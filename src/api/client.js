const API_BASE = '/api';

function getToken() {
  const sessionStr = localStorage.getItem('cardcomposer_session');
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      return session.token;
    } catch {
      return null;
    }
  }
  return null;
}

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!options.body || typeof options.body === 'string') {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const err = await response.json();
      errorMsg = err.error || errorMsg;
    } catch {
      // Ignore JSON parse errors for non-JSON responses
    }
    throw new Error(errorMsg);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response;
}
