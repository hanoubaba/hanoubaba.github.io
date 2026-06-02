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

function formatDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatStartSlotValue(d) {
  return `${formatDateKey(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseStartSlotValue(value) {
  const m = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, day, h, mi] = m.map(Number);
  const d = new Date(y, mo - 1, day, h, mi, 0, 0);
  if (
    d.getFullYear() !== y
    || d.getMonth() !== mo - 1
    || d.getDate() !== day
    || d.getHours() !== h
    || d.getMinutes() !== mi
  ) return null;
  return d;
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatSlotLabel(at, now = new Date()) {
  const time = formatHHMM(at.getHours(), at.getMinutes());
  if (isSameDate(at, now)) return time;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  if (isSameDate(at, yesterday)) return `昨天 ${time}`;
  return `${at.getMonth() + 1}/${at.getDate()} ${time}`;
}

function formatRangeEndLabel(endAt, startAt) {
  const time = formatHHMM(endAt.getHours(), endAt.getMinutes());
  if (!startAt || isSameDate(endAt, startAt)) return time;
  const nextDay = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate() + 1, 0, 0, 0, 0);
  if (isSameDate(endAt, nextDay)) return `次日 ${time}`;
  return `${endAt.getMonth() + 1}/${endAt.getDate()} ${time}`;
}

function floorDateToStep(d, stepMinutes) {
  const mins = d.getHours() * 60 + d.getMinutes();
  const slotMins = Math.floor(mins / stepMinutes) * stepMinutes;
  const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  slot.setMinutes(slotMins);
  return slot;
}

function addPeriodToStart(startValue, periodMinutes) {
  const startAt = getStartDateTime(startValue);
  if (!startAt) return null;
  return new Date(startAt.getTime() + periodMinutes * 60 * 1000);
}

/** 按当前时间取当前已完成的时间起点（15 分钟 / 1 小时 / 4 小时格） */
function getCurrentTimeSlot(stepMinutes) {
  return formatStartSlotValue(floorDateToStep(new Date(), stepMinutes));
}

const START_TIME_SLOT_COUNT = 5;

const TIMEFRAME_MINUTES = {
  '15m': 15,
  '1h': 60,
  '4h': 240,
};

function getTimeframeMode() {
  const active = document.querySelector('[data-tablist="timeframe"] .tab-btn.is-active');
  const mode = active?.getAttribute('data-value');
  return Object.prototype.hasOwnProperty.call(TIMEFRAME_MINUTES, mode) ? mode : '15m';
}

function getTimeframeMinutes(mode = getTimeframeMode()) {
  return TIMEFRAME_MINUTES[mode] ?? TIMEFRAME_MINUTES['15m'];
}

function getOpenCost() {
  const active = document.querySelector('[data-tablist="open-cost"] .tab-btn.is-active');
  const n = Number(active?.getAttribute('data-value'));
  return Number.isFinite(n) && n > 0 ? n : 30;
}

const SUPABASE_URL = 'https://rxggjijrfafcrmtkqkuv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8B1PLTeHhtPou4lPt9cl6w_O2hipMVY';
const STRATEGIES_ENDPOINT = `${SUPABASE_URL}/rest/v1/strategies`;

function getSupabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function fromDbRecord(row) {
  return {
    id: row.id,
    name: row.name,
    side: row.side,
    price: row.price,
    quantity: row.quantity,
    takeProfit: row.take_profit,
    stopLoss: row.stop_loss,
    timeRange: row.time_range,
    createdAt: row.created_at,
    status: row.status || 'pending',
  };
}

function toDbRecord(record) {
  return {
    name: record.name,
    side: record.side,
    price: record.price,
    quantity: record.quantity,
    take_profit: record.takeProfit,
    stop_loss: record.stopLoss,
    time_range: record.timeRange,
    created_at: record.createdAt,
  };
}

function isDevEnvironment() {
  const host = window.location.hostname;
  return window.location.protocol === 'file:'
    || host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1';
}

function isMobileTimePickerEnabled() {
  return window.matchMedia('(max-width: 820px) and (pointer: coarse)').matches;
}

function getTimeSlotsByMode(mode) {
  const slots = [];
  const stepMinutes = getTimeframeMinutes(mode);
  const now = new Date();
  const currentSlot = floorDateToStep(now, stepMinutes);
  for (let i = START_TIME_SLOT_COUNT - 1; i >= 0; i -= 1) {
    const at = new Date(currentSlot.getTime() - i * stepMinutes * 60 * 1000);
    slots.push({
      value: formatStartSlotValue(at),
      label: formatSlotLabel(at, now),
      time: formatHHMM(at.getHours(), at.getMinutes()),
      at,
    });
  }
  return slots;
}

function resolveStartTimeSelection(mode, prevValue) {
  const slots = getTimeSlotsByMode(mode);
  if (!slots.length) return '';
  const prev = String(prevValue ?? '').trim();
  if (prev && slots.some((slot) => slot.value === prev)) return prev;

  const stepMinutes = getTimeframeMinutes(mode);
  const prevAt = parseStartSlotValue(prev);
  if (prevAt) {
    const aligned = formatStartSlotValue(floorDateToStep(prevAt, stepMinutes));
    if (slots.some((slot) => slot.value === aligned)) return aligned;
  }

  const prevM = minutesFromValue(prev);
  if (prevM != null) {
    const match = slots.find((slot) => minutesFromValue(slot.time) === prevM);
    if (match) return match.value;
  }

  return slots[slots.length - 1].value;
}

function updateStartTimeTriggerLabel() {
  const trigger = document.getElementById('start-time-trigger');
  const sel = document.getElementById('start-time');
  if (!trigger || !sel) return;
  const label = String(sel.selectedOptions?.[0]?.textContent ?? '').trim();
  const v = String(sel.value ?? '').trim();
  trigger.textContent = label || v || '请选择';
}

function renderMobileTimePickerOptions(selectedValue) {
  const list = document.getElementById('time-picker-list');
  if (!list) return;
  const mode = getTimeframeMode();
  const slots = getTimeSlotsByMode(mode);
  const fallbackValue = resolveStartTimeSelection(mode, selectedValue);
  const activeValue = slots.some((slot) => slot.value === selectedValue) ? selectedValue : fallbackValue;
  const frag = document.createDocumentFragment();

  for (const slot of slots) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `time-picker__option${slot.value === activeValue ? ' is-selected' : ''}`;
    btn.dataset.value = slot.value;
    btn.textContent = slot.label;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', slot.value === activeValue ? 'true' : 'false');
    frag.appendChild(btn);
  }

  list.innerHTML = '';
  list.append(frag);
}

function getMobilePickerSelectedValue() {
  const selected = document.querySelector('#time-picker-list .time-picker__option.is-selected');
  return String(selected?.dataset.value ?? '').trim();
}

function setMobilePickerSelectedValue(value) {
  document.querySelectorAll('#time-picker-list .time-picker__option').forEach((btn) => {
    const on = btn.getAttribute('data-value') === value;
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function scrollMobilePickerToSelected() {
  const list = document.getElementById('time-picker-list');
  const selected = document.querySelector('#time-picker-list .time-picker__option.is-selected');
  if (!list || !selected) return;
  const targetTop = selected.offsetTop - (list.clientHeight - selected.offsetHeight) / 2;
  list.scrollTop = Math.max(0, targetTop);
}

function openMobileTimePicker() {
  const picker = document.getElementById('start-time-picker');
  const sel = document.getElementById('start-time');
  if (!picker || !sel) return;
  renderMobileTimePickerOptions(String(sel.value ?? '').trim());
  picker.hidden = false;
  document.body.style.overflow = 'hidden';
  window.requestAnimationFrame(scrollMobilePickerToSelected);
}

function closeMobileTimePicker() {
  const picker = document.getElementById('start-time-picker');
  if (!picker) return;
  picker.hidden = true;
  document.body.style.overflow = '';
  updateStartTimeTriggerLabel();
}

function bindMobileTimePickerEvents() {
  const picker = document.getElementById('start-time-picker');
  const trigger = document.getElementById('start-time-trigger');
  const cancelBtn = document.getElementById('time-picker-cancel');
  const confirmBtn = document.getElementById('time-picker-confirm');
  const list = document.getElementById('time-picker-list');
  const sel = document.getElementById('start-time');
  if (!picker || !trigger || !cancelBtn || !confirmBtn || !list || !sel) return;

  trigger.addEventListener('click', () => {
    if (!isMobileTimePickerEnabled()) return;
    openMobileTimePicker();
  });

  picker.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.getAttribute('data-dismiss') === 'true') {
      closeMobileTimePicker();
      return;
    }
    if (target.classList.contains('time-picker__option')) {
      const v = String(target.dataset.value ?? '').trim();
      if (!v) return;
      setMobilePickerSelectedValue(v);
    }
  });

  cancelBtn.addEventListener('click', closeMobileTimePicker);

  confirmBtn.addEventListener('click', () => {
    const selected = getMobilePickerSelectedValue();
    if (!selected) {
      closeMobileTimePicker();
      return;
    }
    if (sel.value !== selected) {
      sel.value = selected;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      updateStartTimeTriggerLabel();
    }
    closeMobileTimePicker();
  });

  list.addEventListener('dblclick', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('time-picker__option')) return;
    const v = String(target.dataset.value ?? '').trim();
    if (!v) return;
    if (sel.value !== v) {
      sel.value = v;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeMobileTimePicker();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !picker.hidden) closeMobileTimePicker();
  });
}

function rebuildStartTimeOptions(preferredValue = null) {
  const sel = document.getElementById('start-time');
  if (!sel) return;

  const mode = getTimeframeMode();
  const slots = getTimeSlotsByMode(mode);
  const selectedValue = resolveStartTimeSelection(mode, preferredValue ?? sel.value);

  const frag = document.createDocumentFragment();
  if (!selectedValue || !slots.some((slot) => slot.value === selectedValue)) {
    const optPlaceholder = document.createElement('option');
    optPlaceholder.value = '';
    optPlaceholder.textContent = '请选择';
    frag.appendChild(optPlaceholder);
  }

  for (const slot of slots) {
    const o = document.createElement('option');
    o.value = slot.value;
    o.textContent = slot.label;
    if (selectedValue && slot.value === selectedValue) o.selected = true;
    frag.appendChild(o);
  }

  sel.innerHTML = '';
  sel.append(frag);

  if (selectedValue && slots.some((slot) => slot.value === selectedValue)) {
    sel.value = selectedValue;
  } else {
    sel.value = '';
  }

  updateStartTimeTriggerLabel();
  if (!document.getElementById('start-time-picker')?.hidden) {
    renderMobileTimePickerOptions(sel.value);
    scrollMobilePickerToSelected();
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
  delete outEl.dataset.qty;
  delete outEl.dataset.copyText;
  delete outEl.dataset.record;
}

function renderStrategyOutput(outEl, { plain, html }) {
  if (!outEl) return;
  outEl.innerHTML = html;
  outEl.dataset.plainText = plain;
  const qtyLine = String(plain ?? '').split('\n').find((line) => line.startsWith('数量：')) || '';
  outEl.dataset.qty = qtyLine.replace(/^数量：/, '').trim();
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

function getStartDateTime(startValue) {
  const parsed = parseStartSlotValue(startValue);
  if (parsed) return parsed;

  const startMins = minutesFromValue(startValue);
  if (startMins == null) return null;

  const mode = getTimeframeMode();
  const slots = getTimeSlotsByMode(mode);
  const match = slots.find((slot) => minutesFromValue(slot.time) === startMins);
  if (match) return new Date(match.at.getTime());

  const now = new Date();
  const startAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  startAt.setMinutes(startMins);
  if (startMins > now.getHours() * 60 + now.getMinutes()) {
    startAt.setDate(startAt.getDate() - 1);
  }
  return startAt;
}

function buildStrategy(open, stop, startTimeValue, startTimeLabel, openCost, priceDecimalPlaces) {
  const unitMin = getTimeframeMinutes();
  const spanMinutes = unitMin * 9;
  const stopDiff = Math.abs(open - stop);
  const quantity = openCost / stopDiff;
  const tp = calcTakeProfit(open, stop, 1);
  const tpDecimals = Math.max(0, priceDecimalPlaces);

  const nameEl = document.getElementById('name-input');
  const name = String(nameEl?.value ?? '').trim();
  const side = open > stop ? 'long' : 'short';
  const sideText = side === 'long' ? '开多' : '开空';
  const sideHash = side === 'long' ? '#开多' : '#开空';
  const alarmName = name || 'demo';
  const sideLabel = `${sideHash}${alarmName}`;
  const startAt = getStartDateTime(startTimeValue);
  const endAt = addPeriodToStart(startTimeValue, spanMinutes);
  const startDisplay = startTimeLabel || (startAt ? formatSlotLabel(startAt) : startTimeValue);
  const endTimeHHMM = endAt ? formatHHMM(endAt.getHours(), endAt.getMinutes()) : '—';
  const endDisplay = endAt ? formatRangeEndLabel(endAt, startAt) : '—';
  const timeRangeLabel = `${startDisplay} — ${endDisplay}`;

  const qty = formatQuantity(quantity);
  const priceLabel = formatPrice(open);
  const tpLabel = formatFixedDecimals(tp, tpDecimals);
  const stopLabel = formatPrice(stop);
  const createTimeLabel = formatCreateTime();

  const lines = [
    sideLabel,
    `价格：${priceLabel}`,
    `数量：${qty}`,
    `参考止盈：${tpLabel}`,
    `止损：${stopLabel}`,
    `时间范围：${timeRangeLabel}`,
    `创建时间：${createTimeLabel}`,
  ];

  const copyText = `帮我创建一个${endTimeHHMM}的闹钟，名称为${alarmName}。`;
  const record = {
    name: alarmName,
    side,
    price: priceLabel,
    quantity: qty,
    takeProfit: tpLabel,
    stopLoss: stopLabel,
    timeRange: timeRangeLabel,
    createdAt: createTimeLabel,
  };

  const plain = lines.join('\n');
  const html = lines.map((line) => escapeHtml(line)).join('\n');

  return { plain, html, copyText, record };
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

function generate() {
  const openEl = document.getElementById('open-price-input');
  const stopEl = document.getElementById('stop-price-input');
  const timeEl = document.getElementById('start-time');
  const errEl = document.getElementById('error');
  const outEl = document.getElementById('strategy-output');

  const open = toNumber(openEl && 'value' in openEl ? openEl.value : '');
  const stop = toNumber(stopEl && 'value' in stopEl ? stopEl.value : '');
  const startTime = timeEl && 'value' in timeEl ? String(timeEl.value).trim() : '';
  const startTimeLabel = timeEl ? String(timeEl.selectedOptions?.[0]?.textContent ?? '').trim() : '';

  if (errEl) errEl.textContent = '';

  if (open === null || stop === null) {
    if (errEl) errEl.textContent = '请输入有效的价格与止损（数字）。';
    clearStrategyOutput(outEl);
    return;
  }

  if (open <= 0) {
    if (errEl) errEl.textContent = '价格须为大于 0 的数字。';
    clearStrategyOutput(outEl);
    return;
  }

  if (!startTime) {
    if (errEl) errEl.textContent = '请选择开始时间。';
    clearStrategyOutput(outEl);
    return;
  }

  if (open === stop) {
    if (errEl) errEl.textContent = '价格与止损不能相同，无法计算数量与方向。';
    clearStrategyOutput(outEl);
    return;
  }

  const openRaw = openEl && 'value' in openEl ? String(openEl.value) : '';
  const priceDecimals = getDecimalPlacesFromInput(openRaw);
  const strategy = buildStrategy(open, stop, startTime, startTimeLabel, getOpenCost(), priceDecimals);
  renderStrategyOutput(outEl, strategy);
  if (outEl) {
    outEl.dataset.copyText = strategy.copyText;
    outEl.dataset.record = JSON.stringify(strategy.record);
  }
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tablist = btn.closest('[role="tablist"]');
    if (tablist?.getAttribute('data-locked') === 'true') return;
    setTabsActive(btn);
    if (btn.closest('[data-tablist="timeframe"]')) rebuildStartTimeOptions();
    autoGenerateIfReady();
  });
});

let startTimeUserPicked = false;
rebuildStartTimeOptions();
bindMobileTimePickerEvents();

const openInput = document.getElementById('open-price-input');
const stopInput = document.getElementById('stop-price-input');
const startTimeSelect = document.getElementById('start-time');
function onEnter(e) {
  if (e.key === 'Enter') generate();
}
if (openInput) openInput.addEventListener('keydown', onEnter);
if (stopInput) stopInput.addEventListener('keydown', onEnter);
if (startTimeSelect) startTimeSelect.addEventListener('keydown', onEnter);

function autoGenerateIfReady() {
  const openVal = String(openInput?.value ?? '').trim();
  const stopVal = String(stopInput?.value ?? '').trim();
  if (openVal && stopVal) {
    generate();
    return;
  }
  const errEl = document.getElementById('error');
  const outEl = document.getElementById('strategy-output');
  if (errEl) errEl.textContent = '';
  clearStrategyOutput(outEl);
}

if (openInput) openInput.addEventListener('input', autoGenerateIfReady);
if (stopInput) stopInput.addEventListener('input', autoGenerateIfReady);
if (startTimeSelect) startTimeSelect.addEventListener('change', autoGenerateIfReady);
if (startTimeSelect) startTimeSelect.addEventListener('change', updateStartTimeTriggerLabel);
if (startTimeSelect) startTimeSelect.addEventListener('change', () => { startTimeUserPicked = true; });

/**
 * 开始时间默认值是基于「当前时间」算出来的。页面长时间不刷新时，
 * new Date() 不会重新读取，默认值就会停在过期的时间格上。
 * 这里在用户尚未手动选择时，定时 + 切回标签页时重新对齐到当前时间格。
 */
function syncStartTimeToNow() {
  const sel = document.getElementById('start-time');
  if (!sel || startTimeUserPicked) return;
  const picker = document.getElementById('start-time-picker');
  if (picker && !picker.hidden) return; // 移动端选择器打开时不打扰
  const stepMinutes = getTimeframeMinutes();
  const nowSlot = getCurrentTimeSlot(stepMinutes);
  if (sel.value === nowSlot) return;
  rebuildStartTimeOptions(nowSlot);
  updateStartTimeTriggerLabel();
  autoGenerateIfReady();
}

setInterval(syncStartTimeToNow, 30 * 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncStartTimeToNow();
});
window.addEventListener('focus', syncStartTimeToNow);

const nameInput = document.getElementById('name-input');
if (nameInput) nameInput.addEventListener('input', autoGenerateIfReady);

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

async function fetchStrategies() {
  const res = await fetch(`${STRATEGIES_ENDPOINT}?select=*&order=inserted_at.desc`, {
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map(fromDbRecord) : [];
}

async function createStrategy(record) {
  const res = await fetch(STRATEGIES_ENDPOINT, {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(toDbRecord(record)),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function clearStrategies() {
  const res = await fetch(`${STRATEGIES_ENDPOINT}?id=not.is.null`, {
    method: 'DELETE',
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function updateStrategyStatus(id, status) {
  const encodedId = encodeURIComponent(id);
  const res = await fetch(`${STRATEGIES_ENDPOINT}?id=eq.${encodedId}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
}

function normalizeStrategyStatus(status) {
  return status === 'profit' || status === 'loss' ? status : 'pending';
}

function getStrategyStatusLabel(status) {
  if (status === 'profit') return '盈利';
  if (status === 'loss') return '亏损';
  return '';
}

function parseCreatedAt(value) {
  const raw = String(value ?? '').trim();
  const m = raw.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})$/);
  if (m) {
    const [, y, mo, day, h, mi] = m.map(Number);
    const d = new Date(y, mo - 1, day, h, mi, 0, 0);
    if (
      d.getFullYear() === y
      && d.getMonth() === mo - 1
      && d.getDate() === day
      && d.getHours() === h
      && d.getMinutes() === mi
    ) return d;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseClockText(text) {
  const m = String(text ?? '').trim().match(/(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return { h, mi, mins: h * 60 + mi };
}

function parseMonthDayText(text, reference) {
  const m = String(text ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, mo, day, h, mi] = m.map(Number);
  const d = new Date(reference.getFullYear(), mo - 1, day, h, mi, 0, 0);
  if (
    d.getMonth() !== mo - 1
    || d.getDate() !== day
    || d.getHours() !== h
    || d.getMinutes() !== mi
  ) return null;
  if (d.getTime() > reference.getTime() + 24 * 60 * 60 * 1000) d.setFullYear(d.getFullYear() - 1);
  return d;
}

function parseRangeStartLabel(label, createdAt) {
  const raw = String(label ?? '').trim();
  const monthDay = parseMonthDayText(raw, createdAt);
  if (monthDay) return monthDay;

  const clock = parseClockText(raw);
  if (!clock) return null;

  const startAt = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate(), clock.h, clock.mi, 0, 0);
  if (raw.startsWith('昨天')) {
    startAt.setDate(startAt.getDate() - 1);
    return startAt;
  }

  const createdMins = createdAt.getHours() * 60 + createdAt.getMinutes();
  if (clock.mins > createdMins) startAt.setDate(startAt.getDate() - 1);
  return startAt;
}

function parseRangeEndLabel(label, startAt, createdAt) {
  const raw = String(label ?? '').trim();
  const monthDay = parseMonthDayText(raw, createdAt);
  if (monthDay) return monthDay;

  const clock = parseClockText(raw);
  if (!clock) return null;

  const base = startAt || createdAt;
  const endAt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), clock.h, clock.mi, 0, 0);
  if (raw.startsWith('次日')) {
    endAt.setDate(endAt.getDate() + 1);
    return endAt;
  }

  const startMins = startAt ? startAt.getHours() * 60 + startAt.getMinutes() : 0;
  if (startAt && clock.mins < startMins) endAt.setDate(endAt.getDate() + 1);
  return endAt;
}

function getTimeRangeEndAt(timeRange, createdAtValue) {
  const parts = String(timeRange ?? '').split('—').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const createdAt = parseCreatedAt(createdAtValue);
  const startAt = parseRangeStartLabel(parts[0], createdAt);
  return parseRangeEndLabel(parts[1], startAt, createdAt);
}

function getTimeRangeStatusByEndAt(endAt) {
  if (!endAt) return 'active';
  return Date.now() >= endAt.getTime() ? 'ended' : 'active';
}

function getTimeRangeStatusLabel(status) {
  return status === 'ended' ? '已结束' : '进行中';
}

let pendingStatusRecordId = '';

function setStatusPickerLoading(loading) {
  document.querySelectorAll('#status-picker button').forEach((btn) => {
    btn.disabled = loading;
  });
}

function setStatusPickerError(message) {
  const errEl = document.getElementById('status-picker-error');
  if (errEl) errEl.textContent = message;
}

function openStatusPicker(id) {
  const picker = document.getElementById('status-picker');
  if (!picker || !id) return;
  pendingStatusRecordId = id;
  setStatusPickerLoading(false);
  setStatusPickerError('');
  picker.hidden = false;
  document.body.style.overflow = 'hidden';
  window.requestAnimationFrame(() => {
    document.getElementById('status-picker-profit')?.focus({ preventScroll: true });
  });
}

function closeStatusPicker() {
  const picker = document.getElementById('status-picker');
  if (!picker) return;
  pendingStatusRecordId = '';
  setStatusPickerLoading(false);
  setStatusPickerError('');
  picker.hidden = true;
  document.body.style.overflow = '';
}

async function submitStatusFromPicker(status) {
  const nextStatus = normalizeStrategyStatus(status);
  const id = pendingStatusRecordId;
  if (!id || nextStatus === 'pending') return;
  setStatusPickerLoading(true);
  setStatusPickerError('');
  try {
    await updateStrategyStatus(id, nextStatus);
    closeStatusPicker();
    await renderAdminList();
  } catch {
    setStatusPickerError('提交失败，请检查网络或 Supabase 权限。');
    setStatusPickerLoading(false);
  }
}

function renderAdminStats(rows) {
  const statsEl = document.getElementById('admin-stats');
  if (!statsEl) return;
  const total = rows.length;
  const profit = rows.filter((row) => normalizeStrategyStatus(row?.status) === 'profit').length;
  const loss = rows.filter((row) => normalizeStrategyStatus(row?.status) === 'loss').length;
  const opened = profit + loss;
  const winRate = opened ? `${Math.round((profit / opened) * 100)}%` : '0%';
  const openRate = total ? `${Math.round((opened / total) * 100)}%` : '0%';
  statsEl.innerHTML = [
    `<div class="admin-stat"><span class="admin-stat__label">数量</span><span class="admin-stat__value">${total}</span></div>`,
    `<div class="admin-stat"><span class="admin-stat__label">胜率</span><span class="admin-stat__value">${winRate}</span></div>`,
    `<div class="admin-stat"><span class="admin-stat__label">开单率</span><span class="admin-stat__value">${openRate}</span></div>`,
  ].join('');
}

async function renderAdminList() {
  const listEl = document.getElementById('admin-list');
  if (!listEl) return;
  let rows = [];
  try {
    rows = await fetchStrategies();
  } catch (err) {
    renderAdminStats([]);
    listEl.innerHTML = `<div class="admin-sync-error">${escapeHtml(String(err?.message || '同步失败'))}</div>`;
    return;
  }
  renderAdminStats(rows);
  if (!rows.length) {
    listEl.innerHTML = '';
    return;
  }
  listEl.innerHTML = rows.map((row) => {
    const sideRaw = String(row?.side ?? '').trim();
    const nameRaw = String(row?.name ?? '').trim();
    const isLong = sideRaw === 'long';
    const isShort = sideRaw === 'short';
    const sideMod = isLong ? 'long' : (isShort ? 'short' : 'flat');
    const sideText = escapeHtml(isLong ? '开多' : (isShort ? '开空' : '—'));
    const name = escapeHtml(nameRaw || '未命名');
    const price = escapeHtml(String(row?.price ?? '-'));
    const qty = escapeHtml(String(row?.quantity ?? '-'));
    const tp = escapeHtml(String(row?.takeProfit ?? '-'));
    const stop = escapeHtml(String(row?.stopLoss ?? '-'));
    const range = escapeHtml(String(row?.timeRange ?? '-'));
    const createTime = escapeHtml(String(row?.createdAt ?? '-'));
    const endTime = escapeHtml(String(row?.timeRange ?? '').split('—').pop()?.trim() || '');
    const copyText = escapeHtml(`帮我创建一个${endTime}的闹钟，名称为${nameRaw || '未命名'}。`);
    const id = escapeHtml(String(row?.id ?? ''));
    const status = normalizeStrategyStatus(row?.status);
    const statusLabel = getStrategyStatusLabel(status);
    const resultStatusHtml = statusLabel
      ? `<div class="admin-status admin-status--${status}"><span class="admin-status__tag">${escapeHtml(statusLabel)}</span></div>`
      : '';
    const timeStatusEndAt = getTimeRangeEndAt(row?.timeRange, row?.createdAt);
    const timeStatus = getTimeRangeStatusByEndAt(timeStatusEndAt);
    const timeStatusLabel = escapeHtml(getTimeRangeStatusLabel(timeStatus));
    const timeStatusHtml = `<div class="admin-status admin-status--time-${timeStatus}"><span class="admin-status__tag">${timeStatusLabel}</span></div>`;
    const statusAction = status === 'pending' && id
      ? `<button type="button" class="admin-status__open" data-id="${id}" aria-haspopup="dialog" aria-controls="status-picker">提交状态</button>`
      : '';
    return [
      `<article class="admin-item admin-item--${sideMod}">`,
      '<header class="admin-item__head">',
      `<span class="admin-item__side">${sideText}</span>`,
      `<span class="admin-item__title">${name}</span>`,
      resultStatusHtml,
      timeStatusHtml,
      '</header>',
      '<div class="admin-item__metrics">',
      `<div class="metric"><span class="metric__label">价格</span><span class="metric__value">${price}</span></div>`,
      `<div class="metric"><span class="metric__label">数量</span><span class="metric__value">${qty}</span></div>`,
      `<div class="metric metric--tp"><span class="metric__label">参考止盈</span><span class="metric__value">${tp}</span></div>`,
      `<div class="metric metric--stop"><span class="metric__label">止损</span><span class="metric__value">${stop}</span></div>`,
      '</div>',
      '<footer class="admin-item__foot">',
      `<span class="admin-item__range">${range}</span>`,
      `<span class="admin-item__created">${createTime}</span>`,
      '</footer>',
      '<div class="admin-item__actions">',
      '<div class="admin-item__buttons">',
      statusAction,
      `<button type="button" class="admin-item__copy" data-copy="${copyText}" aria-label="复制指令">复制指令</button>`,
      '</div>',
      '</div>',
      '</article>',
    ].join('');
  }).join('');
}

let currentPage = 'front';

function setPage(mode) {
  const front = document.getElementById('front-page');
  const admin = document.getElementById('admin-page');
  const btnFront = document.getElementById('btn-tab-front');
  const btnAdmin = document.getElementById('btn-tab-admin');
  if (!front || !admin || !btnFront || !btnAdmin) return;
  const toAdmin = mode === 'admin';
  currentPage = toAdmin ? 'admin' : 'front';
  front.hidden = toAdmin;
  admin.hidden = !toAdmin;
  btnFront.classList.toggle('is-active', !toAdmin);
  btnFront.setAttribute('aria-selected', toAdmin ? 'false' : 'true');
  btnAdmin.classList.toggle('is-active', toAdmin);
  btnAdmin.setAttribute('aria-selected', toAdmin ? 'true' : 'false');
  const btnClear = document.getElementById('btn-clear');
  if (btnClear) {
    btnClear.hidden = toAdmin && !isDevEnvironment();
    btnClear.textContent = toAdmin ? '删除' : '清空';
  }
  if (toAdmin) renderAdminList().catch(() => {});
}

function flashCopyStrategyBtn(btn, label, duration = 1200) {
  if (!btn) return;
  if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
  if (btn._flashTimer) clearTimeout(btn._flashTimer);
  btn.textContent = label;
  btn._flashTimer = setTimeout(() => {
    btn.textContent = btn.dataset.defaultLabel || '保存';
    btn._flashTimer = null;
  }, duration);
}

async function copyStrategyOutput() {
  const btn = document.getElementById('btn-copy-strategy');
  const out = document.getElementById('strategy-output');
  const errEl = document.getElementById('error');
  const nameEl = document.getElementById('name-input');
  const name = String(nameEl?.value ?? '').trim();
  if (!name) {
    if (errEl) errEl.textContent = '保存前请填写名称。';
    flashCopyStrategyBtn(btn, '请填名称');
    return;
  }
  if (errEl) errEl.textContent = '';
  const text = String(out?.dataset.copyText ?? '').trim();
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
  if (ok && out?.dataset.record) {
    try {
      await createStrategy(JSON.parse(out.dataset.record));
      if (currentPage === 'admin') await renderAdminList();
    } catch {
      if (errEl) errEl.textContent = '复制成功，但保存失败。请检查 Supabase 表和权限。';
      flashCopyStrategyBtn(btn, '保存失败');
      return;
    }
  }
  flashCopyStrategyBtn(btn, ok ? '已保存' : '复制失败');
}

async function copyQtyOutput() {
  const btn = document.getElementById('btn-copy-qty');
  const out = document.getElementById('strategy-output');
  const qty = String(out?.dataset.qty ?? '').trim();
  if (!qty) {
    flashCopyStrategyBtn(btn, '无内容');
    return;
  }
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(qty);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) ok = copyFallback(qty);
  flashCopyStrategyBtn(btn, ok ? '已复制' : '复制失败');
}

const btnCopyStrategy = document.getElementById('btn-copy-strategy');
if (btnCopyStrategy) btnCopyStrategy.addEventListener('click', copyStrategyOutput);
const btnCopyQty = document.getElementById('btn-copy-qty');
if (btnCopyQty) btnCopyQty.addEventListener('click', copyQtyOutput);
const clearFront = () => {
  if (openInput) openInput.value = '';
  if (stopInput) stopInput.value = '';
  if (nameInput) nameInput.value = '';
  const errEl = document.getElementById('error');
  const outEl = document.getElementById('strategy-output');
  if (errEl) errEl.textContent = '';
  clearStrategyOutput(outEl);
  if (openInput) openInput.focus({ preventScroll: true });
};
const clearAll = () => {
  if (currentPage === 'admin') {
    if (!isDevEnvironment()) return;
    clearStrategies()
      .then(renderAdminList)
      .catch(() => {});
    return;
  }
  clearFront();
};
const btnClear = document.getElementById('btn-clear');
if (btnClear) btnClear.addEventListener('click', clearAll);

const btnTabFront = document.getElementById('btn-tab-front');
if (btnTabFront) btnTabFront.addEventListener('click', () => setPage('front'));
const btnTabAdmin = document.getElementById('btn-tab-admin');
if (btnTabAdmin) btnTabAdmin.addEventListener('click', () => setPage('admin'));

const adminListEl = document.getElementById('admin-list');
if (adminListEl) {
  adminListEl.addEventListener('click', async (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;

    const statusOpenBtn = target.closest('.admin-status__open');
    if (statusOpenBtn) {
      const id = String(statusOpenBtn.getAttribute('data-id') ?? '').trim();
      openStatusPicker(id);
      return;
    }

    const btn = target.closest('.admin-item__copy');
    if (!btn) return;
    const text = String(btn.getAttribute('data-copy') ?? '').trim();
    if (!text) return;
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
  });
}

const statusPicker = document.getElementById('status-picker');
if (statusPicker) {
  statusPicker.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;
    if (target.getAttribute('data-status-picker-dismiss') === 'true') {
      closeStatusPicker();
      return;
    }
    const option = target.closest('[data-status]');
    if (!option) return;
    submitStatusFromPicker(option.getAttribute('data-status'));
  });
}

const statusPickerCancel = document.getElementById('status-picker-cancel');
if (statusPickerCancel) statusPickerCancel.addEventListener('click', closeStatusPicker);

document.addEventListener('keydown', (e) => {
  const picker = document.getElementById('status-picker');
  if (e.key === 'Escape' && picker && !picker.hidden) closeStatusPicker();
});

setPage('front');
