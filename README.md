# Gun-Wall Game — Simulation Dashboard

**MAS Course Final Project**: Strategic Adaptation in the Gun-Wall Game under Partial Observability

## Quick Start

```bash
# 1. Install dependencies
pip install flask numpy

# 2. Run the server
python app.py

# 3. Open in browser
# http://localhost:5000
```

## Project Structure

```
project/
├── app.py                 # Flask entry point
├── config.py              # Game constants, payoff tables, solver params
├── engine/
│   ├── game.py            # Core rules: legal_actions, outcome, transitions
│   ├── belief.py          # Bayesian belief updates
│   ├── solver.py          # IBR solver with backward induction
│   ├── simulation.py      # Monte Carlo episode runner
│   └── personas.py        # Persona definitions (cautious/aggressive/balanced)
├── api/
│   └── routes.py          # REST API: /api/solve, /api/simulate, /api/personas
├── static/                # CSS + JS for the dashboard
└── templates/
    └── index.html         # Single-page dashboard (3 tabs)
```

## Dashboard Tabs

1. **Simulation** — Pick P1/P2 personas, run N episodes, view outcome distributions
2. **Game Replay** — Step through a single episode round-by-round with belief evolution
3. **Policy Viz** — Plot action probabilities vs belief *p* for each round

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/personas` | List available personas |
| POST | `/api/solve` | Run IBR solver for a persona pair |
| POST | `/api/simulate` | Run N episodes, return stats + episodes |

## Team

| Name | Role |
|------|------|
| Tom Badash | Theory Lead |
| Rom Sheynis | Development Lead |
| Lioz Shor | Analysis and Research Lead |
