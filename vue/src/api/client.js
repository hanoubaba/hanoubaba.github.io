import { ENDPOINTS, SUPABASE } from '@/config';

let session = null;
let refreshTimer = null;
let refreshInFlight = null;
let onExpired = null;

export function setAuthExpiredHandler(handler) {
  onExpired = handler;
}

export function getAuthSession() {
  return session;
}

export function loadAuthSession() {
  try {
    const raw = localStorage.getItem(SUPABASE.authStorageKey);
    if (!raw) {
      session = null;
      return null;
    }
    const parsed = JSON.parse(raw);
    session = parsed && parsed.access_token ? parsed : null;
    return session;
  } catch {
    session = null;
    return null;
  }
}

export function saveAuthSession(next) {
  session = next;
  if (!next) {
    localStorage.removeItem(SUPABASE.authStorageKey);
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    return;
  }
  localStorage.setItem(SUPABASE.authStorageKey, JSON.stringify(next));
  scheduleAuthRefresh();
}

export function clearAuthSession() {
  saveAuthSession(null);
}

export function isAccessTokenValid() {
  if (!session?.access_token || !session?.expires_at) return false;
  return Date.now() < session.expires_at - SUPABASE.accessTokenSkewMs;
}

export function isAuthRefreshTokenInvalid(err) {
  const code = String(err?.code ?? '').toLowerCase();
  const msg = String(err?.message ?? '').toLowerCase();
  return code === 'invalid_grant'
    || msg.includes('invalid refresh token')
    || msg.includes('refresh token not found')
    || msg.includes('token is expired')
    || msg.includes('session not found');
}

function scheduleAuthRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (!session?.refresh_token || !session?.expires_at) return;
  const delay = Math.max(session.expires_at - SUPABASE.refreshLeadMs - Date.now(), 1000);
  refreshTimer = setTimeout(() => {
    refreshAuthSessionSafe().catch(() => {});
  }, delay);
}

function buildAuthSessionFromTokenResponse(data) {
  const expiresIn = Number(data?.expires_in);
  return {
    access_token: String(data?.access_token ?? ''),
    refresh_token: String(data?.refresh_token ?? ''),
    expires_at: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
    email: String(data?.user?.email ?? ''),
  };
}

async function authTokenRequest(grantType, payload) {
  const url = `${ENDPOINTS.auth}?grant_type=${encodeURIComponent(grantType)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE.key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error_description || data?.msg || data?.message || '登录失败');
    err.code = data?.error || data?.error_code || '';
    throw err;
  }
  return data;
}

export async function refreshAuthSession() {
  if (!session?.refresh_token) throw new Error('未登录');
  const data = await authTokenRequest('refresh_token', { refresh_token: session.refresh_token });
  const nextSession = buildAuthSessionFromTokenResponse(data);
  if (!nextSession.access_token) throw new Error('刷新登录失败');
  saveAuthSession(nextSession);
  return nextSession;
}

export async function refreshAuthSessionSafe() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshAuthSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function ensureAuthSession() {
  if (isAccessTokenValid()) return session;
  if (session?.refresh_token) return refreshAuthSessionSafe();
  throw new Error('未登录');
}

export function forceLogout(message = '登录已过期，请重新登录') {
  clearAuthSession();
  onExpired?.(message);
}

export function normalizeLoginEmail(account) {
  const raw = String(account ?? '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  return `${raw}${SUPABASE.loginEmailSuffix}`;
}

export async function loginWithPassword(email, password) {
  const data = await authTokenRequest('password', {
    email: String(email ?? '').trim(),
    password: String(password ?? ''),
  });
  const next = buildAuthSessionFromTokenResponse(data);
  if (!next.access_token) throw new Error('登录失败');
  saveAuthSession(next);
  return next;
}

export function getSupabaseHeaders(extra = {}) {
  const token = session?.access_token;
  if (!token) throw new Error('未登录');
  return {
    apikey: SUPABASE.key,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export async function supabaseFetch(input, init = {}, retried = false) {
  try {
    await ensureAuthSession();
  } catch (err) {
    if (isAuthRefreshTokenInvalid(err)) forceLogout();
    throw err;
  }
  const hasBody = init.body !== undefined && init.body !== null && init.body !== '';
  const headers = {
    ...getSupabaseHeaders(),
    ...(init.headers || {}),
  };
  if (hasBody) {
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  } else {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && !retried && session?.refresh_token) {
    try {
      await refreshAuthSessionSafe();
      return supabaseFetch(input, init, true);
    } catch (err) {
      if (isAuthRefreshTokenInvalid(err)) {
        forceLogout();
        throw new Error('登录已过期，请重新登录');
      }
      throw err;
    }
  }
  if (res.status === 401) {
    forceLogout();
    throw new Error('登录已过期，请重新登录');
  }
  return res;
}

export function syncAuthSessionFromStorage() {
  try {
    const raw = localStorage.getItem(SUPABASE.authStorageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token) return;
    session = parsed;
    scheduleAuthRefresh();
  } catch {
    // ignore
  }
}
