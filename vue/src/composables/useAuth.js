import { COST, PAGES, SUPABASE } from '@/config';
import {
  clearAuthSession,
  ensureAuthSession,
  isAccessTokenValid,
  isAuthRefreshTokenInvalid,
  loadAuthSession,
  loginWithPassword,
  normalizeLoginEmail,
  refreshAuthSessionSafe,
  setAuthExpiredHandler,
  syncAuthSessionFromStorage,
} from '@/api/client.js';
import { fetchAppSettings } from '@/api/strategies.js';
import { normalizeUnitCost } from '@/domain/price.js';
import { store, showToast } from './store.js';

export function useAuth() {
  function showLogin(message = '') {
    store.authed = false;
    store.loginError = message;
    document.body.classList.add('login-mode');
  }

  function showApp() {
    store.authed = true;
    store.loginError = '';
    document.body.classList.remove('login-mode');
  }

  async function enterApp() {
    showApp();
    try {
      const unit = await fetchAppSettings();
      const normalized = normalizeUnitCost(unit);
      if (normalized != null) store.unitCost = normalized;
    } catch {
      store.unitCost = COST.defaultUnit;
    }
    store.page = PAGES.admin;
  }

  async function login(account, password) {
    if (!account || !password) {
      store.loginError = '请填写账号和密码。';
      return false;
    }
    store.loginError = '';
    try {
      await loginWithPassword(normalizeLoginEmail(account), password);
      await enterApp();
      return true;
    } catch (err) {
      store.loginError = String(err?.message || '登录失败');
      return false;
    }
  }

  async function init() {
    setAuthExpiredHandler((message) => {
      showLogin(message);
      showToast(message);
    });
    loadAuthSession();
    const session = loadAuthSession();
    if (session?.refresh_token) {
      try {
        await ensureAuthSession();
        await enterApp();
        return;
      } catch (err) {
        if (isAuthRefreshTokenInvalid(err)) {
          clearAuthSession();
        } else if (isAccessTokenValid()) {
          await enterApp();
          return;
        }
      }
    } else if (session?.access_token && isAccessTokenValid()) {
      await enterApp();
      return;
    }
    showLogin();
  }

  function bindSessionListeners() {
    window.addEventListener('storage', (e) => {
      if (e.key !== SUPABASE.authStorageKey) return;
      if (!e.newValue) {
        showLogin();
        return;
      }
      syncAuthSessionFromStorage();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (!isAccessTokenValid()) {
        refreshAuthSessionSafe().catch((err) => {
          if (isAuthRefreshTokenInvalid(err)) showLogin('登录已过期，请重新登录');
        });
      }
    });
  }

  return { init, login, showLogin, bindSessionListeners };
}
