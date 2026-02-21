/**
 * Tab switching and persona loading.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // CTA button to jump to replay tab
    document.getElementById('btn-goto-replay').addEventListener('click', () => switchTab('replay'));

    // Load personas into all dropdowns
    loadPersonas();
});

async function loadPersonas() {
    try {
        const personas = await API.getPersonas();
        window.personas = personas;
        const selects = ['sim-p1', 'sim-p2'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '';
            personas.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                el.appendChild(opt);
            });
        });
        if (typeof initExperimentMatrix === 'function') {
            initExperimentMatrix(personas);
        }
    } catch (e) {
        console.error('Failed to load personas:', e);
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');
}

function setStatus(elementId, text, type) {
    const el = document.getElementById(elementId);
    el.textContent = text;
    el.className = 'status-bar ' + type;
}
