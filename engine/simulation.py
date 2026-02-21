"""
Monte Carlo episode runner and batch statistics.
"""
import numpy as np
from config import T, INITIAL_BELIEF, DELTA, N_BELIEFS
from engine.game import (outcome, ammo_transition,
                         stage_utility, outcome_payoff, is_terminal)
from engine.belief import propagate_belief


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
            threshold = 1.0  # default: always active
            for p_idx in range(N_BELIEFS):
                probs = policy[t][ammo][p_idx]
                if probs.get(action_key, 0) < 0.5:
                    threshold = p_idx * DELTA
                    break
            thresholds[(t, ammo)] = round(threshold, 2)
    return thresholds


def _sample_action(policy, t, ammo, p, rng):
    """Sample an action from the policy at (t, ammo, belief p)."""
    p_idx = int(round(p / DELTA))
    p_idx = max(0, min(p_idx, N_BELIEFS - 1))

    action_probs = policy[t][ammo][p_idx]
    actions = list(action_probs.keys())
    probs = [action_probs[a] for a in actions]

    # Normalize to handle floating point issues
    total = sum(probs)
    if total > 0:
        probs = [pr / total for pr in probs]
    else:
        probs = [1.0 / len(actions)] * len(actions)

    return rng.choice(actions, p=probs)


def run_episode(policy1, policy2, rng=None):
    """
    Run a single episode of the Gun-Wall Game.

    Returns a dict with:
        'rounds': list of round details
        'outcome': final outcome
        'total_rewards': (R1, R2) cumulative
        'termination_round': which round the game ended (or T+1 if draw)
    """
    if rng is None:
        rng = np.random.default_rng()

    a1, a2 = 0, 0  # both start unarmed
    p1, p2 = INITIAL_BELIEF, INITIAL_BELIEF  # initial beliefs
    total_r1, total_r2 = 0.0, 0.0
    rounds = []
    final_outcome = 'Draw'
    term_round = T + 1

    # Precompute thresholds for decision explanations
    thresholds1 = compute_thresholds(policy1)
    thresholds2 = compute_thresholds(policy2)

    for t in range(1, T + 1):
        # Sample actions
        u1 = str(_sample_action(policy1, t, a1, p1, rng))
        u2 = str(_sample_action(policy2, t, a2, p2, rng))

        state = (a1, a2)
        o = outcome(state, u1, u2)

        # Compute rewards
        g = stage_utility(state, u1, u2)
        u_pay = outcome_payoff(o)
        r1 = g[0] + u_pay[0]
        r2 = g[1] + u_pay[1]
        total_r1 += r1
        total_r2 += r2

        # Look up current action probabilities for decision explanation
        p1_idx = int(round(p1 / DELTA))
        p1_idx = max(0, min(p1_idx, N_BELIEFS - 1))
        p2_idx = int(round(p2 / DELTA))
        p2_idx = max(0, min(p2_idx, N_BELIEFS - 1))

        round_info = {
            'round': t,
            'state': list(state),
            'actions': [u1, u2],
            'outcome': o,
            'rewards': [r1, r2],
            'beliefs_before': [float(p1), float(p2)],
            'ammo_before': list(state),
            'p1_action_probs': dict(policy1[t][a1][p1_idx]),
            'p2_action_probs': dict(policy2[t][a2][p2_idx]),
            'p1_threshold': thresholds1[(t, a1)],
            'p2_threshold': thresholds2[(t, a2)],
        }

        if is_terminal(o):
            round_info['beliefs_after'] = [float(p1), float(p2)]
            round_info['ammo_after'] = list(state)
            rounds.append(round_info)
            final_outcome = o
            term_round = t
            break

        # Ammo transition
        a1_next = ammo_transition(a1, u1)
        a2_next = ammo_transition(a2, u2)

        # Belief updates
        p1_next = propagate_belief(p1, a1, u1, o, policy2, t, player=1)
        p2_next = propagate_belief(p2, a2, u2, o, policy1, t, player=2)

        round_info['beliefs_after'] = [float(p1_next), float(p2_next)]
        round_info['ammo_after'] = [a1_next, a2_next]
        rounds.append(round_info)

        a1, a2 = a1_next, a2_next
        p1, p2 = p1_next, p2_next

    # Apply Draw payoff when game times out
    if final_outcome == 'Draw':
        draw_pay = outcome_payoff('Draw')
        total_r1 += draw_pay[0]
        total_r2 += draw_pay[1]
        if rounds:
            rounds[-1]['outcome'] = 'Draw'

    return {
        'rounds': rounds,
        'outcome': final_outcome,
        'total_rewards': [float(total_r1), float(total_r2)],
        'termination_round': term_round,
    }


def run_batch(policy1, policy2, n_episodes, seed=None):
    """
    Run N episodes and collect aggregate statistics.

    Returns:
        stats: dict with win/loss/tie counts, average rewards, etc.
        episodes: list of episode results (for replay)
    """
    rng = np.random.default_rng(seed)
    episodes = []

    p1_wins = 0
    p2_wins = 0
    ties = 0
    draws = 0
    total_r1 = 0.0
    total_r2 = 0.0
    term_rounds = []

    for _ in range(n_episodes):
        ep = run_episode(policy1, policy2, rng)
        episodes.append(ep)

        if ep['outcome'] == 'P1Win':
            p1_wins += 1
        elif ep['outcome'] == 'P2Win':
            p2_wins += 1
        elif ep['outcome'] == 'Tie':
            ties += 1
        else:
            draws += 1

        total_r1 += ep['total_rewards'][0]
        total_r2 += ep['total_rewards'][1]
        term_rounds.append(ep['termination_round'])

    # Termination distribution
    term_dist = {}
    for r in range(1, T + 2):
        term_dist[r] = term_rounds.count(r)

    stats = {
        'n_episodes': n_episodes,
        'p1_wins': p1_wins,
        'p2_wins': p2_wins,
        'ties': ties,
        'draws': draws,
        'p1_win_rate': p1_wins / n_episodes,
        'p2_win_rate': p2_wins / n_episodes,
        'tie_rate': ties / n_episodes,
        'draw_rate': draws / n_episodes,
        'avg_reward_p1': total_r1 / n_episodes,
        'avg_reward_p2': total_r2 / n_episodes,
        'avg_termination_round': float(np.mean(term_rounds)),
        'termination_distribution': term_dist,
    }

    return stats, episodes
