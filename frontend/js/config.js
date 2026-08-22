// Dayflow frontend config.
// Points at the local backend from the dayflow-backend README (npm start -> :4000).
// Change this if you deploy the API somewhere else.
const API_BASE = window.DAYFLOW_API_BASE || 'http://localhost:4000';

const Session = {
  KEY_TOKEN: 'dayflow_token',
  KEY_USER: 'dayflow_user',

  save(token, user) {
    localStorage.setItem(this.KEY_TOKEN, token);
    localStorage.setItem(this.KEY_USER, JSON.stringify(user));
  },
  token() {
    return localStorage.getItem(this.KEY_TOKEN);
  },
  user() {
    const raw = localStorage.getItem(this.KEY_USER);
    return raw ? JSON.parse(raw) : null;
  },
  setUser(user) {
    localStorage.setItem(this.KEY_USER, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(this.KEY_TOKEN);
    localStorage.removeItem(this.KEY_USER);
  },
};

// Thin wrapper around fetch(): adds the API base, JSON headers, the bearer
// token when present, and unwraps { data } / { error } the way the backend
// always responds.
async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && Session.token()) {
    headers['Authorization'] = `Bearer ${Session.token()}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error(
      `Can't reach the Dayflow API at ${API_BASE}. Is the backend running? (npm start in dayflow-backend)`
    );
  }

  let payload = {};
  try {
    payload = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      Session.clear();
      if (!location.pathname.endsWith('auth.html')) {
        location.href = 'auth.html';
      }
    }
    throw new Error(payload?.error?.message || `Request failed (${res.status}).`);
  }

  return payload.data;
}
