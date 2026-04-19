const API_BASE = '/api';

// ── Token helpers ──────────────────────────────────────────────────────────────
export const getToken  = () => localStorage.getItem('curalink_token');
export const setToken  = (t) => localStorage.setItem('curalink_token', t);
export const clearToken = () => localStorage.removeItem('curalink_token');

const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

/**
 * Parse any fetch response into {data} or throw a meaningful Error.
 * Handles: empty bodies, HTML error pages, JSON error objects.
 */
const handleResponse = async (res) => {
    // Try to parse body as JSON — fallback to empty object
    let data = {};
    const text = await res.text().catch(() => '');
    if (text) {
        try { data = JSON.parse(text); } catch { /* not JSON */ }
    }

    if (!res.ok) {
        // Prefer structured error message from backend
        const msg = data?.error
            || data?.detail
            || data?.message
            || `Request failed: ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        throw err;
    }
    return data;
};

// ── Auth API ───────────────────────────────────────────────────────────────────
export const authAPI = {
    /** Register a new user. Accepts object { name, email, password } */
    register: ({ name, email, password }) =>
        fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        }).then(handleResponse).then(data => {
            if (data.token) setToken(data.token);
            return data;
        }),

    /** Login. Accepts object { email, password } */
    login: ({ email, password }) =>
        fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        }).then(handleResponse).then(data => {
            if (data.token) setToken(data.token);
            return data;
        }),

    getMe: () =>
        fetch(`${API_BASE}/auth/me`, { headers: authHeaders() }).then(handleResponse),
};

// ── Chat API ───────────────────────────────────────────────────────────────────
export const queryMedicalResearch = async ({ query, session_id, disease, location, research_mode, patient_profile }) => {
    const res = await fetch(`${API_BASE}/chat/query`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ query, session_id, disease, location, research_mode, patient_profile }),
    });
    return handleResponse(res);
};

// ── Sessions API ───────────────────────────────────────────────────────────────
export const sessionsAPI = {
    getAll: () =>
        fetch(`${API_BASE}/chat/sessions`, { headers: authHeaders() }).then(handleResponse),

    getById: (id) =>
        fetch(`${API_BASE}/chat/sessions/${id}`, { headers: authHeaders() }).then(handleResponse),

    delete: (id) =>
        fetch(`${API_BASE}/chat/sessions/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
        }).then(handleResponse),
};
