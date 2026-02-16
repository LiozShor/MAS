/**
 * Experiment tab: run full persona matchup matrix, render heatmap + charts, export CSV.
 */
(() => {
    let expResults = {};        // "balanced:aggressive" → stats object
    let expSelectedMatchups = new Set();
    let expPersonas = [];
    let expRunning = false;

    // Chart instances for cleanup
    let rewardsChart = null;
    let termChart = null;

    // ── Initialization ──

    window.initExperimentMatrix = function (personas) {
        expPersonas = personas;
        buildMatrixGrid(personas);
        bindEvents();
    };

    function buildMatrixGrid(personas) {
        const grid = document.getElementById('exp-matrix-grid');
        const table = document.createElement('table');

        // Header row: empty corner + P2 persona names
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const corner = document.createElement('th');
        corner.classList.add('corner-label');
        corner.innerHTML = 'P1 &#8595; &nbsp; P2 &#8594;';
        headerRow.appendChild(corner);
        personas.forEach(p => {
            const th = document.createElement('th');
            th.classList.add('col-header');
            th.textContent = p.name;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body rows: P1 label + checkboxes
        const tbody = document.createElement('tbody');
        personas.forEach(p1 => {
            const row = document.createElement('tr');
            const rowHeader = document.createElement('th');
            rowHeader.classList.add('row-header');
            rowHeader.textContent = p1.name;
            row.appendChild(rowHeader);

            personas.forEach(p2 => {
                const td = document.createElement('td');
                const label = document.createElement('label');
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = true;
                cb.dataset.p1 = p1.id;
                cb.dataset.p2 = p2.id;
                const key = `${p1.id}:${p2.id}`;
                expSelectedMatchups.add(key);

                cb.addEventListener('change', () => {
                    if (cb.checked) {
                        expSelectedMatchups.add(key);
                    } else {
                        expSelectedMatchups.delete(key);
                    }
                });

                label.appendChild(cb);
                td.appendChild(label);
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        grid.innerHTML = '';
        grid.appendChild(table);
    }

    function bindEvents() {
        document.getElementById('btn-run-experiment').addEventListener('click', runExperiment);
        document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

        document.getElementById('btn-select-all').addEventListener('click', () => {
            document.querySelectorAll('#exp-matrix-grid input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
                expSelectedMatchups.add(`${cb.dataset.p1}:${cb.dataset.p2}`);
            });
        });

        document.getElementById('btn-deselect-all').addEventListener('click', () => {
            document.querySelectorAll('#exp-matrix-grid input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            expSelectedMatchups.clear();
        });
    }

    // ── Run Experiment ──

    async function runExperiment() {
        if (expRunning) return;
        const matchups = Array.from(expSelectedMatchups);
        if (matchups.length === 0) return;

        expRunning = true;
        expResults = {};
        const btn = document.getElementById('btn-run-experiment');
        const csvBtn = document.getElementById('btn-export-csv');
        btn.disabled = true;
        csvBtn.disabled = true;
        document.getElementById('exp-results').style.display = 'none';

        const progressEl = document.getElementById('exp-progress');
        const progressLabel = document.getElementById('exp-progress-label');
        const progressFill = document.getElementById('exp-progress-fill');
        progressEl.style.display = 'block';

        const nEpisodes = parseInt(document.getElementById('exp-n').value) || 500;

        for (let i = 0; i < matchups.length; i++) {
            const [p1, p2] = matchups[i].split(':');
            const p1Name = nameForId(p1);
            const p2Name = nameForId(p2);

            progressLabel.textContent = `Running ${i + 1}/${matchups.length}: ${p1Name} vs ${p2Name}...`;
            progressFill.style.width = `${((i) / matchups.length) * 100}%`;

            // Yield to UI before fetch
            await sleep(10);

            try {
                const result = await API.simulateStatsOnly(p1, p2, nEpisodes);
                expResults[matchups[i]] = result.stats;
            } catch (err) {
                console.error(`Failed ${p1} vs ${p2}:`, err);
                expResults[matchups[i]] = null;
            }
        }

        progressLabel.textContent = `Completed ${matchups.length} matchups.`;
        progressLabel.style.color = 'var(--green)';
        progressFill.style.width = '100%';

        renderResults();
        document.getElementById('exp-results').style.display = 'block';
        csvBtn.disabled = false;
        btn.disabled = false;
        expRunning = false;

        // Reset progress color for next run
        setTimeout(() => {
            progressLabel.style.color = '';
        }, 3000);
    }

    // ── Render All Results ──

    function renderResults() {
        renderHeatmap();
        renderRewardsChart();
        renderExpTermChart();
        renderSummaryTable();
    }

    // ── Heatmap ──

    function renderHeatmap() {
        const container = document.getElementById('exp-heatmap');
        const table = document.createElement('table');

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const corner = document.createElement('th');
        corner.innerHTML = '<span class="corner-label">P1 &#8595; P2 &#8594;</span>';
        headerRow.appendChild(corner);
        expPersonas.forEach(p => {
            const th = document.createElement('th');
            th.textContent = p.name;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        expPersonas.forEach(p1 => {
            const row = document.createElement('tr');
            const rowHeader = document.createElement('th');
            rowHeader.textContent = p1.name;
            row.appendChild(rowHeader);

            expPersonas.forEach(p2 => {
                const td = document.createElement('td');
                const key = `${p1.id}:${p2.id}`;
                const stats = expResults[key];

                if (stats) {
                    const p1WinRate = stats.p1_win_rate;
                    const p2WinRate = stats.p2_win_rate;
                    td.style.backgroundColor = heatmapColor(p1WinRate);
                    td.style.color = '#fff';

                    td.innerHTML = `
                        <div class="heatmap-cell">
                            <span class="heatmap-main">${(p1WinRate * 100).toFixed(1)}%</span>
                            <span class="heatmap-sub">P2: ${(p2WinRate * 100).toFixed(1)}%</span>
                        </div>`;
                } else {
                    td.style.backgroundColor = 'var(--surface2)';
                    td.innerHTML = '<span style="color:var(--text-dim)">—</span>';
                }

                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        container.innerHTML = '';
        container.classList.add('exp-heatmap');
        container.appendChild(table);
    }

    function heatmapColor(rate) {
        // 0 → red (#e17055), 0.5 → gray (#636e72), 1 → green (#00b894)
        const red = { r: 225, g: 112, b: 85 };
        const gray = { r: 99, g: 110, b: 114 };
        const green = { r: 0, g: 184, b: 148 };

        let from, to, t;
        if (rate <= 0.5) {
            from = red;
            to = gray;
            t = rate / 0.5;
        } else {
            from = gray;
            to = green;
            t = (rate - 0.5) / 0.5;
        }

        const r = Math.round(from.r + (to.r - from.r) * t);
        const g = Math.round(from.g + (to.g - from.g) * t);
        const b = Math.round(from.b + (to.b - from.b) * t);
        return `rgb(${r},${g},${b})`;
    }

    // ── Rewards Chart ──

    function renderRewardsChart() {
        const canvas = document.getElementById('chart-exp-rewards');
        if (rewardsChart) rewardsChart.destroy();

        const matchups = getCompletedMatchups();
        const labels = matchups.map(k => matchupLabel(k));
        const p1Data = matchups.map(k => expResults[k].avg_reward_p1);
        const p2Data = matchups.map(k => expResults[k].avg_reward_p2);

        rewardsChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'P1 Avg Reward',
                        data: p1Data,
                        backgroundColor: 'rgba(108,92,231,0.8)',
                    },
                    {
                        label: 'P2 Avg Reward',
                        data: p2Data,
                        backgroundColor: 'rgba(162,155,254,0.6)',
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#8b90a5' } } },
                scales: {
                    x: { ticks: { color: '#8b90a5', maxRotation: 45 }, grid: { color: '#2e3348' } },
                    y: { ticks: { color: '#8b90a5' }, grid: { color: '#2e3348' } },
                },
            },
        });
    }

    // ── Termination Round Chart ──

    function renderExpTermChart() {
        const canvas = document.getElementById('chart-exp-termination');
        if (termChart) termChart.destroy();

        const matchups = getCompletedMatchups();
        const labels = matchups.map(k => matchupLabel(k));
        const data = matchups.map(k => expResults[k].avg_termination_round);

        termChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Avg Termination Round',
                    data,
                    backgroundColor: 'rgba(116,185,255,0.7)',
                }],
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#8b90a5' } } },
                scales: {
                    x: { ticks: { color: '#8b90a5', maxRotation: 45 }, grid: { color: '#2e3348' } },
                    y: { ticks: { color: '#8b90a5' }, grid: { color: '#2e3348' } },
                },
            },
        });
    }

    // ── Summary Table ──

    function renderSummaryTable() {
        const container = document.getElementById('exp-summary-table');
        const matchups = getCompletedMatchups();

        let html = '<table><thead><tr>' +
            '<th>Matchup</th><th>Episodes</th>' +
            '<th>P1 Wins</th><th>P2 Wins</th><th>Ties</th><th>Draws</th>' +
            '<th>P1 Win%</th><th>P2 Win%</th><th>Tie%</th><th>Draw%</th>' +
            '<th>Avg Reward P1</th><th>Avg Reward P2</th><th>Avg Term Rnd</th>' +
            '</tr></thead><tbody>';

        matchups.forEach(key => {
            const s = expResults[key];
            const label = matchupLabel(key);
            html += `<tr>
                <td>${label}</td>
                <td>${s.total_episodes}</td>
                <td>${s.p1_wins}</td>
                <td>${s.p2_wins}</td>
                <td>${s.ties}</td>
                <td>${s.draws}</td>
                <td>${(s.p1_win_rate * 100).toFixed(1)}%</td>
                <td>${(s.p2_win_rate * 100).toFixed(1)}%</td>
                <td>${(s.tie_rate * 100).toFixed(1)}%</td>
                <td>${(s.draw_rate * 100).toFixed(1)}%</td>
                <td>${s.avg_reward_p1.toFixed(2)}</td>
                <td>${s.avg_reward_p2.toFixed(2)}</td>
                <td>${s.avg_termination_round.toFixed(1)}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // ── CSV Export ──

    function exportCSV() {
        const matchups = getCompletedMatchups();
        if (matchups.length === 0) return;

        const header = 'P1 Persona,P2 Persona,Episodes,P1 Wins,P2 Wins,Ties,Draws,' +
            'P1 Win Rate,P2 Win Rate,Tie Rate,Draw Rate,' +
            'Avg Reward P1,Avg Reward P2,Avg Termination Round';

        const rows = matchups.map(key => {
            const [p1, p2] = key.split(':');
            const s = expResults[key];
            return [
                nameForId(p1), nameForId(p2), s.total_episodes,
                s.p1_wins, s.p2_wins, s.ties, s.draws,
                s.p1_win_rate.toFixed(4), s.p2_win_rate.toFixed(4),
                s.tie_rate.toFixed(4), s.draw_rate.toFixed(4),
                s.avg_reward_p1.toFixed(4), s.avg_reward_p2.toFixed(4),
                s.avg_termination_round.toFixed(2),
            ].join(',');
        });

        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `experiment_results_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Helpers ──

    function getCompletedMatchups() {
        return Object.keys(expResults).filter(k => expResults[k] !== null);
    }

    function nameForId(id) {
        const p = expPersonas.find(p => p.id === id);
        return p ? p.name : id;
    }

    function matchupLabel(key) {
        const [p1, p2] = key.split(':');
        return `${nameForId(p1)} vs ${nameForId(p2)}`;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
})();
