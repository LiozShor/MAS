/**
 * Simulation tab: run episodes, display outcome bars, score stats, termination distribution.
 */
let simChartOutcomes = null;
let simChartScores = null;
let simChartTerm = null;
let lastSimResult = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-simulate').addEventListener('click', runSimulation);
});

async function runSimulation() {
    const p1 = document.getElementById('sim-p1').value;
    const p2 = document.getElementById('sim-p2').value;
    const n = parseInt(document.getElementById('sim-n').value) || 500;
    const btn = document.getElementById('btn-simulate');

    btn.disabled = true;
    setStatus('sim-status', 'Solving + simulating... (this may take a moment)', 'loading');

    try {
        const data = await API.simulate(p1, p2, n);
        lastSimResult = data;
        setStatus('sim-status',
            `Done — ${data.stats.n_episodes} episodes, solver: ${data.solver_iterations} IBR iters (converged: ${data.solver_converged})`,
            'success');
        renderOutcomeChart(data.stats);
        renderScoreChart(data.stats);
        renderTermChart(data.stats);
        renderStatsTable(data.stats);
        if (typeof renderComputationLog === 'function') {
            renderComputationLog(data.computation_log);
        }
        populateReplayDropdown(data.episodes);
    } catch (e) {
        setStatus('sim-status', 'Error: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

function renderOutcomeChart(stats) {
    const ctx = document.getElementById('chart-outcomes').getContext('2d');
    if (simChartOutcomes) simChartOutcomes.destroy();

    simChartOutcomes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['P1 Wins', 'P2 Wins', 'Ties', 'Draws'],
            datasets: [{
                data: [stats.p1_wins, stats.p2_wins, stats.ties, stats.draws],
                backgroundColor: ['#00b894', '#e17055', '#fdcb6e', '#636e72'],
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#2e3348' }, ticks: { color: '#8b90a5' } },
                x: { grid: { display: false }, ticks: { color: '#8b90a5' } }
            }
        }
    });
}

function renderScoreChart(stats) {
    const ctx = document.getElementById('chart-scores').getContext('2d');
    if (simChartScores) simChartScores.destroy();

    simChartScores = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Player 1', 'Player 2'],
            datasets: [{
                label: 'Avg Total Reward',
                data: [stats.avg_reward_p1.toFixed(2), stats.avg_reward_p2.toFixed(2)],
                backgroundColor: ['#6c5ce7', '#a29bfe'],
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#2e3348' }, ticks: { color: '#8b90a5' } },
                x: { grid: { display: false }, ticks: { color: '#8b90a5' } }
            }
        }
    });
}

function renderTermChart(stats) {
    const ctx = document.getElementById('chart-termination').getContext('2d');
    if (simChartTerm) simChartTerm.destroy();

    const dist = stats.termination_distribution;
    const labels = Object.keys(dist).map(r => r <= 5 ? `Round ${r}` : 'Draw');
    const values = Object.values(dist);

    simChartTerm = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: '#74b9ff',
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#2e3348' }, ticks: { color: '#8b90a5' } },
                x: { grid: { display: false }, ticks: { color: '#8b90a5' } }
            }
        }
    });
}

function renderStatsTable(stats) {
    const el = document.getElementById('sim-stats-table');
    el.innerHTML = `
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>P1 Win Rate</td><td>${(stats.p1_win_rate * 100).toFixed(1)}%</td></tr>
            <tr><td>P2 Win Rate</td><td>${(stats.p2_win_rate * 100).toFixed(1)}%</td></tr>
            <tr><td>Tie Rate</td><td>${(stats.tie_rate * 100).toFixed(1)}%</td></tr>
            <tr><td>Draw Rate (no terminal by T=5)</td><td>${(stats.draw_rate * 100).toFixed(1)}%</td></tr>
            <tr><td>Avg Reward P1</td><td>${stats.avg_reward_p1.toFixed(2)}</td></tr>
            <tr><td>Avg Reward P2</td><td>${stats.avg_reward_p2.toFixed(2)}</td></tr>
            <tr><td>Avg Termination Round</td><td>${stats.avg_termination_round.toFixed(2)}</td></tr>
        </table>
    `;
}

function populateReplayDropdown(episodes) {
    const sel = document.getElementById('replay-ep');
    sel.innerHTML = '';
    episodes.forEach((ep, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Episode ${i + 1} — ${ep.outcome} (${ep.rounds.length} rounds)`;
        sel.appendChild(opt);
    });
}
