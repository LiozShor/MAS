/**
 * Policy visualization: plot P(Shoot) vs belief p for BOTH players
 * for a SINGLE round (selectable via dropdown).
 *
 * Shows one line per player for the selected round, making it easy
 * to compare how P1 and P2 adapt their aggressiveness to perceived threat.
 *
 * Requires a simulation to be run first (uses lastSimResult).
 */
let policyChart = null;

/* Cached data so the round selector can redraw without re-fetching */
let _cachedPolicy1 = null;
let _cachedPolicy2 = null;
let _cachedNBeliefs = 21;
let _cachedDelta = 0.05;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-policy').addEventListener('click', showPolicy);
    document.getElementById('policy-round').addEventListener('change', () => {
        if (_cachedPolicy1 && _cachedPolicy2) {
            const round = parseInt(document.getElementById('policy-round').value, 10);
            renderPolicyChart(_cachedPolicy1, _cachedPolicy2, _cachedNBeliefs, _cachedDelta, round);
        }
    });
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

        _cachedPolicy1 = lastSimResult.policy1;
        _cachedPolicy2 = lastSimResult.policy2;
        _cachedNBeliefs = lastSimResult.n_beliefs || 21;
        _cachedDelta = lastSimResult.delta || 0.05;
        setStatus('pol-status', 'Using policy from last simulation', 'success');

        const round = parseInt(document.getElementById('policy-round').value, 10);
        renderPolicyChart(_cachedPolicy1, _cachedPolicy2, _cachedNBeliefs, _cachedDelta, round);
    } catch (e) {
        setStatus('pol-status', 'Error: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

/**
 * Extract P(actionKey) for a single round from a policy.
 * Returns an array of length nBeliefs.
 */
function getRoundActionProb(policy, round, ammo, actionKey, nBeliefs) {
    const probs = new Array(nBeliefs).fill(0);
    const tData = policy[String(round)];
    if (!tData) return probs;
    const ammoData = tData[String(ammo)];
    if (!ammoData) return probs;

    for (let pidx = 0; pidx < nBeliefs; pidx++) {
        const actionProbs = ammoData[String(pidx)];
        probs[pidx] = actionProbs ? (actionProbs[actionKey] || 0) : 0;
    }
    return probs;
}

function renderPolicyChart(policy1, policy2, nBeliefs, delta, round) {
    const ctx = document.getElementById('chart-policy').getContext('2d');
    if (policyChart) policyChart.destroy();

    const ammo = round === 1 ? 0 : 1; // Round 1 starts unarmed
    const actionKey = 'S';   // Probability of shooting

    const beliefPoints = Array.from({ length: nBeliefs }, (_, i) => (i * delta).toFixed(2));

    const p1Probs = getRoundActionProb(policy1, round, ammo, actionKey, nBeliefs);
    const p2Probs = getRoundActionProb(policy2, round, ammo, actionKey, nBeliefs);

    const datasets = [
        {
            label: 'Player 1',
            data: p1Probs,
            borderColor: '#6c5ce7',
            backgroundColor: 'rgba(108, 92, 231, 0.08)',
            borderWidth: 3,
            fill: true,
            tension: 0.2,
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
            tension: 0.2,
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
                    text: `Shoot Probability vs Opponent Threat (Round ${round} of 5)`,
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
