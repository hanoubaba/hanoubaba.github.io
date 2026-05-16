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

function getTimeframeMode() {
  const active = document.querySelector('.tab-btn.is-active');
  return active?.getAttribute('data-value') === '1h' ? '1h' : '15m';
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
    sel.value = '';
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

function formatLeverageInt(a, b) {
  const d = Math.abs(a - b);
  if (!(d > 0) || !Number.isFinite(a) || Math.abs(a) < Number.EPSILON) return null;
  const lev = Math.abs(a) / d;
  return String(Math.round(lev));
}

function buildStrategy(open, stop, startTimeLabel) {
  const unitMin = getTimeframeMode() === '1h' ? 60 : 15;
  const spanMinutes = unitMin * 9;

  const sideLabel = open > stop ? '#开多' : '#开空';
  const tp = 2 * open - stop;
  const leverageStr = formatLeverageInt(open, stop) ?? '—';

  const endTimeLabel = addPeriodToStart(startTimeLabel, spanMinutes);
  const timeRangeLabel = `${startTimeLabel} — ${endTimeLabel}`;

  return [
    sideLabel,
    `${leverageStr} 倍`,
    `起始：${formatPrice(open)}`,
    `止盈：${formatPrice(tp)}`,
    `止损：${formatPrice(stop)}`,
    `时间范围：${timeRangeLabel}`,
  ].join('\n');
}

function setTabsActive(clicked) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const on = btn === clicked;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function generate() {
  const openEl = document.getElementById('open-price-input');
  const stopEl = document.getElementById('stop-price-input');
  const timeEl = document.getElementById('start-time');
  const errEl = document.getElementById('error');
  const outEl = document.getElementById('strategy-output');

  const open = toNumber(openEl && 'value' in openEl ? openEl.value : '');
  const stop = toNumber(stopEl && 'value' in stopEl ? stopEl.value : '');
  const startTime = timeEl && 'value' in timeEl ? String(timeEl.value).trim() : '';

  if (errEl) errEl.textContent = '';

  if (open === null || stop === null) {
    if (errEl) errEl.textContent = '请输入有效的起始价格与止损价格（数字）。';
    if (outEl) outEl.textContent = '';
    return;
  }

  if (open <= 0) {
    if (errEl) errEl.textContent = '起始价格须为大于 0 的数字。';
    if (outEl) outEl.textContent = '';
    return;
  }

  if (!startTime) {
    if (errEl) errEl.textContent = '请选择开始时间。';
    if (outEl) outEl.textContent = '';
    return;
  }

  if (open === stop) {
    if (errEl) errEl.textContent = '起始价格与止损价格不能相同，无法计算杠杆与方向。';
    if (outEl) outEl.textContent = '';
    return;
  }

  const text = buildStrategy(open, stop, startTime);
  if (outEl) outEl.textContent = text;
}

const btnGenerate = document.getElementById('btn-generate');
if (btnGenerate) btnGenerate.addEventListener('click', generate);

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setTabsActive(btn);
    rebuildStartTimeOptions();
  });
});

rebuildStartTimeOptions();

const openInput = document.getElementById('open-price-input');
const stopInput = document.getElementById('stop-price-input');
const startTimeSelect = document.getElementById('start-time');
function onEnter(e) {
  if (e.key === 'Enter') generate();
}
if (openInput) openInput.addEventListener('keydown', onEnter);
if (stopInput) stopInput.addEventListener('keydown', onEnter);
if (startTimeSelect) startTimeSelect.addEventListener('keydown', onEnter);

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
  const text = (out?.textContent ?? '').trim();
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
}

const btnCopyStrategy = document.getElementById('btn-copy-strategy');
if (btnCopyStrategy) btnCopyStrategy.addEventListener('click', copyStrategyOutput);
