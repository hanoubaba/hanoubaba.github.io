function toNumber(value) {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatPrice(n) {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 20,
  });
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
  return formatFixedDecimals(n, 1);
}

/** 从输入字符串读取小数位数（以价格输入为准） */
function getDecimalPlacesFromInput(value) {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  if (!normalized) return 0;
  const dot = normalized.indexOf('.');
  if (dot === -1) return 0;
  const frac = normalized.slice(dot + 1);
  if (!/^\d*$/.test(frac)) return 0;
  return frac.length;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatHHMM(h, m) {
  return `${pad2(h)}:${pad2(m)}`;
}

function minutesFromValue(val) {
  if (!val || !/^\d{1,2}:\d{2}$/.test(val)) return null;
  const [h, m] = val.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToValue(total) {
  const t = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return formatHHMM(h, m);
}

function addPeriodToStart(startHHMM, periodMinutes) {
  const sm = minutesFromValue(startHHMM);
  if (sm == null) return '—';
  const total = sm + periodMinutes;
  const nextDay = total >= 24 * 60;
  const timeStr = minutesToValue(total);
  return nextDay ? `${timeStr}（次日）` : timeStr;
}

function closestSlotMinutes(mins, stepMinutes) {
  let s = Math.round(mins / stepMinutes) * stepMinutes;
  const max = 24 * 60 - stepMinutes;
  if (s > max) s = max;
  if (s < 0) s = 0;
  return s;
}

/** 按当前时间取最近的时间起点（15 分钟 / 1 小时格） */
function getCurrentTimeSlot(stepMinutes) {
  const d = new Date();
  const mins = d.getHours() * 60 + d.getMinutes();
  return minutesToValue(closestSlotMinutes(mins, stepMinutes));
}

function getTimeframeMode() {
  const active = document.querySelector('[data-tablist="timeframe"] .tab-btn.is-active');
  return active?.getAttribute('data-value') === '1h' ? '1h' : '15m';
}

function getOpenCost() {
  const active = document.querySelector('[aria-label="开仓成本"] .tab-btn.is-active');
  const n = Number(active?.getAttribute('data-value'));
  return Number.isFinite(n) ? n : 30;
}

function getDirection() {
  const active = document.querySelector('[data-tablist="direction"] .tab-btn.is-active');
  return active?.getAttribute('data-value') === 'short' ? 'short' : 'long';
}

function getMultiplier() {
  const active = document.querySelector('[data-tablist="multiplier"] .tab-btn.is-active');
  const n = Number(active?.getAttribute('data-value'));
  return Number.isFinite(n) && n > 0 ? n : 20;
}

/** 总空间 = 开仓成本 × 倍数；1 倍成本止损价差 = 价格 / 倍数 */
function calcStopDiff(open, multiplier) {
  if (!(open > 0) || !(multiplier > 0)) return null;
  return open / multiplier;
}

function calcStopPrice(open, direction, multiplier) {
  const stopDiff = calcStopDiff(open, multiplier);
  if (stopDiff == null) return null;
  return direction === 'long' ? open - stopDiff : open + stopDiff;
}

/** 1 倍成本止损数量 = 总空间 / 价格 */
function calcQuantity1x(open, openCost, multiplier) {
  if (!(open > 0)) return null;
  const totalSpace = openCost * multiplier;
  return totalSpace / open;
}

function rebuildStartTimeOptions() {
  const sel = document.getElementById('start-time');
  if (!sel) return;

  const mode = getTimeframeMode();
  const prev = String(sel.value ?? '').trim();
  const prevM = minutesFromValue(prev);

  const frag = document.createDocumentFragment();
  const optPlaceholder = document.createElement('option');
  optPlaceholder.value = '';
  optPlaceholder.textContent = '请选择';
  frag.appendChild(optPlaceholder);

  if (mode === '1h') {
    for (let h = 0; h < 24; h += 1) {
      const o = document.createElement('option');
      const v = formatHHMM(h, 0);
      o.value = v;
      o.textContent = v;
      frag.appendChild(o);
    }
  } else {
    for (let h = 0; h < 24; h += 1) {
      for (let m = 0; m < 60; m += 15) {
        const o = document.createElement('option');
        const v = formatHHMM(h, m);
        o.value = v;
        o.textContent = v;
        frag.appendChild(o);
      }
    }
  }

  sel.innerHTML = '';
  sel.append(frag);

  if (!prev) {
    sel.value = getCurrentTimeSlot(mode === '1h' ? 60 : 15);
    return;
  }

  if (mode === '1h') {
    const base = prevM == null ? 0 : prevM;
    sel.value = minutesToValue(closestSlotMinutes(base, 60));
    return;
  }

  if (prevM != null && prevM % 15 === 0) {
    sel.value = minutesToValue(prevM);
  } else if (prevM != null) {
    sel.value = minutesToValue(closestSlotMinutes(prevM, 15));
  } else {
    sel.value = '';
  }
}

function formatCreateTime() {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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
}

function renderStrategyOutput(outEl, { plain, html }) {
  if (!outEl) return;
  outEl.innerHTML = html;
  outEl.dataset.plainText = plain;
}

/** 止盈价：盈利 = multiplier×开仓成本 → 价差移动 = multiplier×|价格-止损| */
function calcTakeProfit(open, stop, multiplier = 1) {
  const stopDiff = Math.abs(open - stop);
  const m = Number(multiplier);
  if (!(stopDiff > 0) || !Number.isFinite(m) || m <= 0) return null;
  const move = stopDiff * m;
  if (open > stop) return open + move;
  return open - move;
}

function buildStrategy(open, direction, startTimeLabel, openCost, multiplier, priceDecimalPlaces) {
  const unitMin = getTimeframeMode() === '1h' ? 60 : 15;
  const spanMinutes = unitMin * 6;
  const stop = calcStopPrice(open, direction, multiplier);
  const quantity = calcQuantity1x(open, openCost, multiplier);
  const tpDecimals = Math.max(0, priceDecimalPlaces);

  const sideLabel = direction === 'long' ? '#开多' : '#开空';
  const endTimeLabel = addPeriodToStart(startTimeLabel, spanMinutes);
  const timeRangeLabel = `${startTimeLabel} — ${endTimeLabel}`;

  const fmtTp = (mult) => formatFixedDecimals(calcTakeProfit(open, stop, mult), tpDecimals);
  const priceStr = formatPrice(open);
  const qty = formatQuantity(quantity);

  const lines = [
    sideLabel,
    `价格：${priceStr}`,
    `数量：${qty}`,
    `止盈：${fmtTp(1)}`,
    `止损：${formatFixedDecimals(stop, tpDecimals)}`,
    `平仓1：${fmtTp(1)}`,
    `平仓3：${fmtTp(3)}`,
    `平仓5：${fmtTp(5)}`,
    `时间范围：${timeRangeLabel}`,
    `创建时间：${formatCreateTime()}`,
  ];

  const plain = lines.join('\n');
  const html = lines
    .map((line) => {
      if (line.startsWith('价格：')) {
        return `价格：<strong class="strategy-qty-value">${escapeHtml(priceStr)}</strong>`;
      }
      if (line.startsWith('数量：')) {
        return `数量：<strong class="strategy-qty-value">${escapeHtml(qty)}</strong>`;
      }
      return escapeHtml(line);
    })
    .join('\n');

  return { plain, html };
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
  const timeEl = document.getElementById('start-time');
  const errEl = document.getElementById('error');
  const outEl = document.getElementById('strategy-output');

  const openRaw = openEl && 'value' in openEl ? String(openEl.value) : '';
  const open = toNumber(openRaw);
  const startTime = timeEl && 'value' in timeEl ? String(timeEl.value).trim() : '';

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

  if (!startTime) {
    if (errEl && !silent) errEl.textContent = '请选择开始时间。';
    clearStrategyOutput(outEl);
    return;
  }

  const priceDecimals = getDecimalPlacesFromInput(openRaw);
  renderStrategyOutput(
    outEl,
    buildStrategy(open, getDirection(), startTime, getOpenCost(), getMultiplier(), priceDecimals),
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

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setTabsActive(btn);
    if (btn.closest('[data-tablist="timeframe"]')) rebuildStartTimeOptions();
    scheduleGenerateFromControl();
    focusPriceInput();
  });
});

rebuildStartTimeOptions();

const openInput = document.getElementById('open-price-input');
const startTimeSelect = document.getElementById('start-time');

if (openInput) {
  openInput.addEventListener('input', scheduleGenerateFromInput);
  openInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') scheduleGenerateNow();
  });
  openInput.focus();
}
if (startTimeSelect) {
  startTimeSelect.addEventListener('change', scheduleGenerateFromControl);
  startTimeSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') scheduleGenerateNow();
  });
}

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
  const text = (out?.dataset.plainText ?? out?.textContent ?? '').trim();
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
