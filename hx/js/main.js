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

const DEFAULTS = {
  openCost: 10,
  multiplier: 100,
  direction: 'long',
  riskMultiple: 1,
};

const DIRECTION_SIGN = {
  long: 1,
  short: -1,
};

const STRATEGY_VALUE_IDS = {
  qty: 'strategy-value-qty',
  tp: 'strategy-value-tp',
  stop: 'strategy-value-stop',
};

const COPY_LABELS = {
  strategy: '一键复制',
  row: '复制',
};

const INPUT_DEBOUNCE_MS = 300;
const CONTROL_THROTTLE_MS = 120;

const els = {
  openInput: document.getElementById('open-price-input'),
  error: document.getElementById('error'),
  strategyOutput: document.getElementById('strategy-output'),
  copyStrategyBtn: document.getElementById('btn-copy-strategy'),
};

Object.entries(STRATEGY_VALUE_IDS).forEach(([field, id]) => {
  STRATEGY_VALUE_IDS[field] = {
    value: document.getElementById(id),
    button: els.strategyOutput?.querySelector(`.btn-copy-row[data-field="${field}"]`) ?? null,
  };
});

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

function getActiveTabValue(tablistName) {
  const active = document.querySelector(`[data-tablist="${tablistName}"] .tab-btn.is-active`);
  return active?.getAttribute('data-value') ?? null;
}

function getPositiveNumberTabValue(tablistName, fallback) {
  const n = Number(getActiveTabValue(tablistName));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getStrategyConfig() {
  const direction = getActiveTabValue('direction');
  return {
    openCost: getPositiveNumberTabValue('open-cost', DEFAULTS.openCost),
    multiplier: getPositiveNumberTabValue('multiplier', DEFAULTS.multiplier),
    direction: direction === 'short' ? 'short' : DEFAULTS.direction,
    riskMultiple: getPositiveNumberTabValue('risk-multiple', DEFAULTS.riskMultiple),
  };
}

/** 1 倍成本止损价差 = 价格 / 倍数 */
function calcStopDiff(open, multiplier) {
  if (!(open > 0) || !(multiplier > 0)) return null;
  return open / multiplier;
}

function getDirectionSign(direction) {
  return DIRECTION_SIGN[direction] ?? DIRECTION_SIGN[DEFAULTS.direction];
}

/** 根据方向和倍数计算止损价 */
function calcStopPrice(open, multiplier, direction = DEFAULTS.direction, riskMultiple = DEFAULTS.riskMultiple) {
  const baseDiff = calcStopDiff(open, multiplier);
  const risk = Number(riskMultiple);
  if (baseDiff == null || !Number.isFinite(risk) || risk <= 0) return null;
  return open - (baseDiff * risk * getDirectionSign(direction));
}

/** 数量 = 总空间 / 价格，总空间 = 开仓成本 × 倍数 */
function calcQuantity1x(open, openCost, multiplier) {
  if (!(open > 0)) return null;
  const totalSpace = openCost * multiplier;
  return totalSpace / open;
}

/** 止盈价：与止损关于开仓价对称 */
function calcTakeProfit(open, stop, direction = DEFAULTS.direction) {
  const stopDiff = Math.abs(open - stop);
  if (!(stopDiff > 0)) return null;
  return open + (stopDiff * getDirectionSign(direction));
}

function clearStrategyOutput() {
  renderStrategyOutput({
    plain: '',
    values: { qty: '', tp: '', stop: '' },
  });
}

function renderStrategyOutput({ plain, values }) {
  if (!els.strategyOutput) return;

  const hasValues = Object.values(values ?? {}).some(Boolean);
  els.strategyOutput.dataset.plainText = plain || '';

  Object.entries(STRATEGY_VALUE_IDS).forEach(([field, refs]) => {
    const raw = String(values?.[field] ?? '').trim();
    const display = raw || '—';

    if (refs.value) {
      refs.value.textContent = display;
      refs.value.classList.toggle('is-empty', !raw);
    }
    if (refs.button) {
      refs.button.dataset.copy = raw;
      refs.button.disabled = !raw;
    }
  });

  els.strategyOutput.classList.toggle('is-empty', !hasValues);
}

function buildStrategy(open, config) {
  const { openCost, multiplier, direction, riskMultiple } = config;
  const stop = calcStopPrice(open, multiplier, direction, riskMultiple);
  const quantity = calcQuantity1x(open, openCost, multiplier);
  const takeProfit = calcTakeProfit(open, stop, direction);

  const values = {
    qty: formatQuantity(quantity),
    tp: formatPriceOutput(takeProfit),
    stop: formatPriceOutput(stop),
  };

  return {
    plain: [
      `数量：${values.qty}`,
      `止盈：${values.tp}`,
      `止损：${values.stop}`,
    ].join('\n'),
    values,
  };
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
  return Boolean(String(els.openInput?.value ?? '').trim());
}

function setError(message) {
  if (els.error) els.error.textContent = message;
}

function generate(options = {}) {
  const { silent = false } = options;
  const openRaw = els.openInput && 'value' in els.openInput ? String(els.openInput.value) : '';
  const open = toNumber(openRaw);

  setError('');

  if (open === null) {
    if (!(silent && !openRaw.trim())) {
      setError('请输入有效的价格（数字）。');
    }
    clearStrategyOutput();
    return;
  }

  if (open <= 0) {
    if (!silent) setError('价格须为大于 0 的数字。');
    clearStrategyOutput();
    return;
  }

  renderStrategyOutput(buildStrategy(open, getStrategyConfig()));
}

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
  const el = els.openInput;
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

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTabsActive(btn);
      scheduleGenerateFromControl();
      focusPriceInput();
    });
  });
}

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

function flashButtonLabel(btn, label, fallbackLabel, duration) {
  if (!btn) return;
  if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = fallbackLabel || btn.textContent;
  if (btn._flashTimer) clearTimeout(btn._flashTimer);
  btn.textContent = label;
  btn._flashTimer = setTimeout(() => {
    btn.textContent = btn.dataset.defaultLabel || fallbackLabel;
    btn._flashTimer = null;
  }, duration);
}

async function copyStrategyOutput() {
  const text = String(els.strategyOutput?.dataset.plainText ?? '').trim();
  try {
    if (!text) {
      flashButtonLabel(els.copyStrategyBtn, '无内容', COPY_LABELS.strategy, 1200);
      return;
    }
    const ok = await copyText(text);
    flashButtonLabel(els.copyStrategyBtn, ok ? '已复制' : '复制失败', COPY_LABELS.strategy, 1200);
  } finally {
    focusPriceInput();
  }
}

function bindStrategyRowCopy() {
  Object.values(STRATEGY_VALUE_IDS).forEach(({ button }) => {
    if (!button) return;
    button.addEventListener('click', async () => {
      try {
        const text = button.dataset.copy ?? '';
        if (!String(text).trim()) {
          flashButtonLabel(button, '无内容', COPY_LABELS.row, 1000);
          return;
        }
        const ok = await copyText(text);
        flashButtonLabel(button, ok ? '已复制' : '失败', COPY_LABELS.row, 1000);
      } finally {
        focusPriceInput();
      }
    });
  });
}

function bindPriceInput() {
  if (!els.openInput) return;
  els.openInput.addEventListener('input', scheduleGenerateFromInput);
  els.openInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') scheduleGenerateNow();
  });
}

if (els.copyStrategyBtn) {
  els.copyStrategyBtn.addEventListener('click', copyStrategyOutput);
}

bindTabs();
bindPriceInput();
bindPageEnterFocus();
bindStrategyRowCopy();
focusPriceInputOnPageEnter();
scheduleGenerateFromControl();
