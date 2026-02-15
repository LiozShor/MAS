"""
IBR (Iterated Best Response) solver with backward induction.
Computes belief-dependent policies for both players via fixed-point iteration.
"""
import numpy as np
from config import (T, BELIEF_GRID, DELTA, N_BELIEFS,
                    IBR_ALPHA, IBR_EPSILON, IBR_MAX_ITER)
from engine.game import (legal_actions, outcome, ammo_transition,
                         stage_utility, outcome_payoff, is_terminal)


def make_uniform_policy():
    """
    Create a uniform random policy for one player.
    Format: policy[t][ammo][p_idx] = {'action': prob, ...}
    t in 1..T, ammo in {0,1}, p_idx in 0..N_BELIEFS-1
    """
    policy = {}
    for t in range(1, T + 1):
        policy[t] = {}
        for ammo in [0, 1]:
            policy[t][ammo] = {}
            actions = legal_actions(ammo)
            uniform_p = 1.0 / len(actions)
            for p_idx in range(N_BELIEFS):
                policy[t][ammo][p_idx] = {a: uniform_p for a in actions}
    return policy


def best_response(player, opp_policy, persona_weights=None):
    """
    Compute the best-response policy for 'player' given opponent's policy,
    using backward induction over the belief grid.

    Parameters:
        player: 1 or 2
        opp_policy: opponent's current policy
        persona_weights: optional (w_win, w_lose, w_tie) multipliers for outcome payoffs

    Returns:
        new_policy: best-response policy for this player
        V: value function V[t][ammo][p_idx]
    """
    if persona_weights is None:
        persona_weights = (1.0, 1.0, 1.0)
    w_win, w_lose, w_tie = persona_weights

    # Value function: V[t][ammo][p_idx]
    # Initialize V[T+1] = 0 for all states
    V = {}
    V[T + 1] = {0: np.zeros(N_BELIEFS), 1: np.zeros(N_BELIEFS)}

    # New policy to fill in
    new_policy = {}

    # Backward induction: t = T down to 1
    for t in range(T, 0, -1):
        new_policy[t] = {}
        V[t] = {0: np.zeros(N_BELIEFS), 1: np.zeros(N_BELIEFS)}

        for own_ammo in [0, 1]:
            new_policy[t][own_ammo] = {}
            my_actions = legal_actions(own_ammo)

            for p_idx in range(N_BELIEFS):
                p = BELIEF_GRID[p_idx]
                q_values = {}

                for u_me in my_actions:
                    q_val = _compute_q(player, own_ammo, u_me, t, p, p_idx,
                                       opp_policy, V[t + 1], persona_weights)
                    q_values[u_me] = q_val

                # Best response: pick action(s) with max Q
                max_q = max(q_values.values())
                V[t][own_ammo][p_idx] = max_q

                # Deterministic best response (break ties uniformly)
                best_actions = [a for a, q in q_values.items() if abs(q - max_q) < 1e-10]
                action_probs = {}
                for a in my_actions:
                    if a in best_actions:
                        action_probs[a] = 1.0 / len(best_actions)
                    else:
                        action_probs[a] = 0.0
                new_policy[t][own_ammo][p_idx] = action_probs

    return new_policy, V


def _compute_q(player, own_ammo, my_action, t, p, p_idx, opp_policy, V_next,
               persona_weights):
    """
    Compute Q^i(my_action | own_ammo, t, p) by summing over opponent's
    possible ammo states and actions.
    """
    w_win, w_lose, w_tie = persona_weights
    q = 0.0

    for opp_ammo in [0, 1]:
        w_opp = p if opp_ammo == 1 else (1 - p)
        if w_opp < 1e-12:
            continue

        opp_legal = legal_actions(opp_ammo)
        opp_probs = opp_policy[t][opp_ammo][p_idx]

        for u_opp in opp_legal:
            prob_opp = opp_probs.get(u_opp, 0.0)
            if prob_opp < 1e-12:
                continue

            # Determine state and joint action from game perspective
            if player == 1:
                state = (own_ammo, opp_ammo)
                u1, u2 = my_action, u_opp
            else:
                state = (opp_ammo, own_ammo)
                u1, u2 = u_opp, my_action

            # Outcome
            o = outcome(state, u1, u2)

            # Stage utility
            g = stage_utility(state, u1, u2)
            g_me = g[0] if player == 1 else g[1]

            # Outcome payoff with persona weights
            from engine.game import outcome_payoff as op_func
            u_pay = op_func(o)
            u_me = u_pay[0] if player == 1 else u_pay[1]

            # Apply persona weights to outcome payoff
            if u_me > 0:  # winning
                u_me *= w_win
            elif o == 'Tie':
                u_me *= w_tie
            elif u_me < 0:  # losing
                u_me *= w_lose

            # Total immediate reward
            r_me = g_me + u_me

            # Future value (only if Continue)
            future = 0.0
            if not is_terminal(o):
                # My next ammo
                my_next_ammo = ammo_transition(own_ammo, my_action)
                # Opponent's next ammo (deterministic given opp action)
                opp_next_ammo = ammo_transition(opp_ammo, u_opp)

                # Next belief: what probability mass goes to opp having ammo?
                # We compute this inline for the solver (no actual observation needed)
                # The belief propagation for the solver uses the opponent's next ammo directly
                # weighted by the probability of this branch
                next_p = _solver_next_belief(p, own_ammo, my_action, opp_ammo, u_opp,
                                             opp_policy, t, player)
                next_p_idx = int(round(next_p / DELTA))
                next_p_idx = max(0, min(next_p_idx, N_BELIEFS - 1))

                future = V_next[my_next_ammo][next_p_idx]

            q += w_opp * prob_opp * (r_me + future)

    return q


def _solver_next_belief(p, own_ammo, my_action, opp_ammo, u_opp,
                         opp_policy, t, player):
    """
    Compute the next belief for the solver during Q-value computation.
    Given that we're in a specific branch (opp_ammo, u_opp), the next
    opponent ammo is deterministic. But the belief update must account
    for what the player would actually believe after observing 'Continue'.

    For simplicity in the solver, we propagate belief by computing:
    - The posterior over opponent states given outcome=Continue
    - Then propagate through transition
    """
    # In the solver's Q computation, we know the exact (opp_ammo, u_opp).
    # But the PLAYER doesn't know this — they only see 'Continue'.
    # The player's belief update depends on all possible (opp_ammo, u_opp) pairs.
    # We need to compute what belief the player would have after seeing Continue,
    # given their prior p and their own action.

    # Compute belief propagation: p_{t+1}
    p_idx = int(round(p / DELTA))
    p_idx = max(0, min(p_idx, N_BELIEFS - 1))

    total_continue_weight = 0.0
    armed_next_weight = 0.0

    for a_hyp in [0, 1]:
        w_a = p if a_hyp == 1 else (1 - p)
        opp_legal = legal_actions(a_hyp)
        opp_probs = opp_policy[t][a_hyp][p_idx]

        for u_o in opp_legal:
            prob_o = opp_probs.get(u_o, 0.0)
            if prob_o < 1e-12:
                continue

            if player == 1:
                state = (own_ammo, a_hyp)
                u1, u2 = my_action, u_o
            else:
                state = (a_hyp, own_ammo)
                u1, u2 = u_o, my_action

            o = outcome(state, u1, u2)
            if o == 'Continue':
                joint_w = w_a * prob_o
                total_continue_weight += joint_w
                if ammo_transition(a_hyp, u_o) == 1:
                    armed_next_weight += joint_w

    if total_continue_weight < 1e-12:
        return p

    return armed_next_weight / total_continue_weight


def ibr_solve(persona1_weights=None, persona2_weights=None):
    """
    Run Iterated Best Response to find equilibrium policies.

    Parameters:
        persona1_weights: (w_win, w_lose, w_tie) for player 1
        persona2_weights: (w_win, w_lose, w_tie) for player 2

    Returns:
        dict with 'policy1', 'policy2', 'iterations', 'converged'
    """
    # Initialize with uniform policies
    pi1 = make_uniform_policy()
    pi2 = make_uniform_policy()

    converged = False
    iterations = 0

    for k in range(IBR_MAX_ITER):
        iterations = k + 1

        # Compute best response for P1 given P2's policy
        br1, _ = best_response(1, pi2, persona1_weights)
        # Compute best response for P2 given P1's new policy
        br2, _ = best_response(2, pi1, persona2_weights)

        # Damped update
        new_pi1 = _damp_policy(pi1, br1, IBR_ALPHA)
        new_pi2 = _damp_policy(pi2, br2, IBR_ALPHA)

        # Check convergence
        diff1 = _policy_diff(pi1, new_pi1)
        diff2 = _policy_diff(pi2, new_pi2)

        pi1 = new_pi1
        pi2 = new_pi2

        if diff1 < IBR_EPSILON and diff2 < IBR_EPSILON:
            converged = True
            break

    return {
        'policy1': pi1,
        'policy2': pi2,
        'iterations': iterations,
        'converged': converged,
    }


def _damp_policy(old_policy, new_policy, alpha):
    """Apply damping: result = (1-alpha)*old + alpha*new."""
    result = {}
    for t in old_policy:
        result[t] = {}
        for ammo in old_policy[t]:
            result[t][ammo] = {}
            for p_idx in old_policy[t][ammo]:
                old_probs = old_policy[t][ammo][p_idx]
                new_probs = new_policy[t][ammo][p_idx]
                damped = {}
                for action in old_probs:
                    damped[action] = (1 - alpha) * old_probs.get(action, 0.0) + \
                                     alpha * new_probs.get(action, 0.0)
                result[t][ammo][p_idx] = damped
    return result


def _policy_diff(p1, p2):
    """Compute max absolute difference between two policies."""
    max_diff = 0.0
    for t in p1:
        for ammo in p1[t]:
            for p_idx in p1[t][ammo]:
                probs1 = p1[t][ammo][p_idx]
                probs2 = p2[t][ammo][p_idx]
                for action in probs1:
                    diff = abs(probs1.get(action, 0.0) - probs2.get(action, 0.0))
                    if diff > max_diff:
                        max_diff = diff
    return max_diff


def policy_to_serializable(policy):
    """Convert policy to JSON-serializable format."""
    result = {}
    for t in policy:
        result[str(t)] = {}
        for ammo in policy[t]:
            result[str(t)][str(ammo)] = {}
            for p_idx in policy[t][ammo]:
                result[str(t)][str(ammo)][str(p_idx)] = policy[t][ammo][p_idx]
    return result
