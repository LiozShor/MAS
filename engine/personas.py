"""
Persona definitions: cautious, aggressive, balanced.
Each persona modifies outcome payoff weights, which changes equilibrium behavior.
"""

PERSONAS = {
    'balanced': {
        'name': 'Balanced',
        'description': 'Default payoff weights — no bias toward aggression or caution.',
        'weights': (1.0, 1.0, 1.0),  # (w_win, w_lose, w_tie)
    },
    'aggressive': {
        'name': 'Aggressive',
        'description': 'Higher reward for winning, lower penalty for losing — risk-seeking.',
        'weights': (1.6, 0.75, 0.85), 
    },
    'cautious': {
        'name': 'Cautious',
        'description': 'Higher penalty for losing, lower reward for winning — risk-averse.',
        'weights': (0.65, 1.50, 1.20),  
    }

}

def get_persona(name):
    """Get persona definition by name."""
    return PERSONAS.get(name)


def get_persona_weights(name):
    """Get (w_win, w_lose, w_tie) for a persona."""
    persona = PERSONAS.get(name)
    if persona is None:
        return (1.0, 1.0, 1.0)
    return persona['weights']


def list_personas():
    """Return list of persona info dicts."""
    return [
        {'id': k, 'name': v['name'], 'description': v['description']}
        for k, v in PERSONAS.items()
    ]
