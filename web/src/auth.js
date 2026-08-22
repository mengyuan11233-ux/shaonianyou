// 登录态管理：token 存 localStorage，请求时通过 Authorization 头携带

const KEY = 'sny_token';

export function getToken() { return localStorage.getItem(KEY) || ''; }
export function setToken(t) { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); }
export function clearToken() { localStorage.removeItem(KEY); }

export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
  return data;
}

export function register(phone, password) { return post('/api/auth/register', { phone, password }); }
export function login(phone, password) { return post('/api/auth/login', { phone, password }); }

export async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }); } catch {}
  clearToken();
}

// 拉取当前登录用户（含 memory 和历史行程）；未登录返回 null
export async function fetchMe() {
  try {
    const res = await fetch('/api/auth/me', { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
