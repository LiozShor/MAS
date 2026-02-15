"""
Core game rules: legal actions, outcomes, transitions, payoffs.
"""
from config import STAGE_UTILITY, OUTCOME_PAYOFF


def legal_actions(ammo):
    """Return legal actions for a player with given ammo (0 or 1)."""
    if ammo == 0:
        return ['R', 'B']
    else:
        return ['S', 'B']


def outcome(state, u1, u2):
    """
    Determine the outcome signal given state (a1, a2) and joint action (u1, u2).
    Returns one of: 'Continue', 'P1Win', 'P2Win', 'Tie'.
    """
    a1, a2 = state
    # Both shoot -> Tie (only possible when both armed)
    if u1 == 'S' and u2 == 'S':
        return 'Tie'
    # P1 shoots, P2 doesn't block -> P1 wins
    if u1 == 'S' and u2 != 'B':
        return 'P1Win'
    # P2 shoots, P1 doesn't block -> P2 wins
    if u2 == 'S' and u1 != 'B':
        return 'P2Win'
    # All other cases: continue
    return 'Continue'


def ammo_transition(a, u):
    """
    Deterministic ammo transition: T(a, u).
    Reload -> 1, Shoot -> 0, Block -> unchanged.
    """
    if u == 'R':
        return 1
    if u == 'S':
        return 0
    return a  # Block


def stage_utility(state, u1, u2):
    """
    Look up stage utility G(state, u1, u2) -> (G1, G2).
    """
    return STAGE_UTILITY[state][(u1, u2)]


def outcome_payoff(o):
    """
    Outcome-level payoff U(o) -> (U1, U2).
    """
    return OUTCOME_PAYOFF[o]


def total_reward(state, u1, u2):
    """
    Total immediate reward R^i = G^i + U^i for both players.
    Returns (R1, R2).
    """
    g = stage_utility(state, u1, u2)
    o = outcome(state, u1, u2)
    u = outcome_payoff(o)
    return (g[0] + u[0], g[1] + u[1])


def is_terminal(o):
    """Check if outcome is terminal (game ends)."""
    return o != 'Continue'
