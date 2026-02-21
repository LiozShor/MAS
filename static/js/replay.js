/**
 * Replay tab: step through a single episode round-by-round.
 */
let replayEpisode = null;
let replayRound = 0;
let beliefChart = null;

document.addEventListener('DOMContentLoaded', () => {
    GameCanvas.init('game-canvas');
    document.getElementById('replay-ep').addEventListener('change', loadEpisode);
    document.getElementById('btn-replay-prev').addEventListener('click', () => stepReplay(-1));
    document.getElementById('btn-replay-next').addEventListener('click', () => stepReplay(1));
    document.getElementById('btn-replay-reset').addEventListener('click', () => { replayRound = 0; renderReplay(); GameCanvas.reset(); });
});

function loadEpisode() {
    if (!lastSimResult) return;
    const idx = parseInt(document.getElementById('replay-ep').value);
    if (isNaN(idx)) return;
    replayEpisode = lastSimResult.episodes[idx];
    replayRound = 0;
    GameCanvas.reset();
    renderReplay();
    renderBeliefChart();

    document.getElementById('btn-replay-prev').disabled = false;
    document.getElementById('btn-replay-next').disabled = false;
    document.getElementById('btn-replay-reset').disabled = false;
}

function stepReplay(dir) {
    if (!replayEpisode) return;
    replayRound = Math.max(0, Math.min(replayRound + dir, replayEpisode.rounds.length - 1));
    renderReplay();
}

function renderReplay() {
    if (!replayEpisode) return;
    const ep = replayEpisode;
    const r = ep.rounds[replayRound];

    // Persona labels
    const p1Persona = lastSimResult?.persona1 || 'P1';
    const p2Persona = lastSimResult?.persona2 || 'P2';
    const p1Mode = lastSimResult?.optimal_p1 ? 'Optimal' : 'Softmax';
    const p2Mode = lastSimResult?.optimal_p2 ? 'Optimal' : 'Softmax';

    // Info bar
    document.getElementById('replay-info').innerHTML = `
        <strong>P1:</strong> ${p1Persona} &nbsp;vs&nbsp; <strong>P2:</strong> ${p2Persona}
        &nbsp;|&nbsp; <strong>Outcome:</strong>
        <span class="outcome-badge outcome-${ep.outcome}">${ep.outcome}</span>
        &nbsp;|&nbsp; Rounds: ${ep.rounds.length}
        &nbsp;|&nbsp; Total rewards: P1=${ep.total_rewards[0].toFixed(1)}, P2=${ep.total_rewards[1].toFixed(1)}
    `;

    // Round detail
    const actionNames = { S: 'Shoot', B: 'Block', R: 'Reload' };

    // Build decision explanations if data is available
    let explanationHtml = '';
    if (r.p1_action_probs && r.p2_action_probs) {
        explanationHtml = `
            <div class="decision-explanation">
                ${buildExplanation(1, r.p1_action_probs, r.beliefs_before[0], r.p1_threshold, r.ammo_before[0], r.actions[0], r.p1_q_values)}
                ${buildExplanation(2, r.p2_action_probs, r.beliefs_before[1], r.p2_threshold, r.ammo_before[1], r.actions[1], r.p2_q_values)}
            </div>`;
    }

    document.getElementById('replay-round-detail').innerHTML = `
        <div class="round-card">
            <div class="round-header">Round ${r.round} of ${ep.rounds.length}</div>
            <div class="persona-labels">
                <span class="persona-label p1-persona">P1: ${p1Persona} <span class="mode-tag mode-${p1Mode.toLowerCase()}">${p1Mode}</span></span>
                <span class="persona-vs">vs</span>
                <span class="persona-label p2-persona">P2: ${p2Persona} <span class="mode-tag mode-${p2Mode.toLowerCase()}">${p2Mode}</span></span>
            </div>
            <div class="detail-row">
                <span class="label">State (ammo)</span>
                <span>P1=${r.ammo_before[0]}, P2=${r.ammo_before[1]}</span>
            </div>
            <div class="detail-row">
                <span class="label">Beliefs (before)</span>
                <span>P1 thinks P2 armed: ${r.beliefs_before[0].toFixed(3)} | P2 thinks P1 armed: ${r.beliefs_before[1].toFixed(3)}</span>
            </div>
            <div class="detail-row">
                <span class="label">P1 Action</span>
                <span><span class="action-badge action-${r.actions[0]}">${actionNames[r.actions[0]]}</span></span>
            </div>
            <div class="detail-row">
                <span class="label">P2 Action</span>
                <span><span class="action-badge action-${r.actions[1]}">${actionNames[r.actions[1]]}</span></span>
            </div>
            <div class="detail-row">
                <span class="label">Outcome</span>
                <span class="outcome-badge outcome-${r.outcome}">${r.outcome}</span>
            </div>
            <div class="detail-row">
                <span class="label">Rewards</span>
                <span>P1=${r.rewards[0].toFixed(1)}, P2=${r.rewards[1].toFixed(1)}</span>
            </div>
            <div class="detail-row">
                <span class="label">Beliefs (after)</span>
                <span>P1: ${r.beliefs_after[0].toFixed(3)} | P2: ${r.beliefs_after[1].toFixed(3)}</span>
            </div>
            ${explanationHtml}
        </div>
    `;

    // Animate the 2D game canvas
    GameCanvas.playRoundTransition(r);

    // Timeline
    const timeline = document.getElementById('replay-timeline');
    timeline.innerHTML = '';
    ep.rounds.forEach((rd, i) => {
        const dot = document.createElement('div');
        dot.className = 'timeline-dot';
        if (i === replayRound) dot.classList.add('active');
        if (rd.outcome === 'P1Win') dot.classList.add('p1win');
        else if (rd.outcome === 'P2Win') dot.classList.add('p2win');
        else if (rd.outcome === 'Tie') dot.classList.add('tie');
        else if (rd.outcome === 'Draw') dot.classList.add('draw');
        dot.textContent = rd.round;
        dot.addEventListener('click', () => { replayRound = i; renderReplay(); });
        timeline.appendChild(dot);
    });
}

function buildExplanation(playerNum, actionProbs, belief, threshold, ammo, action, qValues) {
    const actionNames = { S: 'Shoot', B: 'Block', R: 'Reload' };
    const chosenName = actionNames[action] || action;

    // Find the highest-probability action (policy recommendation)
    const sorted = Object.entries(actionProbs)
        .filter(([, p]) => p > 0.001)
        .sort((a, b) => b[1] - a[1]);
    const bestAction = sorted[0][0];
    const isDeviation = action !== bestAction;

    // Build probability summary for all actions
    const probParts = sorted
        .map(([a, p]) => `P(${actionNames[a]})=${p.toFixed(2)}`);

    const chosenProb = (actionProbs[action] || 0).toFixed(2);
    const deviationTag = isDeviation
        ? ` <span class="deviation-badge" title="Sampled low-probability action (mixed strategy)">rolled ${chosenProb}</span>`
        : '';

    const reasoning = `Belief=${belief.toFixed(3)} | ${probParts.join(', ')} &rarr; ${chosenName}${deviationTag}`;

    // Build Q-value delta section
    let qHtml = '';
    if (qValues && Object.keys(qValues).length > 0) {
        const qEntries = Object.entries(qValues)
            .sort((a, b) => b[1] - a[1]);  // highest Q first
        const bestQ = qEntries[0][1];
        const greedyAction = qEntries[0][0];

        const qParts = qEntries.map(([a, q]) => {
            const delta = q - bestQ;
            const tag = delta === 0
                ? '<span class="q-best">best</span>'
                : `<span class="q-delta">(${delta.toFixed(2)})</span>`;
            return `Q(${actionNames[a]})=${q.toFixed(2)} ${tag}`;
        });

        const margin = qEntries.length > 1
            ? (qEntries[0][1] - qEntries[1][1]).toFixed(2)
            : '0.00';

        const noteHtml = action !== greedyAction
            ? `<span class="q-softmax-note">Softmax sampled ${actionNames[action]} (Q=${(qValues[action] || 0).toFixed(2)}) over greedy ${actionNames[greedyAction]}</span>`
            : `<span class="q-greedy-note">Chose greedy action (\u0394=+${margin})</span>`;

        qHtml = `
            <div class="q-value-row">
                <span class="label">Q-values</span>
                <span>${qParts.join(' &nbsp;|&nbsp; ')}</span>
            </div>
            <div class="q-value-row q-note-row">
                <span class="label"></span>
                <span>${noteHtml}</span>
            </div>`;
    }

    return `<div class="explanation-row${isDeviation ? ' deviation' : ''}">
        <span class="label">P${playerNum} Decision</span>
        <span>${reasoning}</span>
    </div>${qHtml}`;
}

function renderBeliefChart() {
    if (!replayEpisode) return;
    const ctx = document.getElementById('chart-beliefs').getContext('2d');
    if (beliefChart) beliefChart.destroy();

    const rounds = replayEpisode.rounds;
    const labels = rounds.map(r => `R${r.round}`);
    const p1beliefs = rounds.map(r => r.beliefs_before[0]);
    const p2beliefs = rounds.map(r => r.beliefs_before[1]);

    beliefChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'P1 belief (P2 armed)',
                    data: p1beliefs,
                    borderColor: '#6c5ce7',
                    backgroundColor: 'rgba(108,92,231,0.1)',
                    fill: true,
                    tension: 0.3,
                },
                {
                    label: 'P2 belief (P1 armed)',
                    data: p2beliefs,
                    borderColor: '#00b894',
                    backgroundColor: 'rgba(0,184,148,0.1)',
                    fill: true,
                    tension: 0.3,
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    min: 0, max: 1,
                    title: { display: true, text: 'Belief p', color: '#8b90a5' },
                    grid: { color: '#2e3348' },
                    ticks: { color: '#8b90a5' },
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b90a5' },
                }
            },
            plugins: {
                legend: { labels: { color: '#e1e4ec' } }
            }
        }
    });
}
