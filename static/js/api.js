/**
 * Fetch wrapper for API calls.
 */
const API = {
    async get(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
        return res.json();
    },

    async post(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
        return res.json();
    },

    getPersonas() {
        return this.get('/api/personas');
    },

    solve(persona1, persona2) {
        return this.post('/api/solve', { persona1, persona2 });
    },

    simulate(persona1, persona2, n_episodes) {
        return this.post('/api/simulate', { persona1, persona2, n_episodes });
    },
};
