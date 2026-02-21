/**
 * Computation Log: display IBR iteration details in a collapsible panel.
 * Shows Q-values, BR action probs, and damped probs for representative states.
 */

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('log-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const content = document.getElementById('computation-log-content');
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggle.classList.toggle('open', isHidden);
        });
    }
});

function renderComputationLog(log) {
    const panel = document.getElementById('computation-log-panel');
    const content = document.getElementById('computation-log-content');
    if (!panel || !content) return;

    if (!log || log.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';

    let html = '';

    // Group by iteration
    const byIter = {};
    log.forEach(entry => {
        const key = entry.iteration;
        if (!byIter[key]) byIter[key] = [];
        byIter[key].push(entry);
    });

    for (const [iter, entries] of Object.entries(byIter)) {
        html += `<div class="log-iteration">`;
        html += `<h4 class="log-iter-header">IBR Iteration ${iter}</h4>`;

        entries.forEach(entry => {
            html += `<div class="log-player-block">`;
            html += `<h5>Player ${entry.player}</h5>`;
            html += `<table class="log-table">`;
            html += `<tr>
                <th>Round</th><th>Ammo</th><th>Belief</th>`;

            // Determine columns from first state's q_values
            const actions = entry.states.length > 0
                ? Object.keys(entry.states[0].q_values).sort()
                : [];
            actions.forEach(a => {
                const name = { S: 'Shoot', B: 'Block', R: 'Reload' }[a] || a;
                html += `<th>Q(${name})</th>`;
            });
            html += `<th>BR</th><th>Damped</th></tr>`;

            entry.states.forEach(s => {
                html += `<tr>`;
                html += `<td>${s.t}</td>`;
                html += `<td>${s.ammo}</td>`;
                html += `<td>${s.belief.toFixed(2)}</td>`;

                actions.forEach(a => {
                    const qv = s.q_values[a];
                    html += `<td>${qv !== undefined ? qv.toFixed(2) : '-'}</td>`;
                });

                // BR probs
                const brParts = Object.entries(s.br_probs)
                    .filter(([, v]) => v > 0.001)
                    .map(([a, v]) => `${a}:${v.toFixed(2)}`)
                    .join(' ');
                html += `<td class="log-mono">${brParts}</td>`;

                // Damped probs
                const dampParts = Object.entries(s.damped_probs)
                    .filter(([, v]) => v > 0.001)
                    .map(([a, v]) => `${a}:${v.toFixed(2)}`)
                    .join(' ');
                html += `<td class="log-mono">${dampParts}</td>`;

                html += `</tr>`;
            });

            html += `</table></div>`;
        });

        html += `</div>`;
    }

    content.innerHTML = html;
}
