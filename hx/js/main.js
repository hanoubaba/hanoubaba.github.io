function toNumber(value) {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatFixedDecimals(n, decimals) {
  if (!Number.isFinite(n)) return '';
  const d = Math.max(0, Math.min(20, Math.floor(decimals)));
  return n.toLocaleString('en-US', {
    useGrouping: false,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function formatQuantity(n) {
  return formatFixedDecimals(n, 2);
}

/** 从价格输入读取小数位数 */
function getDecimalPlacesFromInput(value) {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  if (!normalized) return 0;
  const dot = normalized.indexOf('.');
  if (dot === -1) return 0;
  const frac = normalized.slice(dot + 1);
  if (!/^\d*$/.test(frac)) return 0;
  return frac.length;
}

function getOpenCost() {
  const active = document.querySelector('[aria-label="开仓成本"] .tab-btn.is-active');
  const n = Number(active?.getAttribute('data-value'));
  return Number.isFinite(n) ? n : 30;
}

function getMultiplier() {
  const active = document.querySelector('[data-tablist="multiplier"] .tab-btn.is-active');
  const n = Number(active?.getAttribute('data-value'));
  return Number.isFinite(n) && n > 0 ? n : 20;
}

/** 1 倍成本止损价差 = 价格 / 倍数 */
function calcStopDiff(open, multiplier) {
  if (!(open > 0) || !(multiplier > 0)) return null;
  return open / multiplier;
}

/** 默认按开多：止损在价格下方 */
function calcStopPrice(open, multiplier) {
  const stopDiff = calcStopDiff(open, multiplier);
  if (stopDiff == null) return null;
  return open - stopDiff;
}

/** 数量 = 总空间 / 价格，总空间 = 开仓成本 × 倍数 */
function calcQuantity1x(open, openCost, multiplier) {
  if (!(open > 0)) return null;
  const totalSpace = openCost * multiplier;
  return totalSpace / open;
}

/** 止盈价：n 倍成本 → 价差移动 n×|价格-止损| */
function calcTakeProfit(open, stop, multiplier = 1) {
  const stopDiff = Math.abs(open - stop);
  const m = Number(multiplier);
  if (!(stopDiff > 0) || !Number.isFinite(m) || m <= 0) return null;
  const move = stopDiff * m;
  if (open > stop) return open + move;
  return open - move;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearStrategyOutput(outEl) {
  if (!outEl) return;
  outEl.textContent = '';
  delete outEl.dataset.plainText;
  delete outEl.dataset.copyQty;
}

function renderStrategyOutput(outEl, { plain, html, qty }) {
  if (!outEl) return;
  outEl.innerHTML = html;
  outEl.dataset.plainText = plain;
  if (qty) outEl.dataset.copyQty = qty;
  else delete outEl.dataset.copyQty;
}

function buildStrategy(open, openCost, multiplier, priceDecimalPlaces) {
  const stop = calcStopPrice(open, multiplier);
  const quantity = calcQuantity1x(open, openCost, multiplier);
  const tpDecimals = Math.max(0, priceDecimalPlaces);

  const qty = formatQuantity(quantity);
  const tpStr = formatFixedDecimals(calcTakeProfit(open, stop, 1), tpDecimals);
  const stopStr = formatFixedDecimals(stop, tpDecimals);

  const lines = [
    `数量：${qty}`,
    `止盈：${tpStr}`,
    `止损：${stopStr}`,
  ];

  const plain = lines.join('\n');
  const html = lines.map((line) => escapeHtml(line)).join('\n');

  return { plain, html, qty };
}

function setTabsActive(clicked) {
  const tablist = clicked.closest('[role="tablist"]');
  if (!tablist) return;
  tablist.querySelectorAll('.tab-btn').forEach((btn) => {
    const on = btn === clicked;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function debounce(fn, wait) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
  debounced.flush = (...args) => {
    clearTimeout(timer);
    timer = null;
    fn(...args);
  };
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

function throttle(fn, wait) {
  let last = 0;
  let trailingTimer = null;
  const throttled = (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      if (trailingTimer) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
      }
      last = now;
      fn(...args);
      return;
    }
    if (!trailingTimer) {
      trailingTimer = setTimeout(() => {
        trailingTimer = null;
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
  throttled.flush = (...args) => {
    if (trailingTimer) {
      clearTimeout(trailingTimer);
      trailingTimer = null;
    }
    last = Date.now();
    fn(...args);
  };
  throttled.cancel = () => {
    if (trailingTimer) {
      clearTimeout(trailingTimer);
      trailingTimer = null;
    }
  };
  return throttled;
}

function hasPriceInput() {
  const openEl = document.getElementById('open-price-input');
  return Boolean(String(openEl?.value ?? '').trim());
}

function generate(options = {}) {
  const { silent = false } = options;
  const openEl = document.getElementById('open-price-input');
  const errEl = document.getElementById('error');
  const outEl = document.getElementById('strategy-output');

  const openRaw = openEl && 'value' in openEl ? String(openEl.value) : '';
  const open = toNumber(openRaw);

  if (errEl) errEl.textContent = '';

  if (open === null) {
    if (errEl && !(silent && !openRaw.trim())) {
      errEl.textContent = '请输入有效的价格（数字）。';
    }
    clearStrategyOutput(outEl);
    return;
  }

  if (open <= 0) {
    if (errEl && !silent) errEl.textContent = '价格须为大于 0 的数字。';
    clearStrategyOutput(outEl);
    return;
  }

  const priceDecimals = getDecimalPlacesFromInput(openRaw);
  renderStrategyOutput(
    outEl,
    buildStrategy(open, getOpenCost(), getMultiplier(), priceDecimals),
  );
}

const INPUT_DEBOUNCE_MS = 300;
const CONTROL_THROTTLE_MS = 120;

const scheduleGenerateFromInput = debounce(() => {
  generate({ silent: !hasPriceInput() });
}, INPUT_DEBOUNCE_MS);

const scheduleGenerateFromControl = throttle(() => {
  generate({ silent: !hasPriceInput() });
}, CONTROL_THROTTLE_MS);

function scheduleGenerateNow() {
  scheduleGenerateFromInput.cancel();
  scheduleGenerateFromControl.flush();
}

function focusPriceInput() {
  const el = document.getElementById('open-price-input');
  if (!el || typeof el.focus !== 'function') return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

/** 进入/回到本页时聚焦价格 */
function focusPriceInputOnPageEnter() {
  if (document.visibilityState && document.visibilityState !== 'visible') return;
  focusPriceInput();
  requestAnimationFrame(focusPriceInput);
}

function bindPageEnterFocus() {
  window.addEventListener('pageshow', focusPriceInputOnPageEnter);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') focusPriceInputOnPageEnter();
  });
  window.addEventListener('focus', focusPriceInputOnPageEnter);
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setTabsActive(btn);
    scheduleGenerateFromControl();
    focusPriceInput();
  });
});

const openInput = document.getElementById('open-price-input');

if (openInput) {
  openInput.addEventListener('input', scheduleGenerateFromInput);
  openInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') scheduleGenerateNow();
  });
}
bindPageEnterFocus();
focusPriceInputOnPageEnter();

scheduleGenerateFromControl();

function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

function flashCopyStrategyBtn(btn, label, duration = 1200) {
  if (!btn) return;
  if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
  if (btn._flashTimer) clearTimeout(btn._flashTimer);
  btn.textContent = label;
  btn._flashTimer = setTimeout(() => {
    btn.textContent = btn.dataset.defaultLabel || '一键复制';
    btn._flashTimer = null;
  }, duration);
}

async function copyStrategyOutput() {
  const btn = document.getElementById('btn-copy-strategy');
  const out = document.getElementById('strategy-output');
  const text = (out?.dataset.copyQty ?? '').trim();
  try {
    if (!text) {
      flashCopyStrategyBtn(btn, '无内容');
      return;
    }
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = copyFallback(text);
    flashCopyStrategyBtn(btn, ok ? '已复制' : '复制失败');
  } finally {
    focusPriceInput();
  }
}

const btnCopyStrategy = document.getElementById('btn-copy-strategy');
if (btnCopyStrategy) btnCopyStrategy.addEventListener('click', copyStrategyOutput);
