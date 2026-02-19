# Plan: Gun-Wall Game — 4 Fixes

## Summary

Four fixes to the Gun-Wall Game simulation:
1. **Computation Logs** — show IBR iterations 1-2 with Q-values, action probs, and damping
2. **Replay Decision Explanation** — per-turn display of shoot/load thresholds explaining player choices
3. **Outcome Fix** — eliminate "Continue" on last turn (Draw instead), punish mutual blocking
4. **Policy Viz Fix** — use simulation policies, show correct curves matching persona behavior

## Current State (as of latest code)

| Item | Current Value | File |
|------|---------------|------|
| `DELTA` | 0.05 | `config.py:13` |
| `N_BELIEFS` | 21 | `config.py:15` |
| `INITIAL_BELIEF` | 0.5 | `config.py:62` |
| `IBR_ALPHA` | 0.5 (fixed) | `config.py:56` |
| `IBR_MAX_ITER` | 200 | `config.py:58` |
| Solver type | Deterministic BR + damping | `engine/solver.py:78-86` |
| `('B','B')` utility | `(0, 0)` everywhere | `config.py:30,38,45,49` |
| `V[T+1]` init | `np.zeros` | `engine/solver.py:51` |
| Simulation timeout | Already `'Draw'` | `engine/simulation.py:47` |
| `OUTCOME_PAYOFF` | No `'Draw'` entry | `config.py:18-23` |
| Policy viz beliefs | 21 points (matches backend) | `static/js/policy.js:45-46` |
| Policy viz source | Separate `/api/solve` call | `static/js/policy.js:21` |

---

## Execution Order

**Fix 3 first** (Outcome) -> **Fix 4** (Policy Viz) -> **Fix 1** (Logs) -> **Fix 2** (Replay Explanation)

Rationale: Fix 3 changes game mechanics (payoffs + solver init) which affects everything else. Fix 4 ensures correct visualization before adding logs. Fix 1 & 2 build on top.

---

## Fix 3: Outcome Fix — No Continue on Last Turn + Punish Mutual Block

### Goal
- Last round (T=5) produces only Win/Loss/Tie/Draw, never Continue
- Mutual blocking `('B','B')` has a negative stage utility to discourage passive play
- Solver accounts for Draw penalty in backward induction

### Steps

#### 3.1 — `config.py`: Add Draw penalty and change mutual block utility

```python
# Add 'Draw' to OUTCOME_PAYOFF
OUTCOME_PAYOFF = {
    'P1Win': (+10, -10),
    'P2Win': (-10, +10),
    'Tie':   (-5,  -5),
    'Draw':  (-3,  -3),   # NEW: penalty for reaching T without resolution
    'Continue': (0, 0),
}

# Add 'Draw' to OUTCOMES list
OUTCOMES = ['Continue', 'P1Win', 'P2Win', 'Tie', 'Draw']

# Add Draw penalty constant for solver
DRAW_PENALTY = -3  # V[T+1] initialization — incentivizes resolving before timeout
```

Change all `('B','B')` entries from `(0, 0)` to `(-2, -2)`:
- `config.py:30` — state `(0,0)`
- `config.py:38` — state `(1,0)`
- `config.py:45` — state `(1,1)`
- `config.py:49` — state `(0,1)`

#### 3.2 — `engine/solver.py:51`: Initialize V[T+1] with Draw penalty

Change:
```python
V[T + 1] = {0: np.zeros(N_BELIEFS), 1: np.zeros(N_BELIEFS)}
```
To:
```python
from config import DRAW_PENALTY
V[T + 1] = {0: np.full(N_BELIEFS, DRAW_PENALTY), 1: np.full(N_BELIEFS, DRAW_PENALTY)}
```

**Why this works**: At t=T, only Continue outcomes reference V[T+1]. Terminal outcomes (P1Win, P2Win, Tie) skip future value via the `is_terminal(o)` check at line 145. So DRAW_PENALTY only penalizes action-pairs that fail to resolve the game by the final round.

#### 3.3 — `engine/simulation.py`: Apply Draw payoff to rewards

After the for-loop (after line 97), when `final_outcome == 'Draw'`, add the draw payoff to total rewards:

```python
# After the for-loop
if final_outcome == 'Draw':
    draw_pay = outcome_payoff('Draw')
    total_r1 += draw_pay[0]
    total_r2 += draw_pay[1]
```

Also update the last round's outcome from 'Continue' to 'Draw':
```python
if final_outcome == 'Draw' and rounds:
    rounds[-1]['outcome'] = 'Draw'
```

#### 3.4 — `engine/game.py`: Add 'Draw' to is_terminal

```python
def is_terminal(o):
    """Check if outcome is terminal (game ends)."""
    return o not in ('Continue',)
```
(No change needed since 'Draw' != 'Continue', but add it to the `OUTCOMES` list for documentation)

#### 3.5 — Frontend: Style the Draw outcome

- `static/css/style.css`: Add `.outcome-Draw` class (orange-ish color, similar to Tie)
- `static/js/replay.js:98`: Add `else if (rd.outcome === 'Draw') dot.classList.add('draw');` to timeline dot coloring

### Files changed
| File | Lines | Change |
|------|-------|--------|
| `config.py` | 10, 18-23, 30, 38, 45, 49, +new | Add Draw outcome, penalty, change (B,B) |
| `engine/solver.py` | 6, 51 | Import DRAW_PENALTY, init V[T+1] |
| `engine/simulation.py` | 7, 98-103 | Import outcome_payoff, apply Draw payoff |
| `engine/game.py` | — | No change needed (Draw != Continue) |
| `static/js/replay.js` | 98 | Add Draw timeline dot class |
| `static/css/style.css` | +new | Add .outcome-Draw styling |

---

## Fix 4: Policy Viz Fix — Use Simulation Policies + Correct Display

### Goal
- Policy viz uses the same policies computed during simulation (not a separate /api/solve call)
- Graph shows expected shape: P(Shoot) high at low p, decreasing as p increases
- Persona differences visible (aggressive stays high longer)

### Steps

#### 4.1 — `api/routes.py`: Include policies in `/api/simulate` response

Add serialized policies to the simulation response so the frontend can use them:

```python
# In simulate() endpoint, add to response dict:
response['policy1'] = policy_to_serializable(policy1)
response['policy2'] = policy_to_serializable(policy2)
response['n_beliefs'] = N_BELIEFS
response['delta'] = DELTA
```

Also add to `/api/solve` response:
```python
response['n_beliefs'] = N_BELIEFS
response['delta'] = DELTA
```

#### 4.2 — `static/js/simulation.js`: Store policies from simulation

After `lastSimResult = data;`, the policies are already accessible via `lastSimResult.policy1` and `lastSimResult.policy2`.

#### 4.3 — `static/js/policy.js`: Allow using simulation policies

Add a "Use last simulation" button/option that reads policies from `lastSimResult` instead of calling `/api/solve`:

```javascript
async function showPolicy() {
    const persona = document.getElementById('pol-persona').value;
    const player = parseInt(document.getElementById('pol-player').value);
    const ammo = parseInt(document.getElementById('pol-ammo').value);

    let policy, nBeliefs, delta;

    // Prefer using simulation policies if available
    if (lastSimResult && lastSimResult.policy1) {
        const policyKey = player === 1 ? 'policy1' : 'policy2';
        policy = lastSimResult[policyKey];
        nBeliefs = lastSimResult.n_beliefs || 21;
        delta = lastSimResult.delta || 0.05;
        setStatus('pol-status', 'Using policy from last simulation', 'success');
    } else {
        // Fallback: solve independently
        const data = await API.solve(persona, persona);
        policy = data[player === 1 ? 'policy1' : 'policy2'];
        nBeliefs = data.n_beliefs || 21;
        delta = data.delta || 0.05;
    }

    renderPolicyChart(policy, ammo, player, nBeliefs, delta);
}
```

#### 4.4 — `static/js/policy.js`: Dynamic belief grid in chart

Replace hardcoded `nBeliefs = 21` and `i * 0.05` with dynamic values:

```javascript
function renderPolicyChart(policy, ammo, player, nBeliefs, delta) {
    // Dynamic belief grid from API params
    const beliefPoints = Array.from({ length: nBeliefs }, (_, i) => (i * delta).toFixed(2));
    // ... rest of chart rendering uses nBeliefs and beliefPoints
}
```

#### 4.5 — `templates/index.html`: Add "Use from simulation" option in Policy Viz tab

Add a checkbox or note indicating whether the policy is from the last simulation run.

### Files changed
| File | Lines | Change |
|------|-------|--------|
| `api/routes.py` | 52-58, 94-101 | Add policies + grid params to both endpoints |
| `static/js/policy.js` | 10-34, 36-104 | Dynamic beliefs, use simulation policies |
| `templates/index.html` | 102-132 | Add simulation policy note/option |

---

## Fix 1: IBR Computation Logs

### Goal
- Log iterations 1-2 of IBR showing: initial policy -> Q-values -> best response -> damped result
- For a representative set of (t, ammo, p) states
- Display in a collapsible panel on the Simulation tab

### Representative states to log (6 states):
| State | Description |
|-------|-------------|
| `(t=1, ammo=0, p=0.50)` | Start of game, unarmed, uncertain |
| `(t=1, ammo=1, p=0.25)` | Round 1, armed, low belief opponent armed |
| `(t=1, ammo=1, p=0.75)` | Round 1, armed, high belief opponent armed |
| `(t=3, ammo=0, p=0.50)` | Mid-game, unarmed, uncertain |
| `(t=3, ammo=1, p=0.50)` | Mid-game, armed, uncertain |
| `(t=5, ammo=1, p=0.75)` | Last round, armed, high pressure |

### Steps

#### 1.1 — `engine/solver.py`: Add logging infrastructure to `ibr_solve()`

Add a `log_iterations` parameter (default=2) and capture data for the first N iterations:

```python
def ibr_solve(persona1_weights=None, persona2_weights=None, log_iterations=2):
    ...
    computation_log = []
    LOG_STATES = [
        (1, 0, 10),  # t=1, ammo=0, p_idx=10 (p=0.50)
        (1, 1, 5),   # t=1, ammo=1, p_idx=5  (p=0.25)
        (1, 1, 15),  # t=1, ammo=1, p_idx=15 (p=0.75)
        (3, 0, 10),  # t=3, ammo=0, p_idx=10 (p=0.50)
        (3, 1, 10),  # t=3, ammo=1, p_idx=10 (p=0.50)
        (5, 1, 15),  # t=5, ammo=1, p_idx=15 (p=0.75)
    ]
```

For iterations k < log_iterations:
1. Before damping: capture the BR policy at LOG_STATES (what the pure best response says)
2. After damping: capture the damped policy at LOG_STATES (what we actually use)
3. Store Q-values from `best_response()` at LOG_STATES

#### 1.2 — `engine/solver.py`: Modify `best_response()` to optionally return Q-values

Add an optional `log_collector` dict parameter. When provided, store Q-values at specific (t, ammo, p_idx) states:

```python
def best_response(player, opp_policy, persona_weights=None, log_collector=None):
    ...
    # Inside the p_idx loop, after computing q_values:
    if log_collector is not None:
        key = (t, own_ammo, p_idx)
        if key in log_collector['target_states']:
            log_collector['entries'].append({
                't': t, 'ammo': own_ammo, 'p': float(BELIEF_GRID[p_idx]),
                'q_values': dict(q_values),
                'action_probs': dict(action_probs),
            })
```

#### 1.3 — `engine/solver.py`: Build log entries in `ibr_solve()`

For each logged iteration, build an entry like:
```python
{
    'iteration': k,
    'player': 1,  # or 2
    'states': [
        {
            't': 1, 'ammo': 0, 'belief': 0.50,
            'q_values': {'R': 3.2, 'B': 1.1},
            'br_probs': {'R': 1.0, 'B': 0.0},      # pure best response
            'damped_probs': {'R': 0.75, 'B': 0.25},  # after damping
        },
        ...
    ]
}
```

Include result in return:
```python
return {
    'policy1': pi1,
    'policy2': pi2,
    'iterations': iterations,
    'converged': converged,
    'computation_log': computation_log,
}
```

#### 1.4 — `api/routes.py`: Include computation_log in responses

Add `computation_log` to `/api/solve` and `/api/simulate` responses.

#### 1.5 — Frontend: Computation Log panel

New file `static/js/computation-log.js`:
- Render log as a collapsible panel in the Simulation tab
- Show a formatted table per iteration per player:

```
IBR Iteration 1 — Player 1
| Round | Ammo | Belief | Q(S) | Q(B) | Q(R) | BR   | Damped     |
|-------|------|--------|------|------|------|------|------------|
| 1     | 0    | 0.50   | -    | 1.1  | 3.2  | R:1  | R:.75 B:.25|
| 1     | 1    | 0.25   | 5.1  | 2.3  | -    | S:1  | S:.75 B:.25|
...
```

Each row explains: "Q(Shoot)=5.1 > Q(Block)=2.3, so BR picks Shoot. After damping with alpha=0.5: P(S)=0.75, P(B)=0.25"

#### 1.6 — `templates/index.html`: Add log panel container

Add after `#sim-stats-table`:
```html
<div id="computation-log-panel" class="log-panel" style="display:none">
    <h3 class="log-toggle">Computation Log (IBR iterations 1-2)</h3>
    <div id="computation-log-content"></div>
</div>
```

### Files changed
| File | Lines | Change |
|------|-------|--------|
| `engine/solver.py` | 30-88, 220-266 | Add log_collector to best_response, logging in ibr_solve |
| `api/routes.py` | 52-59, 94-103 | Include computation_log in responses |
| `static/js/computation-log.js` | new file | Render log table |
| `templates/index.html` | +new section | Log panel container + script include |

---

## Fix 2: Game Replay Decision Explanation

### Goal
- Per turn in replay, show each player's action probabilities at their current belief
- Show the decision threshold: "Shoot if p < 0.65" or "Reload if p < 0.40"
- Textual explanation: "P1: P(Shoot)=0.72, belief=0.49. Threshold=0.65 -> Shoot (belief below threshold)"

### Steps

#### 2.1 — `engine/simulation.py`: Add action probs + thresholds to round data

Add a helper to precompute thresholds:
```python
def compute_thresholds(policy):
    """
    For each (t, ammo), find the belief p where the 'active' action
    (Shoot for ammo=1, Reload for ammo=0) drops below 0.5.
    Returns dict: {(t, ammo): threshold_p}
    """
    thresholds = {}
    for t in range(1, T + 1):
        for ammo in [0, 1]:
            action_key = 'S' if ammo == 1 else 'R'
            threshold = 1.0  # default: always above 0.5
            for p_idx in range(N_BELIEFS):
                probs = policy[t][ammo][p_idx]
                if probs.get(action_key, 0) < 0.5:
                    threshold = p_idx * DELTA
                    break
            thresholds[(t, ammo)] = round(threshold, 2)
    return thresholds
```

In `run_episode()`, before the for-loop, precompute thresholds:
```python
thresholds1 = compute_thresholds(policy1)
thresholds2 = compute_thresholds(policy2)
```

In each round_info, add:
```python
# Look up current action probabilities
p1_idx = int(round(p1 / DELTA))
p1_idx = max(0, min(p1_idx, N_BELIEFS - 1))
p2_idx = int(round(p2 / DELTA))
p2_idx = max(0, min(p2_idx, N_BELIEFS - 1))

round_info['p1_action_probs'] = dict(policy1[t][a1][p1_idx])
round_info['p2_action_probs'] = dict(policy2[t][a2][p2_idx])
round_info['p1_threshold'] = thresholds1[(t, a1)]
round_info['p2_threshold'] = thresholds2[(t, a2)]
```

#### 2.2 — `static/js/replay.js`: Render decision explanation

In `renderReplay()`, after the existing round-card, add a decision explanation section:

```javascript
// Build decision explanation for each player
function buildExplanation(playerNum, actionProbs, belief, threshold, ammo, action) {
    const activeAction = ammo === 1 ? 'S' : 'R';
    const activeName = ammo === 1 ? 'Shoot' : 'Reload';
    const activeProb = (actionProbs[activeAction] || 0);
    const blockProb = (actionProbs['B'] || 0);

    let rule = `${activeName} if p < ${threshold.toFixed(2)}`;
    let reasoning;
    if (ammo === 0 && action === 'B') {
        reasoning = `Belief=${belief.toFixed(3)}, P(Reload)=${activeProb.toFixed(2)} -> chose Block (defensive)`;
    } else if (ammo === 0) {
        reasoning = `Belief=${belief.toFixed(3)}, P(Reload)=${activeProb.toFixed(2)} -> chose Reload`;
    } else if (action === 'S') {
        reasoning = `Belief=${belief.toFixed(3)} < ${threshold.toFixed(2)} -> Shoot (below threshold)`;
    } else {
        reasoning = `Belief=${belief.toFixed(3)} >= ${threshold.toFixed(2)} -> Block (above threshold)`;
    }

    return `<div class="explanation-row">
        <span class="label">P${playerNum} Decision</span>
        <span><strong>${rule}</strong> | ${reasoning}</span>
    </div>`;
}
```

Add to the round card HTML:
```html
<div class="decision-explanation">
    ${buildExplanation(1, r.p1_action_probs, r.beliefs_before[0], r.p1_threshold, r.ammo_before[0], r.actions[0])}
    ${buildExplanation(2, r.p2_action_probs, r.beliefs_before[1], r.p2_threshold, r.ammo_before[1], r.actions[1])}
</div>
```

#### 2.3 — `static/css/style.css`: Style the explanation section

Add styles for `.decision-explanation` and `.explanation-row` (monospace font, muted colors, indented).

#### 2.4 — `templates/index.html`: No changes needed

The explanation renders inside the existing `#replay-round-detail` div.

### Files changed
| File | Lines | Change |
|------|-------|--------|
| `engine/simulation.py` | 30-97 | Add compute_thresholds, enrich round_info |
| `static/js/replay.js` | 37-83 | Add decision explanation rendering |
| `static/css/style.css` | +new | Style .decision-explanation |

---

## Proposed Values (tunable)

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| `('B','B')` stage utility | `(0, 0)` | `(-2, -2)` | Discourages passive play in all states |
| `DRAW_PENALTY` / V[T+1] | `0` | `-3` | Strong incentive to resolve before timeout |
| `'Draw'` outcome payoff | N/A | `(-3, -3)` | Penalty applied in simulation for timeouts |

---

## Risk Areas

1. **Changing `('B','B')` utility** shifts equilibrium globally — needs re-testing of all persona matchups
2. **DRAW_PENALTY in V[T+1]** changes backward induction values at all rounds (propagates backwards) — verify policies still make strategic sense
3. **Adding data to round_info** increases response payload size — mitigated by only sending action_probs (small dicts)
4. **Computation log** increases solver runtime for logged iterations — mitigated by only logging 2 iterations for 6 states

## Validation

- [ ] `python -m pytest` (if tests exist) or manual testing
- [ ] Run simulation: Draw rate should decrease significantly with new penalties
- [ ] Policy viz: P(Shoot) curves should start high at p=0, decrease as p increases
- [ ] Policy viz: Aggressive persona curve should stay high longer than cautious
- [ ] Replay: Each round shows action probs and threshold explanation
- [ ] Computation log: Shows clear progression from uniform -> BR -> damped for 2 iterations
- [ ] `flake8` passes
