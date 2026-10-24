// Cliente HTTP: envia o JWT no cabeçalho Authorization e o token anti-CSRF em X-CSRF-Token.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

const STORAGE_KEY = 'assinatura.session';

// sessionStorage: a sessão termina ao fechar a aba e não é compartilhada entre abas
export function getSession() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function setSession(session) {
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(STORAGE_KEY);
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const session = getSession();
  const headers = {};
  if (session) {
    headers.Authorization = `Bearer ${session.token}`;
    headers['X-CSRF-Token'] = session.csrfToken;
  }
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: 'omit',
  });

  if (res.status === 401 && session) {
    setSession(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('session-expired'));
  }
  if (!res.ok) {
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* resposta sem corpo JSON */
    }
    const err = new Error(data.details ? `${data.error}: ${data.details.join('; ')}` : data.error || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return raw ? res : res.json();
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  blob: async (p) => (await request(p, { raw: true })).arrayBuffer(),
};
