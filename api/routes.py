"""
Flask blueprint with API endpoints: /api/solve, /api/simulate, /api/personas.
"""
from flask import Blueprint, request, jsonify
from engine.personas import list_personas, get_persona_weights
from engine.solver import ibr_solve, policy_to_serializable
from engine.simulation import run_batch

api_bp = Blueprint('api', __name__, url_prefix='/api')

# In-memory cache: keyed by (persona1, persona2) -> solver result
_cache = {}
# Store episodes for replay
_last_episodes = {}


@api_bp.route('/personas', methods=['GET'])
def get_personas():
    """List available personas."""
    return jsonify(list_personas())


@api_bp.route('/solve', methods=['POST'])
def solve():
    """
    Run IBR solver for a persona pair.
    Body: { "persona1": "balanced", "persona2": "aggressive" }
    Returns: policies + solver metadata.
    """
    data = request.get_json(force=True)
    p1_name = data.get('persona1', 'balanced')
    p2_name = data.get('persona2', 'balanced')

    cache_key = (p1_name, p2_name)
    if cache_key in _cache:
        cached = _cache[cache_key]
        return jsonify({
            'status': 'ok',
            'cached': True,
            'iterations': cached['iterations'],
            'converged': cached['converged'],
            'policy1': policy_to_serializable(cached['policy1']),
            'policy2': policy_to_serializable(cached['policy2']),
        })

    w1 = get_persona_weights(p1_name)
    w2 = get_persona_weights(p2_name)

    result = ibr_solve(persona1_weights=w1, persona2_weights=w2)
    _cache[cache_key] = result

    return jsonify({
        'status': 'ok',
        'cached': False,
        'iterations': result['iterations'],
        'converged': result['converged'],
        'policy1': policy_to_serializable(result['policy1']),
        'policy2': policy_to_serializable(result['policy2']),
    })


@api_bp.route('/simulate', methods=['POST'])
def simulate():
    """
    Run N episodes for a persona pair.
    Body: { "persona1": "balanced", "persona2": "balanced", "n_episodes": 500 }
    Returns: aggregate stats + episode list for replay.
    """
    data = request.get_json(force=True)
    p1_name = data.get('persona1', 'balanced')
    p2_name = data.get('persona2', 'balanced')
    n_episodes = data.get('n_episodes', 500)
    n_episodes = max(1, min(n_episodes, 10000))

    cache_key = (p1_name, p2_name)

    # Solve if not cached
    if cache_key not in _cache:
        w1 = get_persona_weights(p1_name)
        w2 = get_persona_weights(p2_name)
        result = ibr_solve(persona1_weights=w1, persona2_weights=w2)
        _cache[cache_key] = result

    solver_result = _cache[cache_key]
    policy1 = solver_result['policy1']
    policy2 = solver_result['policy2']

    stats, episodes = run_batch(policy1, policy2, n_episodes)

    # Store episodes for replay
    _last_episodes[cache_key] = episodes

    return jsonify({
        'status': 'ok',
        'solver_iterations': solver_result['iterations'],
        'solver_converged': solver_result['converged'],
        'stats': stats,
        'episodes': episodes,
    })
