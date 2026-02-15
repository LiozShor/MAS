/**
 * Policy visualization: plot action probabilities vs belief p for each round.
 */
let policyChart = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-policy').addEventListener('click', showPolicy);
});

async function showPolicy() {
    const persona = document.getElementById('pol-persona').value;
    const player = parseInt(document.getElementById('pol-player').value);
    const ammo = parseInt(document.getElementById('pol-ammo').value);
    const btn = document.getElementById('btn-policy');

    btn.disabled = true;
    setStatus('pol-status', 'Solving...', 'loading');

    try {
        // Solve balanced vs selected persona (or persona vs persona for symmetry)
        const data = await API.solve(persona, persona);
        const policyKey = player === 1 ? 'policy1' : 'policy2';
        const policy = data[policyKey];

        renderPolicyChart(policy, ammo, player);
        setStatus('pol-status',
            `Solved: ${data.iterations} IBR iters, converged: ${data.converged}`,
            'success');
    } catch (e) {
        setStatus('pol-status', 'Error: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

function renderPolicyChart(policy, ammo, player) {
    const ctx = document.getElementById('chart-policy').getContext('2d');
    if (policyChart) policyChart.destroy();

    // Build datasets: one line per round, showing the "active" action probability
    // For ammo=1: plot P(Shoot) vs p
    // For ammo=0: plot P(Reload) vs p
    const actionKey = ammo === 1 ? 'S' : 'R';
    const actionName = ammo === 1 ? 'Shoot' : 'Reload';
    const nBeliefs = 21;
    const beliefPoints = Array.from({ length: nBeliefs }, (_, i) => (i * 0.05).toFixed(2));

    const colors = ['#e17055', '#fdcb6e', '#00b894', '#74b9ff', '#6c5ce7'];
    const datasets = [];

    for (let t = 1; t <= 5; t++) {
        const tData = policy[String(t)];
        if (!tData) continue;
        const ammoData = tData[String(ammo)];
        if (!ammoData) continue;

        const probs = [];
        for (let pidx = 0; pidx < nBeliefs; pidx++) {
            const actionProbs = ammoData[String(pidx)];
            probs.push(actionProbs ? (actionProbs[actionKey] || 0) : 0);
        }

        datasets.push({
            label: `Round ${t}`,
            data: probs,
            borderColor: colors[t - 1],
            backgroundColor: 'transparent',
            tension: 0.3,
            pointRadius: 2,
        });
    }

    policyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: beliefPoints,
            datasets: datasets,
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    min: 0, max: 1,
                    title: { display: true, text: `P(${actionName})`, color: '#8b90a5' },
                    grid: { color: '#2e3348' },
                    ticks: { color: '#8b90a5' },
                },
                x: {
                    title: { display: true, text: 'Belief p (opponent has ammo)', color: '#8b90a5' },
                    grid: { color: '#2e3348' },
                    ticks: { color: '#8b90a5', maxTicksLimit: 11 },
                }
            },
            plugins: {
                legend: { labels: { color: '#e1e4ec' } },
                title: {
                    display: true,
                    text: `P${player} ${actionName} probability — ammo=${ammo}`,
                    color: '#e1e4ec',
                }
            }
        }
    });
}
