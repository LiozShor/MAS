/**
 * Policy visualization: plot average P(Shoot) vs belief p for BOTH players.
 * Shows one line per player (averaged across all 5 rounds), making it easy
 * to compare how P1 and P2 adapt their aggressiveness to perceived threat.
 *
 * Prefers policies from the last simulation run; falls back to /api/solve.
 */
let policyChart = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-policy').addEventListener('click', showPolicy);
});

async function showPolicy() {
    const btn = document.getElementById('btn-policy');

    btn.disabled = true;
    setStatus('pol-status', 'Loading policy...', 'loading');

    try {
        // Require a simulation to have been run
        if (typeof lastSimResult === 'undefined' || !lastSimResult || !lastSimResult.policy1) {
            setStatus('pol-status', 'Please run a simulation first (Simulation tab)', 'error');
            return;
        }

        const policy1 = lastSimResult.policy1;
        const policy2 = lastSimResult.policy2;
        const nBeliefs = lastSimResult.n_beliefs || 21;
        const delta = lastSimResult.delta || 0.05;
        setStatus('pol-status', 'Using policy from last simulation', 'success');

        renderPolicyChart(policy1, policy2, nBeliefs, delta);
    } catch (e) {
        setStatus('pol-status', 'Error: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

/**
 * Compute the average P(actionKey) across all rounds for a given policy and ammo state.
 * Returns an array of length nBeliefs with the averaged probabilities.
 */
function averageActionProb(policy, ammo, actionKey, nBeliefs) {
    const avgProbs = new Array(nBeliefs).fill(0);
    let roundCount = 0;

    for (let t = 1; t <= 5; t++) {
        const tData = policy[String(t)];
        if (!tData) continue;
        const ammoData = tData[String(ammo)];
        if (!ammoData) continue;
        roundCount++;

        for (let pidx = 0; pidx < nBeliefs; pidx++) {
            const actionProbs = ammoData[String(pidx)];
            avgProbs[pidx] += actionProbs ? (actionProbs[actionKey] || 0) : 0;
        }
    }

    if (roundCount > 0) {
        for (let i = 0; i < nBeliefs; i++) {
            avgProbs[i] /= roundCount;
        }
    }

    return avgProbs;
}

function renderPolicyChart(policy1, policy2, nBeliefs, delta) {
    const ctx = document.getElementById('chart-policy').getContext('2d');
    if (policyChart) policyChart.destroy();

    const ammo = 1;          // Always show armed case (Shoot vs Block)
    const actionKey = 'S';   // Track probability of shooting

    const beliefPoints = Array.from({ length: nBeliefs }, (_, i) => (i * delta).toFixed(2));

    const p1Probs = averageActionProb(policy1, ammo, actionKey, nBeliefs);
    const p2Probs = averageActionProb(policy2, ammo, actionKey, nBeliefs);

    const datasets = [
        {
            label: 'Player 1',
            data: p1Probs,
            borderColor: '#6c5ce7',
            backgroundColor: 'rgba(108, 92, 231, 0.08)',
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#6c5ce7',
        },
        {
            label: 'Player 2',
            data: p2Probs,
            borderColor: '#00b894',
            backgroundColor: 'rgba(0, 184, 148, 0.08)',
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#00b894',
        },
    ];

    policyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: beliefPoints,
            datasets: datasets,
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    min: 0, max: 1,
                    title: {
                        display: true,
                        text: 'P(Shoot)  —  Probability of Shooting',
                        color: '#8b90a5',
                        font: { size: 13 },
                    },
                    grid: { color: '#2e3348' },
                    ticks: { color: '#8b90a5' },
                },
                x: {
                    title: {
                        display: true,
                        text: 'Belief p  —  "How likely is my opponent armed?"',
                        color: '#8b90a5',
                        font: { size: 13 },
                    },
                    grid: { color: '#2e3348' },
                    ticks: { color: '#8b90a5', maxTicksLimit: 11 },
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e1e4ec',
                        font: { size: 13 },
                        usePointStyle: true,
                        pointStyle: 'circle',
                    },
                },
                title: {
                    display: true,
                    text: 'Shoot Probability vs Opponent Threat (averaged across rounds)',
                    color: '#e1e4ec',
                    font: { size: 15 },
                    padding: { bottom: 16 },
                },
                tooltip: {
                    callbacks: {
                        title: (items) => `Belief p = ${items[0].label}`,
                        label: (item) => `${item.dataset.label}: ${(item.parsed.y * 100).toFixed(1)}% chance to shoot`,
                    }
                }
            }
        }
    });
}
