"""
Configuration constants for the Gun-Wall Game simulation.
All game parameters, payoff tables, and solver settings.
"""
import numpy as np

# --- Game parameters ---
T = 5                          # finite horizon (rounds)
ACTIONS = ['S', 'B', 'R']     # Shoot, Block, Reload
OUTCOMES = ['Continue', 'P1Win', 'P2Win', 'Tie', 'Draw']

# --- Belief grid ---
DELTA = 0.05
BELIEF_GRID = np.round(np.arange(0, 1 + DELTA / 2, DELTA), 10)
N_BELIEFS = len(BELIEF_GRID)  # 21

# --- Outcome payoffs U^i(o) ---
OUTCOME_PAYOFF = {
    'P1Win': (+10, -10),
    'P2Win': (-10, +10),
    'Tie':   (-5,  -5),
    'Draw':  (-3,  -3),
    'Continue': (0, 0),
}

# Draw penalty for solver V[T+1] initialization
DRAW_PENALTY = 0

# --- Stage utility tables G(state, u1, u2) = (G1, G2) ---
# State = (a1, a2), keys are (u1, u2)
# These values are from the paper's normal-form tables.
STAGE_UTILITY = {
    (0, 0): {
        ('B', 'B'): (0, 0),
        ('B', 'R'): (0, 2),
        ('R', 'B'): (2, 0),
        ('R', 'R'): (2, 2),
    },
    (1, 0): {
        ('S', 'B'): (0, 2),
        ('S', 'R'): (10, 0),
        ('B', 'B'): (0, 0),
        ('B', 'R'): (0, 2),
    },
    (1, 1): {
        ('S', 'S'): (-5, -5),
        ('S', 'B'): (0, 2),
        ('B', 'S'): (2, 0),
        ('B', 'B'): (0, 0),
    },
    (0, 1): {
        ('B', 'S'): (2, 0),
        ('B', 'B'): (0, 0),
        ('R', 'S'): (0, 10),
        ('R', 'B'): (2, 0),
    },
}

# --- Solver parameters ---
IBR_ALPHA = 0.5       # damping factor
IBR_EPSILON = 1e-4    # convergence tolerance
IBR_MAX_ITER = 200    # max IBR iterations
SOFTMAX_BETA = 2.0    # softmax temperature: higher = sharper, lower = smoother

# --- Simulation defaults ---
DEFAULT_N_EPISODES = 500
INITIAL_BELIEF = 0.5  # initial belief p about opponent having ammo
