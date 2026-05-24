function toNumber(value) {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** 四舍五入到指定小数位（标准四舍五入，非银行家舍入） */
function roundHalfUp(num, decimalPlaces) {
  const d = Math.max(0, Math.min(20, Math.floor(decimalPlaces)));
  if (!Number.isFinite(num)) return NaN;
  if (d === 0) return Math.round(num);

  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);
  const str = abs.toFixed(20).replace(/\.?0+$/, '');
  const [intPart, fracPart = ''] = str.split('.');
  const frac = fracPart.padEnd(d + 1, '0');
  const head = frac.slice(0, d);
  const roundBit = Number(frac[d] ?? '0');

  let combined = BigInt((intPart || '0') + head);
  if (roundBit >= 5) combined += 1n;

  const intLen = (intPart || '0').length;
  const padded = combined.toString().padStart(intLen + d, '0');
  const whole = padded.slice(0, -d) || '0';
  const fracOut = padded.slice(-d);

  return sign * Number(`${whole}.${fracOut}`);
}

function formatFixedDecimals(n, decimals) {
  if (!Number.isFinite(n)) return '';
  const d = Math.max(0, Math.min(20, Math.floor(decimals)));
  const rounded = roundHalfUp(n, d);
  if (!Number.isFinite(rounded)) return '';

  const neg = rounded < 0;
  const abs = Math.abs(rounded);
  const fixed = abs.toFixed(d);
  return neg ? `-${fixed}` : fixed;
}

/**
 * 输出格式：固定最大小数位 + 四舍五入 + 去掉尾部多余 0（可设最少位）
 * 不跟输入价格位数走，又不会出现无限小数。
 */
const OUTPUT_DECIMALS = {
  quantity: { max: 2, min: 2 },
  price: { max: 4, min: 2 },
};

function formatDecimalOutput(n, { max, min = 0 }) {
  if (!Number.isFinite(n)) return '';
  const maxD = Math.max(0, Math.min(20, Math.floor(max)));
  const minD = Math.max(0, Math.min(maxD, Math.floor(min)));
  const rounded = roundHalfUp(n, maxD);
  if (!Number.isFinite(rounded)) return '';

  const neg = rounded < 0;
  const abs = Math.abs(rounded);
  const full = formatFixedDecimals(abs, maxD);
  const dot = full.indexOf('.');
  const intPart = dot === -1 ? full : full.slice(0, dot);
  let frac = dot === -1 ? '' : full.slice(dot + 1);

  frac = frac.replace(/0+$/, '');
  if (frac.length < minD) frac = frac.padEnd(minD, '0');

  const body = frac ? `${intPart}.${frac}` : intPart;
  return neg ? `-${body}` : body;
}

function formatQuantity(n) {
  return formatDecimalOutput(n, OUTPUT_DECIMALS.quantity);
}

function formatPriceOutput(n) {
  return formatDecimalOutput(n, OUTPUT_DECIMALS.price);
}

function getOpenCost() {
  const active = document.querySelector('[aria-label="开仓成本"] .tab-btn.is-active');
  const n = Number(active?.getAttribute('data-value'));
  return Number.isFinite(n) ? n : 10;
}

function getMultiplier() {
  const active = document.querySelector('[data-tablist="multiplier"] .tab-btn.is-active');
  const n = Number(active?.getAttribute('data-value'));
  return Number.isFinite(n) && n > 0 ? n : 100;
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

const STRATEGY_VALUE_IDS = {
  qty: 'strategy-value-qty',
  tp: 'strategy-value-tp',
  stop: 'strategy-value-stop',
};

function clearStrategyOutput(outEl) {
  renderStrategyOutput(outEl, {
    plain: '',
    values: { qty: '', tp: '', stop: '' },
  });
}

function renderStrategyOutput(outEl, { plain, values }) {
  if (!outEl) return;

  const hasValues = Boolean(values?.qty || values?.tp || values?.stop);
  outEl.dataset.plainText = plain || '';

  Object.entries(STRATEGY_VALUE_IDS).forEach(([field, id]) => {
    const valueEl = document.getElementById(id);
    const btn = outEl.querySelector(`.btn-copy-row[data-field="${field}"]`);
    const raw = String(values?.[field] ?? '').trim();
    const display = raw || '—';

    if (valueEl) {
      valueEl.textContent = display;
      valueEl.classList.toggle('is-empty', !raw);
    }
    if (btn) {
      btn.dataset.copy = raw;
      btn.disabled = !raw;
    }
  });

  outEl.classList.toggle('is-empty', !hasValues);
}

function buildStrategy(open, openCost, multiplier) {
  const stop = calcStopPrice(open, multiplier);
  const quantity = calcQuantity1x(open, openCost, multiplier);

  const qty = formatQuantity(quantity);
  const tpStr = formatPriceOutput(calcTakeProfit(open, stop, 1));
  const stopStr = formatPriceOutput(stop);

  const values = { qty, tp: tpStr, stop: stopStr };
  const plain = [
    `数量：${qty}`,
    `止盈：${tpStr}`,
    `止损：${stopStr}`,
  ].join('\n');

  return { plain, values };
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

  renderStrategyOutput(
    outEl,
    buildStrategy(open, getOpenCost(), getMultiplier()),
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

async function copyText(text) {
  const t = String(text ?? '').trim();
  if (!t) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    /* fallback below */
  }
  return copyFallback(t);
}

function flashCopyRowBtn(btn, label, duration = 1000) {
  if (!btn) return;
  if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
  if (btn._flashTimer) clearTimeout(btn._flashTimer);
  btn.textContent = label;
  btn._flashTimer = setTimeout(() => {
    btn.textContent = btn.dataset.defaultLabel || '复制';
    btn._flashTimer = null;
  }, duration);
}

async function copyStrategyOutput() {
  const btn = document.getElementById('btn-copy-strategy');
  const out = document.getElementById('strategy-output');
  const text = (out?.dataset.plainText ?? '').trim();
  try {
    if (!text) {
      flashCopyStrategyBtn(btn, '无内容');
      return;
    }
    const ok = await copyText(text);
    flashCopyStrategyBtn(btn, ok ? '已复制' : '复制失败');
  } finally {
    focusPriceInput();
  }
}

function bindStrategyRowCopy() {
  document.querySelectorAll('.btn-copy-row').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy ?? '';
      if (!String(text).trim()) {
        flashCopyRowBtn(btn, '无内容');
        return;
      }
      const ok = await copyText(text);
      flashCopyRowBtn(btn, ok ? '已复制' : '失败');
    });
  });
}

const btnCopyStrategy = document.getElementById('btn-copy-strategy');
if (btnCopyStrategy) btnCopyStrategy.addEventListener('click', copyStrategyOutput);
bindStrategyRowCopy();
