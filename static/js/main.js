/**
 * Tab switching and persona loading.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });

    // Load personas into all dropdowns
    loadPersonas();
});

async function loadPersonas() {
    try {
        const personas = await API.getPersonas();
        const selects = ['sim-p1', 'sim-p2', 'pol-persona'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            el.innerHTML = '';
            personas.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                el.appendChild(opt);
            });
        });
    } catch (e) {
        console.error('Failed to load personas:', e);
    }
}

function setStatus(elementId, text, type) {
    const el = document.getElementById(elementId);
    el.textContent = text;
    el.className = 'status-bar ' + type;
}
