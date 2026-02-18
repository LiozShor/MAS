"""
Bayesian belief updates under partial observability.
Handles likelihood computation, Bayes update, and belief propagation.
"""
from config import BELIEF_GRID, DELTA
from engine.game import legal_actions, outcome, ammo_transition


def snap_to_grid(p):
    """Snap a belief value to the nearest grid point."""
    idx = int(round(p / DELTA))
    idx = max(0, min(idx, len(BELIEF_GRID) - 1))
    return BELIEF_GRID[idx]


def compute_likelihood(own_ammo, opp_ammo_hyp, my_action, observed_outcome,
                       opp_policy, t, belief_p, player):
    """
    Compute Pr(outcome | a_opp = opp_ammo_hyp, my_action, opp_policy).

    Parameters:
        own_ammo: player's own ammo (known)
        opp_ammo_hyp: hypothesized opponent ammo (0 or 1)
        my_action: action player chose
        observed_outcome: the outcome signal observed
        opp_policy: opponent's policy dict
        t: current round (1-indexed)
        belief_p: current belief (used as parameter for opponent policy)
        player: 1 or 2 (which player we are)
    """
    likelihood = 0.0
    opp_legal = legal_actions(opp_ammo_hyp)

    for u_opp in opp_legal:
        # Get opponent's action probability
        prob = get_opp_action_prob(opp_policy, opp_ammo_hyp, u_opp, t, belief_p)

        # Determine the state and joint action
        if player == 1:
            state = (own_ammo, opp_ammo_hyp)
            u1, u2 = my_action, u_opp
        else:
            state = (opp_ammo_hyp, own_ammo)
            u1, u2 = u_opp, my_action

        # Check if this action pair produces the observed outcome
        o = outcome(state, u1, u2)
        if o == observed_outcome:
            likelihood += prob

    return likelihood


def bayes_update(prior_p, own_ammo, my_action, observed_outcome,
                 opp_policy, t, player):
    """
    Bayesian posterior: P(a_opp=1 | prior, my_action, outcome).
    Returns the posterior probability that opponent has ammo.
    """
    lik_1 = compute_likelihood(own_ammo, 1, my_action, observed_outcome,
                               opp_policy, t, prior_p, player)
    lik_0 = compute_likelihood(own_ammo, 0, my_action, observed_outcome,
                               opp_policy, t, prior_p, player)

    numerator = lik_1 * prior_p
    denominator = lik_1 * prior_p + lik_0 * (1 - prior_p)

    if denominator < 1e-12:
        return prior_p  # no information, keep prior

    return numerator / denominator


def propagate_belief(prior_p, own_ammo, my_action, observed_outcome,
                     opp_policy, t, player):
    """
    Propagate belief to the next round after observing Continue.
    Computes p_{t+1} = P(a_opp_next = 1 | history, my_action, outcome=Continue).

    This involves:
    1. Computing posterior over (a_opp, u_opp) given outcome
    2. Propagating through ammo transition T(a_opp, u_opp)
    """
    if observed_outcome != 'Continue':
        return prior_p  # game ended, no propagation needed

    # Compute joint posterior P(a_opp=a, u_opp=u | outcome)
    # Then check if T(a, u) = 1 (opponent will have ammo next round)
    total_weight = 0.0
    armed_next_weight = 0.0

    for a_opp in [0, 1]:
        w_a = prior_p if a_opp == 1 else (1 - prior_p)
        opp_legal = legal_actions(a_opp)

        for u_opp in opp_legal:
            prob = get_opp_action_prob(opp_policy, a_opp, u_opp, t, prior_p)

            if player == 1:
                state = (own_ammo, a_opp)
                u1, u2 = my_action, u_opp
            else:
                state = (a_opp, own_ammo)
                u1, u2 = u_opp, my_action

            o = outcome(state, u1, u2)
            if o == 'Continue':
                joint_w = w_a * prob
                total_weight += joint_w
                # Check if opponent will have ammo next round
                if ammo_transition(a_opp, u_opp) == 1:
                    armed_next_weight += joint_w

    if total_weight < 1e-12:
        return prior_p

    new_p = armed_next_weight / total_weight
    return snap_to_grid(new_p)


def get_opp_action_prob(opp_policy, opp_ammo, action, t, belief_p):
    """
    Get the probability of opponent choosing 'action' given their ammo,
    the current round, and the belief parameter.

    opp_policy format: dict with keys (t, ammo, p_idx) -> {'S': prob, 'B': prob, ...}
    or structured as policy[t][ammo][p_idx] -> action_probs dict
    """
    p_idx = int(round(belief_p / DELTA))
    p_idx = max(0, min(p_idx, len(BELIEF_GRID) - 1))

    # Policy is stored as policy[t][ammo][p_idx] -> dict of action -> prob
    action_probs = opp_policy[t][opp_ammo][p_idx]
    return action_probs.get(action, 0.0)
