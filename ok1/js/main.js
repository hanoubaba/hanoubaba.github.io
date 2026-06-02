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
  const now = new Date();
  const startAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  startAt.setMinutes(sm);
  const endAt = new Date(startAt.getTime() + periodMinutes * 60 * 1000);
  return `${endAt.getFullYear()}年${endAt.getMonth() + 1}月${endAt.getDate()}日 ${pad2(endAt.getHours())}:${pad2(endAt.getMinutes())}`;
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

function isMobileTimePickerEnabled() {
  return window.matchMedia('(max-width: 820px) and (pointer: coarse)').matches;
}

function getTimeSlotsByMode(mode) {
  const slots = [];
  if (mode === '1h') {
    for (let h = 0; h < 24; h += 1) slots.push(formatHHMM(h, 0));
    return slots;
  }
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += 15) slots.push(formatHHMM(h, m));
  }
  return slots;
}

function resolveStartTimeSelection(mode, prevValue) {
  const prev = String(prevValue ?? '').trim();
  const prevM = minutesFromValue(prev);
  const stepMinutes = mode === '1h' ? 60 : 15;
  if (!prev) return getCurrentTimeSlot(stepMinutes);
  if (mode === '1h') {
    const base = prevM == null ? 0 : prevM;
    return minutesToValue(closestSlotMinutes(base, 60));
  }
  if (prevM != null && prevM % 15 === 0) return minutesToValue(prevM);
  if (prevM != null) return minutesToValue(closestSlotMinutes(prevM, 15));
  return '';
}

function updateStartTimeTriggerLabel() {
  const trigger = document.getElementById('start-time-trigger');
  const sel = document.getElementById('start-time');
  if (!trigger || !sel) return;
  const v = String(sel.value ?? '').trim();
  trigger.textContent = v || '请选择';
}

function renderMobileTimePickerOptions(selectedValue) {
  const list = document.getElementById('time-picker-list');
  if (!list) return;
  const mode = getTimeframeMode();
  const slots = getTimeSlotsByMode(mode);
  const fallbackValue = resolveStartTimeSelection(mode, selectedValue);
  const activeValue = slots.includes(selectedValue) ? selectedValue : fallbackValue;
  const frag = document.createDocumentFragment();

  for (const v of slots) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `time-picker__option${v === activeValue ? ' is-selected' : ''}`;
    btn.dataset.value = v;
    btn.textContent = v;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', v === activeValue ? 'true' : 'false');
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

function rebuildStartTimeOptions() {
  const sel = document.getElementById('start-time');
  if (!sel) return;

  const mode = getTimeframeMode();
  const slots = getTimeSlotsByMode(mode);
  const selectedValue = resolveStartTimeSelection(mode, sel.value);

  const frag = document.createDocumentFragment();
  if (!selectedValue || !slots.includes(selectedValue)) {
    const optPlaceholder = document.createElement('option');
    optPlaceholder.value = '';
    optPlaceholder.textContent = '请选择';
    frag.appendChild(optPlaceholder);
  }

  for (const v of slots) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    if (selectedValue && v === selectedValue) o.selected = true;
    frag.appendChild(o);
  }

  sel.innerHTML = '';
  sel.append(frag);

  if (selectedValue && slots.includes(selectedValue)) {
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

function buildStrategy(open, stop, startTimeLabel, openCost, priceDecimalPlaces) {
  const unitMin = getTimeframeMode() === '1h' ? 60 : 15;
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
  const endTimeLabel = addPeriodToStart(startTimeLabel, spanMinutes);
  const endTimeHHMM = String(endTimeLabel).match(/(\d{2}:\d{2})$/)?.[1] || endTimeLabel;
  const timeRangeLabel = `${startTimeLabel} — ${endTimeHHMM}`;

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
  const strategy = buildStrategy(open, stop, startTime, getOpenCost(), priceDecimals);
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
  const stepMinutes = getTimeframeMode() === '1h' ? 60 : 15;
  const nowSlot = getCurrentTimeSlot(stepMinutes);
  if (sel.value === nowSlot) return;
  sel.value = nowSlot;
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

async function getSavedRecords() {
  const res = await fetch(`${STRATEGIES_ENDPOINT}?select=*&order=inserted_at.desc`, {
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map(fromDbRecord) : [];
}

async function createSavedRecord(record) {
  const res = await fetch(STRATEGIES_ENDPOINT, {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(toDbRecord(record)),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function clearSavedRecords() {
  const res = await fetch(`${STRATEGIES_ENDPOINT}?id=not.is.null`, {
    method: 'DELETE',
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function removeRecordById(id) {
  const encodedId = encodeURIComponent(id);
  const res = await fetch(`${STRATEGIES_ENDPOINT}?id=eq.${encodedId}`, {
    method: 'DELETE',
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function renderAdminList() {
  const listEl = document.getElementById('admin-list');
  if (!listEl) return;
  let rows = [];
  try {
    rows = await getSavedRecords();
  } catch (err) {
    listEl.innerHTML = `<div class="admin-sync-error">${escapeHtml(String(err?.message || '同步失败'))}</div>`;
    return;
  }
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
    const id = escapeHtml(String(row?.id ?? ''));
    return [
      `<article class="admin-item admin-item--${sideMod}">`,
      '<header class="admin-item__head">',
      `<span class="admin-item__side">${sideText}</span>`,
      `<span class="admin-item__title">${name}</span>`,
      `<button type="button" class="admin-item__del" data-id="${id}" aria-label="删除该记录" title="删除">×</button>`,
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
  if (btnClear) btnClear.textContent = toAdmin ? '清空缓存' : '清空';
  if (toAdmin) renderAdminList().catch(() => {});
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
  const errEl = document.getElementById('error');
  const nameEl = document.getElementById('name-input');
  const name = String(nameEl?.value ?? '').trim();
  if (!name) {
    if (errEl) errEl.textContent = '一键复制前请填写名称。';
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
      await createSavedRecord(JSON.parse(out.dataset.record));
      if (currentPage === 'admin') await renderAdminList();
    } catch {
      if (errEl) errEl.textContent = '复制成功，但同步保存失败。请检查 Supabase 表和权限。';
      flashCopyStrategyBtn(btn, '保存失败');
      return;
    }
  }
  flashCopyStrategyBtn(btn, ok ? '已复制' : '复制失败');
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
    clearSavedRecords()
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
    const btn = e.target instanceof HTMLElement ? e.target.closest('.admin-item__del') : null;
    if (!btn) return;
    const id = String(btn.getAttribute('data-id') ?? '').trim();
    if (!id) return;
    try {
      await removeRecordById(id);
      await renderAdminList();
    } catch {
      // ignore delete errors
    }
  });
}

setPage('front');
