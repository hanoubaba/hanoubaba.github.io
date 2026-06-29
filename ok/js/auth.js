(function initAuthModule() {
  const AUTH_STORAGE_KEY = 'ok-app-authenticated';
  const AUTH_USERNAME = 'hanxu';
  const AUTH_PASSWORD = '785555';

  let appInitCallback = null;
  let appInitialized = false;

  function isLoggedIn() {
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  }

  function persistLogin() {
    localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    localStorage.setItem('ok-app-user', AUTH_USERNAME);
  }

  function updateView() {
    const loginPage = document.getElementById('login-page');
    const appRoot = document.getElementById('app-root');
    const loggedIn = isLoggedIn();
    if (loginPage) loginPage.hidden = loggedIn;
    if (appRoot) appRoot.hidden = !loggedIn;
    document.body.classList.toggle('is-authed', loggedIn);
  }

  function runAppInit() {
    if (appInitialized || typeof appInitCallback !== 'function') return;
    appInitialized = true;
    appInitCallback();
  }

  function setLoginError(message) {
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.textContent = message || '';
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    const usernameEl = document.getElementById('login-username');
    const passwordEl = document.getElementById('login-password');
    const username = String(usernameEl?.value ?? '').trim();
    const password = String(passwordEl?.value ?? '');

    if (username !== AUTH_USERNAME || password !== AUTH_PASSWORD) {
      setLoginError('账号或密码错误');
      return;
    }

    setLoginError('');
    persistLogin();
    updateView();
    runAppInit();
  }

  function bindLoginForm() {
    const form = document.getElementById('login-form');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', handleLoginSubmit);
  }

  function boot(appInit) {
    appInitCallback = appInit;
    updateView();
    bindLoginForm();
    if (isLoggedIn()) runAppInit();
  }

  window.AppAuth = {
    boot,
    isLoggedIn,
  };
})();
