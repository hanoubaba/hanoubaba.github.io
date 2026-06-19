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

function formatTrimmedFixedDecimals(n, decimals) {
  const fixed = formatFixedDecimals(n, decimals);
  return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
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

function formatFullDateTimeLabel(d) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

/** 按当前时间取当前已完成的时间起点（1 小时 / 4 小时格） */
function getCurrentTimeSlot(stepMinutes) {
  return formatStartSlotValue(floorDateToStep(new Date(), stepMinutes));
}

const START_TIME_SLOT_COUNT = 5;
const DEFAULT_TIMEFRAME = '4h';

const TIMEFRAME_MINUTES = {
  '1h': 60,
  '4h': 240,
};

const TIMEFRAME_LABELS = {
  '1h': '1小时',
  '4h': '4小时',
};

const PRICE_ADJUSTMENT_RATE = 0;
const TAKE_PROFIT_R_MULTIPLE = 1;
const STRATEGY_DURATION_PERIODS = 10;

function getTimeframeMode() {
  return DEFAULT_TIMEFRAME;
}

function getTimeframeMinutes(mode = getTimeframeMode()) {
  return TIMEFRAME_MINUTES[mode] ?? TIMEFRAME_MINUTES[DEFAULT_TIMEFRAME];
}

function getTimeframeLabel(mode) {
  const value = String(mode ?? '').trim();
  return TIMEFRAME_LABELS[value] || value;
}

function getOpenCost() {
  const activeBtn = document.querySelector('.cost-switch__btn.is-active');
  if (!activeBtn) return null;
  const n = toNumber(activeBtn.getAttribute('data-cost'));
  return n !== null && n > 0 ? n : null;
}

const SUPABASE_URL = 'https://rxggjijrfafcrmtkqkuv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8B1PLTeHhtPou4lPt9cl6w_O2hipMVY';
const STRATEGIES_ENDPOINT = `${SUPABASE_URL}/rest/v1/strategies`;
const STRATEGY_STATS_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/get_strategy_stats`;
const RECENT_10_STATS_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/get_recent_10_stats`;

function getSupabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function isDevEnvironment() {
  const host = window.location.hostname;
  return window.location.protocol === 'file:'
    || host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1';
}

function dbValueToString(value) {
  return value == null ? '' : String(value);
}

function fromDbRecord(row) {
  return {
    id: row.id,
    dbCreatedAt: row.created_at,
    dbUpdatedAt: row.updated_at,
    strategyName: row.strategy_name,
    positionSide: row.position_side,
    inputPrice: dbValueToString(row.input_price),
    inputStopLoss: dbValueToString(row.input_stop_loss),
    entryPrice: dbValueToString(row.entry_price),
    quantity: dbValueToString(row.quantity),
    takeProfitPrice: dbValueToString(row.take_profit_price),
    stopLossPrice: dbValueToString(row.stop_loss_price),
    openCost: row.open_cost,
    priceAdjustmentRate: row.price_adjustment_rate,
    priceAdjustment: row.price_adjustment,
    takeProfitRMultiple: row.take_profit_r_multiple,
    timeframe: row.timeframe,
    timeframeMinutes: row.timeframe_minutes,
    timeframeLabel: getTimeframeLabel(row.timeframe),
    validPeriods: row.valid_periods,
    durationMinutes: row.duration_minutes,
    startAt: row.start_at,
    expiresAt: row.expires_at,
    outcomeStatus: row.outcome_status ?? 'pending',
  };
}

function toDbRecord(record) {
  const startAt = parseDateValue(record.startAt);
  const expiresAt = parseDateValue(record.expiresAt);
  return {
    strategy_name: record.strategyName,
    position_side: record.positionSide,
    input_price: toNumber(record.inputPrice),
    input_stop_loss: toNumber(record.inputStopLoss),
    entry_price: toNumber(record.entryPrice),
    quantity: toNumber(record.quantity),
    take_profit_price: toNumber(record.takeProfitPrice),
    stop_loss_price: toNumber(record.stopLossPrice),
    open_cost: Number(record.openCost),
    price_adjustment_rate: Number(record.priceAdjustmentRate),
    price_adjustment: toNumber(record.priceAdjustment),
    take_profit_r_multiple: Number(record.takeProfitRMultiple),
    timeframe: record.timeframe,
    timeframe_minutes: Number(record.timeframeMinutes),
    valid_periods: Number(record.validPeriods),
    duration_minutes: Number(record.durationMinutes),
    start_at: startAt ? startAt.toISOString() : null,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    outcome_status: normalizeOutcomeStatus(record.outcomeStatus),
  };
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

function applyMobileTimePickerValue(value) {
  const sel = document.getElementById('start-time');
  const selected = String(value ?? '').trim();
  if (!sel || !selected) {
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
}

function bindMobileTimePickerEvents() {
  const picker = document.getElementById('start-time-picker');
  const trigger = document.getElementById('start-time-trigger');
  const list = document.getElementById('time-picker-list');
  const sel = document.getElementById('start-time');
  if (!picker || !trigger || !list || !sel) return;

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
      applyMobileTimePickerValue(v);
    }
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

function getStrategySideText(side) {
  if (side === 'long') return '开多';
  if (side === 'short') return '开空';
  return '开仓';
}

function buildStrategyCopyText({ side, name, price, quantity, takeProfit, stopLoss }) {
  return [
    `${getStrategySideText(side)}${String(name || '未命名').trim() || '未命名'}`,
    `价格：${String(price ?? '').trim()}`,
    `数量：${String(quantity ?? '').trim()}`,
    `止盈：${String(takeProfit ?? '').trim()}`,
    `止损：${String(stopLoss ?? '').trim()}`,
  ].join('\n');
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

function calcAdjustedOpenPrice(open, stop, decimalPlaces) {
  return Number(formatFixedDecimals(open, decimalPlaces));
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
  const timeframe = getTimeframeMode();
  const unitMin = getTimeframeMinutes(timeframe);
  const spanMinutes = unitMin * STRATEGY_DURATION_PERIODS;
  const adjustedOpen = calcAdjustedOpenPrice(open, stop, priceDecimalPlaces);
  const priceAdjustment = 0;
  const stopDiff = Math.abs(adjustedOpen - stop);
  const quantity = openCost / stopDiff;
  const tp = calcTakeProfit(adjustedOpen, stop, TAKE_PROFIT_R_MULTIPLE);
  const tpDecimals = Math.max(0, priceDecimalPlaces);

  const nameEl = document.getElementById('name-input');
  const name = String(nameEl?.value ?? '').trim();
  const side = adjustedOpen > stop ? 'long' : 'short';
  const sideHash = side === 'long' ? '#开多' : '#开空';
  const alarmName = name || 'demo';
  const sideLabel = `${sideHash}${alarmName}`;
  const startAt = getStartDateTime(startTimeValue);
  const endAt = addPeriodToStart(startTimeValue, spanMinutes);
  const startDisplay = startAt ? formatFullDateTimeLabel(startAt) : (startTimeLabel || startTimeValue);
  const endDisplay = endAt ? formatFullDateTimeLabel(endAt) : '—';
  const timeRangeLabel = `${startDisplay} — ${endDisplay}`;

  const qty = formatQuantity(quantity);
  const priceLabel = formatTrimmedFixedDecimals(adjustedOpen, priceDecimalPlaces);
  const tpLabel = formatTrimmedFixedDecimals(tp, tpDecimals);
  const stopLabel = formatPrice(stop);

  const lines = [
    sideLabel,
    `价格：${priceLabel}`,
    `数量：${qty}`,
    `参考止盈：${tpLabel}`,
    `止损：${stopLabel}`,
    `时间范围：${timeRangeLabel}`,
  ];

  const copyText = buildStrategyCopyText({
    side,
    name: alarmName,
    price: priceLabel,
    quantity: qty,
    takeProfit: tpLabel,
    stopLoss: stopLabel,
  });
  const record = {
    strategyName: alarmName,
    positionSide: side,
    inputPrice: formatPrice(open),
    inputStopLoss: formatPrice(stop),
    entryPrice: priceLabel,
    quantity: qty,
    takeProfitPrice: tpLabel,
    stopLossPrice: stopLabel,
    openCost,
    priceAdjustmentRate: PRICE_ADJUSTMENT_RATE,
    priceAdjustment: formatTrimmedFixedDecimals(priceAdjustment, priceDecimalPlaces),
    takeProfitRMultiple: TAKE_PROFIT_R_MULTIPLE,
    timeframe,
    timeframeMinutes: unitMin,
    timeframeLabel: getTimeframeLabel(timeframe),
    validPeriods: STRATEGY_DURATION_PERIODS,
    durationMinutes: spanMinutes,
    startAt: startAt ? startAt.toISOString() : null,
    expiresAt: endAt ? endAt.toISOString() : null,
    outcomeStatus: 'pending',
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
  const openCost = getOpenCost();
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

  if (openCost === null) {
    if (errEl) errEl.textContent = '请输入有效的开仓成本（大于 0 的数字）。';
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
  const stopRaw = stopEl && 'value' in stopEl ? String(stopEl.value) : '';
  const priceDecimals = Math.max(getDecimalPlacesFromInput(openRaw), getDecimalPlacesFromInput(stopRaw)) + 1;
  const adjustedOpen = calcAdjustedOpenPrice(open, stop, priceDecimals);
  const takeProfit = calcTakeProfit(adjustedOpen, stop, TAKE_PROFIT_R_MULTIPLE);
  if (!Number.isFinite(adjustedOpen) || adjustedOpen <= 0 || !Number.isFinite(takeProfit) || takeProfit <= 0) {
    if (errEl) errEl.textContent = '价格或止盈价无效，请检查价格与止损。';
    clearStrategyOutput(outEl);
    return;
  }
  const strategy = buildStrategy(open, stop, startTime, startTimeLabel, openCost, priceDecimals);
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
    autoGenerateIfReady();
  });
});

let startTimeUserPicked = false;
rebuildStartTimeOptions();
bindMobileTimePickerEvents();

const openInput = document.getElementById('open-price-input');
const stopInput = document.getElementById('stop-price-input');
const startTimeSelect = document.getElementById('start-time');

// 开仓成本按钮切换
const costBtns = document.querySelectorAll('.cost-switch__btn');
costBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    costBtns.forEach((b) => {
      b.classList.remove('is-active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-selected', 'true');
    autoGenerateIfReady();
  });
});

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

function setTablistValue(tablistName, value) {
  const tablist = document.querySelector(`[data-tablist="${tablistName}"]`);
  if (!tablist) return;
  tablist.querySelectorAll('.tab-btn').forEach((btn) => {
    const on = btn.getAttribute('data-value') === value;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function resetFrontPage() {
  closeMobileTimePicker();
  startTimeUserPicked = false;
  rebuildStartTimeOptions();
  if (openInput) openInput.value = '';
  if (stopInput) stopInput.value = '';
  // 重置开仓成本为默认值66
  const costBtns = document.querySelectorAll('.cost-switch__btn');
  costBtns.forEach((btn) => {
    const isDefault = btn.getAttribute('data-cost') === '66';
    btn.classList.toggle('is-active', isDefault);
    btn.setAttribute('aria-selected', isDefault ? 'true' : 'false');
  });
  if (nameInput) nameInput.value = '';
  const errEl = document.getElementById('error');
  const outEl = document.getElementById('strategy-output');
  if (errEl) errEl.textContent = '';
  clearStrategyOutput(outEl);
}

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

function getLocalDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

function buildStrategiesQuery(filterValue = 'all') {
  const filter = normalizeAdminTimeFilter(filterValue);
  const params = ['select=*', 'order=created_at.desc'];
  const nameSearch = normalizeAdminNameSearch(adminNameSearch);
  const timeframeFilter = normalizeAdminTimeframeFilter(adminTimeframeFilter);
  const outcomeFilter = normalizeAdminOutcomeFilter(adminOutcomeFilter);

  if (nameSearch) {
    params.push(`strategy_name=ilike.${encodeURIComponent(`*${nameSearch}*`)}`);
  }
  if (timeframeFilter !== 'all') {
    params.push(`timeframe=eq.${encodeURIComponent(timeframeFilter)}`);
  }
  if (outcomeFilter !== 'all') {
    params.push(`outcome_status=eq.${encodeURIComponent(outcomeFilter)}`);
  }
  if (filter === 'active') {
    params.push(`expires_at=gt.${encodeURIComponent(new Date().toISOString())}`);
    // 进行中只显示未操作的（待定状态）
    if (outcomeFilter === 'all') {
      params.push('outcome_status=eq.pending');
    }
  } else if (filter === 'dueToday') {
    const { start, end } = getLocalDayRange();
    params.push(`expires_at=gte.${encodeURIComponent(start.toISOString())}`);
    params.push(`expires_at=lt.${encodeURIComponent(end.toISOString())}`);
    // 今日到期只显示未操作的（待定状态）
    if (outcomeFilter === 'all') {
      params.push('outcome_status=eq.pending');
    }
  } else if (filter === 'createdToday') {
    const { start, end } = getLocalDayRange();
    params.push(`created_at=gte.${encodeURIComponent(start.toISOString())}`);
    params.push(`created_at=lt.${encodeURIComponent(end.toISOString())}`);
  }
  return params.join('&');
}

async function fetchStrategies(filterValue = 'all') {
  const res = await fetch(`${STRATEGIES_ENDPOINT}?${buildStrategiesQuery(filterValue)}`, {
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map(fromDbRecord) : [];
}

function dbNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fromStatsRecord(row) {
  return {
    totalCount: dbNumber(row?.total_count),
    profitCount: dbNumber(row?.profit_count),
    lossCount: dbNumber(row?.loss_count),
    openedCount: dbNumber(row?.opened_count),
    winRate: dbNumber(row?.win_rate),
    openRate: dbNumber(row?.open_rate),
  };
}

function buildStrategyStatsPayload(filterValue = 'all', options = {}) {
  const { ignoreAdminFilters = false } = options;
  const timeFilter = normalizeAdminTimeFilter(filterValue);
  const timeframeFilter = ignoreAdminFilters ? 'all' : normalizeAdminTimeframeFilter(adminTimeframeFilter);
  const outcomeFilter = ignoreAdminFilters ? 'all' : normalizeAdminOutcomeFilter(adminOutcomeFilter);
  const payload = {
    p_name_search: ignoreAdminFilters ? null : normalizeAdminNameSearch(adminNameSearch) || null,
    p_timeframe: timeframeFilter === 'all' ? null : timeframeFilter,
    p_outcome_status: outcomeFilter === 'all' ? null : outcomeFilter,
    p_time_filter: timeFilter,
    p_today_start: null,
    p_today_end: null,
    p_now: new Date().toISOString(),
  };

  if (timeFilter === 'dueToday' || timeFilter === 'createdToday') {
    const { start, end } = getLocalDayRange();
    payload.p_today_start = start.toISOString();
    payload.p_today_end = end.toISOString();
  }

  return payload;
}

async function fetchStrategyStats(filterValue = 'all', options = {}) {
  const res = await fetch(STRATEGY_STATS_ENDPOINT, {
    method: 'POST',
    headers: getSupabaseHeaders(),
    body: JSON.stringify(buildStrategyStatsPayload(filterValue, options)),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  return fromStatsRecord(row || {});
}

async function fetchRecent10Stats() {
  const res = await fetch(RECENT_10_STATS_ENDPOINT, {
    method: 'POST',
    headers: getSupabaseHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalCount: dbNumber(row?.total_count),
    profitCount: dbNumber(row?.profit_count),
    lossCount: dbNumber(row?.loss_count),
    notFilledCount: dbNumber(row?.not_filled_count),
    pendingCount: dbNumber(row?.pending_count),
    openedCount: dbNumber(row?.opened_count),
    winRate: dbNumber(row?.win_rate),
    openRate: dbNumber(row?.open_rate),
  };
}

async function createStrategy(record) {
  const res = await fetch(STRATEGIES_ENDPOINT, {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(toDbRecord(record)),
  });
  if (!res.ok) throw new Error(await res.text());
}

function normalizeStrategyIds(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Array.from(new Set(list.map((id) => String(id ?? '').trim()).filter(Boolean)));
}

async function deleteStrategies(ids) {
  const normalizedIds = normalizeStrategyIds(ids);
  if (!normalizedIds.length) return;
  const idFilter = encodeURIComponent(`(${normalizedIds.join(',')})`);
  const res = await fetch(`${STRATEGIES_ENDPOINT}?id=in.${idFilter}`, {
    method: 'DELETE',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function updateStrategyOutcomeStatus(id, outcomeStatus) {
  const encodedId = encodeURIComponent(id);
  const res = await fetch(`${STRATEGIES_ENDPOINT}?id=eq.${encodedId}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ outcome_status: outcomeStatus }),
  });
  if (!res.ok) throw new Error(await res.text());
}

function normalizeOutcomeStatus(outcomeStatus) {
  return outcomeStatus === 'profit' || outcomeStatus === 'loss' || outcomeStatus === 'not_filled' ? outcomeStatus : 'pending';
}

function getOutcomeStatusLabel(outcomeStatus) {
  if (outcomeStatus === 'profit') return '盈利';
  if (outcomeStatus === 'loss') return '亏损';
  if (outcomeStatus === 'not_filled') return '未成交';
  return '待定';
}

function getTimeBadgeInfo(endAt, now = new Date()) {
  if (!endAt) return null;
  if (getTimeRangeStatusByEndAt(endAt) === 'ended') return null;
  return {
    label: formatCountdownTo(endAt, now),
    type: 'active',
    timeStatus: 'active',
  };
}

function getOutcomeStatusInfo(outcomeStatus) {
  const normalized = normalizeOutcomeStatus(outcomeStatus);
  if (normalized === 'profit') return { label: '盈利', type: 'profit' };
  if (normalized === 'loss') return { label: '亏损', type: 'loss' };
  if (normalized === 'not_filled') return { label: '未成交', type: 'not-filled' };
  return { label: '待定', type: 'pending' };
}

function parseDateValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStrategyEndAt(row) {
  return parseDateValue(row?.expiresAt);
}

function getStrategyStartAt(row) {
  return parseDateValue(row?.startAt);
}

function formatCompactDateTimeLabel(d, base = new Date()) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const date = d.getFullYear() === base.getFullYear()
    ? `${d.getMonth() + 1}月${d.getDate()}日`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatAdminTimeRange(startAt, endAt) {
  const start = startAt ? formatCompactDateTimeLabel(startAt) : '—';
  const end = endAt ? formatCompactDateTimeLabel(endAt) : '—';
  return `${start} — ${end}`;
}

function formatDurationLabel(totalMinutes) {
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}天${hours}小时${minutes}分钟`;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  return `${minutes}分钟`;
}

function formatCountdownTo(endAt, now = new Date()) {
  if (!endAt) return '—';
  const diffMs = endAt.getTime() - now.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return '已到期';

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}天${hours}小时${minutes}分钟`;
  if (hours > 0) return `${hours}小时${minutes}分${pad2(seconds)}秒`;
  if (minutes > 0) return `${minutes}分${pad2(seconds)}秒`;
  return `${seconds}秒`;
}

const COUNTDOWN_URGENT_HOURS = 4;

function isCountdownWithinUrgentWindow(endAt, now = new Date()) {
  if (!endAt) return false;
  const diffMs = endAt.getTime() - now.getTime();
  return Number.isFinite(diffMs) && diffMs > 0 && diffMs <= COUNTDOWN_URGENT_HOURS * 60 * 60 * 1000;
}

function getTimeRangeStatusByEndAt(endAt) {
  if (!endAt) return 'active';
  const nowTs = Date.now();
  const endTs = endAt.getTime();
  return nowTs >= endTs ? 'ended' : 'active';
}

function getTimeRangeStatusLabel(timeStatus) {
  return timeStatus === 'ended' ? '已结束' : '进行中';
}

const ADMIN_TIME_FILTER_LABELS = {
  all: '全部',
  active: '进行中',
  createdToday: '今日创建',
  dueToday: '今日到期',
};

const ADMIN_TIMEFRAME_FILTER_LABELS = {
  all: '全部',
  '1h': '1小时',
  '4h': '4小时',
};

const ADMIN_OUTCOME_FILTER_LABELS = {
  all: '全部',
  pending: '待定',
  profit: '盈利',
  loss: '亏损',
  not_filled: '未成交',
};

const DEFAULT_ADMIN_TIME_FILTER = 'active';

let adminTimeFilter = DEFAULT_ADMIN_TIME_FILTER;
let adminTimeframeFilter = 'all';
let adminOutcomeFilter = 'all';
let adminNameSearch = '';
let adminSearchTimer = null;

function normalizeAdminTimeFilter(value) {
  return Object.prototype.hasOwnProperty.call(ADMIN_TIME_FILTER_LABELS, value) ? value : 'all';
}

function normalizeAdminTimeframeFilter(value) {
  return Object.prototype.hasOwnProperty.call(ADMIN_TIMEFRAME_FILTER_LABELS, value) ? value : 'all';
}

function normalizeAdminOutcomeFilter(value) {
  return Object.prototype.hasOwnProperty.call(ADMIN_OUTCOME_FILTER_LABELS, value) ? value : 'all';
}

function normalizeAdminNameSearch(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function renderAdminFilterTabs() {
  const tabsEl = document.getElementById('admin-filter-tabs');
  renderAdminTabGroup(tabsEl, ADMIN_TIME_FILTER_LABELS, normalizeAdminTimeFilter(adminTimeFilter), 'admin-time-filter');
}

function renderAdminTimeframeFilterSelect() {
  const selectEl = document.getElementById('admin-timeframe-filter-select');
  renderAdminSelect(selectEl, ADMIN_TIMEFRAME_FILTER_LABELS, normalizeAdminTimeframeFilter(adminTimeframeFilter));
}

function renderAdminOutcomeFilterSelect() {
  const selectEl = document.getElementById('admin-outcome-filter-select');
  renderAdminSelect(selectEl, ADMIN_OUTCOME_FILTER_LABELS, normalizeAdminOutcomeFilter(adminOutcomeFilter));
}

function renderAdminTabGroup(tabsEl, labels, activeValue, dataAttr) {
  if (!tabsEl) return;
  tabsEl.innerHTML = Object.entries(labels).map(([value, label]) => {
    const active = activeValue === value;
    return `<button type="button" class="admin-filter-tab${active ? ' is-active' : ''}" role="tab" aria-selected="${active ? 'true' : 'false'}" data-${dataAttr}="${value}">${escapeHtml(label)}</button>`;
  }).join('');
}

function renderAdminSelect(selectEl, labels, activeValue) {
  if (!selectEl) return;
  selectEl.innerHTML = Object.entries(labels).map(([value, label]) => {
    const selected = activeValue === value ? ' selected' : '';
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
  }).join('');
}

function renderAdminControls() {
  renderAdminFilterTabs();
  renderAdminTimeframeFilterSelect();
  renderAdminOutcomeFilterSelect();
  const searchEl = document.getElementById('admin-name-search');
  if (searchEl && searchEl.value !== adminNameSearch) searchEl.value = adminNameSearch;
}

function resetAdminPageState() {
  closeOutcomeStatusPicker();
  if (adminSearchTimer) {
    clearTimeout(adminSearchTimer);
    adminSearchTimer = null;
  }
  adminTimeFilter = DEFAULT_ADMIN_TIME_FILTER;
  adminTimeframeFilter = 'all';
  adminOutcomeFilter = 'all';
  adminNameSearch = '';
  isAdminSelectionMode = false;
  selectedStrategyIds.clear();
  visibleAdminStrategyIds = [];
  isDeletingStrategies = false;
  renderAdminControls();
  updateAdminSelectionControls();
}

function scheduleRenderAdminList(delay = 250) {
  if (adminSearchTimer) clearTimeout(adminSearchTimer);
  adminSearchTimer = setTimeout(() => {
    adminSearchTimer = null;
    renderAdminList().catch(() => {});
  }, delay);
}

let selectedStrategyIds = new Set();
let isDeletingStrategies = false;
let isAdminSelectionMode = false;
let visibleAdminStrategyIds = [];

function getVisibleAdminStrategyIds() {
  const domIds = Array.from(document.querySelectorAll('#admin-list .admin-item__select'))
    .map((el) => String(el.getAttribute('data-id') ?? '').trim())
    .filter(Boolean);
  return domIds.length ? domIds : visibleAdminStrategyIds;
}

function syncAdminSelectionWithRows(rows) {
  visibleAdminStrategyIds = rows.map((row) => String(row?.id ?? '').trim()).filter(Boolean);
  const visibleIds = new Set(visibleAdminStrategyIds);
  selectedStrategyIds = new Set(Array.from(selectedStrategyIds).filter((id) => visibleIds.has(id)));
  updateAdminSelectionControls();
}

function updateAdminSelectionControls() {
  const canDelete = isDevEnvironment();
  if (!canDelete && isAdminSelectionMode) {
    isAdminSelectionMode = false;
    selectedStrategyIds.clear();
  }

  const selectedCount = selectedStrategyIds.size;
  const selectionEl = document.getElementById('admin-selection');
  const countEl = document.getElementById('admin-selection-count');
  const selectAllBtn = document.getElementById('admin-select-all');
  const clearSelectionBtn = document.getElementById('admin-clear-selection');
  const deleteSelectedBtn = document.getElementById('admin-delete-selected');
  const visibleCount = getVisibleAdminStrategyIds().length;

  if (selectionEl) selectionEl.hidden = currentPage !== 'admin' || !canDelete || !isAdminSelectionMode || visibleCount === 0;
  if (countEl) countEl.textContent = `已选 ${selectedCount} 条`;
  if (selectAllBtn) selectAllBtn.disabled = isDeletingStrategies || !canDelete || !isAdminSelectionMode || visibleCount === 0;
  if (clearSelectionBtn) clearSelectionBtn.disabled = isDeletingStrategies || !canDelete || !isAdminSelectionMode;
  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = isDeletingStrategies || !canDelete || !isAdminSelectionMode || selectedCount === 0;
    deleteSelectedBtn.setAttribute('aria-busy', isDeletingStrategies ? 'true' : 'false');
  }

  const btnClear = document.getElementById('btn-clear');
  if (btnClear && currentPage !== 'admin') {
    btnClear.hidden = true;
    btnClear.textContent = '清空';
    btnClear.disabled = false;
    btnClear.setAttribute('aria-busy', 'false');
  } else if (btnClear) {
    btnClear.hidden = !canDelete;
    btnClear.textContent = isAdminSelectionMode
      ? (selectedCount ? `删除所选(${selectedCount})` : '取消删除')
      : '删除';
    btnClear.disabled = isDeletingStrategies || (!isAdminSelectionMode && visibleCount === 0);
    btnClear.setAttribute('aria-busy', isDeletingStrategies ? 'true' : 'false');
  }
}

function enterAdminSelectionMode() {
  if (!isDevEnvironment()) return;
  isAdminSelectionMode = true;
  renderAdminList().catch(() => updateAdminSelectionControls());
}

function resetAdminSelectionMode() {
  isAdminSelectionMode = false;
  selectedStrategyIds.clear();
  updateAdminSelectionControls();
}

function exitAdminSelectionMode() {
  resetAdminSelectionMode();
  renderAdminList().catch(() => updateAdminSelectionControls());
}

function setAdminDeleteLoading(loading) {
  isDeletingStrategies = loading;
  document.querySelectorAll('.admin-item__select').forEach((el) => {
    el.disabled = loading;
  });
  document.querySelectorAll('.admin-item__selector').forEach((el) => {
    el.classList.toggle('is-disabled', loading);
  });
  updateAdminSelectionControls();
}

function setVisibleAdminSelection(selected) {
  document.querySelectorAll('#admin-list .admin-item__select').forEach((el) => {
    const id = String(el.getAttribute('data-id') ?? '').trim();
    if (!id) return;
    if (selected) selectedStrategyIds.add(id);
    else selectedStrategyIds.delete(id);
    el.checked = selected;
  });
  updateAdminSelectionControls();
}

function confirmDeleteStrategies(count) {
  if (typeof window.confirm !== 'function') return true;
  return window.confirm(count > 1 ? `确认删除选中的 ${count} 条策略？` : '确认删除这条策略？');
}

function showAdminDeleteError() {
  if (typeof window.alert === 'function') {
    window.alert('删除失败，请检查网络或 Supabase 权限。');
  }
}

async function deleteStrategyIdsWithConfirm(ids, options = {}) {
  if (!isDevEnvironment()) return;
  const { exitSelectionMode = false } = options;
  const normalizedIds = normalizeStrategyIds(ids);
  if (!normalizedIds.length || isDeletingStrategies) return;
  if (!confirmDeleteStrategies(normalizedIds.length)) return;
  setAdminDeleteLoading(true);
  try {
    await deleteStrategies(normalizedIds);
    normalizedIds.forEach((id) => selectedStrategyIds.delete(id));
    if (exitSelectionMode) isAdminSelectionMode = false;
    await renderAdminList();
  } catch {
    showAdminDeleteError();
  } finally {
    setAdminDeleteLoading(false);
  }
}

async function deleteSelectedStrategies() {
  if (!isDevEnvironment()) return;
  await deleteStrategyIdsWithConfirm(Array.from(selectedStrategyIds), { exitSelectionMode: true });
}

let pendingOutcomeStatusRecordId = '';

function setOutcomeStatusPickerLoading(loading) {
  document.querySelectorAll('#status-picker button').forEach((btn) => {
    btn.disabled = loading;
  });
}

function setOutcomeStatusPickerError(message) {
  const errEl = document.getElementById('status-picker-error');
  if (errEl) errEl.textContent = message;
}

function openOutcomeStatusPicker(id, timeStatus) {
  const picker = document.getElementById('status-picker');
  if (!picker || !id) return;
  pendingOutcomeStatusRecordId = id;
  setOutcomeStatusPickerLoading(false);
  setOutcomeStatusPickerError('');

  picker.hidden = false;
  document.body.style.overflow = 'hidden';
  window.requestAnimationFrame(() => {
    document.getElementById('status-picker-profit')?.focus({ preventScroll: true });
  });
}

function closeOutcomeStatusPicker() {
  const picker = document.getElementById('status-picker');
  if (!picker) return;
  pendingOutcomeStatusRecordId = '';
  setOutcomeStatusPickerLoading(false);
  setOutcomeStatusPickerError('');
  picker.hidden = true;
  document.body.style.overflow = '';
}

function isOutcomeStatusChoice(value) {
  return value === 'profit' || value === 'loss' || value === 'not_filled';
}

async function submitOutcomeStatusFromPicker(outcomeStatus) {
  const nextOutcomeStatus = String(outcomeStatus ?? '').trim();
  const id = pendingOutcomeStatusRecordId;
  if (!id || !isOutcomeStatusChoice(nextOutcomeStatus)) return;
  setOutcomeStatusPickerLoading(true);
  setOutcomeStatusPickerError('');
  try {
    await updateStrategyOutcomeStatus(id, nextOutcomeStatus);
    closeOutcomeStatusPicker();
    await renderAdminList();
  } catch {
    setOutcomeStatusPickerError('提交失败，请检查网络或 Supabase 权限。');
    setOutcomeStatusPickerLoading(false);
  }
}

function renderAdminStats(stats = {}) {
  const statsEl = document.getElementById('admin-stats');
  if (!statsEl) return;
  const total = dbNumber(stats.totalCount);
  const winRate = `${Math.round(dbNumber(stats.winRate))}%`;
  const openRate = `${Math.round(dbNumber(stats.openRate))}%`;
  statsEl.innerHTML = [
    `<div class="admin-stat"><span class="admin-stat__label">数量</span><span class="admin-stat__value">${total}</span></div>`,
    `<div class="admin-stat"><span class="admin-stat__label">胜率</span><span class="admin-stat__value">${winRate}</span></div>`,
    `<div class="admin-stat"><span class="admin-stat__label">开单率</span><span class="admin-stat__value">${openRate}</span></div>`,
  ].join('');
}

async function renderAdminList() {
  const listEl = document.getElementById('admin-list');
  if (!listEl) return;
  renderAdminControls();
  let rows = [];
  try {
    rows = await fetchStrategies(adminTimeFilter);
  } catch (err) {
    selectedStrategyIds.clear();
    visibleAdminStrategyIds = [];
    listEl.innerHTML = `<div class="admin-sync-error">${escapeHtml(String(err?.message || '同步失败'))}</div>`;
    updateAdminSelectionControls();
    return;
  }
  syncAdminSelectionWithRows(rows);

  if (!rows.length) {
    listEl.innerHTML = '';
    updateAdminSelectionControls();
    return;
  }
  listEl.innerHTML = rows.map((row) => {
    const rawId = String(row?.id ?? '').trim();
    const sideRaw = String(row?.positionSide ?? '').trim();
    const nameRaw = String(row?.strategyName ?? '').trim();
    const isLong = sideRaw === 'long';
    const isShort = sideRaw === 'short';
    const sideMod = isLong ? 'long' : (isShort ? 'short' : 'flat');
    const sideText = escapeHtml(isLong ? '开多' : (isShort ? '开空' : '—'));
    const name = escapeHtml(nameRaw || '未命名');
    const price = escapeHtml(String(row?.entryPrice ?? '-'));
    const qty = escapeHtml(String(row?.quantity ?? '-'));
    const tp = escapeHtml(String(row?.takeProfitPrice ?? '-'));
    const stop = escapeHtml(String(row?.stopLossPrice ?? '-'));
    const startAt = getStrategyStartAt(row);
    const endAt = getStrategyEndAt(row);
    const timeRange = escapeHtml(formatAdminTimeRange(startAt, endAt));
    const expiresAt = endAt ? escapeHtml(endAt.toISOString()) : '';
    const id = escapeHtml(rawId);
    const checked = rawId && selectedStrategyIds.has(rawId) ? ' checked' : '';
    const disabled = isDeletingStrategies ? ' disabled' : '';
    const selectorDisabled = isDeletingStrategies ? ' is-disabled' : '';
    const selectHtml = rawId && isAdminSelectionMode
      ? [
        `<label class="admin-item__selector${selectorDisabled}" aria-label="选择 ${name}">`,
        `<input type="checkbox" class="admin-item__select" data-id="${id}"${checked}${disabled}>`,
        '<span class="admin-item__checkmark" aria-hidden="true"></span>',
        '</label>',
      ].join('')
      : '';
    const outcomeStatus = normalizeOutcomeStatus(row?.outcomeStatus);
    const timeStatus = getTimeRangeStatusByEndAt(endAt);
    const timeBadge = getTimeBadgeInfo(endAt);
    const outcomeInfo = getOutcomeStatusInfo(outcomeStatus);
    const timeBadgeUrgent = timeBadge?.type === 'active' && isCountdownWithinUrgentWindow(endAt)
      ? ' admin-time-status--urgent'
      : '';
    const timeBadgeHtml = timeBadge && expiresAt
      ? [
        `<div class="admin-time-status admin-time-status--${timeBadge.type}${timeBadgeUrgent}">`,
        `<span class="admin-time-status__tag admin-time-status__value" data-expires-at="${expiresAt}" data-time-status="${timeBadge.timeStatus}">${escapeHtml(timeBadge.label)}</span>`,
        '</div>',
      ].join('')
      : '';
    const outcomeStatusHtml = id
      ? [
        `<button type="button" class="admin-outcome-status admin-outcome-status--${outcomeInfo.type} admin-outcome-status--actionable" data-id="${id}" data-time-status="${timeStatus}" aria-haspopup="dialog" aria-controls="status-picker" aria-label="修改盈利状态">`,
        `<span class="admin-outcome-status__tag">${escapeHtml(outcomeInfo.label)}</span>`,
        '</button>',
      ].join('')
      : [
        `<div class="admin-outcome-status admin-outcome-status--${outcomeInfo.type}">`,
        `<span class="admin-outcome-status__tag">${escapeHtml(outcomeInfo.label)}</span>`,
        '</div>',
      ].join('');
    const buttonsHtml = `<div class="admin-item__buttons">${outcomeStatusHtml}</div>`;
    return [
      `<article class="admin-item admin-item--${sideMod}">`,
      '<header class="admin-item__head">',
      selectHtml,
      `<span class="admin-item__side">${sideText}</span>`,
      `<span class="admin-item__title">${name}</span>`,
      timeBadgeHtml,
      '</header>',
      '<div class="admin-item__metrics">',
      `<div class="metric metric--price"><span class="metric__label">价格</span><span class="metric__value">${price}</span></div>`,
      `<div class="metric metric--qty"><span class="metric__label">数量</span><span class="metric__value">${qty}</span></div>`,
      `<div class="metric metric--tp"><span class="metric__label">止盈</span><span class="metric__value">${tp}</span></div>`,
      `<div class="metric metric--stop"><span class="metric__label">止损</span><span class="metric__value">${stop}</span></div>`,
      '</div>',
      '<div class="admin-item__actions">',
      '<div class="admin-item__meta">',
      `<span class="admin-item__time-range" aria-label="时间范围">${timeRange}</span>`,
      '</div>',
      buttonsHtml,
      '</div>',
      '</article>',
    ].join('');
  }).join('');
  updateAdminSelectionControls();
  updateAdminCountdowns();
}

function updateAdminCountdowns() {
  const now = new Date();
  document.querySelectorAll('.admin-time-status__value[data-time-status="active"]').forEach((el) => {
    const endAt = parseDateValue(el.getAttribute('data-expires-at'));
    const container = el.closest('.admin-time-status');
    if (!endAt || getTimeRangeStatusByEndAt(endAt) === 'ended') {
      container?.remove();
      return;
    }
    const nextLabel = formatCountdownTo(endAt, now);
    if (el.textContent !== nextLabel) {
      el.textContent = nextLabel;
      el.classList.remove('is-ticking');
      void el.offsetWidth;
      el.classList.add('is-ticking');
    }
    container?.classList.toggle('admin-time-status--urgent', isCountdownWithinUrgentWindow(endAt, now));
  });
}

let adminCountdownTimer = null;

function syncAdminCountdownTimer() {
  const shouldRun = currentPage === 'admin' && !document.hidden;
  if (shouldRun && !adminCountdownTimer) {
    updateAdminCountdowns();
    adminCountdownTimer = setInterval(updateAdminCountdowns, 1000);
  } else if (!shouldRun && adminCountdownTimer) {
    clearInterval(adminCountdownTimer);
    adminCountdownTimer = null;
  }
}

let currentPage = 'admin';

document.addEventListener('visibilitychange', () => {
  syncAdminCountdownTimer();
});

async function renderStatsPage() {
  const statsEl = document.getElementById('stats-recent-10');
  if (!statsEl) return;

  statsEl.innerHTML = '<div class="stats-loading">加载中...</div>';

  try {
    // 获取全部数据的统计和近10单统计
    const [allStats, recent10Stats] = await Promise.all([
      fetchStrategyStats('all', { ignoreAdminFilters: true }),
      fetchRecent10Stats(),
    ]);

    // 渲染全部数据统计（使用已有的函数）
    renderAdminStats(allStats);

    // 渲染近10单统计
    if (recent10Stats.totalCount === 0) {
      statsEl.innerHTML = '<div class="stats-empty">暂无数据</div>';
      return;
    }

    const html = [
      '<div class="stats-summary">',
      `<div class="stats-summary__item">`,
      `<span class="stats-summary__label">总数</span>`,
      `<span class="stats-summary__value">${recent10Stats.totalCount}单</span>`,
      '</div>',
      `<div class="stats-summary__item stats-summary__item--profit">`,
      `<span class="stats-summary__label">盈利</span>`,
      `<span class="stats-summary__value">${recent10Stats.profitCount}单</span>`,
      '</div>',
      `<div class="stats-summary__item stats-summary__item--loss">`,
      `<span class="stats-summary__label">亏损</span>`,
      `<span class="stats-summary__value">${recent10Stats.lossCount}单</span>`,
      '</div>',
      `<div class="stats-summary__item">`,
      `<span class="stats-summary__label">未成交</span>`,
      `<span class="stats-summary__value">${recent10Stats.notFilledCount}单</span>`,
      '</div>',
      `<div class="stats-summary__item">`,
      `<span class="stats-summary__label">待定</span>`,
      `<span class="stats-summary__value">${recent10Stats.pendingCount}单</span>`,
      '</div>',
      '</div>',
      '<div class="stats-rates">',
      `<div class="stats-rate">`,
      `<span class="stats-rate__label">胜率</span>`,
      `<span class="stats-rate__value stats-rate__value--highlight">${recent10Stats.winRate}%</span>`,
      `<span class="stats-rate__note">盈利单数 / (盈利+亏损)</span>`,
      '</div>',
      `<div class="stats-rate">`,
      `<span class="stats-rate__label">成交率</span>`,
      `<span class="stats-rate__value stats-rate__value--highlight">${recent10Stats.openRate}%</span>`,
      `<span class="stats-rate__note">(盈利+亏损) / 总单数</span>`,
      '</div>',
      '</div>',
    ].join('');

    statsEl.innerHTML = html;
  } catch (err) {
    statsEl.innerHTML = `<div class="stats-error">加载失败：${escapeHtml(String(err?.message || '未知错误'))}</div>`;
  }
}

function setPage(mode) {
  const front = document.getElementById('front-page');
  const admin = document.getElementById('admin-page');
  const stats = document.getElementById('stats-page');
  const btnFront = document.getElementById('btn-tab-front');
  const btnAdmin = document.getElementById('btn-tab-admin');
  const btnStats = document.getElementById('btn-tab-stats');
  if (!front || !admin || !stats || !btnFront || !btnAdmin || !btnStats) return;

  const toAdmin = mode === 'admin';
  const toStats = mode === 'stats';
  const toFront = !toAdmin && !toStats;

  currentPage = toAdmin ? 'admin' : (toStats ? 'stats' : 'front');

  front.hidden = !toFront;
  admin.hidden = !toAdmin;
  stats.hidden = !toStats;

  btnFront.classList.toggle('is-active', toFront);
  btnFront.setAttribute('aria-selected', toFront ? 'true' : 'false');
  btnAdmin.classList.toggle('is-active', toAdmin);
  btnAdmin.setAttribute('aria-selected', toAdmin ? 'true' : 'false');
  btnStats.classList.toggle('is-active', toStats);
  btnStats.setAttribute('aria-selected', toStats ? 'true' : 'false');

  const btnClear = document.getElementById('btn-clear');
  if (btnClear) {
    btnClear.hidden = !toAdmin || !isDevEnvironment();
    btnClear.textContent = toAdmin ? '删除' : '清空';
    btnClear.disabled = toAdmin;
    btnClear.setAttribute('aria-busy', 'false');
  }

  if (toAdmin) {
    resetFrontPage();
    resetAdminPageState();
    renderAdminList().catch(() => {});
  } else if (toStats) {
    resetFrontPage();
    resetAdminPageState();
    renderStatsPage().catch(() => {});
  } else {
    resetAdminPageState();
    resetFrontPage();
  }

  syncAdminCountdownTimer();
}

function showToast(message, duration = 1500) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;
  if (toast._toastTimer) clearTimeout(toast._toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toast._toastTimer = setTimeout(() => {
    toast.hidden = true;
    toast._toastTimer = null;
  }, duration);
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

let isSavingStrategy = false;

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

  if (isSavingStrategy) return;
  isSavingStrategy = true;
  if (btn) {
    if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
    if (btn._flashTimer) {
      clearTimeout(btn._flashTimer);
      btn._flashTimer = null;
    }
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = '保存中';
  }

  let saved = false;
  try {
    if (out?.dataset.record) {
      try {
        await createStrategy(JSON.parse(out.dataset.record));
        saved = true;
        if (currentPage === 'admin') await renderAdminList();
      } catch {
        if (errEl) errEl.textContent = '保存失败。请检查 Supabase 表和权限。';
        flashCopyStrategyBtn(btn, '保存失败');
        return;
      }
    }
    if (saved) {
      showToast('保存成功');
      resetFrontPage();
    }
    flashCopyStrategyBtn(btn, saved ? '已保存' : '保存失败');
  } finally {
    isSavingStrategy = false;
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }
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
const clearAll = () => {
  if (currentPage !== 'admin' || !isDevEnvironment()) return;
  if (!isAdminSelectionMode) {
    enterAdminSelectionMode();
    return;
  }
  if (selectedStrategyIds.size === 0) {
    exitAdminSelectionMode();
    return;
  }
  deleteSelectedStrategies().catch(() => {});
};
const btnClear = document.getElementById('btn-clear');
if (btnClear) btnClear.addEventListener('click', clearAll);

const btnTabFront = document.getElementById('btn-tab-front');
if (btnTabFront) btnTabFront.addEventListener('click', () => setPage('front'));
const btnTabAdmin = document.getElementById('btn-tab-admin');
if (btnTabAdmin) btnTabAdmin.addEventListener('click', () => setPage('admin'));
const btnTabStats = document.getElementById('btn-tab-stats');
if (btnTabStats) btnTabStats.addEventListener('click', () => setPage('stats'));

const adminFilterTabsEl = document.getElementById('admin-filter-tabs');
if (adminFilterTabsEl) {
  adminFilterTabsEl.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target.closest('[data-admin-time-filter]') : null;
    if (!target) return;
    const nextFilter = normalizeAdminTimeFilter(target.getAttribute('data-admin-time-filter'));
    if (adminTimeFilter === nextFilter) return;
    adminTimeFilter = nextFilter;
    renderAdminList().catch(() => {});
  });
}

const adminNameSearchEl = document.getElementById('admin-name-search');
if (adminNameSearchEl) {
  adminNameSearchEl.addEventListener('input', () => {
    adminNameSearch = normalizeAdminNameSearch(adminNameSearchEl.value);
    scheduleRenderAdminList();
  });
}

const adminTimeframeFilterSelectEl = document.getElementById('admin-timeframe-filter-select');
if (adminTimeframeFilterSelectEl) {
  adminTimeframeFilterSelectEl.addEventListener('change', () => {
    const nextFilter = normalizeAdminTimeframeFilter(adminTimeframeFilterSelectEl.value);
    if (adminTimeframeFilter === nextFilter) return;
    adminTimeframeFilter = nextFilter;
    renderAdminList().catch(() => {});
  });
}

const adminOutcomeFilterSelectEl = document.getElementById('admin-outcome-filter-select');
if (adminOutcomeFilterSelectEl) {
  adminOutcomeFilterSelectEl.addEventListener('change', () => {
    const nextFilter = normalizeAdminOutcomeFilter(adminOutcomeFilterSelectEl.value);
    if (adminOutcomeFilter === nextFilter) return;
    adminOutcomeFilter = nextFilter;
    renderAdminList().catch(() => {});
  });
}

const adminSelectionEl = document.getElementById('admin-selection');
if (adminSelectionEl) {
  adminSelectionEl.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;
    if (target.closest('#admin-select-all')) {
      setVisibleAdminSelection(true);
      return;
    }
    if (target.closest('#admin-clear-selection')) {
      exitAdminSelectionMode();
      return;
    }
    if (target.closest('#admin-delete-selected')) {
      deleteSelectedStrategies().catch(() => {});
    }
  });
}

const adminListEl = document.getElementById('admin-list');
if (adminListEl) {
  adminListEl.addEventListener('change', (e) => {
    const checkbox = e.target instanceof HTMLElement ? e.target.closest('.admin-item__select') : null;
    if (!checkbox) return;
    const id = String(checkbox.getAttribute('data-id') ?? '').trim();
    if (!id) return;
    if (checkbox.checked) selectedStrategyIds.add(id);
    else selectedStrategyIds.delete(id);
    updateAdminSelectionControls();
  });

  adminListEl.addEventListener('click', async (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;

    const outcomeStatusActionBtn = target.closest('.admin-outcome-status--actionable');
    if (outcomeStatusActionBtn) {
      const id = String(outcomeStatusActionBtn.getAttribute('data-id') ?? '').trim();
      const timeStatus = String(outcomeStatusActionBtn.getAttribute('data-time-status') ?? '').trim();
      openOutcomeStatusPicker(id, timeStatus);
    }
  });
}

const outcomeStatusPicker = document.getElementById('status-picker');
if (outcomeStatusPicker) {
  outcomeStatusPicker.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;
    if (target.getAttribute('data-status-picker-dismiss') === 'true') {
      closeOutcomeStatusPicker();
      return;
    }
    const option = target.closest('[data-outcome-status]');
    if (!option) return;
    submitOutcomeStatusFromPicker(option.getAttribute('data-outcome-status'));
  });
}

const outcomeStatusPickerCancel = document.getElementById('status-picker-cancel');
if (outcomeStatusPickerCancel) outcomeStatusPickerCancel.addEventListener('click', closeOutcomeStatusPicker);

document.addEventListener('keydown', (e) => {
  const picker = document.getElementById('status-picker');
  if (e.key === 'Escape' && picker && !picker.hidden) closeOutcomeStatusPicker();
});

setPage('admin');
