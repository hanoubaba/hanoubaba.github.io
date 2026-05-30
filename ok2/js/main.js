function toNumber(value) {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatHHMM(h, m) {
  return `${pad2(h)}:${pad2(m)}`;
}

function minutesToHHMM(total) {
  const all = 24 * 60;
  const t = ((total % all) + all) % all;
  return formatHHMM(Math.floor(t / 60), t % 60);
}

function getTimeRangeLabel(spanMinutes = 360) {
  const d = new Date();
  const start = d.getHours() * 60 + d.getMinutes();
  const end = start + spanMinutes;
  const endLabel = minutesToHHMM(end);
  const nextDay = end >= 24 * 60;
  const startLabel = formatHHMM(d.getHours(), d.getMinutes());
  return `${startLabel} — ${endLabel}${nextDay ? '（次日）' : ''}`;
}

function formatCreateTime() {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

const COPY_LABELS = {
  strategy: '一键复制全部',
  qty: '复制数量',
};

const INPUT_DEBOUNCE_MS = 300;
const CONTROL_THROTTLE_MS = 120;

const els = {
  openInput: document.getElementById('open-price-input'),
  error: document.getElementById('error'),
  strategyOutput: document.getElementById('strategy-output'),
  copyStrategyBtn: document.getElementById('btn-copy-strategy'),
  copyQtyBtn: document.getElementById('btn-copy-qty'),
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  if (!els.strategyOutput) return;
  els.strategyOutput.textContent = '';
  delete els.strategyOutput.dataset.plainText;
  delete els.strategyOutput.dataset.qty;
}

function renderStrategyOutput({ plain, html, qty }) {
  if (!els.strategyOutput) return;
  els.strategyOutput.innerHTML = html;
  els.strategyOutput.dataset.plainText = plain || '';
  els.strategyOutput.dataset.qty = qty || '';
}

function buildStrategy(open, config) {
  const { openCost, multiplier, direction, riskMultiple } = config;
  const stop = calcStopPrice(open, multiplier, direction, riskMultiple);
  const quantity = calcQuantity1x(open, openCost, multiplier);
  const takeProfit = calcTakeProfit(open, stop, direction);
  const timeRange = getTimeRangeLabel(360);
  const createTime = formatCreateTime();

  const qty = formatQuantity(quantity);
  const tp = formatPriceOutput(takeProfit);
  const stopText = formatPriceOutput(stop);

  const lines = [
    direction === 'short' ? '#开空' : '#开多',
    `价格：${formatPriceOutput(open)}`,
    `数量：${qty}`,
    `止盈：${tp}`,
    `止损：${stopText}`,
    `时间范围：${timeRange}`,
    `创建时间：${createTime}`,
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
      const tablist = btn.closest('[role="tablist"]');
      if (tablist?.getAttribute('data-locked') === 'true') return;
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

async function copyQtyOutput() {
  try {
    const qtyText = String(els.strategyOutput?.dataset.qty ?? '').trim();
    if (!qtyText) {
      flashButtonLabel(els.copyQtyBtn, '无内容', COPY_LABELS.qty, 1000);
      return;
    }
    const ok = await copyText(qtyText);
    flashButtonLabel(els.copyQtyBtn, ok ? '已复制' : '复制失败', COPY_LABELS.qty, 1000);
  } finally {
    focusPriceInput();
  }
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
if (els.copyQtyBtn) {
  els.copyQtyBtn.addEventListener('click', copyQtyOutput);
}

bindTabs();
bindPriceInput();
bindPageEnterFocus();
focusPriceInputOnPageEnter();
scheduleGenerateFromControl();
