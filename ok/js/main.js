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

function parseDateValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

const PRICE_ADJUSTMENT_RATE = 0.2;
const CONCESSION_RATES = [0, 0.2, 0.5, 0.8];
const TAKE_PROFIT_R_MULTIPLE = 1;
const REF_TAKE_PROFIT_R_LOW = 3;
const REF_TAKE_PROFIT_R_HIGH = 5;
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

const OPEN_COST_TRIPLE_MULTIPLIER = 3;

function updateOpenCostNote() {
  const labelEl = document.getElementById('open-cost-label');
  if (!labelEl) return;
  const openCost = getOpenCost();
  const tripleCost = openCost == null ? '—' : openCost * OPEN_COST_TRIPLE_MULTIPLIER;
  labelEl.textContent = `开仓成本（${tripleCost}）`;
}

const SUPABASE_URL = 'https://rxggjijrfafcrmtkqkuv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8B1PLTeHhtPou4lPt9cl6w_O2hipMVY';
const AUTH_STORAGE_KEY = 'ok_supabase_session';
const LOGIN_EMAIL_SUFFIX = '@ok.local';
const AUTH_ENDPOINT = `${SUPABASE_URL}/auth/v1/token`;
const STRATEGIES_ENDPOINT = `${SUPABASE_URL}/rest/v1/strategies`;
const STRATEGY_STATS_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/get_strategy_stats`;
const RECENT_10_STATS_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/get_recent_10_stats`;
const OBSERVATIONS_ENDPOINT = `${SUPABASE_URL}/rest/v1/observation_records`;
const OBS_GRADE_OPTIONS = ['优质', '普通', '观测中'];
const OBS_DEFAULT_GRADE = '普通';
const STRATEGY_GRADE_PREMIUM = '优质';
const STRATEGY_GRADE_NORMAL = '普通';
function getStrategyGradeFromOpenCost(openCost) {
  return Number(openCost) === 150 ? STRATEGY_GRADE_PREMIUM : STRATEGY_GRADE_NORMAL;
}

function normalizeStrategyGrade(grade) {
  const raw = String(grade ?? '').trim();
  if (raw === STRATEGY_GRADE_PREMIUM) return STRATEGY_GRADE_PREMIUM;
  return STRATEGY_GRADE_NORMAL;
}

const OBS_FORM_DEFAULT_ROWS = 3;
const SAVE_LOG_PREFIX = '[strategy-save]';
const METHODOLOGY_SECTIONS = [
  {
    title: '1、核心理念',
    paragraphs: ['右侧交易，趋势跟随，见好就收。', '风控第一，收益第二，策略唯一。'],
  },
  { title: '2、选择标准', items: ['形态上三线齐飞，交叉在同一个时间维度。', '交易量过亿。', '盈亏比', '胜率'] },
  { title: '3、档位', paragraphs: ['三档挂单，兼顾风险和收益。'] },
  { title: '4、仓位', paragraphs: ['3目标 x 3档位 = 9仓位'] },
  { title: '5、平仓', items: ['时间参考：九尾和十尾', '空间参考：3倍和5倍'] },
  {
    title: '6、心态建设',
    items: [
      '遵守规则是为了全局收益更大，践踏规则最多只能赢几次无法实现最终的目标。',
      '我的目标是星辰大海。整体战略高于单次的战术胜利。',
      '坚持好难，但这是修正的必要代价。',
    ],
  },
  {
    title: '7、观测',
    items: [
      '盯盘会调动主观情绪，影响客观判断。',
      '挂测开单列表，按照时间进行操作更佳。',
      '8小时节点观测，全天候覆盖无遗漏。',
    ],
  },
  { title: '8、无悖论', paragraphs: ['相邻时间维度趋势不冲突，有冲突不做。'] },
  { title: '9、目标', paragraphs: ['目标35岁之前退休，计划不变。'] },
  {
    title: '10、理性和感性冲突的终极解法',
    items: ['固定策略选一边覆盖。', '统一标准量化分析。', '1个单位0.5倍，超出预期可做T，预期内则坚持到底。'],
  },
  {
    title: '11、让每一个操作都有意义',
    items: ['做好开仓记录。', '做好观测日志。', '8小时定点操作。', '不做任何无效操作。'],
  },
  {
    title: '12、操作手法',
    items: [
      '观测变为4小时，范围扩展到0.5亿交易量。',
      '只要前三，分清主次。',
      '风险厌恶，浮亏影响判断。时机比点位更重要。',
      '优质股必上车。大仓位挂着，小仓位跑着，进度有度。',
      '4小时为主。1小时和1天维度为辅。多维度兼容思维分析行情。',
      '等待就是最快的前行。',
    ],
  },
];

let authSession = null;
let isLoggingIn = false;
let isAuthReady = false;

function loadAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      authSession = null;
      return;
    }
    const parsed = JSON.parse(raw);
    authSession = parsed && parsed.access_token ? parsed : null;
  } catch {
    authSession = null;
  }
}

function saveAuthSession(session) {
  authSession = session;
  if (!session) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearAuthSession() {
  saveAuthSession(null);
}

function isAccessTokenValid() {
  if (!authSession?.access_token || !authSession?.expires_at) return false;
  return Date.now() < authSession.expires_at - 60_000;
}

function buildAuthSessionFromTokenResponse(data) {
  const expiresIn = Number(data?.expires_in);
  return {
    access_token: String(data?.access_token ?? ''),
    refresh_token: String(data?.refresh_token ?? ''),
    expires_at: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
    email: String(data?.user?.email ?? ''),
  };
}

async function authTokenRequest(grantType, payload) {
  const url = `${AUTH_ENDPOINT}?grant_type=${encodeURIComponent(grantType)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error_description || data?.msg || data?.message || '登录失败');
  }
  return data;
}

async function refreshAuthSession() {
  if (!authSession?.refresh_token) throw new Error('未登录');
  const data = await authTokenRequest('refresh_token', {
    refresh_token: authSession.refresh_token,
  });
  const nextSession = buildAuthSessionFromTokenResponse(data);
  if (!nextSession.access_token) throw new Error('刷新登录失败');
  saveAuthSession(nextSession);
  return nextSession;
}

async function ensureAuthSession() {
  if (isAccessTokenValid()) return authSession;
  if (authSession?.refresh_token) return refreshAuthSession();
  throw new Error('未登录');
}

function normalizeLoginEmail(account) {
  const raw = String(account ?? '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  return `${raw}${LOGIN_EMAIL_SUFFIX}`;
}

function showLoginPage(message = '') {
  const loginPage = document.getElementById('login-page');
  const appRoot = document.getElementById('app-root');
  const errorEl = document.getElementById('login-error');
  const accountEl = document.getElementById('login-account');
  document.body.classList.add('login-mode');
  if (loginPage) loginPage.hidden = false;
  if (appRoot) appRoot.hidden = true;
  if (errorEl) errorEl.textContent = message;
  isAuthReady = false;
  clearMethodologyPage();
  requestAnimationFrame(() => accountEl?.focus());
}

function showApp() {
  const loginPage = document.getElementById('login-page');
  const appRoot = document.getElementById('app-root');
  document.body.classList.remove('login-mode');
  if (loginPage) loginPage.hidden = true;
  if (appRoot) appRoot.hidden = false;
  isAuthReady = true;
}

async function loginWithPassword(email, password) {
  const data = await authTokenRequest('password', {
    email: String(email ?? '').trim(),
    password: String(password ?? ''),
  });
  const session = buildAuthSessionFromTokenResponse(data);
  if (!session.access_token) throw new Error('登录失败');
  saveAuthSession(session);
  return session;
}

function getSupabaseHeaders(extra = {}) {
  const token = authSession?.access_token;
  if (!token) throw new Error('未登录');
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function supabaseFetch(input, init = {}) {
  await ensureAuthSession();
  const hasBody = init.body !== undefined && init.body !== null && init.body !== '';
  const headers = {
    ...getSupabaseHeaders(),
    ...(init.headers || {}),
  };
  if (hasBody) {
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  } else {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearAuthSession();
    showLoginPage('登录已过期，请重新登录');
    throw new Error('登录已过期，请重新登录');
  }
  return res;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (isLoggingIn) return;
  const accountEl = document.getElementById('login-account');
  const passwordEl = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');
  const account = String(accountEl?.value ?? '').trim();
  const password = String(passwordEl?.value ?? '');
  if (!account || !password) {
    if (errorEl) errorEl.textContent = '请填写账号和密码。';
    return;
  }
  if (errorEl) errorEl.textContent = '';
  isLoggingIn = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中';
  }
  try {
    await loginWithPassword(normalizeLoginEmail(account), password);
    showApp();
    setPage('admin');
  } catch (err) {
    if (errorEl) errorEl.textContent = String(err?.message || '登录失败');
  } finally {
    isLoggingIn = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '登录';
    }
  }
}

async function initApp() {
  loadAuthSession();
  if (authSession?.refresh_token) {
    try {
      await ensureAuthSession();
      showApp();
      setPage('admin');
      return;
    } catch {
      clearAuthSession();
    }
  }
  showLoginPage();
}

function logSave(level, message, detail) {
  const fn = level === 'error'
    ? console.error
    : level === 'warn'
      ? console.warn
      : console.log;
  if (detail === undefined) {
    fn(SAVE_LOG_PREFIX, message);
    return;
  }
  fn(SAVE_LOG_PREFIX, message, detail);
}

function dbValueToString(value) {
  return value == null ? '' : String(value);
}

function normalizeConcessions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      rate: Number(item?.rate),
      price: dbValueToString(item?.price),
      quantity: dbValueToString(item?.quantity),
    }))
    .filter((item) => Number.isFinite(item.rate) && item.rate >= 0 && item.price && item.quantity);
}

function enrichConcessionsWithBaseline(concessions, entryPrice, quantity) {
  if (!hasConcessions(concessions)) return concessions;
  const items = concessions.slice();
  if (!items.some((item) => Number(item.rate) === 0)) {
    const price = String(entryPrice ?? '').trim();
    const qty = String(quantity ?? '').trim();
    if (price && qty) items.unshift({ rate: 0, price, quantity: qty });
  }
  return items.sort((a, b) => Number(a.rate) - Number(b.rate));
}

function buildAdminConcessionsForRow(row) {
  const entryPrice = String(row?.entryPrice ?? '').trim();
  const quantity = String(row?.quantity ?? '').trim();
  if (!entryPrice || !quantity) return [];
  if (hasConcessions(row?.concessions)) {
    return enrichConcessionsWithBaseline(row.concessions, entryPrice, quantity);
  }
  return [{ rate: 0, price: entryPrice, quantity }];
}

/** 旧数据无 concessions 字段、为 null 或空数组时返回 null，列表不展示让利区块 */
function parseConcessionsFromDb(value) {
  if (value == null) return null;
  const items = normalizeConcessions(value);
  return items.length ? items : null;
}

function hasConcessions(concessions) {
  return Array.isArray(concessions) && concessions.length > 0;
}

function normalizeOutcomeStatus(outcomeStatus) {
  return outcomeStatus === 'profit' || outcomeStatus === 'loss' || outcomeStatus === 'not_filled' ? outcomeStatus : 'pending';
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
    grade: normalizeStrategyGrade(row.grade ?? getStrategyGradeFromOpenCost(row.open_cost)),
    priceAdjustmentRate: row.price_adjustment_rate,
    priceAdjustment: row.price_adjustment,
    concessions: parseConcessionsFromDb(row.concessions),
    takeProfitRMultiple: row.take_profit_r_multiple,
    timeframe: row.timeframe,
    timeframeMinutes: row.timeframe_minutes,
    timeframeLabel: getTimeframeLabel(row.timeframe),
    validPeriods: row.valid_periods,
    durationMinutes: row.duration_minutes,
    startAt: row.start_at,
    expiresAt: row.expires_at,
    outcomeStatus: row.outcome_status ?? 'pending',
    outcomeRemark: dbValueToString(row.outcome_remark),
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
    grade: normalizeStrategyGrade(record.grade ?? getStrategyGradeFromOpenCost(record.openCost)),
    price_adjustment_rate: Number(record.priceAdjustmentRate),
    price_adjustment: toNumber(record.priceAdjustment),
    concessions: hasConcessions(record.concessions)
      ? normalizeConcessions(record.concessions)
      : [],
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

function clearMethodologyPage() {
  const container = document.querySelector('#methodology-page .methodology-content');
  if (container) container.innerHTML = '';
}

function renderMethodologyPage() {
  if (!isAuthReady) return;
  const container = document.querySelector('#methodology-page .methodology-content');
  if (!container) return;
  container.innerHTML = METHODOLOGY_SECTIONS.map((section) => {
    let body = '';
    if (section.paragraphs?.length) {
      body = section.paragraphs
        .map((p) => `<p class="methodology-section__text">${escapeHtml(p)}</p>`)
        .join('');
    } else if (section.items?.length) {
      body = `<ul class="methodology-section__list">${section.items
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('')}</ul>`;
    }
    return `<article class="methodology-section"><h3 class="methodology-section__title">${escapeHtml(section.title)}</h3><div class="methodology-section__body">${body}</div></article>`;
  }).join('');
}

let currentStrategyCopyText = '';
let currentStrategyRecord = null;

function clearStrategyState() {
  currentStrategyCopyText = '';
  currentStrategyRecord = null;
}

function setStrategyState(strategy) {
  if (!strategy) {
    clearStrategyState();
    return;
  }
  currentStrategyCopyText = String(strategy.copyText ?? '').trim();
  currentStrategyRecord = strategy.record ?? null;
}

function getPositionSideMod(side) {
  return side === 'long' || side === 'short' ? side : 'flat';
}

function formatStrategyCardTitle(name) {
  const base = String(name || '未命名').trim() || '未命名';
  return /[A-Z]/.test(base) ? base.toLowerCase() : base;
}

function formatAdminCardTitlePlain(name, remark) {
  const title = formatStrategyCardTitle(name);
  const note = String(remark ?? '').trim();
  return note ? `${title}，备注：${note}` : title;
}

function renderAdminRemarkStampHtml(remark) {
  const note = String(remark ?? '').trim();
  if (!note) return '';
  return `<div class="admin-item__remark-stamp" aria-label="备注：${escapeHtml(note)}">${escapeHtml(note)}</div>`;
}

function buildStrategyCopyText({ name, price, quantity, takeProfit, stopLoss }) {
  return [
    formatStrategyCardTitle(name),
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

function getPriceDecimalPlacesFromValues(...values) {
  return values.reduce((max, value) => {
    const places = getDecimalPlacesFromInput(String(value ?? ''));
    return Math.max(max, places);
  }, 0);
}

/** 参考止盈：3R 与 5R 止盈价区间（1R 盈利 = 开仓成本） */
function buildReferenceTakeProfitLabel(entryPrice, stopLoss, decimalPlaces) {
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopLoss);
  if (entry == null || stop == null || entry === stop) return '—';
  const tpLowR = calcTakeProfit(entry, stop, REF_TAKE_PROFIT_R_LOW);
  const tpHighR = calcTakeProfit(entry, stop, REF_TAKE_PROFIT_R_HIGH);
  if (tpLowR == null || tpHighR == null) return '—';
  const decimals = decimalPlaces ?? getPriceDecimalPlacesFromValues(entryPrice, stopLoss);
  const low = formatTrimmedFixedDecimals(Math.min(tpLowR, tpHighR), decimals);
  const high = formatTrimmedFixedDecimals(Math.max(tpLowR, tpHighR), decimals);
  return `${low}-${high}`;
}

function renderReferenceTakeProfitHtml(blockClass, label) {
  const value = escapeHtml(String(label ?? '').trim() || '—');
  return [
    `<div class="${blockClass}">`,
    `<span class="${blockClass}-label">参考止盈</span>`,
    `<span class="${blockClass}-value">${value}</span>`,
    '</div>',
  ].join('');
}

function calcAdjustedOpenPrice(open, stop, decimalPlaces) {
  return Number(formatFixedDecimals(open, decimalPlaces));
}

/** 让利价：在开仓价基础上，沿远离止损方向移动 rate×|价格-止损|（开多上调、开空下调） */
function calcConcessionalEntryPrice(entryPrice, stopLoss, rate, decimalPlaces) {
  const stopDiff = Math.abs(entryPrice - stopLoss);
  if (!(stopDiff > 0) || !Number.isFinite(rate) || rate < 0) return null;
  const awayFromStop = entryPrice > stopLoss ? 1 : -1;
  const price = entryPrice + awayFromStop * rate * stopDiff;
  return Number(formatFixedDecimals(price, decimalPlaces));
}

function calcQuantityByRisk(openCost, entryPrice, stopLoss) {
  const stopDiff = Math.abs(entryPrice - stopLoss);
  if (!(stopDiff > 0) || openCost == null || !(openCost > 0)) return null;
  return openCost / stopDiff;
}

function formatConcessionPercent(rate) {
  return `${Math.round(rate * 100)}%`;
}

function getDisplayConcessionItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => Number(item.rate) !== 0);
}

function buildConcessionItems(entryPrice, stopLoss, openCost, decimalPlaces, rates = CONCESSION_RATES) {
  const items = [];
  for (const rate of rates) {
    const price = calcConcessionalEntryPrice(entryPrice, stopLoss, rate, decimalPlaces);
    const qty = price == null ? null : calcQuantityByRisk(openCost, price, stopLoss);
    if (price == null || qty == null) continue;
    items.push({
      rate,
      price: formatTrimmedFixedDecimals(price, decimalPlaces),
      quantity: formatQuantity(qty),
    });
  }
  return items;
}

function renderConcessionsHtml({ prefix, items, stopLabel, wrapperClass }) {
  const displayItems = getDisplayConcessionItems(items);
  if (!displayItems.length) return '';
  const stop = escapeHtml(String(stopLabel ?? '').trim() || '—');
  const rowClass = `${prefix}-concession`;
  const rows = displayItems.map((item) => [
    `<div class="${rowClass}">`,
    `<span class="${rowClass}__rate">${escapeHtml(formatConcessionPercent(item.rate))}</span>`,
    `<span class="${rowClass}__price">${escapeHtml(item.price)}</span>`,
    `<span class="${rowClass}__qty">${escapeHtml(item.quantity)}</span>`,
    `<span class="${rowClass}__stop">${stop}</span>`,
    '</div>',
  ].join('')).join('');
  return [
    `<div class="${wrapperClass}" aria-label="让利档位">`,
    `<div class="${rowClass} ${rowClass}--head">`,
    `<span class="${rowClass}__rate">让利</span>`,
    `<span class="${rowClass}__price">价格</span>`,
    `<span class="${rowClass}__qty">数量</span>`,
    `<span class="${rowClass}__stop">止损</span>`,
    '</div>',
    rows,
    '</div>',
  ].join('');
}

function renderStrategyConcessionsHtml(items, stopLabel) {
  return renderConcessionsHtml({
    prefix: 'strategy',
    items,
    stopLabel,
    wrapperClass: 'strategy-card__concessions',
  });
}

function buildStrategyDisplayHtml({
  side,
  alarmName,
  stopLabel,
  refTakeProfitLabel,
  concessionItems,
  timeRangeLabel,
}) {
  const sideMod = getPositionSideMod(side);
  const title = formatStrategyCardTitle(alarmName);
  return [
    `<div class="strategy-card strategy-card--${sideMod}">`,
    '<div class="strategy-card__head">',
    `<span class="strategy-card__title">${escapeHtml(title)}</span>`,
    '</div>',
    renderStrategyConcessionsHtml(concessionItems, stopLabel),
    renderReferenceTakeProfitHtml('strategy-card__ref-tp', refTakeProfitLabel),
    `<div class="strategy-card__time"><span class="strategy-card__time-label">时间范围</span><span class="strategy-card__time-value">${escapeHtml(timeRangeLabel)}</span></div>`,
    '</div>',
  ].join('');
}

function buildStrategyPlainText({
  sideLabel,
  stopLabel,
  refTakeProfitLabel,
  concessionItems,
  timeRangeLabel,
}) {
  const displayItems = getDisplayConcessionItems(concessionItems);
  return [
    sideLabel,
    ...displayItems.map((item) => (
      `让利${formatConcessionPercent(item.rate)}：${item.price} / ${item.quantity} / ${stopLabel}`
    )),
    `参考止盈：${refTakeProfitLabel}`,
    `时间范围：${timeRangeLabel}`,
  ].join('\n');
}

function renderAdminConcessionsHtml(concessions, stopLabel) {
  return renderConcessionsHtml({
    prefix: 'admin',
    items: concessions,
    stopLabel,
    wrapperClass: 'admin-item__concessions',
  });
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
  const quantity = calcQuantityByRisk(openCost, adjustedOpen, stop);
  const primaryConcessionalPrice = calcConcessionalEntryPrice(adjustedOpen, stop, PRICE_ADJUSTMENT_RATE, priceDecimalPlaces);
  const priceAdjustment = primaryConcessionalPrice == null ? 0 : Math.abs(adjustedOpen - primaryConcessionalPrice);
  const tp = calcTakeProfit(adjustedOpen, stop, TAKE_PROFIT_R_MULTIPLE);
  const tpDecimals = Math.max(0, priceDecimalPlaces);

  const nameEl = document.getElementById('name-input');
  const name = String(nameEl?.value ?? '').trim();
  const side = adjustedOpen > stop ? 'long' : 'short';
  const alarmName = name || 'test';
  const sideLabel = formatStrategyCardTitle(alarmName);
  const startAt = getStartDateTime(startTimeValue);
  const endAt = addPeriodToStart(startTimeValue, spanMinutes);
  const startDisplay = startAt ? formatFullDateTimeLabel(startAt) : (startTimeLabel || startTimeValue);
  const endDisplay = endAt ? formatFullDateTimeLabel(endAt) : '—';
  const timeRangeLabel = `${startDisplay} — ${endDisplay}`;

  const priceLabel = formatTrimmedFixedDecimals(adjustedOpen, priceDecimalPlaces);
  const tpLabel = formatTrimmedFixedDecimals(tp, tpDecimals);
  const stopLabel = formatPrice(stop);
  const refTakeProfitLabel = buildReferenceTakeProfitLabel(adjustedOpen, stop, priceDecimalPlaces);
  const concessionItems = buildConcessionItems(adjustedOpen, stop, openCost, priceDecimalPlaces);
  const baselineItem = concessionItems.find((item) => Number(item.rate) === 0);
  const qty = baselineItem?.quantity ?? formatQuantity(quantity);

  const plain = buildStrategyPlainText({
    sideLabel,
    stopLabel,
    refTakeProfitLabel,
    concessionItems,
    timeRangeLabel,
  });
  const html = buildStrategyDisplayHtml({
    side,
    alarmName,
    stopLabel,
    refTakeProfitLabel,
    concessionItems,
    timeRangeLabel,
  });

  const copyText = buildStrategyCopyText({
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
    grade: getStrategyGradeFromOpenCost(openCost),
    priceAdjustmentRate: PRICE_ADJUSTMENT_RATE,
    priceAdjustment: formatTrimmedFixedDecimals(priceAdjustment, priceDecimalPlaces),
    concessions: concessionItems,
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

  const open = toNumber(openEl && 'value' in openEl ? openEl.value : '');
  const stop = toNumber(stopEl && 'value' in stopEl ? stopEl.value : '');
  const openCost = getOpenCost();
  const startTime = timeEl && 'value' in timeEl ? String(timeEl.value).trim() : '';
  const startTimeLabel = timeEl ? String(timeEl.selectedOptions?.[0]?.textContent ?? '').trim() : '';

  if (errEl) errEl.textContent = '';

  if (open === null || stop === null) {
    if (errEl) errEl.textContent = '请输入有效的价格与止损（数字）。';
    clearStrategyState();
    return;
  }

  if (open <= 0) {
    if (errEl) errEl.textContent = '价格须为大于 0 的数字。';
    clearStrategyState();
    return;
  }

  if (openCost === null) {
    if (errEl) errEl.textContent = '请输入有效的开仓成本（大于 0 的数字）。';
    clearStrategyState();
    return;
  }

  if (!startTime) {
    if (errEl) errEl.textContent = '请选择开始时间。';
    clearStrategyState();
    return;
  }

  if (open === stop) {
    if (errEl) errEl.textContent = '价格与止损不能相同，无法计算数量与方向。';
    clearStrategyState();
    return;
  }

  const openRaw = openEl && 'value' in openEl ? String(openEl.value) : '';
  const stopRaw = stopEl && 'value' in stopEl ? String(stopEl.value) : '';
  const priceDecimals = Math.max(getDecimalPlacesFromInput(openRaw), getDecimalPlacesFromInput(stopRaw)) + 1;
  const adjustedOpen = calcAdjustedOpenPrice(open, stop, priceDecimals);
  const takeProfit = calcTakeProfit(adjustedOpen, stop, TAKE_PROFIT_R_MULTIPLE);
  if (!Number.isFinite(adjustedOpen) || adjustedOpen <= 0 || !Number.isFinite(takeProfit) || takeProfit <= 0) {
    if (errEl) errEl.textContent = '价格或止盈价无效，请检查价格与止损。';
    clearStrategyState();
    return;
  }
  const strategy = buildStrategy(open, stop, startTime, startTimeLabel, openCost, priceDecimals);
  setStrategyState(strategy);
  logSave('info', '策略已生成，可保存', {
    strategyName: strategy.record?.strategyName,
    hasCopyText: Boolean(strategy.copyText),
    hasRecord: Boolean(strategy.record),
    recordPreview: strategy.record,
  });
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
    updateOpenCostNote();
    autoGenerateIfReady();
  });
});

updateOpenCostNote();

function onEnter(e) {
  if (e.key === 'Enter') generate();
}
if (openInput) openInput.addEventListener('keydown', onEnter);
if (stopInput) stopInput.addEventListener('keydown', onEnter);
if (startTimeSelect) {
  startTimeSelect.addEventListener('keydown', onEnter);
  startTimeSelect.addEventListener('change', () => {
    updateStartTimeTriggerLabel();
    startTimeUserPicked = true;
    autoGenerateIfReady();
  });
}

function autoGenerateIfReady() {
  const openVal = String(openInput?.value ?? '').trim();
  const stopVal = String(stopInput?.value ?? '').trim();
  if (openVal && stopVal) {
    generate();
    return;
  }
  const errEl = document.getElementById('error');
  if (errEl) errEl.textContent = '';
  clearStrategyState();
}

if (openInput) openInput.addEventListener('input', autoGenerateIfReady);
if (stopInput) stopInput.addEventListener('input', autoGenerateIfReady);

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
  updateOpenCostNote();
  if (nameInput) nameInput.value = '';
  const errEl = document.getElementById('error');
  if (errEl) errEl.textContent = '';
  clearStrategyState();
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

function getLocalDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

function buildStrategiesQuery(filterValue = 'all') {
  const filter = normalizeAdminTimeFilter(filterValue);
  const params = ['select=*', 'order=created_at.desc'];
  const nameSearch = normalizeAdminNameSearch(adminNameSearch);

  if (nameSearch) {
    params.push(`strategy_name=ilike.${encodeURIComponent(`*${nameSearch}*`)}`);
  }
  if (filter === 'active') {
    params.push(`expires_at=gt.${encodeURIComponent(new Date().toISOString())}`);
    params.push('outcome_status=eq.pending');
  } else if (filter === 'dueToday') {
    const { start, end } = getLocalDayRange();
    params.push(`expires_at=gte.${encodeURIComponent(start.toISOString())}`);
    params.push(`expires_at=lt.${encodeURIComponent(end.toISOString())}`);
    params.push('outcome_status=eq.pending');
  } else if (filter === 'createdToday') {
    const { start, end } = getLocalDayRange();
    params.push(`created_at=gte.${encodeURIComponent(start.toISOString())}`);
    params.push(`created_at=lt.${encodeURIComponent(end.toISOString())}`);
  }
  return params.join('&');
}

async function fetchStrategies(filterValue = 'all') {
  const res = await supabaseFetch(`${STRATEGIES_ENDPOINT}?${buildStrategiesQuery(filterValue)}`, {
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
  const payload = {
    p_name_search: ignoreAdminFilters ? null : normalizeAdminNameSearch(adminNameSearch) || null,
    p_timeframe: null,
    p_outcome_status: null,
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
  const res = await supabaseFetch(STRATEGY_STATS_ENDPOINT, {
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
  const res = await supabaseFetch(RECENT_10_STATS_ENDPOINT, {
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
  const payload = toDbRecord(record);
  logSave('info', '准备请求 Supabase', {
    endpoint: STRATEGIES_ENDPOINT,
    payload,
  });
  let res;
  try {
    res = await supabaseFetch(STRATEGIES_ENDPOINT, {
      method: 'POST',
      headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logSave('error', '网络请求失败（未到达 Supabase）', {
      message: err?.message || String(err),
      endpoint: STRATEGIES_ENDPOINT,
    });
    throw err;
  }
  const bodyText = res.ok ? '' : await res.text();
  logSave(res.ok ? 'info' : 'error', 'Supabase 响应', {
    status: res.status,
    ok: res.ok,
    body: bodyText || '(empty)',
  });
  if (!res.ok) throw new Error(bodyText || `HTTP ${res.status}`);
}

function normalizeStrategyIds(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Array.from(new Set(list.map((id) => String(id ?? '').trim()).filter(Boolean)));
}

async function deleteStrategies(ids) {
  const normalizedIds = normalizeStrategyIds(ids);
  if (!normalizedIds.length) return;
  const idFilter = encodeURIComponent(`(${normalizedIds.join(',')})`);
  const res = await supabaseFetch(`${STRATEGIES_ENDPOINT}?id=in.${idFilter}`, {
    method: 'DELETE',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function updateStrategyOutcomeStatus(id, outcomeStatus, remark) {
  const encodedId = encodeURIComponent(id);
  const res = await supabaseFetch(`${STRATEGIES_ENDPOINT}?id=eq.${encodedId}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      outcome_status: outcomeStatus,
      outcome_remark: String(remark ?? '').trim(),
    }),
  });
  if (!res.ok) throw new Error(await res.text());
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

const ADMIN_TIME_FILTER_LABELS = {
  all: '全部',
  active: '进行中',
  createdToday: '今日创建',
  dueToday: '今日到期',
};

const DEFAULT_ADMIN_TIME_FILTER = 'active';

let adminTimeFilter = DEFAULT_ADMIN_TIME_FILTER;
let adminNameSearch = '';
let adminSearchTimer = null;

function normalizeAdminFilter(value, labels, fallback = 'all') {
  return Object.prototype.hasOwnProperty.call(labels, value) ? value : fallback;
}

function normalizeAdminTimeFilter(value) {
  return normalizeAdminFilter(value, ADMIN_TIME_FILTER_LABELS);
}

function normalizeAdminNameSearch(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function renderAdminFilterTabs() {
  const tabsEl = document.getElementById('admin-filter-tabs');
  renderAdminTabGroup(tabsEl, ADMIN_TIME_FILTER_LABELS, normalizeAdminTimeFilter(adminTimeFilter), 'admin-time-filter');
}

function renderAdminTabGroup(tabsEl, labels, activeValue, dataAttr) {
  if (!tabsEl) return;
  tabsEl.innerHTML = Object.entries(labels).map(([value, label]) => {
    const active = activeValue === value;
    return `<button type="button" class="admin-filter-tab${active ? ' is-active' : ''}" role="tab" aria-selected="${active ? 'true' : 'false'}" data-${dataAttr}="${value}">${escapeHtml(label)}</button>`;
  }).join('');
}

function renderAdminControls() {
  renderAdminFilterTabs();
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
  const selectedCount = selectedStrategyIds.size;
  const selectionEl = document.getElementById('admin-selection');
  const countEl = document.getElementById('admin-selection-count');
  const selectAllBtn = document.getElementById('admin-select-all');
  const clearSelectionBtn = document.getElementById('admin-clear-selection');
  const deleteSelectedBtn = document.getElementById('admin-delete-selected');
  const visibleCount = getVisibleAdminStrategyIds().length;

  if (selectionEl) selectionEl.hidden = currentPage !== 'admin' || !isAdminSelectionMode || visibleCount === 0;
  if (countEl) countEl.textContent = `已选 ${selectedCount} 条`;
  if (selectAllBtn) selectAllBtn.disabled = isDeletingStrategies || !isAdminSelectionMode || visibleCount === 0;
  if (clearSelectionBtn) clearSelectionBtn.disabled = isDeletingStrategies || !isAdminSelectionMode;
  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = isDeletingStrategies || !isAdminSelectionMode || selectedCount === 0;
    deleteSelectedBtn.setAttribute('aria-busy', isDeletingStrategies ? 'true' : 'false');
  }

  updateHeaderClearButton();
}

function updateHeaderClearButton() {
  const btnClear = document.getElementById('btn-clear');
  if (!btnClear) return;

  if (currentPage === 'admin') {
    btnClear.hidden = false;
    const visibleCount = getVisibleAdminStrategyIds().length;
    const selectedCount = selectedStrategyIds.size;
    btnClear.textContent = isAdminSelectionMode
      ? (selectedCount ? `删除所选(${selectedCount})` : '取消删除')
      : '删除';
    btnClear.disabled = isDeletingStrategies || (!isAdminSelectionMode && visibleCount === 0);
    btnClear.setAttribute('aria-busy', isDeletingStrategies ? 'true' : 'false');
    return;
  }

  if (currentPage === 'observations') {
    btnClear.hidden = false;
    const visibleCount = getVisibleObservationIds().length;
    const selectedCount = selectedObservationIds.size;
    btnClear.textContent = isObsSelectionMode
      ? (selectedCount ? `删除所选(${selectedCount})` : '取消删除')
      : '删除';
    btnClear.disabled = isDeletingObservations || (!isObsSelectionMode && visibleCount === 0);
    btnClear.setAttribute('aria-busy', isDeletingObservations ? 'true' : 'false');
    return;
  }

  btnClear.hidden = true;
  btnClear.textContent = '删除';
  btnClear.disabled = false;
  btnClear.setAttribute('aria-busy', 'false');
}

function enterAdminSelectionMode() {
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
  await deleteStrategyIdsWithConfirm(Array.from(selectedStrategyIds), { exitSelectionMode: true });
}

let pendingOutcomeStatusRecordId = '';
let pendingOutcomeStatusSelection = '';

function setOutcomeStatusPickerLoading(loading) {
  document.querySelectorAll('#status-picker button').forEach((btn) => {
    btn.disabled = loading;
  });
  const remarkEl = document.getElementById('status-picker-remark');
  if (remarkEl) remarkEl.disabled = loading;
}

function setOutcomeStatusPickerError(message) {
  const errEl = document.getElementById('status-picker-error');
  if (errEl) errEl.textContent = message;
}

function resetOutcomeStatusPickerForm() {
  pendingOutcomeStatusSelection = '';
  const remarkEl = document.getElementById('status-picker-remark');
  if (remarkEl) remarkEl.value = '';
  document.querySelectorAll('#status-picker [data-outcome-status]').forEach((btn) => {
    btn.classList.remove('is-selected');
    btn.setAttribute('aria-pressed', 'false');
  });
}

function selectOutcomeStatusInPicker(outcomeStatus) {
  const next = String(outcomeStatus ?? '').trim();
  if (!isOutcomeStatusChoice(next)) return;
  pendingOutcomeStatusSelection = next;
  document.querySelectorAll('#status-picker [data-outcome-status]').forEach((btn) => {
    const selected = btn.getAttribute('data-outcome-status') === next;
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function openOutcomeStatusPicker(id, currentStatus, currentRemark) {
  const picker = document.getElementById('status-picker');
  if (!picker || !id) return;
  pendingOutcomeStatusRecordId = id;
  setOutcomeStatusPickerLoading(false);
  setOutcomeStatusPickerError('');
  resetOutcomeStatusPickerForm();

  const normalized = normalizeOutcomeStatus(currentStatus);
  if (isOutcomeStatusChoice(normalized)) {
    selectOutcomeStatusInPicker(normalized);
  }
  const remarkEl = document.getElementById('status-picker-remark');
  if (remarkEl) remarkEl.value = String(currentRemark ?? '');

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
  resetOutcomeStatusPickerForm();
  setOutcomeStatusPickerLoading(false);
  setOutcomeStatusPickerError('');
  picker.hidden = true;
  document.body.style.overflow = '';
}

function isOutcomeStatusChoice(value) {
  return value === 'profit' || value === 'loss' || value === 'not_filled';
}

async function submitOutcomeStatusFromPicker() {
  const id = pendingOutcomeStatusRecordId;
  const nextOutcomeStatus = pendingOutcomeStatusSelection;
  if (!id || !isOutcomeStatusChoice(nextOutcomeStatus)) {
    setOutcomeStatusPickerError('请先选择盈利状态。');
    return;
  }
  const remarkEl = document.getElementById('status-picker-remark');
  const remark = String(remarkEl?.value ?? '').trim();
  setOutcomeStatusPickerLoading(true);
  setOutcomeStatusPickerError('');
  try {
    await updateStrategyOutcomeStatus(id, nextOutcomeStatus, remark);
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
    const sideMod = getPositionSideMod(sideRaw);
    const title = escapeHtml(formatStrategyCardTitle(nameRaw));
    const titleLabel = escapeHtml(formatAdminCardTitlePlain(nameRaw, row?.outcomeRemark));
    const gradeBadgeHtml = normalizeStrategyGrade(row?.grade) === STRATEGY_GRADE_PREMIUM
      ? '<span class="admin-item__grade admin-item__grade--premium">优质</span>'
      : '';
    const titleGroupHtml = [
      '<div class="admin-item__title-wrap">',
      `<span class="admin-item__title">${title}</span>`,
      gradeBadgeHtml,
      '</div>',
    ].join('');
    const remarkStampHtml = renderAdminRemarkStampHtml(row?.outcomeRemark);
    const stop = escapeHtml(String(row?.stopLossPrice ?? '-'));
    const refTakeProfitLabel = buildReferenceTakeProfitLabel(
      row?.entryPrice,
      row?.stopLossPrice,
      getPriceDecimalPlacesFromValues(row?.entryPrice, row?.stopLossPrice),
    );
    const refTakeProfitHtml = renderReferenceTakeProfitHtml('admin-item__ref-tp', refTakeProfitLabel);
    const concessionsHtml = renderAdminConcessionsHtml(buildAdminConcessionsForRow(row), stop);
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
        `<label class="admin-item__selector${selectorDisabled}" aria-label="选择 ${titleLabel}">`,
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
        `<button type="button" class="admin-outcome-status admin-outcome-status--${outcomeInfo.type} admin-outcome-status--actionable" data-id="${id}" data-time-status="${timeStatus}" data-outcome-status="${escapeHtml(outcomeStatus)}" data-outcome-remark="${escapeHtml(String(row?.outcomeRemark ?? ''))}" aria-haspopup="dialog" aria-controls="status-picker" aria-label="修改盈利状态">`,
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
      remarkStampHtml,
      '<header class="admin-item__head">',
      selectHtml,
      titleGroupHtml,
      timeBadgeHtml,
      '</header>',
      concessionsHtml,
      refTakeProfitHtml,
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

const CASES_DIR = './cases/';
const CASE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const CASE_MAX_COUNT = 99;

let casesSlideIndex = 0;
let casesImages = [];

function checkCaseImageExists(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function findCaseImageByIndex(index) {
  const base = String(index).padStart(2, '0');
  const results = await Promise.all(
    CASE_EXTENSIONS.map(async (ext) => {
      const file = `${base}.${ext}`;
      const exists = await checkCaseImageExists(`${CASES_DIR}${file}`);
      return exists ? file : null;
    }),
  );
  return results.find(Boolean) ?? null;
}

/** 按 01、02 … 序号自动扫描 cases 文件夹内的图片 */
async function discoverCaseImages() {
  const images = [];
  for (let i = 1; i <= CASE_MAX_COUNT; i += 1) {
    const found = await findCaseImageByIndex(i);
    if (found) {
      images.push(found);
    } else if (images.length > 0) {
      break;
    }
  }
  return images;
}

function getCasesViewport() {
  return document.querySelector('.cases-carousel__viewport');
}

function goToCaseSlide(index, { animate = true } = {}) {
  const track = document.getElementById('cases-track');
  const viewport = getCasesViewport();
  if (!track || !viewport || casesImages.length === 0) return;
  casesSlideIndex = Math.max(0, Math.min(index, casesImages.length - 1));
  track.style.transition = animate ? 'transform 0.32s ease' : 'none';
  track.style.transform = `translateX(-${casesSlideIndex * viewport.clientWidth}px)`;
}

function setupCasesSwipe(viewport, track) {
  let startX = 0;
  let startTranslate = 0;
  let dragging = false;
  let pointerId = null;

  const getWidth = () => viewport.clientWidth;

  const finishDrag = (clientX) => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-dragging');
    const dx = clientX - startX;
    const threshold = getWidth() * 0.18;
    if (dx < -threshold) goToCaseSlide(casesSlideIndex + 1);
    else if (dx > threshold) goToCaseSlide(casesSlideIndex - 1);
    else goToCaseSlide(casesSlideIndex);
  };

  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    viewport.setPointerCapture(pointerId);
    dragging = true;
    startX = e.clientX;
    startTranslate = -casesSlideIndex * getWidth();
    track.style.transition = 'none';
    viewport.classList.add('is-dragging');
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const min = -(casesImages.length - 1) * getWidth();
    const max = 0;
    const rubber = getWidth() * 0.25;
    let next = startTranslate + dx;
    next = Math.max(min - rubber, Math.min(max + rubber, next));
    track.style.transform = `translateX(${next}px)`;
  });

  viewport.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointerId) return;
    viewport.releasePointerCapture(pointerId);
    pointerId = null;
    finishDrag(e.clientX);
  });

  viewport.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    finishDrag(e.clientX);
  });

  window.addEventListener('resize', () => {
    if (currentPage === 'cases') goToCaseSlide(casesSlideIndex, { animate: false });
  });
}

async function renderCasesPage() {
  const track = document.getElementById('cases-track');
  const emptyEl = document.getElementById('cases-empty');
  const carouselEl = document.getElementById('cases-carousel');
  if (!track || !emptyEl) return;

  track.innerHTML = '<div class="cases-loading">加载中...</div>';
  emptyEl.hidden = true;
  if (carouselEl) carouselEl.hidden = false;

  casesImages = await discoverCaseImages();

  if (casesImages.length === 0) {
    track.innerHTML = '';
    if (carouselEl) carouselEl.hidden = true;
    emptyEl.hidden = false;
    return;
  }

  track.innerHTML = casesImages.map((file, i) => {
    const src = `${CASES_DIR}${encodeURIComponent(file)}`;
    const alt = file.replace(/\.[^.]+$/, '');
    return `<figure class="cases-carousel__slide"><img class="cases-carousel__img" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="${i === 0 ? 'eager' : 'lazy'}" draggable="false" /></figure>`;
  }).join('');

  const viewport = getCasesViewport();
  if (viewport && !viewport.dataset.swipeBound) {
    setupCasesSwipe(viewport, track);
    viewport.dataset.swipeBound = 'true';
  }

  casesSlideIndex = 0;
  requestAnimationFrame(() => goToCaseSlide(0, { animate: false }));
}

function getObsGradeClass(grade) {
  const map = {
    观测中: 'pending',
    普通: 'normal',
    优质: 'premium',
  };
  return map[grade] || 'normal';
}

function normalizeObservationItems(items) {
  const source = Array.isArray(items) ? items : [];
  return source
    .map((item) => ({
      name: String(item?.name ?? '').trim(),
      grade: normalizeObservationGrade(item?.grade),
    }))
    .filter((item) => item.name);
}

function fromObservationRecord(row) {
  let items = [];
  if (Array.isArray(row?.items)) {
    items = row.items;
  } else if (typeof row?.content === 'string' && row.content.trim()) {
    items = [{ name: row.content.trim(), grade: OBS_DEFAULT_GRADE }];
  }
  return {
    id: String(row?.id ?? '').trim(),
    createdAt: row?.created_at ?? null,
    items: normalizeObservationItems(items),
  };
}

async function fetchObservationRecords() {
  const params = 'select=id,created_at,items&order=created_at.desc';
  const res = await supabaseFetch(`${OBSERVATIONS_ENDPOINT}?${params}`, {
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map(fromObservationRecord) : [];
}

async function createObservationRecord(items) {
  const normalizedItems = normalizeObservationItems(items);
  if (!normalizedItems.length) throw new Error('记录内容不能为空');
  const payload = {
    items: normalizedItems,
    content: normalizedItems.map((item) => `${item.name}:${item.grade}`).join('\n'),
  };
  const res = await supabaseFetch(OBSERVATIONS_ENDPOINT, {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function deleteObservationRecords(ids) {
  const normalizedIds = Array.from(new Set(
    (Array.isArray(ids) ? ids : [ids])
      .map((id) => String(id ?? '').trim())
      .filter(Boolean),
  ));
  if (!normalizedIds.length) return;
  const idFilter = encodeURIComponent(`(${normalizedIds.join(',')})`);
  const res = await supabaseFetch(`${OBSERVATIONS_ENDPOINT}?id=in.${idFilter}`, {
    method: 'DELETE',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) throw new Error(await res.text());
}

function formatObservationRecordDate(isoString) {
  const d = parseDateValue(isoString);
  if (!d) return '—';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function renderObsGradeBadge(grade) {
  const cls = getObsGradeClass(grade);
  return `<span class="obs-grade obs-grade--${cls}">${escapeHtml(grade)}</span>`;
}

function normalizeObservationGrade(grade) {
  const raw = String(grade ?? '').trim();
  const legacyMap = {
    优秀: '优质',
    良好: '普通',
    及格: '普通',
    待观测: '观测中',
  };
  const normalized = legacyMap[raw] || raw;
  return OBS_GRADE_OPTIONS.includes(normalized) ? normalized : OBS_DEFAULT_GRADE;
}

function renderObservationTemplateDisplay(items) {
  const normalizedItems = normalizeObservationItems(items);
  if (!normalizedItems.length) {
    return '<p class="obs-template-empty">暂无币种记录</p>';
  }
  const rows = normalizedItems
    .map((item) => [
      '<div class="obs-template__row">',
      `<span class="obs-template__name">${escapeHtml(item.name)}</span>`,
      renderObsGradeBadge(item.grade),
      '</div>',
    ].join(''))
    .join('');
  return [
    '<div class="obs-template">',
    '<div class="obs-template__row obs-template__head">',
    '<span>名称</span>',
    '<span>等级</span>',
    '</div>',
    rows,
    '</div>',
  ].join('');
}

function renderObservationFormRow(item = {}) {
  const name = escapeHtml(String(item?.name ?? ''));
  const grade = normalizeObservationGrade(item?.grade);
  const options = OBS_GRADE_OPTIONS.map((option) => {
    const selected = option === grade ? ' selected' : '';
    return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
  }).join('');
  return [
    '<div class="obs-form-row">',
    `<input class="obs-form-row__name" type="text" value="${name}" placeholder="请输入名称" autocomplete="off" autocapitalize="characters" spellcheck="false" />`,
    `<select class="obs-form-row__grade" aria-label="等级">${options}</select>`,
    '<button type="button" class="obs-form-row__remove" aria-label="删除">×</button>',
    '</div>',
  ].join('');
}

function renderObservationFormEmptyHint() {
  return '<p class="obs-form-empty">点击「新增」添加币种记录。</p>';
}

function renderObservationFormList() {
  const listEl = document.getElementById('obs-form-list');
  if (!listEl) return;
  listEl.innerHTML = Array.from({ length: OBS_FORM_DEFAULT_ROWS }, () => (
    renderObservationFormRow({ grade: OBS_DEFAULT_GRADE })
  )).join('');
}

function syncObservationFormEmptyHint() {
  const listEl = document.getElementById('obs-form-list');
  if (!listEl) return;
  const hasRows = listEl.querySelector('.obs-form-row');
  const emptyEl = listEl.querySelector('.obs-form-empty');
  if (hasRows) {
    emptyEl?.remove();
    return;
  }
  if (!emptyEl) listEl.innerHTML = renderObservationFormEmptyHint();
}

function addObservationFormRow(focusName = true) {
  const listEl = document.getElementById('obs-form-list');
  if (!listEl) return;
  listEl.querySelector('.obs-form-empty')?.remove();
  listEl.insertAdjacentHTML('beforeend', renderObservationFormRow({ grade: OBS_DEFAULT_GRADE }));
  if (focusName) {
    const rows = listEl.querySelectorAll('.obs-form-row__name');
    rows[rows.length - 1]?.focus();
  }
}

function removeObservationFormRow(rowEl) {
  if (!(rowEl instanceof HTMLElement)) return;
  rowEl.remove();
  syncObservationFormEmptyHint();
}

function collectObservationFormItems() {
  return Array.from(document.querySelectorAll('#obs-form-list .obs-form-row'))
    .map((row) => ({
      name: String(row.querySelector('.obs-form-row__name')?.value ?? '').trim(),
      grade: normalizeObservationGrade(row.querySelector('.obs-form-row__grade')?.value),
    }))
    .filter((item) => item.name);
}

function renderObservationRecordItem(record) {
  const rawId = String(record?.id ?? '').trim();
  const id = escapeHtml(rawId);
  const date = escapeHtml(formatObservationRecordDate(record.createdAt));
  const dateTime = escapeHtml(String(record?.createdAt ?? ''));
  const templateHtml = renderObservationTemplateDisplay(record.items);
  const checked = rawId && selectedObservationIds.has(rawId) ? ' checked' : '';
  const disabled = isDeletingObservations ? ' disabled' : '';
  const selectorDisabled = isDeletingObservations ? ' is-disabled' : '';
  const selectHtml = rawId && isObsSelectionMode
    ? [
      `<label class="admin-item__selector${selectorDisabled}" aria-label="选择观测记录">`,
      `<input type="checkbox" class="admin-item__select" data-id="${id}"${checked}${disabled}>`,
      '<span class="admin-item__checkmark" aria-hidden="true"></span>',
      '</label>',
    ].join('')
    : '';
  return [
    '<article class="obs-record">',
    '<div class="obs-record__meta">',
    selectHtml,
    `<time class="obs-record__date" datetime="${dateTime}">${date}</time>`,
    '</div>',
    '<div class="obs-item">',
    templateHtml,
    '</div>',
    '</article>',
  ].join('');
}

let selectedObservationIds = new Set();
let isDeletingObservations = false;
let isObsSelectionMode = false;
let visibleObservationIds = [];

function getVisibleObservationIds() {
  const domIds = Array.from(document.querySelectorAll('#obs-list .admin-item__select'))
    .map((el) => String(el.getAttribute('data-id') ?? '').trim())
    .filter(Boolean);
  return domIds.length ? domIds : visibleObservationIds;
}

function syncObsSelectionWithRows(records) {
  visibleObservationIds = records.map((row) => String(row?.id ?? '').trim()).filter(Boolean);
  const visibleIds = new Set(visibleObservationIds);
  selectedObservationIds = new Set(Array.from(selectedObservationIds).filter((id) => visibleIds.has(id)));
  updateObsSelectionControls();
}

function updateObsSelectionControls() {
  const selectedCount = selectedObservationIds.size;
  const selectionEl = document.getElementById('obs-selection');
  const countEl = document.getElementById('obs-selection-count');
  const selectAllBtn = document.getElementById('obs-select-all');
  const clearSelectionBtn = document.getElementById('obs-clear-selection');
  const deleteSelectedBtn = document.getElementById('obs-delete-selected');
  const visibleCount = getVisibleObservationIds().length;

  if (selectionEl) selectionEl.hidden = currentPage !== 'observations' || !isObsSelectionMode || visibleCount === 0;
  if (countEl) countEl.textContent = `已选 ${selectedCount} 条`;
  if (selectAllBtn) selectAllBtn.disabled = isDeletingObservations || !isObsSelectionMode || visibleCount === 0;
  if (clearSelectionBtn) clearSelectionBtn.disabled = isDeletingObservations || !isObsSelectionMode;
  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = isDeletingObservations || !isObsSelectionMode || selectedCount === 0;
    deleteSelectedBtn.setAttribute('aria-busy', isDeletingObservations ? 'true' : 'false');
  }

  updateHeaderClearButton();
}

function enterObsSelectionMode() {
  isObsSelectionMode = true;
  renderObservationsPage().catch(() => updateObsSelectionControls());
}

function resetObsSelectionMode() {
  isObsSelectionMode = false;
  selectedObservationIds.clear();
  updateObsSelectionControls();
}

function exitObsSelectionMode() {
  resetObsSelectionMode();
  renderObservationsPage().catch(() => updateObsSelectionControls());
}

function resetObsPageState() {
  isObsSelectionMode = false;
  selectedObservationIds.clear();
  visibleObservationIds = [];
  isDeletingObservations = false;
  updateObsSelectionControls();
}

function setObsDeleteLoading(loading) {
  isDeletingObservations = loading;
  document.querySelectorAll('#obs-list .admin-item__select').forEach((el) => {
    el.disabled = loading;
  });
  document.querySelectorAll('#obs-list .admin-item__selector').forEach((el) => {
    el.classList.toggle('is-disabled', loading);
  });
  updateObsSelectionControls();
}

function setVisibleObsSelection(selected) {
  document.querySelectorAll('#obs-list .admin-item__select').forEach((el) => {
    const id = String(el.getAttribute('data-id') ?? '').trim();
    if (!id) return;
    if (selected) selectedObservationIds.add(id);
    else selectedObservationIds.delete(id);
    el.checked = selected;
  });
  updateObsSelectionControls();
}

function confirmDeleteObservations(count) {
  if (typeof window.confirm !== 'function') return true;
  return window.confirm(count > 1 ? `确认删除选中的 ${count} 条观测记录？` : '确认删除这条观测记录？');
}

function showObsDeleteError() {
  if (typeof window.alert === 'function') {
    window.alert('删除失败，请检查网络或 Supabase 权限。');
  }
}

async function deleteObservationIdsWithConfirm(ids, options = {}) {
  const { exitSelectionMode = false } = options;
  const normalizedIds = Array.from(new Set(
    (Array.isArray(ids) ? ids : [ids])
      .map((id) => String(id ?? '').trim())
      .filter(Boolean),
  ));
  if (!normalizedIds.length || isDeletingObservations) return;
  if (!confirmDeleteObservations(normalizedIds.length)) return;
  setObsDeleteLoading(true);
  try {
    await deleteObservationRecords(normalizedIds);
    normalizedIds.forEach((id) => selectedObservationIds.delete(id));
    if (exitSelectionMode) isObsSelectionMode = false;
    await renderObservationsPage();
  } catch {
    showObsDeleteError();
  } finally {
    setObsDeleteLoading(false);
  }
}

async function deleteSelectedObservations() {
  await deleteObservationIdsWithConfirm(Array.from(selectedObservationIds), { exitSelectionMode: true });
}

async function renderObservationsPage() {
  const listEl = document.getElementById('obs-list');
  if (!listEl) return;

  listEl.innerHTML = '<p class="obs-loading">加载中...</p>';

  try {
    const records = await fetchObservationRecords();
    if (records.length === 0) {
      visibleObservationIds = [];
      selectedObservationIds.clear();
      listEl.innerHTML = '<p class="obs-empty">暂无观测记录，点击下方按钮新增。</p>';
      updateObsSelectionControls();
      return;
    }
    syncObsSelectionWithRows(records);
    listEl.innerHTML = records.map(renderObservationRecordItem).join('');
    updateObsSelectionControls();
  } catch (err) {
    visibleObservationIds = [];
    selectedObservationIds.clear();
    listEl.innerHTML = `<p class="obs-error">加载失败：${escapeHtml(String(err?.message || '未知错误'))}</p>`;
    updateObsSelectionControls();
  }
}

function openObservationFormPicker() {
  const picker = document.getElementById('obs-form-picker');
  const errorEl = document.getElementById('obs-form-error');
  if (!picker) return;
  renderObservationFormList();
  if (errorEl) errorEl.textContent = '';
  picker.hidden = false;
}

function closeObservationFormPicker() {
  const picker = document.getElementById('obs-form-picker');
  const listEl = document.getElementById('obs-form-list');
  const errorEl = document.getElementById('obs-form-error');
  if (!picker) return;
  picker.hidden = true;
  if (listEl) listEl.innerHTML = '';
  if (errorEl) errorEl.textContent = '';
}

let isSavingObservation = false;

async function submitObservationForm() {
  const errorEl = document.getElementById('obs-form-error');
  const submitBtn = document.getElementById('obs-form-submit');
  const items = collectObservationFormItems();
  if (!items.length) {
    if (errorEl) errorEl.textContent = '请至少新增一条币种记录。';
    return;
  }
  if (errorEl) errorEl.textContent = '';
  if (isSavingObservation) return;

  isSavingObservation = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '保存中';
  }

  try {
    await createObservationRecord(items);
    closeObservationFormPicker();
    showToast('记录已保存');
    if (currentPage === 'observations') await renderObservationsPage();
  } catch (err) {
    if (errorEl) errorEl.textContent = `保存失败：${String(err?.message || '未知错误')}`;
  } finally {
    isSavingObservation = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '保存';
    }
  }
}

function setPage(mode) {
  if (!isAuthReady) {
    showLoginPage();
    return;
  }
  const front = document.getElementById('front-page');
  const admin = document.getElementById('admin-page');
  const stats = document.getElementById('stats-page');
  const methodology = document.getElementById('methodology-page');
  const cases = document.getElementById('cases-page');
  const observations = document.getElementById('observations-page');
  const btnFront = document.getElementById('btn-tab-front');
  const btnAdmin = document.getElementById('btn-tab-admin');
  const btnStats = document.getElementById('btn-tab-stats');
  const btnMethodology = document.getElementById('btn-tab-methodology');
  const btnCases = document.getElementById('btn-tab-cases');
  const btnObservations = document.getElementById('btn-tab-observations');
  if (!front || !admin || !stats || !methodology || !cases || !observations || !btnFront || !btnAdmin || !btnStats || !btnMethodology || !btnCases || !btnObservations) return;

  const normalizedMode = ['admin', 'stats', 'methodology', 'cases', 'observations'].includes(mode) ? mode : 'front';
  const toAdmin = normalizedMode === 'admin';
  const toStats = normalizedMode === 'stats';
  const toMethodology = normalizedMode === 'methodology';
  const toCases = normalizedMode === 'cases';
  const toObservations = normalizedMode === 'observations';
  const toFront = normalizedMode === 'front';

  currentPage = normalizedMode;

  front.hidden = !toFront;
  admin.hidden = !toAdmin;
  stats.hidden = !toStats;
  methodology.hidden = !toMethodology;
  cases.hidden = !toCases;
  observations.hidden = !toObservations;

  btnFront.classList.toggle('is-active', toFront);
  btnFront.setAttribute('aria-selected', toFront ? 'true' : 'false');
  btnAdmin.classList.toggle('is-active', toAdmin);
  btnAdmin.setAttribute('aria-selected', toAdmin ? 'true' : 'false');
  btnStats.classList.toggle('is-active', toStats);
  btnStats.setAttribute('aria-selected', toStats ? 'true' : 'false');
  btnMethodology.classList.toggle('is-active', toMethodology);
  btnMethodology.setAttribute('aria-selected', toMethodology ? 'true' : 'false');
  btnCases.classList.toggle('is-active', toCases);
  btnCases.setAttribute('aria-selected', toCases ? 'true' : 'false');
  btnObservations.classList.toggle('is-active', toObservations);
  btnObservations.setAttribute('aria-selected', toObservations ? 'true' : 'false');

  if (!toObservations) resetObsPageState();

  updateHeaderClearButton();

  if (toAdmin) {
    resetFrontPage();
    resetAdminPageState();
    renderAdminList().catch(() => {});
  } else if (toStats) {
    resetFrontPage();
    resetAdminPageState();
    renderStatsPage().catch(() => {});
  } else if (toMethodology) {
    resetFrontPage();
    resetAdminPageState();
    renderMethodologyPage();
  } else if (toCases) {
    resetFrontPage();
    resetAdminPageState();
    renderCasesPage().catch(() => {});
  } else if (toObservations) {
    resetFrontPage();
    resetAdminPageState();
    resetObsPageState();
    renderObservationsPage().catch(() => {});
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
  logSave('info', '点击保存');
  const btn = document.getElementById('btn-copy-strategy');
  const errEl = document.getElementById('error');
  const nameEl = document.getElementById('name-input');
  const name = String(nameEl?.value ?? '').trim();
  logSave('info', '保存前状态', {
    currentPage,
    name,
    hasCopyText: Boolean(currentStrategyCopyText),
    hasRecord: Boolean(currentStrategyRecord),
    copyTextLength: currentStrategyCopyText.length,
  });
  if (!name) {
    logSave('warn', '前端拦截：未填写名称');
    if (errEl) errEl.textContent = '保存前请填写名称。';
    flashCopyStrategyBtn(btn, '请填名称');
    return;
  }
  if (errEl) errEl.textContent = '';
  const text = currentStrategyCopyText;
  if (!text) {
    logSave('warn', '前端拦截：策略未生成（copyText 为空）');
    flashCopyStrategyBtn(btn, '无内容');
    return;
  }

  if (isSavingStrategy) {
    logSave('warn', '前端拦截：正在保存中，忽略重复点击');
    return;
  }
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
    if (!currentStrategyRecord) {
      logSave('warn', '前端拦截：有 copyText 但缺少 record，未发起接口');
      flashCopyStrategyBtn(btn, '保存失败');
      return;
    }
    const record = currentStrategyRecord;
    logSave('info', 'record 已就绪', record);
    try {
      await createStrategy(record);
      saved = true;
      logSave('info', '保存成功');
      if (currentPage === 'admin') await renderAdminList();
    } catch (err) {
      logSave('error', 'Supabase 保存失败', {
        message: err?.message || String(err),
      });
      if (errEl) errEl.textContent = '保存失败。请检查 Supabase 表和权限。';
      flashCopyStrategyBtn(btn, '保存失败');
      return;
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

const btnCopyStrategy = document.getElementById('btn-copy-strategy');
if (btnCopyStrategy) btnCopyStrategy.addEventListener('click', copyStrategyOutput);
const clearAll = () => {
  if (currentPage === 'admin') {
    if (!isAdminSelectionMode) {
      enterAdminSelectionMode();
      return;
    }
    if (selectedStrategyIds.size === 0) {
      exitAdminSelectionMode();
      return;
    }
    deleteSelectedStrategies().catch(() => {});
    return;
  }
  if (currentPage === 'observations') {
    if (!isObsSelectionMode) {
      enterObsSelectionMode();
      return;
    }
    if (selectedObservationIds.size === 0) {
      exitObsSelectionMode();
      return;
    }
    deleteSelectedObservations().catch(() => {});
  }
};
const btnClear = document.getElementById('btn-clear');
if (btnClear) btnClear.addEventListener('click', clearAll);

const btnTabFront = document.getElementById('btn-tab-front');
if (btnTabFront) btnTabFront.addEventListener('click', () => setPage('front'));
const btnTabAdmin = document.getElementById('btn-tab-admin');
if (btnTabAdmin) btnTabAdmin.addEventListener('click', () => setPage('admin'));
const btnTabStats = document.getElementById('btn-tab-stats');
if (btnTabStats) btnTabStats.addEventListener('click', () => setPage('stats'));
const btnTabMethodology = document.getElementById('btn-tab-methodology');
if (btnTabMethodology) btnTabMethodology.addEventListener('click', () => setPage('methodology'));
const btnTabCases = document.getElementById('btn-tab-cases');
if (btnTabCases) btnTabCases.addEventListener('click', () => setPage('cases'));
const btnTabObservations = document.getElementById('btn-tab-observations');
if (btnTabObservations) btnTabObservations.addEventListener('click', () => setPage('observations'));

const obsAddBtn = document.getElementById('obs-add-btn');
if (obsAddBtn) obsAddBtn.addEventListener('click', openObservationFormPicker);

const obsListEl = document.getElementById('obs-list');
if (obsListEl) {
  obsListEl.addEventListener('change', (e) => {
    const checkbox = e.target instanceof HTMLElement ? e.target.closest('#obs-list .admin-item__select') : null;
    if (!checkbox) return;
    const id = String(checkbox.getAttribute('data-id') ?? '').trim();
    if (!id) return;
    if (checkbox.checked) selectedObservationIds.add(id);
    else selectedObservationIds.delete(id);
    updateObsSelectionControls();
  });
}

const obsSelectionEl = document.getElementById('obs-selection');
if (obsSelectionEl) {
  obsSelectionEl.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;
    if (target.closest('#obs-select-all')) {
      setVisibleObsSelection(true);
      return;
    }
    if (target.closest('#obs-clear-selection')) {
      exitObsSelectionMode();
      return;
    }
    if (target.closest('#obs-delete-selected')) {
      deleteSelectedObservations().catch(() => {});
    }
  });
}

const obsFormPicker = document.getElementById('obs-form-picker');
if (obsFormPicker) {
  obsFormPicker.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;
    if (target.getAttribute('data-obs-form-dismiss') === 'true') {
      closeObservationFormPicker();
      return;
    }
    const removeBtn = target.closest('.obs-form-row__remove');
    if (removeBtn) {
      removeObservationFormRow(removeBtn.closest('.obs-form-row'));
    }
  });
}

const obsFormAddRow = document.getElementById('obs-form-add-row');
if (obsFormAddRow) obsFormAddRow.addEventListener('click', () => addObservationFormRow(true));

const obsFormCancel = document.getElementById('obs-form-cancel');
if (obsFormCancel) obsFormCancel.addEventListener('click', closeObservationFormPicker);

const obsFormSubmit = document.getElementById('obs-form-submit');
if (obsFormSubmit) obsFormSubmit.addEventListener('click', () => {
  submitObservationForm().catch(() => {});
});

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
      openOutcomeStatusPicker(
        id,
        outcomeStatusActionBtn.getAttribute('data-outcome-status'),
        outcomeStatusActionBtn.getAttribute('data-outcome-remark') ?? '',
      );
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
    if (option) {
      selectOutcomeStatusInPicker(option.getAttribute('data-outcome-status'));
    }
  });
}

const outcomeStatusPickerCancel = document.getElementById('status-picker-cancel');
if (outcomeStatusPickerCancel) outcomeStatusPickerCancel.addEventListener('click', closeOutcomeStatusPicker);

const outcomeStatusPickerSubmit = document.getElementById('status-picker-submit');
if (outcomeStatusPickerSubmit) outcomeStatusPickerSubmit.addEventListener('click', () => {
  submitOutcomeStatusFromPicker().catch(() => {});
});

document.addEventListener('keydown', (e) => {
  const picker = document.getElementById('status-picker');
  if (e.key === 'Escape' && picker && !picker.hidden) closeOutcomeStatusPicker();
  const obsPicker = document.getElementById('obs-form-picker');
  if (e.key === 'Escape' && obsPicker && !obsPicker.hidden) closeObservationFormPicker();
});

const loginForm = document.getElementById('login-form');
if (loginForm) loginForm.addEventListener('submit', (e) => {
  handleLoginSubmit(e).catch(() => {});
});

initApp().catch(() => showLoginPage());
