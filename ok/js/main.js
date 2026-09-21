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

function formatFixed2FromValue(value) {
  const n = toNumber(value);
  if (n == null) return String(value ?? '').trim();
  return formatFixedDecimals(n, 2);
}

const QUANTITY_DECIMALS_MAX = 8;

/** 后台价格：按输入/存储精度展示，去掉尾随 0 */
function formatAdminPriceFromValue(value, decimalPlaces) {
  const n = toNumber(value);
  if (n == null) return String(value ?? '').trim();
  const decimals = Math.max(0, Math.min(20, Math.floor(Number(decimalPlaces) || 0)));
  return formatTrimmedFixedDecimals(n, decimals);
}

/** 按单值量级决定数量小数位：≥10 取整，1~10 一位小数，更小按量级加位 */
function getQuantityDecimalsFromValue(n) {
  const v = Math.abs(Number(n));
  if (!Number.isFinite(v) || v <= 0) return 1;
  if (v >= 10) return 0;
  if (v >= 1) return 1;
  if (v >= 0.1) return 2;
  if (v >= 0.01) return 3;
  if (v >= 0.001) return 4;
  if (v >= 0.0001) return 5;
  if (v >= 0.00001) return 6;
  if (v >= 0.000001) return 7;
  return QUANTITY_DECIMALS_MAX;
}

/** 同一组档位共用取整精度，以最小正数量为准 */
function getQuantityDecimalsFromDataset(values) {
  const nums = (Array.isArray(values) ? values : [values])
    .map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : toNumber(value)))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return 1;
  return getQuantityDecimalsFromValue(Math.min(...nums));
}

function formatQuantity(n, decimals) {
  const value = Number(n);
  if (!Number.isFinite(value)) return '';
  const d = decimals == null ? getQuantityDecimalsFromValue(value) : decimals;
  return formatTrimmedFixedDecimals(value, d);
}

function formatQuantityFromValue(value, decimals) {
  const text = String(value ?? '').trim();
  if (!text) return text;
  const n = toNumber(value);
  if (n == null) return text;
  return formatQuantity(n, decimals);
}

function applyDatasetQuantityFormat(items, rawQtys) {
  const decimals = getQuantityDecimalsFromDataset(rawQtys);
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const qty = rawQtys[index];
    if (qty == null || !(Number(qty) > 0)) return item;
    return { ...item, quantity: formatQuantity(qty, decimals) };
  });
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

function formatSlotLabelForMode(at, now, mode) {
  if (normalizeTimeframeMode(mode) === '1d') {
    if (isSameDate(at, now)) return '今天';
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    if (isSameDate(at, yesterday)) return '昨天';
    return `${at.getMonth() + 1}/${at.getDate()}`;
  }
  return formatSlotLabel(at, now);
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
const DEFAULT_ASSIST_TIMEFRAME = '8h';
const FRONT_TREND_TIMEFRAMES = ['4h', '8h', '1d'];
const FRONT_PAGES = ['front'];
const FRONT_MODE_TREND = 'trend';
const FRONT_MODE_ASSIST = 'assist';
const FRONT_MODE_FISH = 'fish';
let frontMode = FRONT_MODE_TREND;

const TIMEFRAME_MINUTES = {
  '1h': 60,
  '4h': 240,
  '8h': 480,
  '1d': 1440,
};

const TIMEFRAME_LABELS = {
  '1h': '1小时',
  '4h': '4小时',
  '8h': '8小时',
  '1d': '1天',
};

function normalizeTimeframeMode(mode) {
  const value = String(mode ?? '').trim();
  return TIMEFRAME_MINUTES[value] ? value : DEFAULT_TIMEFRAME;
}

function normalizeFrontTrendTimeframe(mode) {
  const value = String(mode ?? '').trim();
  return FRONT_TREND_TIMEFRAMES.includes(value) ? value : DEFAULT_TIMEFRAME;
}

let trendTimeframeMode = DEFAULT_TIMEFRAME;
let assistTimeframeMode = DEFAULT_ASSIST_TIMEFRAME;
let startTimeUserPicked = false;
let assistStartTimeUserPicked = false;
let mobileTimePickerScope = 'trend';

const PRICE_ADJUSTMENT_RATE = 0;
const CONCESSION_RATES = [
  { rate: 0, display: true, reuseMinTierCost: true },
  { rate: 0.1, display: true, reuseMinTierCost: true },
  { rate: 0.2, costShare: 1 / 3 },
  { rate: 0.5, costShare: 1 / 3 },
  { rate: 0.8, costShare: 1 / 3 },
];
const LEGACY_TIER_COUNTS = new Set([5, 6, 7]);
const DEFAULT_TIER_COUNT = 3;
const TRADE_MODE_NORMAL = 'normal';
const OPEN_COST_BASE = 100;
const OPEN_COST_MULTIPLIER_MIN = 1;
const OPEN_COST_MULTIPLIER_MAX = 10;
const OPEN_COST_MULTIPLIER_DEFAULT = 3;
/** 后台管理：输入框为总资金，落库 unit_cost；每档本金 = 总资金的 1/3（凯利惯例） */
const ADMIN_TOTAL_CAPITAL_DEFAULT = 100;
const ADMIN_TIER_COST_RATIO = 1 / 3;
let cachedUnitCostInput = ADMIN_TOTAL_CAPITAL_DEFAULT;
const OPEN_COST_TOTAL_PREMIUM_LEVELS = [500, 1000];
const TAKE_PROFIT_R_MULTIPLE = 1;
const REF_TAKE_PROFIT_R = 3;
const BEST_TAKE_PROFIT_R = 5;
const STRATEGY_DURATION_PERIODS = 10;
const ASSIST_DURATION_PERIODS = 3;
const ASSIST_TAKE_PROFIT_MULTIPLE = 2;
/** 吃鱼助手：与顺势而为同档位，止盈空间 1 倍；无时间 UI，落库用长效占位以满足非空约束 */
const FISH_TAKE_PROFIT_MULTIPLE = 1;
/** 吃鱼助手：每档本金固定 66，不随总资金比例变化 */
const FISH_TIER_OPEN_COST = 66;
const FISH_TIMEFRAME = '1d';
const FISH_TIMEFRAME_MINUTES = 1440;
const FISH_VALID_PERIODS = 3650; // ≈10 年，视为长期有效
/** 反趋势：挂单档位 = 原策略 3/5 倍止盈价，止损 = 10 倍止盈价；另展示 10R–100R 价格（无数量） */
const COUNTER_TREND_ENTRY_MULTIPLES = [3, 5];
const COUNTER_TREND_PRICE_ONLY_MULTIPLES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const COUNTER_TREND_BASE_MULTIPLES = [
  ...COUNTER_TREND_ENTRY_MULTIPLES,
  ...COUNTER_TREND_PRICE_ONLY_MULTIPLES,
];
const COUNTER_TREND_STOP_MULTIPLE = 10;
/** 趋势力预测默认只显示到 50R，展开后显示到 100R */
const COUNTER_TREND_COLLAPSED_MAX_RATE = 50;
/** 辅助开单：10%/20% 复用最小让利档仓位；后台每档固定本金；80% 仅展示 */
const ASSIST_TIER_RATIOS = [
  { rate: 0.1, label: '10%（鱼头三选一）', reuseMinTierCost: true },
  { rate: 0.2, label: '20%（鱼头三选一）', reuseMinTierCost: true },
  { rate: 0.3, label: '30%（鱼头三选一）', costShare: 3 / 5 },
  { rate: 0.5, label: '50%', costShare: 2 / 5 },
  { rate: 0.8, label: '80%（鱼尾）', costShare: 0 },
];
/** 兼容旧辅助开单比例识别 */
const ASSIST_TIER_RATES_LEGACY = [1 / 3, 1 / 2, 2 / 3];
const ASSIST_TIER_RATES_LEGACY_66 = [0.3, 0.5, 0.66];
const ASSIST_TIER_RATES_LEGACY_70 = [0.3, 0.5, 0.7];
const ASSIST_TIER_RATES_LEGACY_75 = [0.33, 0.48, 0.75];
const ASSIST_TIER_RATES_LEGACY_30_48_80 = [0.3, 0.48, 0.8];
const ASSIST_TIER_RATES_LEGACY_10_20_30_48_80 = [0.1, 0.2, 0.3, 0.48, 0.8];
const ASSIST_TIER_RATES_LEGACY_10_20_30_50_80 = [0.1, 0.2, 0.3, 0.5, 0.8];
const ASSIST_TIER_RATES_LEGACY_10_TO_100 = Array.from({ length: 10 }, (_, index) => (index + 1) / 10);
const ASSIST_TIER_RATES_LEGACY_20_TO_100 = Array.from({ length: 9 }, (_, index) => (index + 2) / 10);
const ASSIST_TITLE_SUFFIX = ' (顺势而为)';
const FISH_TITLE_SUFFIX = ' (吃鱼助手)';
const TIER_ASSIST_TITLE_SUFFIX = ' (挡位辅助)';
/** 挡位辅助：00% / 10% 两档，每档固定本金 */
const TIER_ASSIST_RATES = [
  { rate: 0, display: true, costShare: 1 / 2 },
  { rate: 0.1, display: true, costShare: 1 / 2 },
];
const TIER_ASSIST_RATES_LEGACY_00_10_20 = [0, 0.1, 0.2];
const TIER_ASSIST_TAKE_PROFIT_MULTIPLE = 1;

function clampOpenCostMultiplier(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return OPEN_COST_MULTIPLIER_DEFAULT;
  return Math.min(OPEN_COST_MULTIPLIER_MAX, Math.max(OPEN_COST_MULTIPLIER_MIN, n));
}

function getFrontFormScope() {
  if (frontMode === FRONT_MODE_ASSIST) return 'assist';
  if (frontMode === FRONT_MODE_FISH) return 'fish';
  return 'trend';
}

function frontModeToFormScope(mode) {
  if (mode === FRONT_MODE_ASSIST) return 'assist';
  if (mode === FRONT_MODE_FISH) return 'fish';
  return 'trend';
}

function getTimeframeMode(scope = getFrontFormScope()) {
  return scope === 'assist' ? assistTimeframeMode : trendTimeframeMode;
}

function getTimeframeMinutes(mode = getTimeframeMode()) {
  return TIMEFRAME_MINUTES[mode] ?? TIMEFRAME_MINUTES[DEFAULT_TIMEFRAME];
}

function getTimeframeLabel(mode) {
  const value = String(mode ?? '').trim();
  return TIMEFRAME_LABELS[value] || value;
}

function getTimeframeShortLabel(mode) {
  const value = String(mode ?? '').trim();
  return TIMEFRAME_MINUTES[value] ? value : '';
}

function syncFrontTimeframeSwitch(scope = getFrontFormScope()) {
  const root = document.getElementById(scope === 'assist' ? 'front-assist-panel' : 'front-trend-panel');
  const mode = getTimeframeMode(scope);
  const buttons = root
    ? root.querySelectorAll('[data-timeframe]')
    : document.querySelectorAll('[data-timeframe]');
  buttons.forEach((btn) => {
    const active = btn.getAttribute('data-timeframe') === mode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function setFrontTimeframeMode(mode, { refresh = true, scope = getFrontFormScope() } = {}) {
  const next = normalizeFrontTrendTimeframe(mode);
  if (scope === 'assist') {
    const changed = next !== assistTimeframeMode;
    assistTimeframeMode = next;
    syncFrontTimeframeSwitch('assist');
    if (!refresh || !changed) return;
    rebuildStartTimeOptions(null, { scope: 'assist' });
    autoGenerateAssistIfReady();
    return;
  }
  const changed = next !== trendTimeframeMode;
  trendTimeframeMode = next;
  syncFrontTimeframeSwitch('trend');
  if (!refresh || !changed) return;
  rebuildStartTimeOptions(null, { scope: 'trend' });
  autoGenerateIfReady();
}

function normalizeFrontMode(mode) {
  if (mode === FRONT_MODE_FISH) return FRONT_MODE_FISH;
  return FRONT_MODE_TREND;
}

function isFrontPage(page = currentPage) {
  return page === 'front' || FRONT_PAGES.includes(page);
}

function isFrontAssistMode() {
  return isFrontPage() && frontMode === FRONT_MODE_ASSIST;
}

function isFrontFishMode() {
  return isFrontPage() && frontMode === FRONT_MODE_FISH;
}

function isFrontTrendMode() {
  return isFrontPage() && frontMode === FRONT_MODE_TREND;
}

function getTradeMode() {
  return TRADE_MODE_NORMAL;
}

function updateTradeModeAppearance() {
  const openLabel = document.getElementById('open-price-label');
  const stopLabel = document.getElementById('stop-price-label');
  if (openLabel) openLabel.textContent = '开始价格';
  if (stopLabel) stopLabel.textContent = '止损价格';
}

function getOpenCostTotal(multiplier = OPEN_COST_MULTIPLIER_DEFAULT) {
  return OPEN_COST_BASE * clampOpenCostMultiplier(multiplier);
}

function normalizeUnitCost(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function getUnitCostInputValue() {
  const el = document.getElementById('unit-cost-input');
  return String(el?.value ?? '').trim();
}

function getTotalCapital() {
  return normalizeUnitCost(cachedUnitCostInput) ?? ADMIN_TOTAL_CAPITAL_DEFAULT;
}

function getAdminTierFixedOpenCost() {
  return getTotalCapital() * ADMIN_TIER_COST_RATIO;
}

function getAssistDisplayTierOpenCost(row) {
  return isFishStrategyRow(row) ? FISH_TIER_OPEN_COST : getAdminTierFixedOpenCost();
}

/** 仅从已保存值恢复输入框（加载数据） */
function restoreUnitCostInput() {
  const el = document.getElementById('unit-cost-input');
  if (!el || document.activeElement === el) return;
  el.value = String(getTotalCapital());
}

async function fetchAppSettings() {
  const res = await supabaseFetch(`${SETTINGS_ENDPOINT}?id=eq.${encodeURIComponent(APP_SETTINGS_ID)}&select=unit_cost`);
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  const inputValue = normalizeUnitCost(row?.unit_cost);
  if (inputValue != null) cachedUnitCostInput = inputValue;
  restoreUnitCostInput();
  return getAdminTierFixedOpenCost();
}

async function saveAppSettings(inputValue) {
  const cost = normalizeUnitCost(inputValue);
  if (cost == null) throw new Error('请输入大于 0 的数字');
  const res = await supabaseFetch(`${SETTINGS_ENDPOINT}?on_conflict=id`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: APP_SETTINGS_ID,
      unit_cost: cost,
    }),
  });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  cachedUnitCostInput = cost;
  return cost;
}

async function handleUnitCostSave() {
  const input = document.getElementById('unit-cost-input');
  const btn = document.getElementById('unit-cost-save');
  const inputValue = normalizeUnitCost(getUnitCostInputValue());
  if (inputValue == null) {
    showToast('请输入大于 0 的数字');
    input?.focus();
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = '保存中';
  }
  try {
    await saveAppSettings(inputValue);
    showToast('已保存');
    if (currentPage === 'admin') renderAdminListItems();
  } catch (err) {
    showToast(String(err?.message || '保存失败'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '保存';
    }
  }
}

function hasAdminTierCostBudget(openCostTotal = null, fixedTierOpenCost = null) {
  const fixed = Number(fixedTierOpenCost ?? getAdminTierFixedOpenCost());
  if (Number.isFinite(fixed) && fixed > 0) return true;
  const total = Number(openCostTotal);
  return Number.isFinite(total) && total > 0;
}

function applyAdminFixedTierQuantities(concessions, stopLoss, { isAssist: _isAssist = false, fixedTierOpenCost = null } = {}) {
  if (!hasConcessions(concessions)) return [];
  const stop = toNumber(stopLoss);
  const tierCost = Number(fixedTierOpenCost ?? getAdminTierFixedOpenCost());
  if (stop == null || !(tierCost > 0)) return concessions.slice();
  const rawQtys = concessions.map((item) => {
    const price = toNumber(item.price);
    if (price == null || price === stop) return null;
    const qty = calcQuantityByRisk(tierCost, price, stop);
    return qty != null && qty > 0 ? qty : null;
  });
  return applyDatasetQuantityFormat(concessions.map((item) => ({ ...item })), rawQtys);
}

function getConcessionRates() {
  return CONCESSION_RATES;
}

function isKnownTierCount(tierCount) {
  return tierCount === DEFAULT_TIER_COUNT || LEGACY_TIER_COUNTS.has(tierCount);
}

function getOpenCost() {
  const total = getOpenCostTotal();
  if (total == null) return null;
  return total / DEFAULT_TIER_COUNT;
}

function getTierCountFromConcessions(concessions) {
  if (isCurrentTrendConcessionSet(concessions)) return DEFAULT_TIER_COUNT;
  const count = getDisplayConcessionItems(concessions).length;
  return isKnownTierCount(count) ? count : DEFAULT_TIER_COUNT;
}

function getTierCountFromRow(row) {
  if (hasConcessions(row?.concessions)) return getTierCountFromConcessions(row.concessions);
  return DEFAULT_TIER_COUNT;
}

function getOpenCostTotalFromRow(row) {
  const storedTotal = toNumber(row?.openCostTotal);
  if (storedTotal != null && storedTotal > 0) return storedTotal;
  const storedMultiplier = toNumber(row?.openCostMultiplier);
  if (storedMultiplier != null && storedMultiplier > 0) {
    return getOpenCostTotal(storedMultiplier);
  }
  const tierCount = getTierCountFromRow(row);
  const openCost = toNumber(row?.openCost);
  if (openCost != null && openCost > 0) return openCost * tierCount;
  return null;
}

function inferReverseFromConcessions(entryPrice, stopLoss, concessions, decimalPlaces) {
  const displayItems = getDisplayConcessionItems(concessions);
  if (!displayItems.length) return false;
  const first = displayItems.find((item) => Math.abs(Number(item.rate)) > 1e-9) || displayItems[0];
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopLoss);
  const rate = Number(first.rate);
  if (entry == null || stop == null || !Number.isFinite(rate)) return false;
  const savedPrice = String(first.price ?? '').trim();
  const normalPrice = calcConcessionalEntryPrice(entry, stop, rate, decimalPlaces, false);
  const reversePrice = calcConcessionalEntryPrice(entry, stop, rate, decimalPlaces, true);
  const normalLabel = normalPrice == null ? '' : formatTrimmedFixedDecimals(normalPrice, decimalPlaces);
  const reverseLabel = reversePrice == null ? '' : formatTrimmedFixedDecimals(reversePrice, decimalPlaces);
  if (savedPrice && savedPrice === reverseLabel && savedPrice !== normalLabel) return true;
  return false;
}

function buildUnifiedConcessionsForRow(row) {
  const entryPrice = toNumber(row?.entryPrice);
  const stopLoss = toNumber(row?.stopLossPrice);
  if (entryPrice == null || stopLoss == null || !(getAdminTierFixedOpenCost() > 0)) return null;

  const decimalPlaces = getPriceDecimalPlacesFromValues(
    row?.entryPrice,
    row?.stopLossPrice,
    row?.inputPrice,
    row?.inputStopLoss,
  );
  const currentConcessions = buildAdminConcessionsForRow(row);
  const reverse = inferReverseFromConcessions(entryPrice, stopLoss, currentConcessions, decimalPlaces);
  return buildConcessionItems(
    entryPrice,
    stopLoss,
    null,
    decimalPlaces,
    getConcessionRates(),
    reverse,
    { fixedTierOpenCost: getAdminTierFixedOpenCost() },
  );
}

function getSortedDisplayRates(concessions) {
  return getDisplayConcessionItems(concessions)
    .map((item) => Number(item.rate))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function ratesMatch(actual, expected) {
  if (actual.length !== expected.length) return false;
  return expected.every((rate, index) => Math.abs(actual[index] - rate) < 1e-9);
}

function getConfiguredDisplayRates(rateConfigs) {
  return (Array.isArray(rateConfigs) ? rateConfigs : [])
    .filter(isDisplayRateConfig)
    .map((item) => Number(normalizeConcessionRateConfig(item).rate))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function isCurrentTrendConcessionSet(concessions) {
  const rates = getSortedDisplayRates(concessions);
  return ratesMatch(rates, [0, 0.1, 0.2, 0.5, 0.8])
    || ratesMatch(rates, [0.2, 0.5, 0.8])
    || ratesMatch(rates, [0, 0.3, 0.8]);
}

function isTierAssistConcessionSet(concessions) {
  const rates = getSortedDisplayRates(concessions);
  return ratesMatch(rates, getConfiguredDisplayRates(TIER_ASSIST_RATES))
    || ratesMatch(rates, TIER_ASSIST_RATES_LEGACY_00_10_20);
}

function isCurrentAssistConcessionSet(concessions) {
  return ratesMatch(getSortedDisplayRates(concessions), getConfiguredDisplayRates(ASSIST_TIER_RATIOS));
}

function isAssistConcessionSet(concessions) {
  const rates = getSortedDisplayRates(concessions);
  return isCurrentAssistConcessionSet(concessions)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_66)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_70)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_75)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_30_48_80)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_10_20_30_48_80)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_10_20_30_50_80)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_10_TO_100)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_20_TO_100);
}

function getAssistTierLabel(rate) {
  const matched = ASSIST_TIER_RATIOS.find((item) => Math.abs(Number(rate) - item.rate) < 1e-9);
  return matched?.label || formatConcessionPercent(rate);
}

function shouldHideAssistQuantity(rate) {
  return Math.abs(Number(rate) - 0.8) < 1e-9;
}

function formatAssistStrategyTitle(name) {
  return `${formatStrategyCardTitle(name)}${ASSIST_TITLE_SUFFIX}`;
}

function formatFishStrategyTitle(name) {
  return `${formatStrategyCardTitle(name)}${FISH_TITLE_SUFFIX}`;
}

function formatTierAssistStrategyTitle(name) {
  return `${formatStrategyCardTitle(name)}${TIER_ASSIST_TITLE_SUFFIX}`;
}

function buildFishTimeRange(now = new Date()) {
  const startAt = new Date(now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : Date.now());
  startAt.setMilliseconds(0);
  const durationMinutes = FISH_TIMEFRAME_MINUTES * FISH_VALID_PERIODS;
  const expiresAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  return {
    timeframe: FISH_TIMEFRAME,
    timeframeMinutes: FISH_TIMEFRAME_MINUTES,
    timeframeLabel: getTimeframeLabel(FISH_TIMEFRAME),
    validPeriods: FISH_VALID_PERIODS,
    durationMinutes,
    startAt: startAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function isFishTakeProfitMultiple(value) {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n - FISH_TAKE_PROFIT_MULTIPLE) < 1e-9;
}

function isFishStrategyRow(row) {
  const rawConcessions = hasConcessions(row?.concessions) ? row.concessions : [];
  const concessions = isAssistConcessionSet(rawConcessions)
    ? rawConcessions
    : buildAdminConcessionsForRow(row);
  return isAssistConcessionSet(concessions) && isFishTakeProfitMultiple(row?.takeProfitRMultiple);
}

function getAdminStrategyTypeInfo(row) {
  const rawConcessions = hasConcessions(row?.concessions) ? row.concessions : [];
  if (isTierAssistConcessionSet(rawConcessions)) {
    return { label: '挡位辅助', type: 'tier_assist' };
  }
  if (isAssistConcessionSet(rawConcessions)) {
    if (isFishTakeProfitMultiple(row?.takeProfitRMultiple)) {
      return { label: '吃鱼助手', type: 'fish' };
    }
    return { label: '顺势而为', type: 'assist' };
  }
  const savedConcessions = buildAdminConcessionsForRow(row);
  if (isTierAssistConcessionSet(savedConcessions)) {
    return { label: '挡位辅助', type: 'tier_assist' };
  }
  if (isAssistConcessionSet(savedConcessions)) {
    if (isFishTakeProfitMultiple(row?.takeProfitRMultiple)) {
      return { label: '吃鱼助手', type: 'fish' };
    }
    return { label: '顺势而为', type: 'assist' };
  }
  return { label: '趋势立项', type: 'trend' };
}

function buildAdminDisplayConcessions(row) {
  const savedConcessions = buildAdminConcessionsForRow(row);
  const stopLoss = toNumber(row?.stopLossPrice);
  if (isCurrentTrendConcessionSet(savedConcessions)) {
    return applyAdminFixedTierQuantities(savedConcessions, stopLoss);
  }
  const rebuilt = buildUnifiedConcessionsForRow(row);
  if (rebuilt) return rebuilt;
  if (hasConcessions(savedConcessions)) {
    return applyAdminFixedTierQuantities(savedConcessions, stopLoss);
  }
  return buildTrendAdminConcessions(row);
}

function buildAdminAssistConcessionsForDisplay(row) {
  const savedConcessions = buildAdminConcessionsForRow(row);
  const stopLoss = toNumber(row?.inputPrice ?? row?.stopLossPrice);
  const options = { isAssist: true, fixedTierOpenCost: getAssistDisplayTierOpenCost(row) };
  if (isCurrentAssistConcessionSet(savedConcessions)) {
    return applyAdminFixedTierQuantities(savedConcessions, stopLoss, options);
  }
  return applyAdminFixedTierQuantities(buildAssistConcessionsFromRow(row), stopLoss, options);
}

function buildTrendAdminConcessions(row) {
  const entryPrice = toNumber(row?.entryPrice);
  const stopLoss = toNumber(row?.stopLossPrice);
  if (entryPrice == null || stopLoss == null || !(getAdminTierFixedOpenCost() > 0)) return [];

  const decimalPlaces = getAdminPriceDecimalPlacesFromRow(row);
  const savedConcessions = buildAdminConcessionsForRow(row);
  const reverse = inferReverseFromConcessions(entryPrice, stopLoss, savedConcessions, decimalPlaces);
  return buildConcessionItems(
    entryPrice,
    stopLoss,
    null,
    decimalPlaces,
    getConcessionRates(),
    reverse,
    { fixedTierOpenCost: getAdminTierFixedOpenCost() },
  );
}

const STRATEGY_VIEW_MODE_TREND = 'trend';
const STRATEGY_VIEW_MODE_COUNTER = 'counter_trend';
const STRATEGY_VIEW_MODE_TIER_ASSIST = 'tier_assist';
const STRATEGY_VIEW_MODE_FISH = 'fish';

function normalizeStrategyViewMode(value) {
  if (value === STRATEGY_VIEW_MODE_COUNTER) return STRATEGY_VIEW_MODE_COUNTER;
  if (value === STRATEGY_VIEW_MODE_TIER_ASSIST) return STRATEGY_VIEW_MODE_TIER_ASSIST;
  if (value === STRATEGY_VIEW_MODE_FISH) return STRATEGY_VIEW_MODE_FISH;
  return STRATEGY_VIEW_MODE_TREND;
}

function normalizeViewState(value) {
  if (value == null) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

function isStrategyPinned(row) {
  return Boolean(normalizeViewState(row?.viewState).pinned);
}

function setPinnedInViewState(viewState, pinned) {
  const next = { ...normalizeViewState(viewState) };
  if (pinned) {
    next.pinned = true;
    next.pinnedAt = new Date().toISOString();
  } else {
    delete next.pinned;
    delete next.pinnedAt;
  }
  return next;
}

function getTierAssistViewState(row) {
  const raw = normalizeViewState(row?.viewState).tierAssist;
  if (!raw || typeof raw !== 'object') return null;
  const side = raw.side === 'short' ? 'short' : (raw.side === 'long' ? 'long' : null);
  const entryPrice = toNumber(raw.entryPrice);
  const stopLoss = toNumber(raw.stopLoss);
  const takeProfit = toNumber(raw.takeProfit);
  if (!side || entryPrice == null || stopLoss == null || entryPrice === stopLoss) return null;
  const rate = Number(raw.rate);
  return {
    side,
    entryPrice,
    stopLoss,
    takeProfit,
    rate: Number.isFinite(rate) ? rate : null,
  };
}

function buildLinkedTierAssistDisplay(row) {
  const state = getTierAssistViewState(row);
  const decimalPlaces = getAdminPriceDecimalPlacesFromRow(row);
  const side = state?.side === 'short' ? 'short' : (state?.side === 'long' ? 'long' : (row?.positionSide === 'short' ? 'short' : 'long'));
  const entryPrice = state?.entryPrice ?? toNumber(row?.entryPrice);
  const stopLoss = state?.stopLoss ?? toNumber(row?.stopLossPrice);
  let takeProfit = state?.takeProfit ?? null;
  if (takeProfit == null) {
    takeProfit = calcTakeProfit(entryPrice, stopLoss, TIER_ASSIST_TAKE_PROFIT_MULTIPLE);
  }
  if (entryPrice == null || stopLoss == null || entryPrice === stopLoss) {
    return {
      side,
      concessions: [],
      takeProfitLabel: '—',
      stopLabel: '—',
    };
  }
  const concessionItems = buildConcessionItems(
    entryPrice,
    stopLoss,
    null,
    decimalPlaces,
    TIER_ASSIST_RATES,
    false,
    { fixedTierOpenCost: getAdminTierFixedOpenCost() },
  );
  const allowedRates = getConfiguredDisplayRates(TIER_ASSIST_RATES);
  const concessions = applyAdminFixedTierQuantities(concessionItems, stopLoss).filter((item) => (
    allowedRates.some((rate) => Math.abs(Number(item.rate) - rate) < 1e-9)
  ));
  return {
    side,
    concessions,
    takeProfitLabel: takeProfit != null
      ? formatTrimmedFixedDecimals(takeProfit, decimalPlaces)
      : '—',
    stopLabel: formatTrimmedFixedDecimals(stopLoss, decimalPlaces),
  };
}

function getCounterTrendRateRows() {
  const rows = [];
  for (let i = 0; i < COUNTER_TREND_BASE_MULTIPLES.length; i += 1) {
    const rate = COUNTER_TREND_BASE_MULTIPLES[i];
    if (i > 0) {
      const prev = COUNTER_TREND_BASE_MULTIPLES[i - 1];
      rows.push({ rate: (prev + rate) / 2, isMidpoint: true });
    }
    rows.push({ rate, isMidpoint: false });
  }
  return rows;
}

/**
 * 反趋势策略：以原策略 R 倍数推算挂单价。
 * 档位 3/5R 与 10–100R 仅展示价格；相邻档之间插入中间值；末行 S = 原开仓价。
 * 时间范围接在原策略结束后再排 10 个周期。
 */
function buildCounterTrendConcessions(row) {
  const entryPrice = toNumber(row?.entryPrice);
  const stopLoss = toNumber(row?.stopLossPrice);
  if (entryPrice == null || stopLoss == null || entryPrice === stopLoss) {
    return { items: [], stopLoss: null, refTakeProfit: null };
  }

  const decimalPlaces = getAdminPriceDecimalPlacesFromRow(row);
  const counterStop = calcTakeProfit(entryPrice, stopLoss, COUNTER_TREND_STOP_MULTIPLE);
  if (counterStop == null) {
    return { items: [], stopLoss: null, refTakeProfit: null };
  }

  const refTakeProfit = formatTrimmedFixedDecimals(entryPrice, decimalPlaces);
  const items = [];
  for (const { rate: multiple, isMidpoint } of getCounterTrendRateRows()) {
    const price = calcTakeProfit(entryPrice, stopLoss, multiple);
    if (price == null) continue;
    if (!isMidpoint && COUNTER_TREND_ENTRY_MULTIPLES.includes(multiple) && price === counterStop) continue;
    items.push({
      rate: multiple,
      display: true,
      hideQuantity: true,
      showSideActions: true,
      isMidpoint,
      price: formatTrimmedFixedDecimals(price, decimalPlaces),
      quantity: '',
    });
  }
  // 3R 下方：S = 原开仓价（原「止盈」展示值）
  items.push({
    rate: 1,
    rateLabel: 'S',
    display: true,
    hideQuantity: true,
    showSideActions: true,
    price: refTakeProfit,
    quantity: '',
  });
  return {
    items,
    stopLoss: formatTrimmedFixedDecimals(counterStop, decimalPlaces),
    refTakeProfit,
  };
}

function getCounterTrendTimeRange(row) {
  const unitMin = Number(row?.timeframeMinutes) > 0
    ? Number(row.timeframeMinutes)
    : getTimeframeMinutes(row?.timeframe);
  const spanMs = unitMin * STRATEGY_DURATION_PERIODS * 60 * 1000;
  const originalEnd = getStrategyEndAt(row);
  const originalStart = getStrategyStartAt(row);
  const startAt = originalEnd
    || (originalStart ? new Date(originalStart.getTime() + spanMs) : null);
  if (!startAt) return { startAt: null, endAt: null };
  return {
    startAt,
    endAt: new Date(startAt.getTime() + spanMs),
  };
}

function canShowCounterTrend(row) {
  if (getAdminStrategyTypeInfo(row).type !== 'trend') return false;
  const entryPrice = toNumber(row?.entryPrice);
  const stopLoss = toNumber(row?.stopLossPrice);
  if (entryPrice == null || stopLoss == null || entryPrice === stopLoss) return false;
  const counterStop = calcTakeProfit(entryPrice, stopLoss, COUNTER_TREND_STOP_MULTIPLE);
  return counterStop != null;
}

function getStrategyNameKey(name) {
  return formatStrategyCardTitle(name);
}

function findRelatedTrendRow(row) {
  const key = getStrategyNameKey(row?.strategyName);
  if (!key || key === '未命名') return null;
  const selfId = String(row?.id ?? '').trim();
  const rows = Array.isArray(latestAdminRows) ? latestAdminRows : [];
  return rows.find((item) => {
    if (!item || String(item?.id ?? '').trim() === selfId) return false;
    if (getStrategyNameKey(item?.strategyName) !== key) return false;
    return getAdminStrategyTypeInfo(item).type === 'trend';
  }) || null;
}

function findRelatedFishRow(row) {
  const key = getStrategyNameKey(row?.strategyName);
  if (!key || key === '未命名') return null;
  const selfId = String(row?.id ?? '').trim();
  const rows = Array.isArray(latestAdminRows) ? latestAdminRows : [];
  return rows.find((item) => {
    if (!item || String(item?.id ?? '').trim() === selfId) return false;
    if (getStrategyNameKey(item?.strategyName) !== key) return false;
    return getAdminStrategyTypeInfo(item).type === 'fish';
  }) || null;
}

/** 修改入口：趋势立项与吃鱼助手各自改自己的单据 */
function resolveEditableStrategyRow(row) {
  if (!row) return null;
  const type = getAdminStrategyTypeInfo(row).type;
  if (type === 'trend' || type === 'fish') return row;
  return findRelatedTrendRow(row);
}

function findRelatedTierAssistRow(row) {
  const key = getStrategyNameKey(row?.strategyName);
  if (!key || key === '未命名') return null;
  const selfId = String(row?.id ?? '').trim();
  const rows = Array.isArray(latestAdminRows) ? latestAdminRows : [];
  return rows.find((item) => {
    if (!item || String(item?.id ?? '').trim() === selfId) return false;
    if (getStrategyNameKey(item?.strategyName) !== key) return false;
    return getAdminStrategyTypeInfo(item).type === 'tier_assist';
  }) || null;
}

function getTierAssistSourceRate(row) {
  const desc = String(row?.description ?? '');
  const matched = desc.match(/来源\s*(\d+(?:\.\d+)?)R/i);
  if (!matched) return null;
  const rate = Number(matched[1]);
  return Number.isFinite(rate) ? rate : null;
}

function isCounterTrendItemCurrentTierAssist(item, row) {
  const state = getTierAssistViewState(row);
  if (!state || !item) return false;
  const entry = state.entryPrice;
  const price = toNumber(item?.price);
  if (entry != null && price != null) {
    const eps = Math.max(Math.abs(entry) * 1e-6, 1e-6);
    if (Math.abs(entry - price) <= eps) return true;
  }
  const sourceRate = state.rate;
  const itemRate = Number(item?.rate);
  return sourceRate != null
    && Number.isFinite(itemRate)
    && Math.abs(sourceRate - itemRate) < 1e-9;
}

function getSelectedConcessionFromRow(row) {
  const raw = normalizeViewState(row?.viewState).selectedConcession;
  if (!raw || typeof raw !== 'object') return null;
  const rate = Number(raw.rate);
  const price = toNumber(raw.price);
  if (!Number.isFinite(rate) && price == null) return null;
  return {
    rate: Number.isFinite(rate) ? rate : null,
    price,
  };
}

function isConcessionItemSelected(item, row) {
  if (!item || item.isMidpoint) return false;
  const selected = getSelectedConcessionFromRow(row);
  if (!selected) return false;
  const itemRate = Number(item?.rate);
  if (selected.rate != null && Number.isFinite(itemRate) && Math.abs(itemRate - selected.rate) < 1e-9) {
    return true;
  }
  const itemPrice = toNumber(item?.price);
  return selected.price != null && itemPrice != null && itemPrice === selected.price;
}

function isAdminConcessionCurrentItem(item, row) {
  return isConcessionItemSelected(item, row);
}

async function setSelectedConcession(strategyId, row, nextSelection) {
  const id = String(strategyId ?? '').trim();
  if (!id || !row) return false;
  const prevViewState = normalizeViewState(row?.viewState);
  const nextViewState = { ...prevViewState };
  if (nextSelection) {
    nextViewState.selectedConcession = {
      rate: nextSelection.rate,
      price: nextSelection.price,
    };
  } else {
    delete nextViewState.selectedConcession;
  }
  latestAdminRows = latestAdminRows.map((item) => (
    String(item?.id ?? '').trim() === id
      ? { ...item, viewState: nextViewState }
      : item
  ));
  renderAdminListItems();
  try {
    await updateStrategyView(id, { viewMode: row?.viewMode, viewState: nextViewState });
    return true;
  } catch (err) {
    console.error('[concession-select]', err);
    latestAdminRows = latestAdminRows.map((item) => (
      String(item?.id ?? '').trim() === id
        ? { ...item, viewState: prevViewState }
        : item
    ));
    renderAdminListItems();
    showToast('选中失败');
    return false;
  }
}

function getTenRPriceFromTrend(trendRow) {
  const entry = toNumber(trendRow?.entryPrice);
  const stop = toNumber(trendRow?.stopLossPrice);
  return calcTakeProfit(entry, stop, COUNTER_TREND_STOP_MULTIPLE);
}

function isStopAtOrBeyondTenR(stopPrice, trendRow) {
  const entry = toNumber(trendRow?.entryPrice);
  const stop = toNumber(trendRow?.stopLossPrice);
  const tenR = getTenRPriceFromTrend(trendRow);
  const price = toNumber(stopPrice);
  if (entry == null || stop == null || tenR == null || price == null) return false;
  const eps = Math.abs(entry - stop) * 0.05;
  if (entry > stop) return price >= tenR - eps;
  return price <= tenR + eps;
}

function isAdminTenRBoundaryRow(row) {
  const type = getAdminStrategyTypeInfo(row).type;
  if (type === 'trend' && isAdminTierAssistView(row)) {
    const state = getTierAssistViewState(row);
    const refPrice = state
      ? toNumber(state.entryPrice ?? state.stopLoss)
      : toNumber(row?.entryPrice ?? row?.stopLossPrice);
    return isStopAtOrBeyondTenR(refPrice, row);
  }
  if (type !== 'assist' && type !== 'fish' && type !== 'tier_assist') return false;
  const relatedTrend = findRelatedTrendRow(row);
  if (!relatedTrend) return false;
  const refPrice = type === 'tier_assist'
    ? toNumber(row?.inputPrice ?? row?.entryPrice ?? row?.stopLossPrice)
    : toNumber(row?.inputPrice ?? row?.stopLossPrice);
  return isStopAtOrBeyondTenR(refPrice, relatedTrend);
}

function calcAssistTierPrice(from, to, ratio, decimalPlaces) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(ratio)) return null;
  const price = from + (to - from) * ratio;
  if (!Number.isFinite(price)) return null;
  return Number(formatFixedDecimals(price, decimalPlaces));
}

function buildAssistConcessionItems(from, to, openCostTotal, decimalPlaces, fixedTierOpenCost = null) {
  if (
    from == null
    || to == null
    || from === to
    || !hasAdminTierCostBudget(openCostTotal, fixedTierOpenCost)
  ) {
    return [];
  }
  const stop = from;
  const minFundedShare = getMinFundedTierCostShare(ASSIST_TIER_RATIOS);
  const items = [];
  const rawQtys = [];
  for (const rateConfig of ASSIST_TIER_RATIOS) {
    const { rate, costShare, reuseMinTierCost } = normalizeConcessionRateConfig(rateConfig);
    const price = calcAssistTierPrice(from, to, rate, decimalPlaces);
    if (price == null || !(price > 0) || price === stop) continue;
    const share = reuseMinTierCost
      ? minFundedShare
      : (costShare != null ? costShare : null);
    const tierOpenCost = share != null && share > 0
      ? resolveTierOpenCost(openCostTotal, share, fixedTierOpenCost)
      : null;
    const qty = tierOpenCost != null ? calcQuantityByRisk(tierOpenCost, price, stop) : null;
    if (share != null && share > 0 && (qty == null || !(qty > 0))) continue;
    const item = {
      rate,
      display: true,
      price: formatTrimmedFixedDecimals(price, decimalPlaces),
      quantity: '',
    };
    if (reuseMinTierCost) item.reuseMinTierCost = true;
    items.push(item);
    rawQtys.push(qty != null && qty > 0 ? qty : 0);
  }
  const decimals = getQuantityDecimalsFromDataset(rawQtys);
  return items.map((item, index) => ({
    ...item,
    quantity: formatQuantity(rawQtys[index], decimals),
  }));
}

function buildAssistConcessionsFromRow(row) {
  const from = toNumber(row?.inputPrice ?? row?.stopLossPrice);
  const to = toNumber(row?.inputStopLoss);
  const decimalPlaces = Math.max(3, getAdminPriceDecimalPlacesFromRow(row));
  return buildAssistConcessionItems(from, to, null, decimalPlaces, getAssistDisplayTierOpenCost(row));
}

function isAdminCounterTrendView(row) {
  return canShowCounterTrend(row)
    && normalizeStrategyViewMode(row?.viewMode) === STRATEGY_VIEW_MODE_COUNTER;
}

function isAdminTierAssistView(_row) {
  return false;
}

function isAdminFishView(_row) {
  return false;
}

function getAdminDisplayViewMode(row) {
  if (getAdminStrategyTypeInfo(row).type === 'fish') return STRATEGY_VIEW_MODE_FISH;
  if (isAdminCounterTrendView(row)) return STRATEGY_VIEW_MODE_COUNTER;
  return STRATEGY_VIEW_MODE_TREND;
}

function coerceSupportedViewMode(value) {
  return normalizeStrategyViewMode(value) === STRATEGY_VIEW_MODE_COUNTER
    ? STRATEGY_VIEW_MODE_COUNTER
    : STRATEGY_VIEW_MODE_TREND;
}

function getAdminModeChipClass(mode) {
  if (mode === STRATEGY_VIEW_MODE_FISH) return 'fish';
  if (mode === STRATEGY_VIEW_MODE_TIER_ASSIST) return 'tier_assist';
  if (mode === STRATEGY_VIEW_MODE_COUNTER) return 'counter';
  if (mode === 'assist') return 'assist';
  return 'trend';
}

function isStandaloneTierAssistRow(row) {
  return getAdminStrategyTypeInfo(row).type === 'tier_assist';
}

function isLinkedFishRow(row, rows = latestAdminRows) {
  if (getAdminStrategyTypeInfo(row).type !== 'fish') return false;
  const key = getStrategyNameKey(row?.strategyName);
  if (!key || key === '未命名') return false;
  const selfId = String(row?.id ?? '').trim();
  return (Array.isArray(rows) ? rows : []).some((item) => {
    if (!item || String(item?.id ?? '').trim() === selfId) return false;
    if (getStrategyNameKey(item?.strategyName) !== key) return false;
    return getAdminStrategyTypeInfo(item).type === 'trend';
  });
}

function getAdminVisibleRows(rows = latestAdminRows) {
  const list = Array.isArray(rows) ? rows : [];
  // 趋势立项与吃鱼助手各自成卡；挡位辅助 / 顺势而为仍不出现在列表
  return list.filter((row) => {
    const type = getAdminStrategyTypeInfo(row).type;
    return type === 'trend' || type === 'fish';
  });
}

async function setAdminStrategyViewMode(strategyId, row, nextViewMode, extra = {}) {
  const id = String(strategyId ?? '').trim();
  const nextMode = coerceSupportedViewMode(nextViewMode);
  if (!id || updatingAdminViewModeIds.has(id)) return false;
  if (normalizeStrategyViewMode(nextViewMode) === STRATEGY_VIEW_MODE_FISH
    || normalizeStrategyViewMode(nextViewMode) === STRATEGY_VIEW_MODE_TIER_ASSIST) {
    return false;
  }
  if (nextMode === STRATEGY_VIEW_MODE_COUNTER && !canShowCounterTrend(row)) {
    showToast('当前单据无法切换趋势力预测');
    return false;
  }
  const prevViewMode = normalizeStrategyViewMode(row?.viewMode);
  const prevViewState = normalizeViewState(row?.viewState);
  const nextViewState = extra.viewState !== undefined
    ? normalizeViewState(extra.viewState)
    : prevViewState;
  const viewStateChanged = JSON.stringify(nextViewState) !== JSON.stringify(prevViewState);
  if (prevViewMode === nextMode && !viewStateChanged) return true;

  updatingAdminViewModeIds.add(id);
  latestAdminRows = latestAdminRows.map((item) => (
    String(item?.id ?? '').trim() === id
      ? { ...item, viewMode: nextMode, viewState: nextViewState }
      : item
  ));
  renderAdminListItems();
  renderAdminActiveNames();
  let ok = true;
  try {
    const patch = { viewMode: nextMode };
    if (viewStateChanged || extra.viewState !== undefined) {
      patch.viewState = nextViewState;
    }
    await updateStrategyView(id, patch);
  } catch (err) {
    ok = false;
    console.error('[admin-view-mode-sync]', err);
    latestAdminRows = latestAdminRows.map((item) => (
      String(item?.id ?? '').trim() === id
        ? { ...item, viewMode: prevViewMode, viewState: prevViewState }
        : item
    ));
    showToast('视图切换失败，请先执行 supabase.sql');
  } finally {
    updatingAdminViewModeIds.delete(id);
    renderAdminListItems();
    renderAdminActiveNames();
  }
  return ok;
}

const SUPABASE_URL = 'https://rxggjijrfafcrmtkqkuv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8B1PLTeHhtPou4lPt9cl6w_O2hipMVY';
const AUTH_STORAGE_KEY = 'ok_supabase_session';
const AUTH_REFRESH_LEAD_MS = 10 * 60 * 1000;
const AUTH_ACCESS_TOKEN_SKEW_MS = 2 * 60 * 1000;
const LOGIN_EMAIL_SUFFIX = '@ok.local';
const AUTH_ENDPOINT = `${SUPABASE_URL}/auth/v1/token`;
const STRATEGIES_ENDPOINT = `${SUPABASE_URL}/rest/v1/strategies`;
const STRATEGY_STATS_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/get_strategy_stats`;
const RECENT_10_STATS_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/get_recent_10_stats`;
const OBSERVATIONS_ENDPOINT = `${SUPABASE_URL}/rest/v1/observation_records`;
const SETTINGS_ENDPOINT = `${SUPABASE_URL}/rest/v1/app_settings`;
const APP_SETTINGS_ID = 'default';
const STRATEGY_GRADE_PREMIUM = '优质';
const STRATEGY_GRADE_NORMAL = '普通';
function getStrategyGradeFromOpenCost(openCost, openCostTotal, tierCount = DEFAULT_TIER_COUNT) {
  const total = openCostTotal != null
    ? Number(openCostTotal)
    : Math.round(Number(openCost) * tierCount);
  if (OPEN_COST_TOTAL_PREMIUM_LEVELS.includes(total)) return STRATEGY_GRADE_PREMIUM;
  if (Number(openCost) === 150) return STRATEGY_GRADE_PREMIUM;
  return STRATEGY_GRADE_NORMAL;
}

function normalizeStrategyGrade(grade) {
  const raw = String(grade ?? '').trim();
  if (raw === STRATEGY_GRADE_PREMIUM) return STRATEGY_GRADE_PREMIUM;
  return STRATEGY_GRADE_NORMAL;
}

const SAVE_LOG_PREFIX = '[strategy-save]';
const METHODOLOGY_SECTIONS = [
  {
    title: '1、核心理念',
    items: [
      '右侧交易，趋势立项，见好就收。',
      '风控第一，收益第二，策略唯一。',
      '简化操作，行情很简单，复杂的是人心。',
      '挂单交易，能成交就做，不能成交就算了，机会不止一个。',
      '在限定的范围内做正确的事。',
      '保持优雅，永远不要让自己陷入纠结和绝境。',
      '严格选品，耐心等待，保守前进。',
    ],
  },
  {
    title: '2、选择标准',
    items: [
      '三线齐飞是信号，三线统一是根源，看大做小是方法。',
      '只研究热度前20即可，时间维度切换1/4/24。',
      '大维度是主方向，小维度打配合。统一方向10，背离参考也是10。',
      '做日内趋势明显的小时右侧单。',
      '交易量过亿。',
      '止损位置往前数10个标的内的插针极限。',
    ],
  },
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
  { title: '8、目标', paragraphs: ['目标35岁之前退休，计划不变。'] },
  {
    title: '9、理性和感性冲突的终极解法',
    items: ['固定策略选一边覆盖。', '统一标准量化分析。'],
  },
  {
    title: '10、让每一个操作都有意义',
    items: ['做好开仓记录。', '做好观测日志。', '不做任何无效操作。'],
  },
  {
    title: '11、操作手法',
    items: [
      '确定性第一，风险第二，盈亏比第三。浮亏浮盈是最后。',
      '最大止损不超过50%，最大止盈不超过一个数量级。',
      '风险很小的策略，等待时间和空间。',
      '保持自己正确的盘感，不要觊觎其他体系的力量。',
      '只要前三，分清主次。',
      '风险厌恶，浮亏影响判断。时机比点位更重要。',
      '优质股必上车。大仓位挂着，小仓位跑着，进度有度。',
      '4小时为主。1小时和1天维度为辅。多维度兼容思维分析行情。',
      '等待就是最快的前行。',
      '让利润飞腾，无需太大的仓位。关键是时间和空间。',
      '螺旋上升没有必要，渐进增长是唯一解。',
      '无明确信号的时候，不操作就是最好的操作。',
      '恐惧和贪婪的平衡点在于规则的约束。',
      'btc eth 上的高手太多了，内卷严重。我资金量小，以后不做这2个。',
      '时间止盈＋空间止盈危机处理：先平仓避险，然后更换为最好的。',
      '危机处理：先平仓避险，然后更换为最好的。',
      '带着止损冲，这是唯一可以赢的方式。',
    ],
  },
  {
    title: '12、基本定律',
    items: [
      '博弈中盈亏比与确定性互斥。盈亏比高的情况往往是还没走向确定，等确定性很高了往往也没有多少盈亏比。',
      '做多赢得多，做空盈利快。',
      '盈亏同源。',
      '多军和空军都不好过，日内30%基本是极限。',
      '这个游戏的核心是，应该做胜率最高的选择，而不是盈利最大选择。',
    ],
  },
  {
    title: '13、简要',
    items: [
      '不做BTC 和 ETH，难度太大。',
      '只做自己的行情，不参考其他人的信息。',
      '不加仓不减仓，使用自己的方法判断。',
      '尊重客观事实，不做无法实现的梦。',
      '没有符合生命周期理论的就不操作，找点其他乐子。',
    ],
  },
  {
    title: '14、天道',
    items: [
      '以小博大是弱者思维，胜率太小经不起波澜。以大博小是强者思维，确定性永远排在第一位。',
      '顺境时不要张狂，要懂得居安思危。逆境时不要焦虑，要从风险中看到机会。',
      '不要只盯着风险或者收益，要全面平等的看待。胜率大的时候要坚定选择，当赢则赢。但也要留有余地，因为失败的可能性一直存在。',
      '一开始选择的是自己，选择之初就应该明白可能的全部结果。早有觉悟不是一句空话。',
      '见路不走，宽门不进，肥田不耕。',
    ],
  },
  {
    title: '15、观测不仔细就会错过机会。',
    items: [
      '正确的流程：顺序看4h，倒序看1d。',
      '每天早中晚观测3遍可以覆盖全时间段。',
      '千万级别以上的标的都不要错过。',
    ],
  },
  {
    title: '16、我喜欢不焦虑的人',
    items: [
      '不加仓，不减仓，不滚仓，不改变。',
      '不后悔，不遗憾。平静的面对，渐进式增长。',
      '心态不好的时候，停下来去场外娱乐转移注意力。',
    ],
  },
  {
    title: '17、最新感悟',
    items: [
      '格局大点，没到100万都是欢乐豆。',
      '优先级：趋势立项＞趋势力预测＞顺势而为',
      '反趋势限定方向空，时间空间都满足，否则不做。优先级还是新的趋势立项单。',
      '严格选品，分批挂单。保持最佳位置挂单的好习惯，经常会有惊喜。',
      '分仓不如集中子弹到最优势的单子，多维度去解读操作。基于方向的确定性，实现收益最大化。',
      '不符合模型就跑，亏不了多少。无需纠结，集中力量到下一单。',
      '放弃多空临界值的单子，做好趋势交易的本分。',
      '钝感力，松弛感。',
      '趋势立项确认正确以后加仓。趋势力预测确认正确以后转顺势而为。',
      '严格选品，耐心等待，保守前进。',
      '多做多错，少做不错。 非必要不操作是最好的操作。',
      '错过一些机会证明我的风控做的很好，要继续保持，不要觊觎其他的力量。',
      '已经认证过可行性，只需坚定循环执行。不要调整，稳定盈利才是王道。',
      '所有操作必须有体系结论，无结论坚决不操作。杜绝一切临时起意的奇怪想法。',
      '行情有四种形态：趋势立项、反趋势、追涨杀跌、极限逼空。每个形态都可以用体系辅助解析。',
      '顶级判断力，缺乏执行力。实际操作中，保留底仓长线+部分短线操作可以有效缓解执行焦虑。',
      '每天早中晚发掘新机会，只做最好的，排行前三开单。不纠结利用率问题。',
      '在行情剧烈时候操作，在行情缓慢时候思考。',
      '趋势立项坚持到底，反趋势见好就收。',
      '排行榜前10是最大的机会，种类不超过三。',
      '打好基础，指数增长。技术爆炸。螺旋上升。',
      '4h为主，1d为辅。优先级不能变，',
      '先保证生存才有资格谈盈利。渐进增长是可行的，螺旋上升不具备安全性。',
      '最危险的不是市场，是自己的心。',
      '真正的考验是关键位置的抗压能力。',
    ],
  },
  {
    title: '18、合约的本质',
    items: [
      '短线重仓确定性最好位置，根据后续时间维度连续性判断止盈离场。',
      '绝对的理性，只看数据。',
      '寻找趋势力量的源头。',
      '确定性才是机会，也是唯一的前提。',
      '精确计算，多方验证，快准狠执行。',
      '双向思维，多时间维度分析。',
      '谨慎会导致盈利的缩水，但也是活着的必要代价。',
      '知行合一，星辰大海只是时间问题。',
      '想赚钱还是要做头部热度排行榜。',
      '认真挂好每一单，永远相信美好的事情即将发生。',
      '只做龙头日内8小时右侧趋势，8小时内不操作。',
      '仓位超过10%就会心态失衡，时间空间杠杆的价值就没了，得不偿失。',
      '咒语-验证-结局。',
      '最大的风险来自于不敢承担风险。',
    ],
  },
  {
    title: '19、思路无敌，操作拉跨的解决方案',
    items: [
      '确立思路是做8小时日内趋势，8小时内不操作，不看小趋势。',
      '主动出击，立即成交。时间点调整补仓减仓调整。确保成交率，保留调整机会。',
      '仓位控制，不要心态影响操作。时间才是最好的杠杆。',
      '龙头机会最大，这是不争的事实。',
      '一个模型，三个阶段形态。趋势立项前期挂单。注意拐点10的避险和验证。验证以后做回调。',
      '参考数据是为了更好的盈利，不是为了困住自己。有利润随时出，当前的利润才是真实的，合约本身就是限定时间空间的走一步看一步。',
      '本金分配需要平衡成交率、最佳位置、后手补仓。所以最佳分配方案是2个仓位(28正太分布），立即成交一半，最佳位置加仓一半。',
      '转折点 ==> 时间10单位+空间10倍 ==> 解除封印，单边行情',
      '不要轻易删数据，历史数据很有研究价值。',
    ],
  },
  {
    title: '20、一个模型，三种形态',
    items: [
      '只挂前50%优势单，劣势单最多用1个。',
      '趋势方向明确，在关键时间关键位置上搏一把。',
      '关键点确定之前靠猜测，出现以后靠精准计算。',
    ],
  },
  {
    title: '21、解读',
    items: [
      '大小周期结合',
      '形态数值结合',
      '理论实际结合',
      '长线波段结合',
      '过程结果结合',
    ],
  },
  {
    title: '23、悟道',
    items: [
      '浮亏是机会，踏空是风险。',
      '只要结果是好的，过程中的曲折都是值得的。',
      '结果合约，过程盈利。不要吃满全部收益，不要期望开在最好的位置。',
      '正确但不准确是常态，暂时的亏损不是问题。不要在长久的等待中迷失。',
      '追求本金的螺旋上升，不要在意胜率和价格好坏。',
      '要有本金剧烈波动的心里准备。风险固定，收益看机会。',
      '只在关键位置和时间操作，中间态不操作不关注。',
      '小趋势（15m/1h）不能作为操作依据。',
      '最佳状态是快准狠，不要瞻前顾后想太多。',
      '限定的风险是必须的，是为了解决正确不准确的客观事实，防止小概率的黑天鹅意外。',
      '分析和操作两权分立。空仓观测分析，持有仓位以后不再分析和操作，只相信最初的判断。',
      '最佳时机是8/16/24点，过程垃圾时间需要忽视。（可以提前半小时准备）',
      '没有万全之策。胆子大一点，要有资产剧烈波动的心理准备。',
      '持仓不分析，分析不持仓。',
      '必须克服波段操作，并且坚持到底，否则什么都无法改变。',
    ],
  },
];

let authSession = null;
let isLoggingIn = false;
let isAuthReady = false;
let authRefreshTimer = null;
let authRefreshInFlight = null;

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
    if (authRefreshTimer) {
      clearTimeout(authRefreshTimer);
      authRefreshTimer = null;
    }
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  scheduleAuthRefresh();
}

function clearAuthSession() {
  saveAuthSession(null);
}

function isAccessTokenValid() {
  if (!authSession?.access_token || !authSession?.expires_at) return false;
  return Date.now() < authSession.expires_at - AUTH_ACCESS_TOKEN_SKEW_MS;
}

function isAuthRefreshTokenInvalid(err) {
  const code = String(err?.code ?? '').toLowerCase();
  const msg = String(err?.message ?? '').toLowerCase();
  return code === 'invalid_grant'
    || msg.includes('invalid refresh token')
    || msg.includes('refresh token not found')
    || msg.includes('token is expired')
    || msg.includes('session not found');
}

function scheduleAuthRefresh() {
  if (authRefreshTimer) {
    clearTimeout(authRefreshTimer);
    authRefreshTimer = null;
  }
  if (!authSession?.refresh_token || !authSession?.expires_at) return;
  const refreshAt = authSession.expires_at - AUTH_REFRESH_LEAD_MS;
  const delay = Math.max(refreshAt - Date.now(), 1000);
  authRefreshTimer = setTimeout(() => {
    refreshAuthSessionSafe().catch(() => {});
  }, delay);
}

function syncAuthSessionFromStorage() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token) return;
    authSession = parsed;
    scheduleAuthRefresh();
  } catch {
    // ignore cross-tab parse errors
  }
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
    const err = new Error(data?.error_description || data?.msg || data?.message || '登录失败');
    err.code = data?.error || data?.error_code || '';
    throw err;
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

async function refreshAuthSessionSafe() {
  if (authRefreshInFlight) return authRefreshInFlight;
  authRefreshInFlight = refreshAuthSession()
    .finally(() => {
      authRefreshInFlight = null;
    });
  return authRefreshInFlight;
}

async function ensureAuthSession() {
  if (isAccessTokenValid()) return authSession;
  if (authSession?.refresh_token) return refreshAuthSessionSafe();
  throw new Error('未登录');
}

function forceLogout(message = '登录已过期，请重新登录') {
  clearAuthSession();
  showLoginPage(message);
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

async function supabaseFetch(input, init = {}, retried = false) {
  try {
    await ensureAuthSession();
  } catch (err) {
    if (isAuthRefreshTokenInvalid(err)) {
      forceLogout();
    }
    throw err;
  }
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
  if (res.status === 401 && !retried && authSession?.refresh_token) {
    try {
      await refreshAuthSessionSafe();
      return supabaseFetch(input, init, true);
    } catch (err) {
      if (isAuthRefreshTokenInvalid(err)) {
        forceLogout();
        throw new Error('登录已过期，请重新登录');
      }
      throw err;
    }
  }
  if (res.status === 401) {
    forceLogout();
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
    await enterAuthenticatedApp();
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

async function enterAuthenticatedApp() {
  showApp();
  try {
    await fetchAppSettings();
  } catch {
    cachedUnitCostInput = ADMIN_TOTAL_CAPITAL_DEFAULT;
    restoreUnitCostInput();
  }
  setPage('admin');
}

async function initApp() {
  loadAuthSession();
  if (authSession?.refresh_token) {
    try {
      await ensureAuthSession();
      await enterAuthenticatedApp();
      return;
    } catch (err) {
      if (isAuthRefreshTokenInvalid(err)) {
        clearAuthSession();
      } else if (isAccessTokenValid()) {
        scheduleAuthRefresh();
        await enterAuthenticatedApp();
        return;
      }
    }
  } else if (authSession?.access_token && isAccessTokenValid()) {
    await enterAuthenticatedApp();
    return;
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
    .map((item) => {
      const normalized = {
        rate: Number(item?.rate),
        price: dbValueToString(item?.price),
        quantity: dbValueToString(item?.quantity),
      };
      if (item?.display === true) normalized.display = true;
      return normalized;
    })
    .filter((item) => Number.isFinite(item.rate) && item.price && item.quantity);
}

function enrichConcessionsWithBaseline(concessions, entryPrice, quantity) {
  if (!hasConcessions(concessions)) return concessions;
  if (isAssistConcessionSet(concessions)) return concessions.slice();
  const items = concessions.slice();
  if (!items.some((item) => Number(item.rate) === 0)) {
    const price = String(entryPrice ?? '').trim();
    const qty = String(quantity ?? '').trim();
    if (price && qty) items.unshift({ rate: 0, price, quantity: qty });
  }
  return items;
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
    description: dbValueToString(row.description),
    positionSide: row.position_side,
    inputPrice: dbValueToString(row.input_price),
    inputStopLoss: dbValueToString(row.input_stop_loss),
    entryPrice: dbValueToString(row.entry_price),
    quantity: dbValueToString(row.quantity),
    takeProfitPrice: dbValueToString(row.take_profit_price),
    stopLossPrice: dbValueToString(row.stop_loss_price),
    openCost: row.open_cost,
    openCostMultiplier: row.open_cost_multiplier,
    openCostTotal: row.open_cost_total,
    grade: normalizeStrategyGrade(row.grade ?? getStrategyGradeFromOpenCost(row.open_cost, row.open_cost_total)),
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
    viewMode: normalizeStrategyViewMode(row.view_mode),
    viewState: normalizeViewState(row.view_state),
  };
}

function toDbRecord(record) {
  const startAt = parseDateValue(record.startAt);
  const expiresAt = parseDateValue(record.expiresAt);
  const openCostTotal = Number(record.openCostTotal) || getOpenCostTotal(record.openCostMultiplier);
  const openCostMultiplier = clampOpenCostMultiplier(record.openCostMultiplier ?? openCostTotal / OPEN_COST_BASE);
  const isFish = isAssistConcessionSet(record.concessions) && isFishTakeProfitMultiple(record.takeProfitRMultiple);
  const fishTime = isFish ? buildFishTimeRange(startAt || new Date()) : null;
  const resolvedStart = isFish
    ? parseDateValue(fishTime.startAt)
    : startAt;
  const resolvedExpires = isFish
    ? parseDateValue(fishTime.expiresAt)
    : expiresAt;
  return {
    strategy_name: record.strategyName,
    description: String(record.description ?? '').trim(),
    position_side: record.positionSide,
    input_price: toNumber(record.inputPrice),
    input_stop_loss: toNumber(record.inputStopLoss),
    entry_price: toNumber(record.entryPrice),
    quantity: toNumber(record.quantity),
    take_profit_price: toNumber(record.takeProfitPrice),
    stop_loss_price: toNumber(record.stopLossPrice),
    open_cost: Number(record.openCost),
    open_cost_multiplier: openCostMultiplier,
    open_cost_total: openCostTotal,
    grade: normalizeStrategyGrade(record.grade ?? getStrategyGradeFromOpenCost(record.openCost, openCostTotal)),
    price_adjustment_rate: Number(record.priceAdjustmentRate),
    price_adjustment: toNumber(record.priceAdjustment),
    concessions: hasConcessions(record.concessions)
      ? normalizeConcessions(record.concessions)
      : [],
    take_profit_r_multiple: Number(record.takeProfitRMultiple),
    timeframe: isFish ? fishTime.timeframe : normalizeTimeframeMode(record.timeframe),
    timeframe_minutes: isFish
      ? fishTime.timeframeMinutes
      : (Number(record.timeframeMinutes) || getTimeframeMinutes(record.timeframe)),
    valid_periods: isFish ? fishTime.validPeriods : Number(record.validPeriods),
    duration_minutes: isFish ? fishTime.durationMinutes : Number(record.durationMinutes),
    start_at: resolvedStart ? resolvedStart.toISOString() : null,
    expires_at: resolvedExpires ? resolvedExpires.toISOString() : null,
    outcome_status: normalizeOutcomeStatus(record.outcomeStatus),
    outcome_remark: String(record.outcomeRemark ?? '').trim(),
    view_mode: normalizeStrategyViewMode(record.viewMode),
    view_state: normalizeViewState(record.viewState),
  };
}

function parseSupabaseErrorMessage(err) {
  const raw = String(err?.message || err || '').trim();
  if (!raw) return '';
  try {
    const json = JSON.parse(raw);
    return String(json?.message || json?.details || json?.hint || raw).trim();
  } catch {
    return raw;
  }
}

function formatStrategySaveError(err) {
  const message = parseSupabaseErrorMessage(err);
  if (
    /null value in column "(?:start_at|expires_at)"/i.test(message)
    || (/not-null constraint/i.test(message) && /start_at|expires_at/i.test(message))
  ) {
    return '保存失败：开始时间留空需要升级数据库，请在 Supabase SQL Editor 执行 supabase.sql。';
  }
  if (message && message.length < 180) return `保存失败：${message}`;
  return '保存失败。请检查 Supabase 表和权限。';
}

function isMobileTimePickerEnabled() {
  return window.matchMedia('(max-width: 820px) and (pointer: coarse)').matches;
}

function getTimeSlotsByMode(mode) {
  const slots = [];
  const normalizedMode = normalizeTimeframeMode(mode);
  const stepMinutes = getTimeframeMinutes(normalizedMode);
  const now = new Date();
  const currentSlot = floorDateToStep(now, stepMinutes);
  for (let i = START_TIME_SLOT_COUNT - 1; i >= 0; i -= 1) {
    const at = new Date(currentSlot.getTime() - i * stepMinutes * 60 * 1000);
    slots.push({
      value: formatStartSlotValue(at),
      label: formatSlotLabelForMode(at, now, normalizedMode),
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

function getStartTimeFieldEls(scope = getFrontFormScope()) {
  if (scope === 'assist') {
    return {
      sel: document.getElementById('assist-start-time'),
      trigger: document.getElementById('assist-start-time-trigger'),
    };
  }
  return {
    sel: document.getElementById('start-time'),
    trigger: document.getElementById('start-time-trigger'),
  };
}

function isStartTimeUserPicked(scope = getFrontFormScope()) {
  return scope === 'assist' ? assistStartTimeUserPicked : startTimeUserPicked;
}

function setStartTimeUserPicked(value, scope = getFrontFormScope()) {
  if (scope === 'assist') assistStartTimeUserPicked = Boolean(value);
  else startTimeUserPicked = Boolean(value);
}

function updateStartTimeTriggerLabel(scope = getFrontFormScope()) {
  const { trigger, sel } = getStartTimeFieldEls(scope);
  if (!trigger || !sel) return;
  const v = String(sel.value ?? '').trim();
  const label = String(sel.selectedOptions?.[0]?.textContent ?? '').trim();
  trigger.textContent = label || v || '留空（旧单）';
}

function renderMobileTimePickerOptions(selectedValue, scope = mobileTimePickerScope) {
  const list = document.getElementById('time-picker-list');
  if (!list) return;
  const mode = getTimeframeMode(scope);
  const slots = getTimeSlotsByMode(mode);
  const rawSelected = String(selectedValue ?? '').trim();
  const allowEmpty = rawSelected === '';
  const fallbackValue = resolveStartTimeSelection(mode, selectedValue);
  const activeValue = allowEmpty
    ? ''
    : (slots.some((slot) => slot.value === rawSelected) ? rawSelected : fallbackValue);
  const frag = document.createDocumentFragment();

  const emptyBtn = document.createElement('button');
  emptyBtn.type = 'button';
  emptyBtn.className = `time-picker__option${activeValue === '' ? ' is-selected' : ''}`;
  emptyBtn.dataset.value = '';
  emptyBtn.textContent = '留空（旧单）';
  emptyBtn.setAttribute('role', 'option');
  emptyBtn.setAttribute('aria-selected', activeValue === '' ? 'true' : 'false');
  frag.appendChild(emptyBtn);

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

function openMobileTimePicker(scope = getFrontFormScope()) {
  const picker = document.getElementById('start-time-picker');
  const { sel } = getStartTimeFieldEls(scope);
  if (!picker || !sel) return;
  mobileTimePickerScope = scope;
  renderMobileTimePickerOptions(String(sel.value ?? '').trim(), scope);
  picker.hidden = false;
  document.body.style.overflow = 'hidden';
  window.requestAnimationFrame(scrollMobilePickerToSelected);
}

function closeMobileTimePicker() {
  const picker = document.getElementById('start-time-picker');
  if (!picker) return;
  picker.hidden = true;
  document.body.style.overflow = '';
  updateStartTimeTriggerLabel(mobileTimePickerScope);
}

function applyMobileTimePickerValue(value) {
  const { sel } = getStartTimeFieldEls(mobileTimePickerScope);
  if (!sel) {
    closeMobileTimePicker();
    return;
  }
  const selected = String(value ?? '').trim();
  if (sel.value !== selected) {
    if (selected && !Array.from(sel.options).some((opt) => opt.value === selected)) {
      const opt = document.createElement('option');
      opt.value = selected;
      opt.textContent = selected;
      sel.appendChild(opt);
    }
    sel.value = selected;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    updateStartTimeTriggerLabel(mobileTimePickerScope);
  }
  closeMobileTimePicker();
}

function bindMobileTimePickerEvents() {
  const picker = document.getElementById('start-time-picker');
  const list = document.getElementById('time-picker-list');
  if (!picker || !list) return;

  ['trend', 'assist'].forEach((scope) => {
    const { trigger } = getStartTimeFieldEls(scope);
    trigger?.addEventListener('click', () => {
      if (!isMobileTimePickerEnabled()) return;
      openMobileTimePicker(scope);
    });
  });

  picker.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.getAttribute('data-dismiss') === 'true') {
      closeMobileTimePicker();
      return;
    }
    if (target.classList.contains('time-picker__option')) {
      const v = Object.prototype.hasOwnProperty.call(target.dataset, 'value')
        ? String(target.dataset.value ?? '').trim()
        : '';
      applyMobileTimePickerValue(v);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !picker.hidden) closeMobileTimePicker();
  });
}

function rebuildStartTimeOptions(preferredValue = null, { ensurePreferredSlot = false, scope = getFrontFormScope() } = {}) {
  const { sel } = getStartTimeFieldEls(scope);
  if (!sel) return;

  const mode = getTimeframeMode(scope);
  let slots = getTimeSlotsByMode(mode);
  const preferred = String(preferredValue ?? '').trim();
  // ensurePreferredSlot 时保留明确传入的值（含空，表示旧单无开始时间）
  const selectedValue = ensurePreferredSlot
    ? preferred
    : resolveStartTimeSelection(mode, preferredValue ?? sel.value);

  if (ensurePreferredSlot && selectedValue && !slots.some((slot) => slot.value === selectedValue)) {
    const extraAt = parseStartSlotValue(selectedValue);
    if (extraAt) {
      slots = [{
        value: selectedValue,
        label: formatFullDateTimeLabel(extraAt),
        time: formatHHMM(extraAt.getHours(), extraAt.getMinutes()),
        at: extraAt,
      }, ...slots];
    }
  }

  const frag = document.createDocumentFragment();
  const optPlaceholder = document.createElement('option');
  optPlaceholder.value = '';
  optPlaceholder.textContent = '留空（旧单）';
  if (!selectedValue) optPlaceholder.selected = true;
  frag.appendChild(optPlaceholder);

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

  updateStartTimeTriggerLabel(scope);
  if (!document.getElementById('start-time-picker')?.hidden && mobileTimePickerScope === scope) {
    renderMobileTimePickerOptions(sel.value, scope);
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

function renderCopyableNumberHtml(value, className) {
  const text = String(value ?? '').trim();
  const safeClass = String(className || '').trim();
  if (!text || text === '—') {
    return `<span class="${safeClass}">${escapeHtml(text || '—')}</span>`;
  }
  return [
    `<button type="button" class="${safeClass} admin-copy-value" data-copy-text="${escapeHtml(text)}" title="点击复制" aria-label="复制 ${escapeHtml(text)}">`,
    escapeHtml(text),
    '</button>',
  ].join('');
}

async function copyTextToClipboard(text) {
  const value = String(text ?? '');
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function clearMethodologyPage() {
  const container = document.querySelector('#methodology-page .methodology-content');
  if (container) container.innerHTML = '';
}

function renderMethodologyBalanceBannerHtml() {
  return [
    '<aside class="methodology-balance" aria-label="生命周期理论">',
    '<div class="methodology-balance__row">',
    '<div class="methodology-balance__side">',
    '<span class="methodology-balance__stage">趋势立项</span>',
    '<span class="methodology-balance__desc">时间10，空间3-5倍</span>',
    '</div>',
    '<span class="methodology-balance__arrow" aria-hidden="true">==&gt;</span>',
    '<div class="methodology-balance__side">',
    '<span class="methodology-balance__stage">趋势力回调</span>',
    '<span class="methodology-balance__desc">时间空间都满足，止损空间翻倍非常安全</span>',
    '</div>',
    '<span class="methodology-balance__arrow" aria-hidden="true">==&gt;</span>',
    '<div class="methodology-balance__side">',
    '<span class="methodology-balance__stage">调整等待</span>',
    '<span class="methodology-balance__desc">进入下一个周期</span>',
    '</div>',
    '</div>',
    '</aside>',
  ].join('');
}

function renderMethodologyPage() {
  if (!isAuthReady) return;
  const container = document.querySelector('#methodology-page .methodology-content');
  if (!container) return;
  const sectionsHtml = METHODOLOGY_SECTIONS.slice().reverse().map((section) => {
    let body = '';
    if (section.paragraphs?.length) {
      body = section.paragraphs
        .map((p) => `<p class="methodology-section__text">${escapeHtml(p)}</p>`)
        .join('');
    } else if (section.items?.length) {
      body = `<ul class="methodology-section__list">${section.items
        .map((item) => `<li>${escapeHtml(item).replace(/\n/g, '<br>')}</li>`)
        .join('')}</ul>`;
    }
    return `<article class="methodology-section"><h3 class="methodology-section__title">${escapeHtml(section.title)}</h3><div class="methodology-section__body">${body}</div></article>`;
  }).join('');
  container.innerHTML = `${renderMethodologyBalanceBannerHtml()}${sectionsHtml}`;
}

let currentStrategyCopyText = '';
let currentStrategyRecord = null;
let currentAssistCopyText = '';
let currentAssistRecord = null;
let editingStrategyId = null;
let editingStrategyPreserve = null;
let pendingAdminFocusId = '';

function clearEditingStrategy() {
  editingStrategyId = null;
  editingStrategyPreserve = null;
  updateSaveButtonLabels();
  syncFrontModeSwitchLock();
  syncPinButtonUI();
}

function syncFrontModeSwitchLock() {
  const wrap = document.querySelector('.front-mode-switch');
  const locked = Boolean(editingStrategyId);
  if (wrap) wrap.classList.toggle('is-locked', locked);
  document.querySelectorAll('.front-mode-switch__btn').forEach((btn) => {
    btn.disabled = locked;
  });
}

function syncFrontModeSwitchUI() {
  document.querySelectorAll('.front-mode-switch__btn').forEach((btn) => {
    const active = btn.getAttribute('data-front-mode') === frontMode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  syncFrontModeSwitchLock();
}

function syncPinButtonUI() {
  const btn = document.getElementById('btn-toggle-pin');
  if (!btn) return;
  const isEditing = Boolean(editingStrategyId);
  const pinned = isStrategyPinned({ viewState: editingStrategyPreserve?.viewState });
  btn.hidden = !isEditing;
  btn.textContent = pinned ? '取消关注' : '关注';
  btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
  btn.classList.toggle('is-pinned', pinned);
}

function updateSaveButtonLabels() {
  const trendBtn = document.getElementById('btn-copy-strategy');
  const assistBtn = document.getElementById('btn-save-assist');
  const fishBtn = document.getElementById('btn-save-fish');
  const isEditing = Boolean(editingStrategyId);
  if (trendBtn) {
    const label = isEditing && isFrontTrendMode() ? '保存修改' : '保存';
    trendBtn.textContent = label;
    trendBtn.dataset.defaultLabel = label;
  }
  if (assistBtn) {
    const label = isEditing && isFrontAssistMode() ? '保存修改' : '保存';
    assistBtn.textContent = label;
    assistBtn.dataset.defaultLabel = label;
  }
  if (fishBtn) {
    const label = isEditing && isFrontFishMode() ? '保存修改' : '保存';
    fishBtn.textContent = label;
    fishBtn.dataset.defaultLabel = label;
  }
  syncFrontModeSwitchLock();
  syncPinButtonUI();
}

function getStartSlotValueFromRow(row) {
  const startAt = parseDateValue(row?.startAt);
  if (!startAt) return '';
  const mode = normalizeFrontTrendTimeframe(row?.timeframe);
  const stepMinutes = getTimeframeMinutes(mode);
  return formatStartSlotValue(floorDateToStep(startAt, stepMinutes));
}

function getStrategyDescription(scope = getFrontFormScope()) {
  const normalized = scope === 'fish' || scope === 'assist' ? scope : 'trend';
  if (normalized === 'trend') {
    const remarkEl = document.getElementById('remark-input');
    if (remarkEl) return String(remarkEl.value ?? '').trim();
  }
  if (editingStrategyId && editingStrategyPreserve) {
    return String(editingStrategyPreserve.description ?? '').trim();
  }
  return '';
}

function populateTrendFormFromRow(row) {
  const nameEl = document.getElementById('name-input');
  const openEl = document.getElementById('open-price-input');
  const stopEl = document.getElementById('stop-price-input');
  const remarkEl = document.getElementById('remark-input');
  if (nameEl) nameEl.value = String(row?.strategyName ?? '').trim();
  if (openEl) openEl.value = String(row?.inputPrice ?? '').trim();
  if (stopEl) stopEl.value = String(row?.inputStopLoss ?? '').trim();
  if (remarkEl) remarkEl.value = String(row?.description ?? '').trim();
  setFrontTimeframeMode(row?.timeframe || DEFAULT_TIMEFRAME, { refresh: false, scope: 'trend' });
  const startSlot = getStartSlotValueFromRow(row);
  setStartTimeUserPicked(true, 'trend');
  rebuildStartTimeOptions(startSlot, { ensurePreferredSlot: true, scope: 'trend' });
}

function populateAssistFormFromRow(row) {
  const nameEl = document.getElementById('assist-name-input');
  const descEl = document.getElementById('assist-desc-input');
  const fromEl = document.getElementById('assist-from-input');
  const toEl = document.getElementById('assist-to-input');
  if (nameEl) nameEl.value = String(row?.strategyName ?? '').trim();
  if (descEl) descEl.value = String(row?.description ?? '').trim();
  if (fromEl) fromEl.value = String(row?.inputPrice ?? '').trim();
  if (toEl) toEl.value = String(row?.inputStopLoss ?? '').trim();
  setFrontTimeframeMode(row?.timeframe || DEFAULT_ASSIST_TIMEFRAME, { refresh: false, scope: 'assist' });
  const startSlot = getStartSlotValueFromRow(row);
  setStartTimeUserPicked(true, 'assist');
  rebuildStartTimeOptions(startSlot, { ensurePreferredSlot: true, scope: 'assist' });
}

function populateFishFormFromRow(row) {
  const nameEl = document.getElementById('fish-name-input');
  const fromEl = document.getElementById('fish-from-input');
  const toEl = document.getElementById('fish-to-input');
  if (nameEl) nameEl.value = String(row?.strategyName ?? '').trim();
  if (fromEl) fromEl.value = String(row?.inputPrice ?? '').trim();
  if (toEl) toEl.value = String(row?.inputStopLoss ?? '').trim();
}

function readFrontFormDraft(scope) {
  if (scope === 'fish') {
    return {
      name: String(document.getElementById('fish-name-input')?.value ?? ''),
      remark: '',
      timeframe: '',
      startTime: '',
      startTimePicked: false,
      priceA: String(document.getElementById('fish-from-input')?.value ?? ''),
      priceB: String(document.getElementById('fish-to-input')?.value ?? ''),
    };
  }
  const isAssist = scope === 'assist';
  const { sel } = getStartTimeFieldEls(isAssist ? 'assist' : 'trend');
  return {
    name: String(document.getElementById(isAssist ? 'assist-name-input' : 'name-input')?.value ?? ''),
    remark: isAssist ? '' : String(document.getElementById('remark-input')?.value ?? ''),
    timeframe: getTimeframeMode(isAssist ? 'assist' : 'trend'),
    startTime: String(sel?.value ?? '').trim(),
    startTimePicked: isStartTimeUserPicked(isAssist ? 'assist' : 'trend'),
    priceA: String(document.getElementById(isAssist ? 'assist-from-input' : 'open-price-input')?.value ?? ''),
    priceB: String(document.getElementById(isAssist ? 'assist-to-input' : 'stop-price-input')?.value ?? ''),
  };
}

function applyFrontFormDraft(draft, scope) {
  if (scope === 'fish') {
    const nameEl = document.getElementById('fish-name-input');
    const priceAEl = document.getElementById('fish-from-input');
    const priceBEl = document.getElementById('fish-to-input');
    if (nameEl) nameEl.value = draft.name ?? '';
    if (priceAEl) priceAEl.value = draft.priceA ?? '';
    if (priceBEl) priceBEl.value = draft.priceB ?? '';
    return;
  }
  const isAssist = scope === 'assist';
  const nameEl = document.getElementById(isAssist ? 'assist-name-input' : 'name-input');
  const priceAEl = document.getElementById(isAssist ? 'assist-from-input' : 'open-price-input');
  const priceBEl = document.getElementById(isAssist ? 'assist-to-input' : 'stop-price-input');
  const remarkEl = isAssist ? null : document.getElementById('remark-input');
  if (nameEl) nameEl.value = draft.name ?? '';
  if (priceAEl) priceAEl.value = draft.priceA ?? '';
  if (priceBEl) priceBEl.value = draft.priceB ?? '';
  if (remarkEl) remarkEl.value = draft.remark ?? '';
  setFrontTimeframeMode(
    draft.timeframe || (isAssist ? DEFAULT_ASSIST_TIMEFRAME : DEFAULT_TIMEFRAME),
    { refresh: false, scope: isAssist ? 'assist' : 'trend' },
  );
  const startTime = String(draft.startTime ?? '').trim();
  setStartTimeUserPicked(Boolean(draft.startTimePicked), isAssist ? 'assist' : 'trend');
  rebuildStartTimeOptions(startTime, {
    ensurePreferredSlot: Boolean(draft.startTimePicked),
    scope: isAssist ? 'assist' : 'trend',
  });
}

function startEditStrategy(row, { focusId = '' } = {}) {
  const target = resolveEditableStrategyRow(row) || row;
  const id = String(target?.id ?? '').trim();
  if (!id) return;

  const strategyType = getAdminStrategyTypeInfo(target);
  if (strategyType.type !== 'trend' && strategyType.type !== 'fish') {
    showToast('仅支持修改趋势立项或吃鱼助手单据');
    return;
  }
  pendingAdminFocusId = String(focusId || row?.id || id).trim();

  const isFish = strategyType.type === 'fish';
  if (isFish) {
    resetFrontPage();
    resetAssistPage();
    populateFishFormFromRow(target);
  } else {
    resetAssistPage();
    resetFishPage();
    populateTrendFormFromRow(target);
  }

  setPage('front', {
    preserveFrontForm: true,
    frontMode: isFish ? FRONT_MODE_FISH : FRONT_MODE_TREND,
    forceFrontMode: true,
  });

  editingStrategyId = id;
  editingStrategyPreserve = {
    outcomeStatus: target?.outcomeStatus,
    outcomeRemark: target?.outcomeRemark,
    viewMode: coerceSupportedViewMode(target?.viewMode),
    viewState: target?.viewState,
    description: target?.description,
  };

  if (isFish) generateFish();
  else generate();

  updateSaveButtonLabels();
  updateHeaderClearButton();
  syncPinButtonUI();
  showToast(isFish ? '已进入修改模式（吃鱼助手）' : '已进入修改模式（趋势立项）');
  window.scrollTo(0, 0);
}

function startCreateFishFromTrend(_row) {
  showToast('吃鱼助手请在前台单独开单');
}

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

function getPositionSideLabel(side) {
  const sideMod = getPositionSideMod(side);
  if (sideMod === 'long') return '做多';
  if (sideMod === 'short') return '做空';
  return '';
}

function getTimeframeTagHtml(timeframe) {
  const label = getTimeframeShortLabel(timeframe);
  if (!label) return '';
  return `<span class="admin-item__timeframe admin-item__timeframe--${escapeHtml(label)}" aria-label="时间维度 ${label}">${escapeHtml(label)}</span>`;
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

function renderAdminDescriptionHtml(description) {
  const text = String(description ?? '').trim();
  if (!text) return '';
  return [
    `<div class="admin-item__desc" aria-label="备注：${escapeHtml(text)}">`,
    `<p class="admin-item__desc-text">${escapeHtml(text)}</p>`,
    '</div>',
  ].join('');
}

function renderAdminRemarkStampHtml(remark) {
  const note = String(remark ?? '').trim();
  if (!note) return '';
  return `<div class="admin-item__remark-stamp" aria-label="备注：${escapeHtml(note)}">${escapeHtml(note)}</div>`;
}

function buildStrategyCopyText({ name, price, quantity, takeProfit, stopLoss, description }) {
  const lines = [
    formatStrategyCardTitle(name),
    `开始价格：${String(price ?? '').trim()}`,
    `数量：${String(quantity ?? '').trim()}`,
    `止盈：${String(takeProfit ?? '').trim()}`,
    `止损价格：${String(stopLoss ?? '').trim()}`,
  ];
  const note = String(description ?? '').trim();
  if (note) lines.push(`备注：${note}`);
  return lines.join('\n');
}

function enrichStrategyRecordForSubmit(record) {
  if (!record) return null;
  if (frontMode === FRONT_MODE_FISH || isFishStrategyRow(record)) {
    const fishTime = buildFishTimeRange();
    const next = {
      ...record,
      description: getStrategyDescription('fish'),
      ...fishTime,
      takeProfitRMultiple: FISH_TAKE_PROFIT_MULTIPLE,
    };
    if (editingStrategyId && editingStrategyPreserve) {
      next.outcomeStatus = editingStrategyPreserve.outcomeStatus ?? next.outcomeStatus;
      next.outcomeRemark = editingStrategyPreserve.outcomeRemark ?? '';
      next.viewMode = editingStrategyPreserve.viewMode ?? next.viewMode;
      next.viewState = editingStrategyPreserve.viewState ?? next.viewState;
    }
    return next;
  }
  const timeframe = getTimeframeMode();
  const timeframeMinutes = getTimeframeMinutes(timeframe);
  const validPeriods = Number(record.validPeriods) || STRATEGY_DURATION_PERIODS;
  const durationMinutes = timeframeMinutes * validPeriods;
  const next = {
    ...record,
    timeframe,
    timeframeMinutes,
    timeframeLabel: getTimeframeLabel(timeframe),
    validPeriods,
    durationMinutes,
    description: getStrategyDescription(),
  };
  const timeEl = getStartTimeFieldEls().sel;
  const startValue = timeEl && 'value' in timeEl ? String(timeEl.value).trim() : '';
  if (startValue) {
    const startAt = getStartDateTime(startValue);
    const endAt = addPeriodToStart(startValue, durationMinutes);
    next.startAt = startAt ? startAt.toISOString() : null;
    next.expiresAt = endAt ? endAt.toISOString() : null;
  } else {
    next.startAt = null;
    next.expiresAt = null;
  }
  if (editingStrategyId && editingStrategyPreserve) {
    next.outcomeStatus = editingStrategyPreserve.outcomeStatus ?? next.outcomeStatus;
    next.outcomeRemark = editingStrategyPreserve.outcomeRemark ?? '';
    next.viewMode = editingStrategyPreserve.viewMode ?? next.viewMode;
    next.viewState = editingStrategyPreserve.viewState ?? next.viewState;
  }
  return next;
}

/** 价格下限为 0：算穿或极限值按 0 展示，不拦截创建 */
function clampPriceAtZero(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n < 0 ? 0 : n;
}

/** 止盈价：盈利 = multiplier×开仓成本 → 价差移动 = multiplier×|价格-止损| */
function calcTakeProfit(open, stop, multiplier = 1) {
  const stopDiff = Math.abs(open - stop);
  const m = Number(multiplier);
  if (!(stopDiff > 0) || !Number.isFinite(m) || m <= 0) return null;
  const move = stopDiff * m;
  const raw = open > stop ? open + move : open - move;
  return clampPriceAtZero(raw);
}

/** 顺势而为止盈：以 from→to 为 1 倍空间，默认 2 倍 */
function calcAssistTakeProfitPrice(from, to, multiple = ASSIST_TAKE_PROFIT_MULTIPLE) {
  const start = Number(from);
  const end = Number(to);
  const m = Number(multiple);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end || !Number.isFinite(m) || m <= 0) {
    return null;
  }
  const tp = start + m * (end - start);
  return Number.isFinite(tp) && tp > 0 ? tp : null;
}

function getPriceDecimalPlacesFromValues(...values) {
  return values.reduce((max, value) => {
    const places = getDecimalPlacesFromInput(String(value ?? ''));
    return Math.max(max, places);
  }, 0);
}

function getAdminPriceDecimalPlacesFromRow(row) {
  const inputDecimals = getPriceDecimalPlacesFromValues(row?.inputPrice, row?.inputStopLoss);
  const storedDecimals = getPriceDecimalPlacesFromValues(
    row?.entryPrice,
    row?.stopLossPrice,
    row?.takeProfitPrice,
    ...(Array.isArray(row?.concessions) ? row.concessions.map((item) => item?.price) : []),
  );
  return Math.max(inputDecimals, storedDecimals);
}

function normalizeReferenceTakeProfitPrice(price) {
  return clampPriceAtZero(price);
}

function buildReferenceTakeProfitLabel(entryPrice, stopLoss, decimalPlaces) {
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopLoss);
  if (entry == null || stop == null || entry === stop) return '—';
  const tp = calcTakeProfit(entry, stop, REF_TAKE_PROFIT_R);
  if (tp == null) return '—';
  const normalized = normalizeReferenceTakeProfitPrice(tp);
  if (normalized == null) return '—';
  const decimals = decimalPlaces ?? getPriceDecimalPlacesFromValues(entryPrice, stopLoss);
  return formatTrimmedFixedDecimals(normalized, decimals);
}

function buildAdminReferenceTakeProfitLabel(entryPrice, stopLoss, decimalPlaces = 0) {
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopLoss);
  if (entry == null || stop == null || entry === stop) return '—';
  const tp = calcTakeProfit(entry, stop, REF_TAKE_PROFIT_R);
  if (tp == null) return '—';
  const normalized = normalizeReferenceTakeProfitPrice(tp);
  if (normalized == null) return '—';
  const decimals = Math.max(0, Math.min(20, Math.floor(Number(decimalPlaces) || 0)));
  return formatTrimmedFixedDecimals(normalized, decimals);
}

/** 趋势立项最佳止盈点位：5R，方向随多空（开>止为多，开<止为空） */
function buildAdminBestTakeProfitLabel(entryPrice, stopLoss, decimalPlaces = 0) {
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopLoss);
  if (entry == null || stop == null || entry === stop) return '—';
  const tp = calcTakeProfit(entry, stop, BEST_TAKE_PROFIT_R);
  if (tp == null) return '—';
  const normalized = normalizeReferenceTakeProfitPrice(tp);
  if (normalized == null) return '—';
  const decimals = Math.max(0, Math.min(20, Math.floor(Number(decimalPlaces) || 0)));
  return formatTrimmedFixedDecimals(normalized, decimals);
}

function renderAdminTakeProfitStopHtml(takeProfitLabel, stopLossLabel, { name, endAt } = {}) {
  const tpRaw = String(takeProfitLabel ?? '').trim() || '—';
  const slRaw = String(stopLossLabel ?? '').trim() || '—';
  const alarmText = buildAlarmCopyText(name, endAt);

  const renderBlock = (modClass, label, value, ariaLabel, { copyable = true } = {}) => {
    const text = String(value ?? '').trim() || '—';
    const canCopy = copyable && Boolean(text && text !== '—');
    const className = `admin-item__tp-sl-item ${modClass}${canCopy ? ' admin-copy-value' : ''}`.trim();
    const tag = canCopy ? 'button' : 'span';
    const copyAttrs = canCopy
      ? ` type="button" data-copy-text="${escapeHtml(text)}" title="点击复制" aria-label="复制${escapeHtml(label)} ${escapeHtml(text)}"`
      : ` aria-label="${escapeHtml(ariaLabel)}"`;
    return `<${tag} class="${className}"${copyAttrs}><span class="admin-item__tp-sl-label">${escapeHtml(label)}</span><span class="admin-item__tp-sl-value">${escapeHtml(text)}</span></${tag}>`;
  };

  const copyHtml = alarmText
    ? [
      '<span class="admin-item__tp-sl-item admin-item__tp-sl-copy-wrap">',
      '<button type="button" class="admin-edit-btn admin-copy-value"',
      ` data-copy-text="${escapeHtml(alarmText)}"`,
      ' title="点击复制闹钟指令"',
      ' aria-label="复制闹钟指令">指令</button>',
      '</span>',
    ].join('')
    : '<span class="admin-item__tp-sl-item admin-item__tp-sl-spacer" aria-hidden="true"></span>';

  return [
    '<div class="admin-item__tp-sl" aria-label="止盈止损">',
    copyHtml,
    renderBlock('admin-item__tp-sl-item--tp', '止盈', tpRaw, '止盈价格'),
    renderBlock('admin-item__tp-sl-item--sl', '止损', slRaw, '止损价格'),
    '</div>',
  ].join('');
}

function buildAlarmCopyText(name, endAt) {
  const title = formatStrategyCardTitle(name);
  const time = formatCompactDateTimeLabel(endAt);
  if (!title || !time) return '';
  return `请加一个${time}点的闹钟，名称为${title}`;
}

function calcAdjustedOpenPrice(open, stop, decimalPlaces) {
  return Number(formatFixedDecimals(open, decimalPlaces));
}

/** 趋势立项让利价；reverse 仅用于兼容旧数据重算 */
function calcConcessionalEntryPrice(entryPrice, stopLoss, rate, decimalPlaces, reverse = false) {
  const stopDiff = Math.abs(entryPrice - stopLoss);
  if (!(stopDiff > 0) || !Number.isFinite(rate)) return null;
  const awayFromStop = entryPrice > stopLoss ? 1 : -1;
  const direction = reverse ? -awayFromStop : awayFromStop;
  const price = clampPriceAtZero(entryPrice + direction * rate * stopDiff);
  if (price == null) return null;
  return Number(formatFixedDecimals(price, decimalPlaces));
}

function calcQuantityByRisk(openCost, entryPrice, stopLoss) {
  const stopDiff = Math.abs(entryPrice - stopLoss);
  if (!(stopDiff > 0) || openCost == null || !(openCost > 0)) return null;
  return openCost / stopDiff;
}

function isDisplayRateConfig(rateConfig) {
  const { rate, display } = normalizeConcessionRateConfig(rateConfig);
  return Number(rate) !== 0 || display === true;
}

function isFundedRateConfig(rateConfig) {
  const config = normalizeConcessionRateConfig(rateConfig);
  return !config.reuseMinTierCost && isDisplayRateConfig(rateConfig);
}

function countDisplayRateConfigs(rates) {
  if (!Array.isArray(rates)) return 0;
  return rates.filter(isDisplayRateConfig).length;
}

function countFundedRateConfigs(rates) {
  if (!Array.isArray(rates)) return 0;
  return rates.filter(isFundedRateConfig).length;
}

function getMinFundedTierCostShare(rates) {
  if (!Array.isArray(rates) || !rates.length) return null;
  const funded = rates
    .map((rateConfig) => normalizeConcessionRateConfig(rateConfig))
    .filter((config) => !config.reuseMinTierCost && Number.isFinite(config.rate));
  if (!funded.length) return null;
  funded.sort((a, b) => a.rate - b.rate);
  const minFunded = funded[0];
  if (minFunded.costShare != null) return minFunded.costShare;
  const fundedCount = countFundedRateConfigs(rates);
  return fundedCount > 0 ? 1 / fundedCount : null;
}

function getTierOpenCostBudget(openCostTotal, costShare) {
  const total = Number(openCostTotal);
  const share = Number(costShare);
  if (!(total > 0) || !(share > 0)) return null;
  return total * share;
}

function resolveTierOpenCost(openCostTotal, costShare, fixedTierOpenCost = null) {
  const fixed = Number(fixedTierOpenCost);
  if (Number.isFinite(fixed) && fixed > 0) return fixed;
  return getTierOpenCostBudget(openCostTotal, costShare);
}

function formatConcessionPercent(rate) {
  const pct = Math.round(Number(rate) * 100);
  if (!Number.isFinite(pct)) return '—';
  return `${String(pct).padStart(2, '0')}%`;
}

function formatCounterTrendRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-9) return `${rounded}R`;
  return `${String(Number(n.toFixed(2)))}R`;
}

/** 0% / 10% / 20% / 30% 统一标记为 best三选一 */
const BEST_CONCESSION_RATE_MAX = 0.3;

function isBestConcessionRate(rate) {
  const n = Number(rate);
  return Number.isFinite(n) && n <= BEST_CONCESSION_RATE_MAX + 1e-9;
}

function withBestConcessionLabel(label, rate) {
  const text = String(label ?? '');
  if (!isBestConcessionRate(rate)) return text;
  if (
    text.includes('（best三选一）')
    || text.includes('（best）')
    || text.includes('（鱼头）')
    || text.includes('（鱼头三选一）')
    || text.includes('（鱼尾）')
  ) return text;
  return `${text}（best三选一）`;
}

function stripRateAnnotation(label) {
  return String(label ?? '').replace(/\s*[（(][^）)]*[）)]/g, '').trim();
}

function getDisplayConcessionItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => Number(item.rate) !== 0 || item.display === true)
    .slice()
    .sort((a, b) => Number(a.rate) - Number(b.rate));
}

function normalizeConcessionRateConfig(rateConfig) {
  if (rateConfig && typeof rateConfig === 'object') {
    const costShare = Number(rateConfig.costShare);
    return {
      rate: Number(rateConfig.rate),
      display: rateConfig.display === true,
      costShare: Number.isFinite(costShare) && costShare > 0 ? costShare : null,
      reuseMinTierCost: rateConfig.reuseMinTierCost === true,
    };
  }
  return {
    rate: Number(rateConfig),
    display: false,
    costShare: null,
    reuseMinTierCost: false,
  };
}

function buildConcessionItems(entryPrice, stopLoss, openCostTotal, decimalPlaces, rates = getConcessionRates(), reverse = false, options = {}) {
  const fixedTierOpenCost = options?.fixedTierOpenCost ?? null;
  const fundedCount = countFundedRateConfigs(rates);
  const minFundedShare = getMinFundedTierCostShare(rates);
  const items = [];
  const rawQtys = [];
  for (const rateConfig of rates) {
    const { rate, display, costShare, reuseMinTierCost } = normalizeConcessionRateConfig(rateConfig);
    const price = calcConcessionalEntryPrice(entryPrice, stopLoss, rate, decimalPlaces, reverse);
    const share = reuseMinTierCost
      ? minFundedShare
      : (costShare != null ? costShare : (fundedCount > 0 ? 1 / fundedCount : null));
    const tierOpenCost = share != null && share > 0
      ? resolveTierOpenCost(openCostTotal, share, fixedTierOpenCost)
      : null;
    const qty = price == null ? null : calcQuantityByRisk(tierOpenCost, price, stopLoss);
    if (price == null || qty == null) continue;
    const item = {
      rate,
      price: formatTrimmedFixedDecimals(price, decimalPlaces),
      quantity: '',
    };
    if (display) item.display = true;
    if (reuseMinTierCost) item.reuseMinTierCost = true;
    items.push(item);
    rawQtys.push(qty);
  }
  return applyDatasetQuantityFormat(items, rawQtys);
}

function reverseConcessionPriceQty(displayItems) {
  if (!Array.isArray(displayItems) || displayItems.length < 2) return displayItems;
  const prices = displayItems.map((item) => item.price);
  const quantities = displayItems.map((item) => item.quantity);
  prices.reverse();
  quantities.reverse();
  return displayItems.map((item, index) => ({
    ...item,
    price: prices[index],
    quantity: quantities[index],
  }));
}

function isCounterTrendHighRate(rate) {
  const n = Number(rate);
  return Number.isFinite(n) && n > COUNTER_TREND_COLLAPSED_MAX_RATE + 1e-9;
}

function isCounterTrendRatesExpanded(strategyId) {
  return expandedCounterTrendIds.has(String(strategyId ?? '').trim());
}

function filterCounterTrendConcessionItems(items, expanded) {
  if (!Array.isArray(items)) return [];
  if (expanded) return items;
  return items.filter((item) => !isCounterTrendHighRate(item?.rate));
}

function renderCounterTrendFoldLinkHtml(strategyId) {
  const id = escapeHtml(String(strategyId ?? '').trim());
  if (!id) return '';
  const expanded = isCounterTrendRatesExpanded(strategyId);
  const label = expanded ? '收起' : '展开';
  const action = expanded ? 'collapse' : 'expand';
  return `<button type="button" class="admin-concession__fold-link" data-counter-fold="${action}" data-id="${id}" aria-expanded="${expanded ? 'true' : 'false'}" aria-label="${expanded ? '收起至50R' : '展开至100R'}">${label}<span class="admin-concession__fold-caret" aria-hidden="true">${expanded ? '▴' : '▾'}</span></button>`;
}

function renderCounterTrendSideActionsHtml() {
  return '<span class="admin-concession__actions"></span>';
}

function getCounterTrendDisplayItems(row) {
  const { items } = buildCounterTrendConcessions(row);
  return getDisplayConcessionItems(items).slice().reverse();
}

function findCounterTrendNeighborPrices(row, rate, price) {
  const displayItems = getCounterTrendDisplayItems(row).filter((item) => !item?.isMidpoint);
  if (!displayItems.length) return null;
  const rateNum = Number(rate);
  const priceNum = toNumber(price);
  let index = displayItems.findIndex((item) => (
    Number.isFinite(rateNum) && Math.abs(Number(item.rate) - rateNum) < 1e-9
  ));
  if (index < 0 && priceNum != null) {
    index = displayItems.findIndex((item) => toNumber(item.price) === priceNum);
  }
  if (index < 0) return null;
  const current = displayItems[index];
  const above = index > 0 ? displayItems[index - 1] : null;
  const below = index < displayItems.length - 1 ? displayItems[index + 1] : null;
  return {
    currentPrice: toNumber(current?.price),
    abovePrice: toNumber(above?.price),
    belowPrice: toNumber(below?.price),
    currentRate: Number(current?.rate),
    decimalPlaces: getAdminPriceDecimalPlacesFromRow(row),
  };
}

function buildTierAssistRecord({
  parentRow,
  side,
  entryPrice,
  stopLoss,
  takeProfit,
  rate,
  decimalPlaces,
}) {
  const name = String(parentRow?.strategyName ?? '').trim() || 'test';
  const openCostTotal = getOpenCostTotal();
  const concessionItems = buildConcessionItems(
    entryPrice,
    stopLoss,
    openCostTotal,
    decimalPlaces,
    TIER_ASSIST_RATES,
    false,
    { fixedTierOpenCost: getAdminTierFixedOpenCost() },
  );
  if (!concessionItems.length) return null;
  const primaryItem = concessionItems[0];
  const entryLabel = formatTrimmedFixedDecimals(entryPrice, decimalPlaces);
  const stopLabel = formatTrimmedFixedDecimals(stopLoss, decimalPlaces);
  const tpLabel = formatTrimmedFixedDecimals(takeProfit, decimalPlaces);
  const sideLabel = side === 'short' ? '做空' : '做多';
  const rateLabel = Number.isFinite(Number(rate)) ? `${Math.round(Number(rate))}R` : '';
  const timeRange = getCounterTrendTimeRange(parentRow);
  const timeframe = normalizeTimeframeMode(parentRow?.timeframe);
  const timeframeMinutes = Number(parentRow?.timeframeMinutes) > 0
    ? Number(parentRow.timeframeMinutes)
    : getTimeframeMinutes(timeframe);
  const validPeriods = STRATEGY_DURATION_PERIODS;
  const durationMinutes = timeframeMinutes * validPeriods;
  const description = [
    `挡位辅助·${sideLabel}`,
    rateLabel ? `来源 ${rateLabel}` : '',
    String(parentRow?.description ?? '').trim(),
  ].filter(Boolean).join('；');

  return {
    strategyName: name,
    description,
    positionSide: side,
    inputPrice: entryLabel,
    inputStopLoss: stopLabel,
    entryPrice: primaryItem.price,
    quantity: primaryItem.quantity,
    takeProfitPrice: tpLabel,
    stopLossPrice: stopLabel,
    openCost: getAdminTierFixedOpenCost(),
    openCostMultiplier: OPEN_COST_MULTIPLIER_DEFAULT,
    openCostTotal,
    tierCount: TIER_ASSIST_RATES.length,
    tradeMode: TRADE_MODE_NORMAL,
    grade: getStrategyGradeFromOpenCost(getAdminTierFixedOpenCost(), openCostTotal, TIER_ASSIST_RATES.length),
    priceAdjustmentRate: 0,
    priceAdjustment: '0',
    concessions: concessionItems,
    takeProfitRMultiple: TIER_ASSIST_TAKE_PROFIT_MULTIPLE,
    timeframe,
    timeframeMinutes,
    timeframeLabel: getTimeframeLabel(timeframe),
    validPeriods,
    durationMinutes,
    startAt: timeRange?.startAt ? timeRange.startAt.toISOString() : null,
    expiresAt: timeRange?.endAt ? timeRange.endAt.toISOString() : null,
    outcomeStatus: 'pending',
    viewMode: STRATEGY_VIEW_MODE_TREND,
  };
}

let isCreatingTierAssist = false;

function collectTierAssistIdsByName(rows, strategyName) {
  const key = getStrategyNameKey(strategyName);
  if (!key || key === '未命名') return [];
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => getStrategyNameKey(row?.strategyName) === key)
    .filter((row) => getAdminStrategyTypeInfo(row).type === 'tier_assist')
    .map((row) => String(row?.id ?? '').trim())
    .filter(Boolean);
}

async function deleteExistingTierAssistsForName(strategyName) {
  const rawName = String(strategyName ?? '').trim();
  const key = getStrategyNameKey(rawName);
  if (!key || key === '未命名') return 0;

  let ids = collectTierAssistIdsByName(latestAdminRows, rawName);
  try {
    const params = [
      'select=id,strategy_name,concessions,take_profit_r_multiple',
      'order=created_at.desc',
    ];
    if (rawName) {
      params.push(`strategy_name=ilike.${encodeURIComponent(rawName)}`);
    }
    const res = await supabaseFetch(`${STRATEGIES_ENDPOINT}?${params.join('&')}`, {
      headers: getSupabaseHeaders(),
    });
    if (res.ok) {
      const rows = await res.json();
      const mapped = Array.isArray(rows) ? rows.map(fromDbRecord) : [];
      ids = Array.from(new Set([
        ...ids,
        ...collectTierAssistIdsByName(mapped, rawName),
      ]));
    }
  } catch (err) {
    console.error('[tier-assist-lookup]', err);
  }

  if (!ids.length) return 0;
  await deleteStrategies(ids);
  return ids.length;
}

async function createTierAssistFromCounterAction(parentRow, side, rate, price) {
  if (isCreatingTierAssist) return;
  const parentId = String(parentRow?.id ?? '').trim();
  if (!parentId) return;
  const neighbors = findCounterTrendNeighborPrices(parentRow, rate, price);
  if (!neighbors || neighbors.currentPrice == null) {
    showToast('无法定位当前挡位');
    return;
  }
  const entryPrice = neighbors.currentPrice;
  const neighborForStop = side === 'long' ? neighbors.belowPrice : neighbors.abovePrice;
  const takeProfit = side === 'long' ? neighbors.abovePrice : neighbors.belowPrice;
  if (neighborForStop == null || takeProfit == null) {
    showToast('缺少相邻挡位价格，无法切换');
    return;
  }
  // 做多：止损 = 本行与下方行 50%；做空：止损 = 本行与上方行 50%
  const stopLoss = (entryPrice + neighborForStop) / 2;
  if (side === 'long') {
    if (!(entryPrice > stopLoss) || !(takeProfit > entryPrice)) {
      showToast('做多需满足：止损 < 开仓 < 止盈');
      return;
    }
  } else if (!(entryPrice < stopLoss) || !(takeProfit < entryPrice)) {
    showToast('做空需满足：止盈 < 开仓 < 止损');
    return;
  }

  const decimalPlaces = Math.max(3, neighbors.decimalPlaces || 0);
  const nextViewState = {
    ...normalizeViewState(parentRow?.viewState),
    tierAssist: {
      side,
      rate: neighbors.currentRate ?? rate,
      entryPrice: formatTrimmedFixedDecimals(entryPrice, decimalPlaces),
      stopLoss: formatTrimmedFixedDecimals(stopLoss, decimalPlaces),
      takeProfit: formatTrimmedFixedDecimals(takeProfit, decimalPlaces),
    },
  };

  isCreatingTierAssist = true;
  try {
    const ok = await setAdminStrategyViewMode(parentId, parentRow, STRATEGY_VIEW_MODE_TIER_ASSIST, {
      viewState: nextViewState,
    });
    if (ok) {
      const sideLabel = side === 'long' ? '做多' : '做空';
      showToast(`已切换挡位辅助（${sideLabel}）`);
    }
  } finally {
    isCreatingTierAssist = false;
  }
}

function renderConcessionRowHtml({
  rowClass,
  item,
  rateLabel,
  stop,
  hideQuantity = false,
  hideStop = false,
  strikeRate = false,
  copyableNumbers = false,
  extraClass = '',
  sideActionsHtml = '',
  selectable = false,
  strategyId = '',
}) {
  const rateClass = strikeRate
    ? `${rowClass}__rate ${rowClass}__rate--strike`
    : `${rowClass}__rate`;
  const priceHtml = copyableNumbers
    ? renderCopyableNumberHtml(item.price, `${rowClass}__price`)
    : `<span class="${rowClass}__price">${escapeHtml(item.price)}</span>`;
  const hasSideActions = Boolean(String(sideActionsHtml ?? '').trim());
  const qtyHtml = hasSideActions
    ? sideActionsHtml
    : (hideQuantity
      ? `<span class="${rowClass}__qty"></span>`
      : (copyableNumbers
        ? renderCopyableNumberHtml(item.quantity, `${rowClass}__qty`)
        : `<span class="${rowClass}__qty">${escapeHtml(item.quantity)}</span>`));
  const stopHtml = hideStop
    ? ''
    : (copyableNumbers
      ? renderCopyableNumberHtml(stop, `${rowClass}__stop`)
      : `<span class="${rowClass}__stop">${stop}</span>`);
  const selectableClass = selectable ? ` ${rowClass}--selectable is-selectable` : '';
  const rowExtra = extraClass ? ` ${extraClass}` : '';
  const rateNum = Number(item?.rate);
  const rateSelectClass = selectable ? ` ${rowClass}__rate--select` : '';
  const rateSelectAttrs = selectable
    ? [
      ' data-admin-concession-select',
      ` data-id="${escapeHtml(String(strategyId ?? '').trim())}"`,
      ` data-rate="${escapeHtml(Number.isFinite(rateNum) ? String(rateNum) : '')}"`,
      ` data-price="${escapeHtml(String(item?.price ?? '').trim())}"`,
      ' role="button"',
      ' tabindex="0"',
      ' title="点击设为当前"',
    ].join('')
    : '';
  return [
    `<div class="${rowClass}${selectableClass}${rowExtra}">`,
    `<span class="${rateClass}${rateSelectClass}"${rateSelectAttrs}>${escapeHtml(rateLabel)}</span>`,
    priceHtml,
    qtyHtml,
    stopHtml,
    '</div>',
  ].join('');
}

function getConcessionBoundaryZone(item, boundary) {
  if (!boundary) return 'none';
  if (typeof boundary.getZone === 'function') return boundary.getZone(item) || 'none';
  if (boundary.rate != null && Number.isFinite(Number(item?.rate))) {
    const r = Number(item.rate);
    return r >= Number(boundary.rate) - 1e-9 ? 'beyond' : 'within';
  }
  return 'none';
}

function renderBoundaryGroupedRows(displayItems, buildRow, prefix, boundary) {
  const chunks = [];
  let zone = null;
  let bucket = [];
  const flush = () => {
    if (!bucket.length || !zone || zone === 'none') {
      if (bucket.length) chunks.push(bucket.map(buildRow).join(''));
      bucket = [];
      return;
    }
    if (zone === 'beyond') {
      chunks.push([
        `<div class="${prefix}-concession-beyond-group" aria-label="10R以上">`,
        bucket.map(buildRow).join(''),
        '</div>',
      ].join(''));
    } else {
      chunks.push([
        `<div class="${prefix}-concession-within-group" aria-label="10R以内">`,
        bucket.map(buildRow).join(''),
        '</div>',
      ].join(''));
    }
    bucket = [];
  };
  for (const item of displayItems) {
    const nextZone = getConcessionBoundaryZone(item, boundary);
    if (zone != null && nextZone !== zone) flush();
    zone = nextZone;
    bucket.push(item);
  }
  flush();
  return chunks.join('');
}

function renderConcessionsHtml({
  prefix,
  items,
  stopLabel,
  stopHeaderLabel = '止损价格',
  rateHeaderLabel = '让利',
  rateHeaderSuffixHtml = '',
  qtyHeaderPrefixHtml = '',
  qtyHeaderLabel = null,
  wrapperClass,
  reverseOrder = false,
  reversePriceQty = false,
  assistLabels = false,
  formatRate = formatConcessionPercent,
  groupBestPeers = false,
  hideStopColumn = false,
  boundary = null,
  sideActionsMode = false,
  sideActionsStrategyId = '',
  actionsHeaderHtml = '',
  selectableStrategyId = '',
  isCurrentItem = null,
}) {
  let displayItems = getDisplayConcessionItems(items);
  if (reverseOrder) displayItems = displayItems.slice().reverse();
  if (reversePriceQty) displayItems = reverseConcessionPriceQty(displayItems);
  if (!displayItems.length) return '';
  const stop = escapeHtml(String(stopLabel ?? '').trim() || '—');
  const stopHeader = escapeHtml(String(stopHeaderLabel ?? '').trim() || '止损价格');
  const rateHeader = escapeHtml(String(rateHeaderLabel ?? '').trim() || '让利');
  const rowClass = `${prefix}-concession`;
  const rateFormatter = assistLabels
    ? (rate) => getAssistTierLabel(rate)
    : formatRate;
  let wrapper = hideStopColumn
    ? `${wrapperClass} ${wrapperClass}--no-stop`.trim()
    : wrapperClass;
  if (sideActionsMode) {
    wrapper = `${wrapper} ${wrapperClass}--side-actions`.trim();
  }
  const useBoundary = Boolean(boundary);
  const selectId = String(selectableStrategyId || sideActionsStrategyId || '').trim();

  const buildRow = (item) => {
    const formatted = item?.isMidpoint
      ? ''
      : (item?.rateLabel ? String(item.rateLabel) : rateFormatter(item.rate));
    const rateLabel = prefix === 'admin'
      ? stripRateAnnotation(formatted)
      : withBestConcessionLabel(formatted, item.rate);
    const useSideActions = sideActionsMode || item.showSideActions === true;
    const isCurrent = typeof isCurrentItem === 'function'
      ? Boolean(isCurrentItem(item))
      : false;
    const selectable = Boolean(prefix === 'admin' && selectId && !item?.isMidpoint);
    const extraClass = [
      isCurrent ? `${rowClass}--current is-current` : '',
      item?.isMidpoint ? `${rowClass}--mid` : '',
    ].filter(Boolean).join(' ');
    return renderConcessionRowHtml({
      rowClass,
      item,
      rateLabel,
      stop,
      hideQuantity: item.hideQuantity === true
        || useSideActions
        || (assistLabels && prefix !== 'admin' && shouldHideAssistQuantity(item.rate)),
      hideStop: hideStopColumn,
      strikeRate: assistLabels && shouldHideAssistQuantity(item.rate),
      copyableNumbers: prefix === 'admin',
      extraClass,
      sideActionsHtml: useSideActions && prefix === 'admin'
        ? renderCounterTrendSideActionsHtml()
        : '',
      selectable,
      strategyId: selectId,
    });
  };

  let bodyHtml = '';
  if (useBoundary) {
    bodyHtml = renderBoundaryGroupedRows(displayItems, buildRow, prefix, boundary);
  } else if (groupBestPeers) {
    const chunks = [];
    let bestChunk = [];
    const flushBest = () => {
      if (!bestChunk.length) return;
      chunks.push([
        `<div class="${prefix}-concession-best-group" aria-label="平级三选一">`,
        bestChunk.map(buildRow).join(''),
        '</div>',
      ].join(''));
      bestChunk = [];
    };
    for (const item of displayItems) {
      if (isBestConcessionRate(item.rate)) {
        bestChunk.push(item);
      } else {
        flushBest();
        chunks.push(buildRow(item));
      }
    }
    flushBest();
    bodyHtml = chunks.join('');
  } else {
    bodyHtml = displayItems.map(buildRow).join('');
  }

  const suffixHtml = String(rateHeaderSuffixHtml ?? '').trim();
  const rateHeaderInner = suffixHtml
    ? `${rateHeader}${suffixHtml}`
    : rateHeader;
  const qtyPrefixHtml = String(qtyHeaderPrefixHtml ?? '').trim();
  const qtyHeaderInner = qtyHeaderLabel != null
    ? escapeHtml(String(qtyHeaderLabel))
    : (qtyPrefixHtml ? `${qtyPrefixHtml}数量` : '数量');

  return [
    `<div class="${wrapper}" aria-label="${assistLabels ? '顺势而为位置' : '让利档位'}">`,
    `<div class="${rowClass} ${rowClass}--head">`,
    `<span class="${rowClass}__rate">${rateHeaderInner}</span>`,
    `<span class="${rowClass}__price">价格</span>`,
    sideActionsMode
      ? `<span class="${rowClass}__actions">${String(actionsHeaderHtml ?? '').trim() || qtyHeaderInner}</span>`
      : `<span class="${rowClass}__qty">${qtyHeaderInner}</span>`,
    hideStopColumn ? '' : `<span class="${rowClass}__stop">${stopHeader}</span>`,
    '</div>',
    bodyHtml,
    '</div>',
  ].join('');
}

function formatAdminConcessionItems(items, priceDecimalPlaces = 0) {
  if (!Array.isArray(items)) return [];
  const decimals = getQuantityDecimalsFromDataset(items.map((item) => item?.quantity));
  return items.map((item) => ({
    ...item,
    price: formatAdminPriceFromValue(item?.price, priceDecimalPlaces),
    quantity: formatQuantityFromValue(item?.quantity, decimals),
  }));
}

function renderAdminConcessionsHtml(concessions, stopLabel, options = {}) {
  const priceDecimalPlaces = options.priceDecimalPlaces ?? 0;
  const hideStopColumn = options.hideStopColumn !== false;
  return renderConcessionsHtml({
    prefix: 'admin',
    items: formatAdminConcessionItems(concessions, priceDecimalPlaces),
    stopLabel: hideStopColumn ? '' : formatAdminPriceFromValue(stopLabel, priceDecimalPlaces),
    stopHeaderLabel: options.stopHeaderLabel,
    rateHeaderLabel: options.rateHeaderLabel,
    rateHeaderSuffixHtml: options.rateHeaderSuffixHtml,
    qtyHeaderPrefixHtml: options.qtyHeaderPrefixHtml,
    qtyHeaderLabel: options.qtyHeaderLabel,
    wrapperClass: 'admin-item__concessions',
    reversePriceQty: options.reversePriceQty === true,
    reverseOrder: options.reverseOrder === true,
    assistLabels: options.assistLabels === true,
    formatRate: options.formatRate,
    groupBestPeers: options.groupBestPeers !== false && !options.boundary,
    hideStopColumn,
    boundary: options.boundary || null,
    sideActionsMode: options.sideActionsMode === true,
    sideActionsStrategyId: options.sideActionsStrategyId || '',
    actionsHeaderHtml: options.actionsHeaderHtml || '',
    selectableStrategyId: options.selectableStrategyId || options.sideActionsStrategyId || '',
    isCurrentItem: typeof options.isCurrentItem === 'function' ? options.isCurrentItem : null,
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

function buildTrendFollowingStrategy(open, stop, startTimeValue, startTimeLabel, openCost, priceDecimalPlaces, tradeMode = getTradeMode()) {
  const timeframe = getTimeframeMode();
  const unitMin = getTimeframeMinutes(timeframe);
  const spanMinutes = unitMin * STRATEGY_DURATION_PERIODS;
  const reverse = false;
  const adjustedOpen = calcAdjustedOpenPrice(open, stop, priceDecimalPlaces);
  const openCostMultiplier = OPEN_COST_MULTIPLIER_DEFAULT;
  const openCostTotal = getOpenCostTotal(openCostMultiplier) ?? openCost * DEFAULT_TIER_COUNT;
  const quantity = calcQuantityByRisk(openCost, adjustedOpen, stop);
  const primaryConcessionalPrice = calcConcessionalEntryPrice(adjustedOpen, stop, PRICE_ADJUSTMENT_RATE, priceDecimalPlaces, reverse);
  const priceAdjustment = primaryConcessionalPrice == null ? 0 : Math.abs(adjustedOpen - primaryConcessionalPrice);
  const tp = calcTakeProfit(adjustedOpen, stop, TAKE_PROFIT_R_MULTIPLE);
  const tpDecimals = Math.max(0, priceDecimalPlaces);

  const nameEl = document.getElementById('name-input');
  const name = String(nameEl?.value ?? '').trim();
  const side = adjustedOpen > stop ? 'long' : 'short';
  const alarmName = name || 'test';
  const startAt = getStartDateTime(startTimeValue);
  const endAt = addPeriodToStart(startTimeValue, spanMinutes);

  const priceLabel = formatTrimmedFixedDecimals(adjustedOpen, priceDecimalPlaces);
  const tpLabel = formatTrimmedFixedDecimals(tp, tpDecimals);
  const stopLabel = formatPrice(stop);
  const concessionRates = getConcessionRates();
  const concessionItems = buildConcessionItems(adjustedOpen, stop, openCostTotal, priceDecimalPlaces, concessionRates, reverse);
  const primaryItem = concessionItems.find((item) => Math.abs(Number(item.rate) - PRICE_ADJUSTMENT_RATE) < 1e-9);
  const qty = primaryItem?.quantity ?? formatQuantity(quantity);

  const copyText = buildStrategyCopyText({
    name: alarmName,
    price: priceLabel,
    quantity: qty,
    takeProfit: tpLabel,
    stopLoss: stopLabel,
    description: getStrategyDescription('trend'),
  });
  const record = {
    strategyName: alarmName,
    description: getStrategyDescription('trend'),
    positionSide: side,
    inputPrice: formatPrice(open),
    inputStopLoss: formatPrice(stop),
    entryPrice: priceLabel,
    quantity: qty,
    takeProfitPrice: tpLabel,
    stopLossPrice: stopLabel,
    openCost,
    openCostMultiplier,
    openCostTotal,
    tierCount: DEFAULT_TIER_COUNT,
    tradeMode,
    grade: getStrategyGradeFromOpenCost(openCost, openCostTotal, DEFAULT_TIER_COUNT),
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
    viewMode: STRATEGY_VIEW_MODE_TREND,
  };

  return { copyText, record };
}

function buildStrategy(open, stop, startTimeValue, startTimeLabel, openCost, priceDecimalPlaces, tradeMode = getTradeMode()) {
  return buildTrendFollowingStrategy(open, stop, startTimeValue, startTimeLabel, openCost, priceDecimalPlaces, tradeMode);
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
  const tradeMode = getTradeMode();

  if (errEl) errEl.textContent = '';

  if (open === null || stop === null) {
    if (errEl) errEl.textContent = '请输入有效的开始价格与止损价格（数字）。';
    clearStrategyState();
    return;
  }

  if (open <= 0 || stop <= 0) {
    if (errEl) errEl.textContent = '开始价格和止损价格须为大于 0 的数字。';
    clearStrategyState();
    return;
  }

  if (openCost === null) {
    if (errEl) errEl.textContent = '请输入有效的开仓成本（大于 0 的数字）。';
    clearStrategyState();
    return;
  }

  if (open === stop) {
    if (errEl) errEl.textContent = '开始价格与止损价格不能相同，无法计算数量与方向。';
    clearStrategyState();
    return;
  }

  const openRaw = openEl && 'value' in openEl ? String(openEl.value) : '';
  const stopRaw = stopEl && 'value' in stopEl ? String(stopEl.value) : '';
  const priceDecimals = Math.max(getDecimalPlacesFromInput(openRaw), getDecimalPlacesFromInput(stopRaw)) + 1;
  const adjustedOpen = calcAdjustedOpenPrice(open, stop, priceDecimals);
  const takeProfit = calcTakeProfit(adjustedOpen, stop, TAKE_PROFIT_R_MULTIPLE);
  if (!Number.isFinite(adjustedOpen) || adjustedOpen <= 0 || takeProfit == null) {
    if (errEl) errEl.textContent = '开始价格无效，请检查开始价格与止损价格。';
    clearStrategyState();
    return;
  }
  const strategy = buildStrategy(open, stop, startTime, startTimeLabel, openCost, priceDecimals, tradeMode);
  setStrategyState(strategy);
  logSave('info', '策略已生成，可保存', {
    strategyName: strategy.record?.strategyName,
    hasCopyText: Boolean(strategy.copyText),
    hasRecord: Boolean(strategy.record),
    recordPreview: strategy.record,
  });
}

rebuildStartTimeOptions(null, { scope: 'trend' });
rebuildStartTimeOptions(null, { scope: 'assist' });
bindMobileTimePickerEvents();

const openInput = document.getElementById('open-price-input');
const stopInput = document.getElementById('stop-price-input');
const startTimeSelect = document.getElementById('start-time');
const assistStartTimeSelect = document.getElementById('assist-start-time');

function onEnter(e) {
  if (e.key === 'Enter') generate();
}
if (openInput) openInput.addEventListener('keydown', onEnter);
if (stopInput) stopInput.addEventListener('keydown', onEnter);
if (startTimeSelect) {
  startTimeSelect.addEventListener('keydown', onEnter);
  startTimeSelect.addEventListener('change', () => {
    updateStartTimeTriggerLabel('trend');
    setStartTimeUserPicked(true, 'trend');
    autoGenerateIfReady();
  });
}
if (assistStartTimeSelect) {
  assistStartTimeSelect.addEventListener('change', () => {
    updateStartTimeTriggerLabel('assist');
    setStartTimeUserPicked(true, 'assist');
    autoGenerateAssistIfReady();
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

function resetFrontPage() {
  closeMobileTimePicker();
  setStartTimeUserPicked(false, 'trend');
  clearEditingStrategy();
  setFrontTimeframeMode(DEFAULT_TIMEFRAME, { refresh: false, scope: 'trend' });
  rebuildStartTimeOptions(null, { scope: 'trend' });
  if (openInput) openInput.value = '';
  if (stopInput) stopInput.value = '';
  if (nameInput) nameInput.value = '';
  const remarkEl = document.getElementById('remark-input');
  if (remarkEl) remarkEl.value = '';
  const errEl = document.getElementById('error');
  if (errEl) errEl.textContent = '';
  clearStrategyState();
}

function clearAssistState() {
  currentAssistCopyText = '';
  currentAssistRecord = null;
}

function resetAssistPage() {
  const nameEl = document.getElementById('assist-name-input');
  const descEl = document.getElementById('assist-desc-input');
  const fromEl = document.getElementById('assist-from-input');
  const toEl = document.getElementById('assist-to-input');
  const errEl = document.getElementById('assist-error');
  if (nameEl) nameEl.value = '';
  if (descEl) descEl.value = '';
  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
  if (errEl) errEl.textContent = '';
  setStartTimeUserPicked(false, 'assist');
  setFrontTimeframeMode(DEFAULT_ASSIST_TIMEFRAME, { refresh: false, scope: 'assist' });
  rebuildStartTimeOptions(null, { scope: 'assist' });
  clearAssistState();
}

let currentFishCopyText = '';
let currentFishRecord = null;

function clearFishState() {
  currentFishCopyText = '';
  currentFishRecord = null;
}

function resetFishPage() {
  const nameEl = document.getElementById('fish-name-input');
  const fromEl = document.getElementById('fish-from-input');
  const toEl = document.getElementById('fish-to-input');
  const errEl = document.getElementById('fish-error');
  if (nameEl) nameEl.value = '';
  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
  if (errEl) errEl.textContent = '';
  clearFishState();
}

function buildAssistStrategy(from, to, openCostTotal, priceDecimalPlaces) {
  const nameEl = document.getElementById('assist-name-input');
  const name = String(nameEl?.value ?? '').trim() || 'test';
  const side = to > from ? 'long' : 'short';
  const stop = from;
  const takeProfit = calcAssistTakeProfitPrice(from, to);
  if (takeProfit == null) return null;
  const stopLabel = formatTrimmedFixedDecimals(stop, priceDecimalPlaces);
  const tpLabel = formatTrimmedFixedDecimals(takeProfit, priceDecimalPlaces);
  const concessionItems = buildAssistConcessionItems(from, to, openCostTotal, priceDecimalPlaces);
  if (!concessionItems.length) return null;
  const primaryItem = concessionItems[0];
  const timeframe = getTimeframeMode('assist');
  const unitMin = getTimeframeMinutes(timeframe);
  const spanMinutes = unitMin * ASSIST_DURATION_PERIODS;
  const timeEl = getStartTimeFieldEls('assist').sel;
  const startValue = timeEl && 'value' in timeEl ? String(timeEl.value).trim() : '';
  const startAt = startValue ? getStartDateTime(startValue) : null;
  const endAt = startValue ? addPeriodToStart(startValue, spanMinutes) : null;
  const openCostMultiplier = OPEN_COST_MULTIPLIER_DEFAULT;
  const openCost = openCostTotal / DEFAULT_TIER_COUNT;

  const description = getStrategyDescription('assist');
  const fromLabel = formatTrimmedFixedDecimals(from, priceDecimalPlaces);
  const copyText = [
    formatAssistStrategyTitle(name),
    ...concessionItems.map((item) => {
      const label = withBestConcessionLabel(getAssistTierLabel(item.rate), item.rate);
      return shouldHideAssistQuantity(item.rate)
        ? `${label}：${item.price}`
        : `${label}：${item.price} / ${item.quantity}`;
    }),
    `止盈价格：${tpLabel}`,
    `止损价格：${fromLabel}`,
    ...(description ? [`描述：${description}`] : []),
  ].join('\n');

  const record = {
    strategyName: name,
    description,
    positionSide: side,
    inputPrice: formatTrimmedFixedDecimals(from, priceDecimalPlaces),
    inputStopLoss: formatTrimmedFixedDecimals(to, priceDecimalPlaces),
    entryPrice: primaryItem.price,
    quantity: primaryItem.quantity,
    takeProfitPrice: tpLabel,
    stopLossPrice: stopLabel,
    openCost,
    openCostMultiplier,
    openCostTotal,
    tierCount: DEFAULT_TIER_COUNT,
    tradeMode: TRADE_MODE_NORMAL,
    grade: getStrategyGradeFromOpenCost(openCost, openCostTotal, DEFAULT_TIER_COUNT),
    priceAdjustmentRate: 0,
    priceAdjustment: '0',
    concessions: concessionItems,
    takeProfitRMultiple: ASSIST_TAKE_PROFIT_MULTIPLE,
    timeframe,
    timeframeMinutes: unitMin,
    timeframeLabel: getTimeframeLabel(timeframe),
    validPeriods: ASSIST_DURATION_PERIODS,
    durationMinutes: spanMinutes,
    startAt: startAt ? startAt.toISOString() : null,
    expiresAt: endAt ? endAt.toISOString() : null,
    outcomeStatus: 'pending',
    viewMode: STRATEGY_VIEW_MODE_TREND,
  };

  return { copyText, record };
}

function generateAssist() {
  const fromEl = document.getElementById('assist-from-input');
  const toEl = document.getElementById('assist-to-input');
  const timeEl = getStartTimeFieldEls('assist').sel;
  const errEl = document.getElementById('assist-error');
  const from = toNumber(fromEl && 'value' in fromEl ? fromEl.value : '');
  const to = toNumber(toEl && 'value' in toEl ? toEl.value : '');
  const startTime = timeEl && 'value' in timeEl ? String(timeEl.value).trim() : '';
  const openCostTotal = getOpenCostTotal();

  if (errEl) errEl.textContent = '';

  if (from == null || to == null) {
    if (errEl) errEl.textContent = '请输入有效的 from 与 to（数字）。';
    clearAssistState();
    return;
  }
  if (!(from > 0) || !(to > 0)) {
    if (errEl) errEl.textContent = 'from 和 to 须为大于 0 的数字。';
    clearAssistState();
    return;
  }
  if (from === to) {
    if (errEl) errEl.textContent = 'from 与 to 不能相同。';
    clearAssistState();
    return;
  }
  if (!startTime) {
    if (errEl) errEl.textContent = '请选择开始时间。';
    clearAssistState();
    return;
  }

  const priceDecimals = Math.max(3, getPriceDecimalPlacesFromValues(fromEl?.value, toEl?.value));
  const strategy = buildAssistStrategy(from, to, openCostTotal, priceDecimals);
  if (!strategy) {
    if (errEl) errEl.textContent = '无法生成顺势而为档位，请检查 from / to。';
    clearAssistState();
    return;
  }

  currentAssistCopyText = strategy.copyText;
  currentAssistRecord = strategy.record;
}

function autoGenerateAssistIfReady() {
  if (!isFrontAssistMode()) return;
  const fromEl = document.getElementById('assist-from-input');
  const toEl = document.getElementById('assist-to-input');
  const fromVal = String(fromEl?.value ?? '').trim();
  const toVal = String(toEl?.value ?? '').trim();
  if (fromVal && toVal) {
    generateAssist();
    return;
  }
  const errEl = document.getElementById('assist-error');
  if (errEl) errEl.textContent = '';
  clearAssistState();
}

function buildFishStrategy(from, to, openCostTotal, priceDecimalPlaces) {
  const nameEl = document.getElementById('fish-name-input');
  const name = String(nameEl?.value ?? '').trim() || 'test';
  const side = to > from ? 'long' : 'short';
  const stop = from;
  const takeProfit = calcAssistTakeProfitPrice(from, to, FISH_TAKE_PROFIT_MULTIPLE);
  if (takeProfit == null) return null;
  const stopLabel = formatTrimmedFixedDecimals(stop, priceDecimalPlaces);
  const tpLabel = formatTrimmedFixedDecimals(takeProfit, priceDecimalPlaces);
  const concessionItems = buildAssistConcessionItems(from, to, openCostTotal, priceDecimalPlaces, FISH_TIER_OPEN_COST);
  if (!concessionItems.length) return null;
  const primaryItem = concessionItems[0];
  const openCostMultiplier = OPEN_COST_MULTIPLIER_DEFAULT;
  const openCost = FISH_TIER_OPEN_COST;
  const description = getStrategyDescription('fish');
  const fromLabel = formatTrimmedFixedDecimals(from, priceDecimalPlaces);
  const fishTime = buildFishTimeRange();
  const copyText = [
    formatFishStrategyTitle(name),
    ...concessionItems.map((item) => {
      const label = withBestConcessionLabel(getAssistTierLabel(item.rate), item.rate);
      return shouldHideAssistQuantity(item.rate)
        ? `${label}：${item.price}`
        : `${label}：${item.price} / ${item.quantity}`;
    }),
    `止盈价格：${tpLabel}`,
    `止损价格：${fromLabel}`,
    ...(description ? [`描述：${description}`] : []),
  ].join('\n');

  const record = {
    strategyName: name,
    description,
    positionSide: side,
    inputPrice: formatTrimmedFixedDecimals(from, priceDecimalPlaces),
    inputStopLoss: formatTrimmedFixedDecimals(to, priceDecimalPlaces),
    entryPrice: primaryItem.price,
    quantity: primaryItem.quantity,
    takeProfitPrice: tpLabel,
    stopLossPrice: stopLabel,
    openCost,
    openCostMultiplier,
    openCostTotal,
    tierCount: DEFAULT_TIER_COUNT,
    tradeMode: TRADE_MODE_NORMAL,
    grade: getStrategyGradeFromOpenCost(openCost, openCostTotal, DEFAULT_TIER_COUNT),
    priceAdjustmentRate: 0,
    priceAdjustment: '0',
    concessions: concessionItems,
    takeProfitRMultiple: FISH_TAKE_PROFIT_MULTIPLE,
    ...fishTime,
    outcomeStatus: 'pending',
    viewMode: STRATEGY_VIEW_MODE_TREND,
  };

  return { copyText, record };
}

function generateFish() {
  const fromEl = document.getElementById('fish-from-input');
  const toEl = document.getElementById('fish-to-input');
  const errEl = document.getElementById('fish-error');
  const from = toNumber(fromEl && 'value' in fromEl ? fromEl.value : '');
  const to = toNumber(toEl && 'value' in toEl ? toEl.value : '');
  const openCostTotal = getOpenCostTotal();

  if (errEl) errEl.textContent = '';

  if (from == null || to == null) {
    if (errEl) errEl.textContent = '请输入有效的 from 与 to（数字）。';
    clearFishState();
    return;
  }
  if (!(from > 0) || !(to > 0)) {
    if (errEl) errEl.textContent = 'from 和 to 须为大于 0 的数字。';
    clearFishState();
    return;
  }
  if (from === to) {
    if (errEl) errEl.textContent = 'from 与 to 不能相同。';
    clearFishState();
    return;
  }

  const priceDecimals = Math.max(3, getPriceDecimalPlacesFromValues(fromEl?.value, toEl?.value));
  const strategy = buildFishStrategy(from, to, openCostTotal, priceDecimals);
  if (!strategy) {
    if (errEl) errEl.textContent = '无法生成吃鱼助手档位，请检查 from / to。';
    clearFishState();
    return;
  }

  currentFishCopyText = strategy.copyText;
  currentFishRecord = strategy.record;
}

function autoGenerateFishIfReady() {
  if (!isFrontFishMode()) return;
  const fromEl = document.getElementById('fish-from-input');
  const toEl = document.getElementById('fish-to-input');
  const fromVal = String(fromEl?.value ?? '').trim();
  const toVal = String(toEl?.value ?? '').trim();
  if (fromVal && toVal) {
    generateFish();
    return;
  }
  const errEl = document.getElementById('fish-error');
  if (errEl) errEl.textContent = '';
  clearFishState();
}

/**
 * 开始时间默认值是基于「当前时间」算出来的。页面长时间不刷新时，
 * new Date() 不会重新读取，默认值就会停在过期的时间格上。
 * 这里在用户尚未手动选择时，定时 + 切回标签页时重新对齐到当前时间格。
 */
function syncStartTimeToNow() {
  const picker = document.getElementById('start-time-picker');
  if (picker && !picker.hidden) return;
  let trendChanged = false;
  let assistChanged = false;
  ['trend', 'assist'].forEach((scope) => {
    if (isStartTimeUserPicked(scope)) return;
    const { sel } = getStartTimeFieldEls(scope);
    if (!sel) return;
    const nowSlot = getCurrentTimeSlot(getTimeframeMinutes(getTimeframeMode(scope)));
    if (sel.value === nowSlot) return;
    rebuildStartTimeOptions(nowSlot, { scope });
    if (scope === 'assist') assistChanged = true;
    else trendChanged = true;
  });
  if (trendChanged) autoGenerateIfReady();
  if (assistChanged) autoGenerateAssistIfReady();
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
    params.push(`or=(expires_at.gt.${encodeURIComponent(new Date().toISOString())},expires_at.is.null)`);
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

async function updateStrategy(id, record) {
  const normalizedId = String(id ?? '').trim();
  if (!normalizedId) throw new Error('缺少策略 ID');
  const payload = toDbRecord(record);
  logSave('info', '准备更新 Supabase 策略', {
    id: normalizedId,
    endpoint: STRATEGIES_ENDPOINT,
    payload,
  });
  let res;
  try {
    res = await supabaseFetch(`${STRATEGIES_ENDPOINT}?id=eq.${encodeURIComponent(normalizedId)}`, {
      method: 'PATCH',
      headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logSave('error', '网络请求失败（未到达 Supabase）', {
      message: err?.message || String(err),
      endpoint: STRATEGIES_ENDPOINT,
      id: normalizedId,
    });
    throw err;
  }
  const bodyText = res.ok ? '' : await res.text();
  logSave(res.ok ? 'info' : 'error', 'Supabase 更新响应', {
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

async function updateStrategyView(id, { viewMode, viewState } = {}) {
  const encodedId = encodeURIComponent(id);
  const payload = {
    view_mode: normalizeStrategyViewMode(viewMode),
  };
  if (viewState !== undefined) {
    payload.view_state = normalizeViewState(viewState);
  }
  const res = await supabaseFetch(`${STRATEGIES_ENDPOINT}?id=eq.${encodedId}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(payload),
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
  pinned: '关注',
  dueToday: '今日到期',
};

const DEFAULT_ADMIN_TIME_FILTER = 'all';

let adminTimeFilter = DEFAULT_ADMIN_TIME_FILTER;
let adminNameSearch = '';
let adminNameFilter = '';
let adminSortByExpiresAsc = false;
let isUnpinningAll = false;
let isUnpinAllArmed = false;
let unpinAllArmedAt = 0;
let unpinAllArmTimer = 0;
const UNPIN_ALL_ARM_MS = 4000;
const UNPIN_ALL_CONFIRM_DELAY_MS = 700;
function getAdminNameFilterKey(name) {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  return raw.toLowerCase();
}

function getAdminRowNameFilterKey(row) {
  const raw = String(row?.strategyName ?? '').trim();
  if (!raw) return '';
  return formatStrategyCardTitle(raw).toLowerCase();
}

function rowMatchesAdminNameFilter(row) {
  if (!adminNameFilter) return true;
  return getAdminRowNameFilterKey(row) === adminNameFilter;
}

function getFilteredAdminRows(rows = latestAdminRows) {
  let visible = getAdminVisibleRows(rows);
  if (normalizeAdminTimeFilter(adminTimeFilter) === 'pinned') {
    visible = visible.filter(isStrategyPinned);
  }
  if (!adminNameFilter) return visible;
  return visible.filter(rowMatchesAdminNameFilter);
}

function compareAdminRowsByExpiresAsc(a, b) {
  const aEnd = getStrategyEndAt(a);
  const bEnd = getStrategyEndAt(b);
  const aTs = aEnd?.getTime();
  const bTs = bEnd?.getTime();
  if (aTs == null && bTs == null) return 0;
  if (aTs == null) return 1;
  if (bTs == null) return -1;
  return aTs - bTs;
}

function getDisplayAdminRows(rows = latestAdminRows) {
  const filtered = getFilteredAdminRows(rows);
  if (!adminSortByExpiresAsc) return filtered;
  return filtered.slice().sort(compareAdminRowsByExpiresAsc);
}

function getPinnedAdminRowsForUnpin(rows = latestAdminRows) {
  return getFilteredAdminRows(rows).filter(isStrategyPinned);
}

function disarmUnpinAll() {
  if (unpinAllArmTimer) {
    window.clearTimeout(unpinAllArmTimer);
    unpinAllArmTimer = 0;
  }
  isUnpinAllArmed = false;
  unpinAllArmedAt = 0;
}

function armUnpinAll() {
  isUnpinAllArmed = true;
  unpinAllArmedAt = Date.now();
  if (unpinAllArmTimer) window.clearTimeout(unpinAllArmTimer);
  unpinAllArmTimer = window.setTimeout(() => {
    unpinAllArmTimer = 0;
    isUnpinAllArmed = false;
    unpinAllArmedAt = 0;
    renderAdminActiveNames();
  }, UNPIN_ALL_ARM_MS);
  renderAdminActiveNames();
}

function requestUnpinDisplayedAdminStrategies() {
  if (isUnpinningAll || isDeletingStrategies || isAdminSelectionMode) return;
  const pinnedCount = getPinnedAdminRowsForUnpin().length;
  if (!pinnedCount) {
    disarmUnpinAll();
    renderAdminActiveNames();
    return;
  }
  if (!isUnpinAllArmed) {
    armUnpinAll();
    return;
  }
  if (Date.now() - unpinAllArmedAt < UNPIN_ALL_CONFIRM_DELAY_MS) return;
  unpinDisplayedAdminStrategies().catch(() => {});
}

async function unpinDisplayedAdminStrategies() {
  if (isUnpinningAll || isDeletingStrategies || isAdminSelectionMode) return;
  disarmUnpinAll();
  const targets = getPinnedAdminRowsForUnpin();
  if (!targets.length) {
    renderAdminActiveNames();
    return;
  }
  const snapshots = targets.map((row) => {
    const id = String(row?.id ?? '').trim();
    return {
      id,
      viewMode: row?.viewMode,
      prevViewState: normalizeViewState(row?.viewState),
      nextViewState: setPinnedInViewState(row?.viewState, false),
    };
  }).filter((item) => item.id);
  if (!snapshots.length) {
    renderAdminActiveNames();
    return;
  }

  const nextById = new Map(snapshots.map((item) => [item.id, item.nextViewState]));
  const prevById = new Map(snapshots.map((item) => [item.id, item.prevViewState]));

  isUnpinningAll = true;
  latestAdminRows = latestAdminRows.map((item) => {
    const id = String(item?.id ?? '').trim();
    if (!nextById.has(id)) return item;
    return { ...item, viewState: nextById.get(id) };
  });
  renderAdminListItems();
  renderAdminActiveNames();
  updateAdminSelectionControls();

  try {
    const results = await Promise.allSettled(snapshots.map((item) => (
      updateStrategyView(item.id, {
        viewMode: item.viewMode,
        viewState: item.nextViewState,
      })
    )));
    const failedIds = new Set();
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedIds.add(snapshots[index].id);
        console.error('[admin-unpin-all]', snapshots[index].id, result.reason);
      }
    });
    if (failedIds.size) {
      latestAdminRows = latestAdminRows.map((item) => {
        const id = String(item?.id ?? '').trim();
        if (!failedIds.has(id)) return item;
        return { ...item, viewState: prevById.get(id) };
      });
    }
  } finally {
    isUnpinningAll = false;
    renderAdminListItems();
    renderAdminActiveNames();
    updateAdminSelectionControls();
  }
}

function toggleAdminNameFilter(name) {
  const key = getAdminNameFilterKey(name);
  if (!key) return;
  disarmUnpinAll();
  adminNameFilter = adminNameFilter === key ? '' : key;
  renderAdminListItems();
  renderAdminActiveNames();
}

function toggleAdminSortByExpires() {
  disarmUnpinAll();
  adminSortByExpiresAsc = !adminSortByExpiresAsc;
  renderAdminListItems();
  renderAdminActiveNames();
}

function normalizeAdminFilter(value, labels, fallback = 'all') {
  return Object.prototype.hasOwnProperty.call(labels, value) ? value : fallback;
}

function normalizeAdminTimeFilter(value) {
  return normalizeAdminFilter(value, ADMIN_TIME_FILTER_LABELS, DEFAULT_ADMIN_TIME_FILTER);
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

function compareAdminNamesByFirstLetter(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

function collectAdminNameCounts(rows) {
  let list = getAdminVisibleRows(rows);
  if (normalizeAdminTimeFilter(adminTimeFilter) === 'pinned') {
    list = list.filter(isStrategyPinned);
  }
  const counts = new Map();
  for (const row of list) {
    const raw = String(row?.strategyName ?? '').trim();
    if (!raw) continue;
    const display = formatStrategyCardTitle(raw);
    const key = display.toLowerCase();
    if (!counts.has(key)) {
      counts.set(key, {
        name: display,
        count: 0,
        mode: getAdminDisplayViewMode(row),
      });
    }
    counts.get(key).count += 1;
    counts.get(key).mode = getAdminDisplayViewMode(row);
  }
  return Array.from(counts.values()).sort((a, b) => compareAdminNamesByFirstLetter(a.name, b.name));
}

function renderAdminActiveNames(rows = latestAdminRows) {
  const el = document.getElementById('admin-active-names');
  if (!el) return;
  const nameCounts = collectAdminNameCounts(rows);
  const uniqueTotal = nameCounts.length;
  el.hidden = false;
  const sortHtml = [
    `<button type="button" class="admin-active-names__sort${adminSortByExpiresAsc ? ' is-active' : ''}" data-admin-sort-expires aria-pressed="${adminSortByExpiresAsc ? 'true' : 'false'}" aria-label="按截止时间由近到远排序，${uniqueTotal} 个名称">`,
    `排序 ${uniqueTotal}`,
    '</button>',
  ].join('');
  const pinnedCount = getPinnedAdminRowsForUnpin(rows).length;
  if (isUnpinAllArmed && pinnedCount === 0 && !isUnpinningAll) disarmUnpinAll();
  const canUnpin = !isAdminSelectionMode && !isDeletingStrategies && (pinnedCount > 0 || isUnpinningAll || isUnpinAllArmed);
  const unpinStateClass = isUnpinningAll ? ' is-busy' : (isUnpinAllArmed ? ' is-armed' : '');
  const unpinLabel = isUnpinningAll
    ? '取关中'
    : (isUnpinAllArmed ? `确认取关 ${pinnedCount}` : '一键取关');
  const unpinAria = isUnpinningAll
    ? '正在取消关注'
    : (isUnpinAllArmed
      ? `再点一次确认取消关注当前 ${pinnedCount} 条，4 秒内未确认将取消`
      : `一键取消关注当前 ${pinnedCount} 条，需再确认一次`);
  const unpinHtml = canUnpin
    ? [
      `<button type="button" class="admin-active-names__unpin${unpinStateClass}" data-admin-unpin-all`,
      isUnpinningAll ? ' disabled' : '',
      ` aria-busy="${isUnpinningAll ? 'true' : 'false'}"`,
      ` aria-pressed="${isUnpinAllArmed ? 'true' : 'false'}"`,
      ` aria-label="${unpinAria}">`,
      unpinLabel,
      '</button>',
    ].join('')
    : '';
  const activeKey = adminNameFilter;
  const namesHtml = nameCounts.map(({ name, count, mode }) => {
    const chipClass = getAdminModeChipClass(mode);
    const isActive = activeKey && getAdminNameFilterKey(name) === activeKey;
    const countHtml = count > 1
      ? `<span class="admin-active-names__count">${count}</span>`
      : '';
    return [
      `<button type="button" class="admin-active-names__item admin-active-names__item--${chipClass}${isActive ? ' is-active' : ''}" data-admin-name-filter="${escapeHtml(name)}" aria-pressed="${isActive ? 'true' : 'false'}">`,
      escapeHtml(name),
      countHtml,
      '</button>',
    ].join('');
  }).join('');
  el.innerHTML = `${sortHtml}${unpinHtml}${namesHtml}`;
}

function renderAdminControls() {
  renderAdminFilterTabs();
  renderAdminActiveNames();
}

function scrollAdminItemIntoView(rawId) {
  const id = String(rawId ?? '').trim();
  if (!id) return;
  const listEl = document.getElementById('admin-list');
  if (!listEl) return;
  const safeId = (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
    ? CSS.escape(id)
    : id.replace(/["\\]/g, '');
  const itemEl = listEl.querySelector(`.admin-item[data-id="${safeId}"]`)
    || listEl.querySelector(`[data-id="${safeId}"]`)?.closest('.admin-item');
  if (!itemEl) return;
  itemEl.classList.add('is-focused');
  const align = () => {
    itemEl.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  };
  requestAnimationFrame(() => requestAnimationFrame(align));
  window.setTimeout(() => {
    itemEl.classList.remove('is-focused');
  }, 1800);
}

function resetAdminPageState() {
  closeOutcomeStatusPicker();
  adminTimeFilter = DEFAULT_ADMIN_TIME_FILTER;
  adminNameSearch = '';
  adminNameFilter = '';
  adminSortByExpiresAsc = false;
  isAdminSelectionMode = false;
  selectedStrategyIds.clear();
  visibleAdminStrategyIds = [];
  isDeletingStrategies = false;
  isUnpinningAll = false;
  disarmUnpinAll();
  updatingAdminViewModeIds.clear();
  renderAdminControls();
  updateAdminSelectionControls();
}

let selectedStrategyIds = new Set();
let isDeletingStrategies = false;
let isAdminSelectionMode = false;
let visibleAdminStrategyIds = [];
let latestAdminRows = [];
let updatingAdminViewModeIds = new Set();
let expandedCounterTrendIds = new Set();

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

  if (isFrontPage() && editingStrategyId) {
    btnClear.hidden = false;
    btnClear.textContent = '取消修改';
    btnClear.disabled = false;
    btnClear.setAttribute('aria-busy', 'false');
    return;
  }

  btnClear.hidden = true;
  btnClear.textContent = '删除';
  btnClear.disabled = false;
  btnClear.setAttribute('aria-busy', 'false');
}

function enterAdminSelectionMode() {
  disarmUnpinAll();
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

function confirmDeleteStrategies() {
  return true;
}

function showAdminDeleteError() {
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
  renderAdminFilterTabs();
  // 切换筛选时先隐藏名称栏，避免沿用上一筛选项的旧 name 闪现
  const namesEl = document.getElementById('admin-active-names');
  if (namesEl) {
    namesEl.hidden = true;
    namesEl.innerHTML = '';
  }
  let rows = [];
  try {
    // 关注筛选取全量，便于关联单据查找；展示层再按关注过滤
    const fetchFilter = adminTimeFilter === 'pinned' ? 'all' : adminTimeFilter;
    rows = await fetchStrategies(fetchFilter);
  } catch (err) {
    selectedStrategyIds.clear();
    visibleAdminStrategyIds = [];
    latestAdminRows = [];
    updatingAdminViewModeIds.clear();
    listEl.innerHTML = `<div class="admin-sync-error">${escapeHtml(String(err?.message || '同步失败'))}</div>`;
    renderAdminActiveNames([]);
    updateAdminSelectionControls();
    return;
  }
  latestAdminRows = rows;
  renderAdminActiveNames(rows);
  renderAdminListItems();
}

function getAdminCurrentModeTagHtml(row) {
  const rawId = String(row?.id ?? '').trim();
  const type = getAdminStrategyTypeInfo(row).type;
  if (type === 'fish') {
    return '<span class="admin-fish-tag" aria-label="吃鱼助手">吃鱼助手</span>';
  }
  if (!rawId || type !== 'trend') return '';
  const syncing = updatingAdminViewModeIds.has(rawId);
  const isCounter = isAdminCounterTrendView(row);
  const canCycle = isCounter || canShowCounterTrend(row);
  const label = isCounter ? '趋势力预测' : '趋势立项';
  const mod = isCounter ? 'counter' : 'trend';
  const enabled = canCycle && !syncing;
  return [
    `<button type="button" class="admin-mode-tag admin-mode-tag--${mod}${syncing ? ' is-syncing' : ''}${enabled ? ' is-clickable' : ''}"`,
    ` data-admin-mode-cycle data-id="${escapeHtml(rawId)}"`,
    enabled ? '' : ' disabled',
    ` aria-label="点击切换模式，当前${label}"`,
    enabled ? ' title="点击切换模式"' : '',
    '>',
    escapeHtml(label),
    '</button>',
  ].join('');
}

function getNextCycledViewMode(row) {
  if (isAdminCounterTrendView(row)) return STRATEGY_VIEW_MODE_TREND;
  if (canShowCounterTrend(row)) return STRATEGY_VIEW_MODE_COUNTER;
  return null;
}

function buildAdminListItemHtml(row) {
  const rawId = String(row?.id ?? '').trim();
  const id = escapeHtml(rawId);
  const sideRaw = String(row?.positionSide ?? '').trim();
  const nameRaw = String(row?.strategyName ?? '').trim();
  const showCounterTrend = Boolean(rawId && isAdminCounterTrendView(row));
  const showTierAssistView = Boolean(rawId && isAdminTierAssistView(row));
  const showFishView = Boolean(rawId && isAdminFishView(row));
  const relatedFish = showFishView ? findRelatedFishRow(row) : null;
  const linkedTier = showTierAssistView ? buildLinkedTierAssistDisplay(row) : null;
  const baseSideMod = getPositionSideMod(sideRaw);
  const sideMod = showFishView && relatedFish
    ? getPositionSideMod(relatedFish.positionSide)
    : (linkedTier ? getPositionSideMod(linkedTier.side) : baseSideMod);
  const strategyType = getAdminStrategyTypeInfo(row);
  const isAssistStrategy = strategyType.type === 'assist';
  const isFishStrategy = strategyType.type === 'fish';
  const isTierAssistStrategy = strategyType.type === 'tier_assist';
  const isAssistLikeStrategy = isAssistStrategy || isFishStrategy || showFishView;
  const hasTimeRange = Boolean(getStrategyStartAt(row) && getStrategyEndAt(row));
  const showTimeMeta = strategyType.type === 'trend' && !showFishView && hasTimeRange;
  const title = escapeHtml(formatStrategyCardTitle(nameRaw));
  const titleLabel = escapeHtml(
    isTierAssistStrategy
      ? `${formatTierAssistStrategyTitle(nameRaw)}${String(row?.outcomeRemark ?? '').trim() ? `，备注：${String(row.outcomeRemark).trim()}` : ''}`
      : isFishStrategy
        ? `${formatFishStrategyTitle(nameRaw)}${String(row?.outcomeRemark ?? '').trim() ? `，备注：${String(row.outcomeRemark).trim()}` : ''}`
        : isAssistStrategy
          ? `${formatAssistStrategyTitle(nameRaw)}${String(row?.outcomeRemark ?? '').trim() ? `，备注：${String(row.outcomeRemark).trim()}` : ''}`
          : formatAdminCardTitlePlain(nameRaw, row?.outcomeRemark),
  );
  const remarkStampHtml = renderAdminRemarkStampHtml(row?.outcomeRemark);
  const priceDecimalPlaces = getAdminPriceDecimalPlacesFromRow(row);
  let concessions;
  let stopLabel;
  let takeProfitLabel;
  let tenRBoundary = null;
  let showTenREffect = false;
  if (showCounterTrend) {
    const counter = buildCounterTrendConcessions(row);
    concessions = filterCounterTrendConcessionItems(
      counter.items,
      isCounterTrendRatesExpanded(rawId),
    );
    // 趋势力预测：止盈=原开仓价，止损=10R（计算逻辑不变，仅改展示位置）
    takeProfitLabel = counter.refTakeProfit || '—';
    stopLabel = counter.stopLoss || '—';
    tenRBoundary = { rate: COUNTER_TREND_STOP_MULTIPLE, label: '10R 分界' };
  } else if (showTierAssistView) {
    concessions = linkedTier?.concessions || [];
    takeProfitLabel = linkedTier?.takeProfitLabel || '—';
    stopLabel = linkedTier?.stopLabel || '—';
    if (isAdminTenRBoundaryRow(row)) {
      showTenREffect = true;
    }
  } else if (showFishView && relatedFish) {
    concessions = buildAdminAssistConcessionsForDisplay(relatedFish);
    const assistFrom = toNumber(relatedFish?.inputPrice ?? relatedFish?.stopLossPrice);
    const assistTo = toNumber(relatedFish?.inputStopLoss);
    const assistTp = calcAssistTakeProfitPrice(assistFrom, assistTo, FISH_TAKE_PROFIT_MULTIPLE);
    takeProfitLabel = assistTp != null
      ? formatTrimmedFixedDecimals(assistTp, priceDecimalPlaces)
      : (formatAdminPriceFromValue(relatedFish?.takeProfitPrice, priceDecimalPlaces) || '—');
    stopLabel = formatAdminPriceFromValue(relatedFish?.inputPrice ?? relatedFish?.stopLossPrice, priceDecimalPlaces) || '—';
    if (isAdminTenRBoundaryRow(relatedFish)) {
      showTenREffect = true;
    }
  } else if (isTierAssistStrategy) {
    const saved = hasConcessions(row?.concessions) ? row.concessions : [];
    const stopLoss = toNumber(row?.stopLossPrice);
    const allowedRates = getConfiguredDisplayRates(TIER_ASSIST_RATES);
    concessions = applyAdminFixedTierQuantities(saved, stopLoss).filter((item) => (
      allowedRates.some((rate) => Math.abs(Number(item.rate) - rate) < 1e-9)
    ));
    takeProfitLabel = formatAdminPriceFromValue(row?.takeProfitPrice, priceDecimalPlaces) || '—';
    stopLabel = formatAdminPriceFromValue(row?.stopLossPrice, priceDecimalPlaces) || '—';
    if (isAdminTenRBoundaryRow(row)) {
      showTenREffect = true;
    }
  } else if (isAssistLikeStrategy) {
    concessions = buildAdminAssistConcessionsForDisplay(row);
    // 顺势而为：2 倍；吃鱼助手：1 倍；止损=from
    const assistFrom = toNumber(row?.inputPrice ?? row?.stopLossPrice);
    const assistTo = toNumber(row?.inputStopLoss);
    const tpMultiple = isFishStrategy ? FISH_TAKE_PROFIT_MULTIPLE : ASSIST_TAKE_PROFIT_MULTIPLE;
    const assistTp = calcAssistTakeProfitPrice(assistFrom, assistTo, tpMultiple);
    takeProfitLabel = assistTp != null
      ? formatTrimmedFixedDecimals(assistTp, priceDecimalPlaces)
      : (formatAdminPriceFromValue(row?.takeProfitPrice, priceDecimalPlaces) || '—');
    stopLabel = formatAdminPriceFromValue(row?.inputPrice ?? row?.stopLossPrice, priceDecimalPlaces) || '—';
    if (isAdminTenRBoundaryRow(row)) {
      showTenREffect = true;
    }
  } else {
    concessions = buildAdminDisplayConcessions(row);
    // 趋势立项：止盈=5R 最佳点位（区分多空），止损=原止损
    takeProfitLabel = buildAdminBestTakeProfitLabel(row?.entryPrice, row?.stopLossPrice, priceDecimalPlaces);
    stopLabel = formatAdminPriceFromValue(row?.stopLossPrice, priceDecimalPlaces) || '—';
  }
  const tpSlHtml = showCounterTrend ? '' : renderAdminTakeProfitStopHtml(takeProfitLabel, stopLabel, {
    name: nameRaw,
    endAt: getStrategyEndAt(row),
  });
  const sideLabel = getPositionSideLabel(sideMod);
  const sideTagHtml = sideLabel
    ? `<span class="admin-item__side admin-item__side--${sideMod}" aria-label="${sideLabel}">${sideLabel}</span>`
    : '';
  const concessionsHtml = renderAdminConcessionsHtml(concessions, stopLabel, {
    priceDecimalPlaces,
    assistLabels: isAssistLikeStrategy,
    hideStopColumn: true,
    selectableStrategyId: rawId,
    isCurrentItem: (item) => isAdminConcessionCurrentItem(item, row),
    ...(showCounterTrend
      ? {
        formatRate: formatCounterTrendRate,
        rateHeaderLabel: '倍数',
        qtyHeaderLabel: '',
        sideActionsMode: true,
        sideActionsStrategyId: rawId,
        actionsHeaderHtml: renderCounterTrendFoldLinkHtml(rawId),
        reverseOrder: true,
      }
      : {}),
    ...(tenRBoundary ? { boundary: tenRBoundary } : {}),
  });
  const baseStartAt = getStrategyStartAt(row);
  const baseEndAt = getStrategyEndAt(row);
  const counterTimeRange = showCounterTrend ? getCounterTrendTimeRange(row) : null;
  const startAt = showCounterTrend ? counterTimeRange?.startAt : baseStartAt;
  const endAt = showCounterTrend ? counterTimeRange?.endAt : baseEndAt;
  const timeRange = showTimeMeta
    ? escapeHtml(formatAdminTimeRange(startAt, endAt))
    : '';
  const expiresAt = endAt ? escapeHtml(endAt.toISOString()) : '';
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
  const editTargetRow = resolveEditableStrategyRow(row);
  const editTargetId = String(editTargetRow?.id ?? '').trim();
  const canShowEdit = Boolean(editTargetId && !isAdminSelectionMode);
  const timeBadge = showTimeMeta ? getTimeBadgeInfo(endAt) : null;
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
  const currentModeTagHtml = getAdminCurrentModeTagHtml(row);
  const pinTagHtml = isStrategyPinned(row)
    ? '<span class="admin-pin-tag" aria-label="已关注" title="已关注">♥</span>'
    : '';
  const tenRTagHtml = showTenREffect
    ? '<span class="admin-ten-r-tag" aria-label="10R分界">10R分界</span>'
    : '';
  const timeframeTagHtml = (strategyType.type === 'trend' && !showFishView)
    ? getTimeframeTagHtml(row?.timeframe)
    : '';
  const titleGroupHtml = [
    '<div class="admin-item__title-wrap">',
    `<span class="admin-item__title">${title}</span>`,
    sideTagHtml,
    currentModeTagHtml,
    tenRTagHtml,
    timeframeTagHtml,
    pinTagHtml,
    '</div>',
  ].join('');
  const headRightHtml = timeBadgeHtml
    ? `<div class="admin-item__head-right">${timeBadgeHtml}</div>`
    : '';
  return [
    `<article class="admin-item admin-item--${sideMod}${showCounterTrend ? ' admin-item--counter-trend' : ''}${isAssistStrategy ? ' admin-item--assist' : ''}${isFishStrategy || showFishView ? ' admin-item--fish' : ''}${showTierAssistView || isTierAssistStrategy ? ' admin-item--tier-assist' : ''}${isStrategyPinned(row) ? ' admin-item--pinned' : ''}" data-id="${id}">`,
    '<header class="admin-item__head">',
    selectHtml,
    '<div class="admin-item__head-main">',
    titleGroupHtml,
    '</div>',
    headRightHtml,
    '</header>',
    '<div class="admin-item__table">',
    concessionsHtml,
    tpSlHtml,
    isTierAssistStrategy
      ? ''
      : [
        '<div class="admin-item__sub">',
        `<span class="admin-item__time-range"${timeRange ? ' aria-label="时间范围"' : ' aria-hidden="true"'}>${timeRange || ''}</span>`,
        canShowEdit
          ? `<button type="button" class="admin-edit-btn" data-admin-edit data-id="${escapeHtml(editTargetId)}" aria-label="修改 ${titleLabel}">修改</button>`
          : '',
        '</div>',
      ].join(''),
    '</div>',
    renderAdminDescriptionHtml(row?.description),
    remarkStampHtml,
    '</article>',
  ].join('');
}

function renderAdminListItems() {
  const listEl = document.getElementById('admin-list');
  if (!listEl) return;
  const rows = getDisplayAdminRows(latestAdminRows);
  syncAdminSelectionWithRows(rows);
  if (!rows.length) {
    listEl.innerHTML = latestAdminRows.length && adminNameFilter
      ? '<div class="admin-list-empty">无匹配策略</div>'
      : '';
    updateAdminSelectionControls();
    return;
  }
  listEl.innerHTML = rows.map((row) => {
    try {
      return buildAdminListItemHtml(row);
    } catch (err) {
      console.error('[admin-item-render]', err);
      return '';
    }
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
  const shouldRun = (currentPage === 'admin' || currentPage === 'observations') && !document.hidden;
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

let observationContentColumnAvailable = true;
const OBS_DAILY_TIMEFRAME = '1d';
const OBS_DURATION_PERIODS = 9;
const OPP_RANK_MAX = 10;
const OPP_RANK_ACTIONABLE = 3;
let latestObservationRecords = [];
let isPersistingOpp = false;
let editingOppTarget = null;

function isMissingObservationContentColumnError(errorText) {
  return /content/i.test(String(errorText ?? ''))
    && /(column|schema cache|could not find|not found)/i.test(String(errorText ?? ''));
}

function getObservationDailyTimeSlots() {
  return getTimeSlotsByMode(OBS_DAILY_TIMEFRAME);
}

function formatObservationTimeLabel(timeValue, timeLabel = '') {
  const label = String(timeLabel ?? '').trim();
  if (label) return label;
  const value = String(timeValue ?? '').trim();
  if (!value) return '';
  const at = parseStartSlotValue(value);
  if (!at) return value;
  return formatSlotLabelForMode(at, new Date(), OBS_DAILY_TIMEFRAME);
}

function formatObservationDateLabel(d, base = new Date()) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return d.getFullYear() === base.getFullYear()
    ? `${d.getMonth() + 1}月${d.getDate()}日`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatObservationTimeRange(timeValue, timeLabel = '') {
  const startAt = parseStartSlotValue(String(timeValue ?? '').trim());
  if (!startAt) {
    return formatObservationTimeLabel(timeValue, timeLabel) || '—';
  }
  const endAt = getObservationEndAtFromStart(startAt);
  const now = new Date();
  return `${formatObservationDateLabel(startAt, now)} — ${formatObservationDateLabel(endAt, now)}`;
}

function getObservationEndAtFromStart(startAt) {
  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) return null;
  const spanMinutes = getTimeframeMinutes(OBS_DAILY_TIMEFRAME) * OBS_DURATION_PERIODS;
  return new Date(startAt.getTime() + spanMinutes * 60 * 1000);
}

function getObservationEndAt(timeValue) {
  const startAt = parseStartSlotValue(String(timeValue ?? '').trim());
  if (!startAt) return null;
  return getObservationEndAtFromStart(startAt);
}

function renderObservationCountdownBadgeHtml(endAt) {
  const timeBadge = getTimeBadgeInfo(endAt);
  if (!timeBadge || !endAt) return '';
  const expiresAt = escapeHtml(endAt.toISOString());
  const timeBadgeUrgent = timeBadge.type === 'active' && isCountdownWithinUrgentWindow(endAt)
    ? ' admin-time-status--urgent'
    : '';
  return [
    `<div class="admin-time-status admin-time-status--${timeBadge.type}${timeBadgeUrgent}">`,
    `<span class="admin-time-status__tag admin-time-status__value" data-expires-at="${expiresAt}" data-time-status="${timeBadge.timeStatus}">${escapeHtml(timeBadge.label)}</span>`,
    '</div>',
  ].join('');
}

function getObservationTemplateFields(item = {}) {
  return [
    { key: 'heat', label: '热度', value: String(item?.heat ?? '').trim() },
    { key: 'change', label: '涨跌幅', value: String(item?.change ?? '').trim() },
    { key: 'pattern', label: '形态', value: String(item?.pattern ?? '').trim() },
  ].filter((field) => field.value);
}

function normalizeObservationRank(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function makeObservationItemId() {
  return `oi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getObservationRecordDayDate(record) {
  const createdAt = record?.createdAt ? new Date(record.createdAt) : null;
  if (createdAt && !Number.isNaN(createdAt.getTime())) return createdAt;
  return new Date();
}

function getObservationDayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isObservationRecordOnLocalDay(record, date = new Date()) {
  return getObservationDayKey(getObservationRecordDayDate(record)) === getObservationDayKey(date);
}

function getObservationItemKey(recordId, itemId) {
  return `${String(recordId ?? '').trim()}::${String(itemId ?? '').trim()}`;
}

function parseObservationItemKey(key) {
  const raw = String(key ?? '');
  const splitAt = raw.indexOf('::');
  if (splitAt < 0) return { recordId: '', itemId: raw };
  return {
    recordId: raw.slice(0, splitAt),
    itemId: raw.slice(splitAt + 2),
  };
}

function hasObservationItemContent(item = {}) {
  return Boolean(
    String(item?.name ?? '').trim()
    || String(item?.description ?? '').trim()
  );
}

function normalizeObservationItems(items) {
  const source = Array.isArray(items) ? items : [];
  return source
    .map((item) => {
      const legacyDescription = item?.grade == null ? '' : `等级：${String(item.grade).trim()}`;
      const name = String(item?.name ?? '').trim();
      const time = String(item?.time ?? '').trim();
      const timeLabel = formatObservationTimeLabel(time, item?.timeLabel);
      const price = String(item?.price ?? '').trim();
      const stopLoss = String(item?.stopLoss ?? item?.stop ?? item?.stop_loss ?? '').trim();
      const description = String(item?.description ?? item?.desc ?? item?.note ?? legacyDescription).trim();
      const id = String(item?.id ?? '').trim();
      const rank = normalizeObservationRank(item?.rank ?? item?.order);
      return {
        id,
        rank,
        name,
        time,
        timeLabel,
        price,
        stopLoss,
        description,
      };
    })
    .filter((item) => hasObservationItemContent(item));
}

function parseLegacyObservationContent(content) {
  const lines = String(content ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const [first, ...rest] = lines;
  const colonIndex = first.indexOf(':');
  if (colonIndex > 0 && !rest.length) {
    return [{
      name: first.slice(0, colonIndex).trim(),
      description: first.slice(colonIndex + 1).trim(),
    }];
  }
  return [{
    name: first,
    description: rest.join('\n'),
  }];
}

function fromObservationRecord(row) {
  let items = Array.isArray(row?.items) ? normalizeObservationItems(row.items) : [];
  if (!items.length && typeof row?.content === 'string' && row.content.trim()) {
    items = normalizeObservationItems(parseLegacyObservationContent(row.content));
  }
  return {
    id: String(row?.id ?? '').trim(),
    createdAt: row?.created_at ?? null,
    items,
  };
}

function sortOpportunityItems(items) {
  const source = Array.isArray(items) ? items.slice() : [];
  source.sort((a, b) => {
    const aRank = normalizeObservationRank(a?.rank);
    const bRank = normalizeObservationRank(b?.rank);
    const aHas = aRank != null;
    const bHas = bRank != null;
    if (aHas && bHas && aRank !== bRank) return aRank - bRank;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return 0;
  });
  return source.map((item, index) => ({
    ...item,
    rank: index + 1,
    id: String(item?.id ?? '').trim() || makeObservationItemId(),
  }));
}

function serializeObservationItems(items) {
  return sortOpportunityItems(items)
    .slice(0, OPP_RANK_MAX)
    .map((item, index) => {
      const next = { id: item.id, rank: index + 1 };
      if (item.name) next.name = item.name;
      if (item.description) next.description = item.description;
      return next;
    })
    .filter((item) => hasObservationItemContent(item));
}

function flattenOpportunityItems(records) {
  const list = Array.isArray(records) ? records.slice() : [];
  list.sort((a, b) => {
    const aTs = getObservationRecordDayDate(a).getTime();
    const bTs = getObservationRecordDayDate(b).getTime();
    return aTs - bTs;
  });
  const items = [];
  for (const record of list) {
    const recordId = String(record?.id ?? '').trim();
    const rawItems = normalizeObservationItems(record?.items);
    rawItems.forEach((item, index) => {
      const itemId = String(item?.id ?? '').trim() || `${recordId}:${index}`;
      items.push({
        ...item,
        id: itemId,
        recordId,
        itemKey: getObservationItemKey(recordId, itemId),
      });
    });
  }
  return sortOpportunityItems(items);
}

function groupObservationRecordsByDay(records) {
  const groups = [];
  const byKey = new Map();
  const list = Array.isArray(records) ? records : [];
  for (const record of list) {
    const date = getObservationRecordDayDate(record);
    const key = getObservationDayKey(date);
    if (!key) continue;
    if (!byKey.has(key)) {
      const group = { key, date, records: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).records.push(record);
  }
  groups.sort((a, b) => b.date.getTime() - a.date.getTime());
  return groups;
}

function getTodayOpportunityCount(records = latestObservationRecords) {
  const todayRecords = (Array.isArray(records) ? records : [])
    .filter((record) => isObservationRecordOnLocalDay(record));
  return flattenOpportunityItems(todayRecords).length;
}

function getDayRecordsForItemKey(itemKey, records = latestObservationRecords) {
  const { recordId } = parseObservationItemKey(itemKey);
  const match = (Array.isArray(records) ? records : [])
    .find((record) => String(record?.id ?? '').trim() === recordId);
  if (!match) return [];
  const dayKey = getObservationDayKey(getObservationRecordDayDate(match));
  return (Array.isArray(records) ? records : [])
    .filter((record) => getObservationDayKey(getObservationRecordDayDate(record)) === dayKey);
}

async function fetchObservationRecords(filterValue = obsTimeFilter) {
  const selectFields = observationContentColumnAvailable
    ? 'id,created_at,items,content'
    : 'id,created_at,items';
  const params = [`select=${selectFields}`, 'order=created_at.desc'];
  const filter = normalizeObsTimeFilter(filterValue);
  if (filter === 'createdToday') {
    const { start, end } = getLocalDayRange();
    params.push(`created_at=gte.${encodeURIComponent(start.toISOString())}`);
    params.push(`created_at=lt.${encodeURIComponent(end.toISOString())}`);
  }
  const res = await supabaseFetch(`${OBSERVATIONS_ENDPOINT}?${params.join('&')}`, {
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (observationContentColumnAvailable && isMissingObservationContentColumnError(errorText)) {
      observationContentColumnAvailable = false;
      return fetchObservationRecords(filterValue);
    }
    throw new Error(errorText);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map(fromObservationRecord) : [];
}

function buildObservationLegacyContent(items) {
  return normalizeObservationItems(items)
    .map((item) => {
      const fields = getObservationTemplateFields(item)
        .map((field) => `${field.label}：${field.value}`);
      if (item.description) fields.push(item.description);
      if (item.time || item.price || item.stopLoss) {
        const timeRange = formatObservationTimeRange(item.time, item.timeLabel);
        return [
          item.name,
          timeRange ? `时间范围：${timeRange}` : '',
          item.price ? `价格：${item.price}` : '',
          item.stopLoss ? `止损：${item.stopLoss}` : '',
          ...fields,
        ].filter(Boolean).join('\n');
      }
      return [item.name, ...fields].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

async function createObservationRecord(items) {
  const normalizedItems = serializeObservationItems(items);
  if (!normalizedItems.length) throw new Error('记录内容不能为空');
  const legacyContent = buildObservationLegacyContent(normalizedItems);
  const payload = {
    items: normalizedItems,
    content: legacyContent,
  };
  const res = await supabaseFetch(OBSERVATIONS_ENDPOINT, {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(observationContentColumnAvailable ? payload : { items: normalizedItems }),
  });
  if (res.ok) return;
  const errorText = await res.text();
  if (observationContentColumnAvailable && isMissingObservationContentColumnError(errorText)) {
    observationContentColumnAvailable = false;
    const retryRes = await supabaseFetch(OBSERVATIONS_ENDPOINT, {
      method: 'POST',
      headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ items: normalizedItems }),
    });
    if (retryRes.ok) return;
    throw new Error(await retryRes.text());
  }
  throw new Error(errorText);
}

async function updateObservationRecord(id, items) {
  const normalizedId = String(id ?? '').trim();
  if (!normalizedId) throw new Error('缺少记录 ID');
  const normalizedItems = serializeObservationItems(items);
  if (!normalizedItems.length) {
    await deleteObservationRecords([normalizedId]);
    return;
  }
  const payload = observationContentColumnAvailable
    ? { items: normalizedItems, content: buildObservationLegacyContent(normalizedItems) }
    : { items: normalizedItems };
  const res = await supabaseFetch(`${OBSERVATIONS_ENDPOINT}?id=eq.${encodeURIComponent(normalizedId)}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(payload),
  });
  if (res.ok) return;
  const errorText = await res.text();
  if (observationContentColumnAvailable && isMissingObservationContentColumnError(errorText)) {
    observationContentColumnAvailable = false;
    const retryRes = await supabaseFetch(`${OBSERVATIONS_ENDPOINT}?id=eq.${encodeURIComponent(normalizedId)}`, {
      method: 'PATCH',
      headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ items: normalizedItems }),
    });
    if (retryRes.ok) return;
    throw new Error(await retryRes.text());
  }
  throw new Error(errorText);
}

async function persistDayOpportunityBoard(dayRecords, items) {
  const payloadItems = serializeObservationItems(items);
  const records = (Array.isArray(dayRecords) ? dayRecords : [])
    .slice()
    .sort((a, b) => getObservationRecordDayDate(a).getTime() - getObservationRecordDayDate(b).getTime());
  if (!payloadItems.length) {
    await deleteObservationRecords(records.map((record) => record.id));
    return;
  }
  if (!records.length) {
    await createObservationRecord(payloadItems);
    return;
  }
  const keepId = String(records[0]?.id ?? '').trim();
  await updateObservationRecord(keepId, payloadItems);
  const extraIds = records
    .slice(1)
    .map((record) => String(record?.id ?? '').trim())
    .filter((id) => id && id !== keepId);
  if (extraIds.length) await deleteObservationRecords(extraIds);
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

function renderOpportunityRankItem(item, { index, selectable = true } = {}) {
  const itemKey = escapeHtml(String(item?.itemKey ?? ''));
  const rank = Number(item?.rank) || (index + 1);
  const checked = item?.itemKey && selectedObservationIds.has(item.itemKey) ? ' checked' : '';
  const disabled = isDeletingObservations || isPersistingOpp ? ' disabled' : '';
  const selectorDisabled = (isDeletingObservations || isPersistingOpp) ? ' is-disabled' : '';
  const selectHtml = selectable && item?.itemKey && isObsSelectionMode
    ? [
      `<label class="admin-item__selector${selectorDisabled}" aria-label="选择机会">`,
      `<input type="checkbox" class="admin-item__select" data-id="${itemKey}"${checked}${disabled}>`,
      '<span class="admin-item__checkmark" aria-hidden="true"></span>',
      '</label>',
    ].join('')
    : '';
  const nameHtml = item?.name
    ? `<p class="obs-rank-item__name">${escapeHtml(item.name)}</p>`
    : '<p class="obs-rank-item__name obs-rank-item__name--empty">未命名</p>';
  const descHtml = item?.description
    ? `<p class="obs-rank-item__desc">${escapeHtml(item.description)}</p>`
    : '';
  const canMove = !isObsSelectionMode && !isDeletingObservations && !isPersistingOpp;
  const moveHtml = canMove
    ? [
      `<button type="button" class="obs-rank-item__move" data-opp-move="-1" data-opp-key="${itemKey}" aria-label="上移"${rank <= 1 ? ' disabled' : ''}>`,
      '<svg class="obs-rank-item__move-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14.5 12 8.5l6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      '</button>',
    ].join('')
    : '';
  const rankClass = rank <= OPP_RANK_ACTIONABLE ? ` obs-rank-item--${rank}` : '';
  return [
    `<article class="admin-item admin-item--flat obs-rank-item${rankClass}" data-opp-key="${itemKey}">`,
    selectHtml,
    `<span class="obs-rank-item__pos" aria-label="第 ${rank} 名">${rank}</span>`,
    '<div class="obs-rank-item__main">',
    `<div class="obs-rank-item__title">${nameHtml}</div>`,
    descHtml,
    '</div>',
    moveHtml,
    '</article>',
  ].join('');
}

function renderOpportunityBoard(items, { title = '', selectable = true } = {}) {
  const list = Array.isArray(items) ? items : [];
  const titleHtml = title
    ? `<h3 class="obs-board__title">${escapeHtml(title)}</h3>`
    : '';
  if (!list.length) return titleHtml;
  return [
    titleHtml,
    list.map((item, index) => renderOpportunityRankItem(item, {
      index,
      selectable,
    })).join(''),
  ].join('');
}

function renderObservationFormRow(item = {}) {
  const name = escapeHtml(String(item?.name ?? ''));
  const description = escapeHtml(String(item?.description ?? ''));
  return [
    '<div class="obs-form-row">',
    '<label class="obs-form-field">',
    '<span class="obs-form-field__label">名称</span>',
    `<input class="obs-form-row__input obs-form-row__name" type="text" value="${name}" placeholder="必填" autocomplete="off" />`,
    '</label>',
    '<label class="obs-form-field">',
    '<span class="obs-form-field__label">描述</span>',
    `<textarea class="obs-form-row__input obs-form-row__desc" rows="3" autocomplete="off">${description}</textarea>`,
    '</label>',
    '</div>',
  ].join('');
}

function renderObservationFormList(item = {}) {
  const listEl = document.getElementById('obs-form-list');
  const titleEl = document.getElementById('obs-form-title');
  if (!listEl) return;
  listEl.innerHTML = renderObservationFormRow(item);
  if (titleEl) titleEl.textContent = editingOppTarget ? '修改机会' : '加入机会';
  requestAnimationFrame(() => {
    listEl.querySelector('.obs-form-row__name')?.focus();
  });
}

function collectObservationFormItems() {
  return Array.from(document.querySelectorAll('#obs-form-list .obs-form-row'))
    .map((row) => ({
      name: String(row.querySelector('.obs-form-row__name')?.value ?? '').trim(),
      description: String(row.querySelector('.obs-form-row__desc')?.value ?? '').trim(),
    }))
    .filter((item) => String(item.name ?? '').trim());
}

let selectedObservationIds = new Set();
let isDeletingObservations = false;
let isObsSelectionMode = false;
let visibleObservationIds = [];

const OBS_TIME_FILTER_LABELS = {
  all: '全部',
  createdToday: '今日',
};
const DEFAULT_OBS_TIME_FILTER = 'createdToday';
let obsTimeFilter = DEFAULT_OBS_TIME_FILTER;

function normalizeObsTimeFilter(value) {
  return value === 'createdToday' ? 'createdToday' : 'all';
}

function renderObsFilterTabs() {
  const tabsEl = document.getElementById('obs-filter-tabs');
  renderAdminTabGroup(tabsEl, OBS_TIME_FILTER_LABELS, normalizeObsTimeFilter(obsTimeFilter), 'obs-time-filter');
}

function getVisibleObservationIds() {
  const domIds = Array.from(document.querySelectorAll('#obs-list .admin-item__select'))
    .map((el) => String(el.getAttribute('data-id') ?? '').trim())
    .filter(Boolean);
  return domIds.length ? domIds : visibleObservationIds;
}

function syncObsSelectionWithRows(records) {
  const items = flattenOpportunityItems(records);
  visibleObservationIds = items.map((item) => String(item?.itemKey ?? '').trim()).filter(Boolean);
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
  editingOppTarget = null;
  updateObsSelectionControls();
  updateObsAddButton();
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

function confirmDeleteObservations() {
  return true;
}

function showObsDeleteError() {
}

async function deleteSelectedObservations() {
  const keys = Array.from(selectedObservationIds);
  if (!keys.length || isDeletingObservations) return;
  if (!confirmDeleteObservations(keys.length)) return;
  setObsDeleteLoading(true);
  try {
    const remainingByDay = new Map();
    for (const record of latestObservationRecords) {
      const dayKey = getObservationDayKey(getObservationRecordDayDate(record));
      if (!remainingByDay.has(dayKey)) {
        remainingByDay.set(dayKey, {
          records: [],
          items: [],
        });
      }
      remainingByDay.get(dayKey).records.push(record);
    }
    remainingByDay.forEach((group) => {
      group.items = flattenOpportunityItems(group.records)
        .filter((item) => !selectedObservationIds.has(item.itemKey));
    });
    const tasks = [];
    remainingByDay.forEach((group) => {
      const originalCount = flattenOpportunityItems(group.records).length;
      if (group.items.length === originalCount) return;
      tasks.push(persistDayOpportunityBoard(group.records, group.items));
    });
    await Promise.all(tasks);
    selectedObservationIds.clear();
    isObsSelectionMode = false;
    await renderObservationsPage();
  } catch {
    showObsDeleteError();
  } finally {
    setObsDeleteLoading(false);
  }
}

function updateObsAddButton() {
  const btn = document.getElementById('obs-add-btn');
  if (!btn) return;
  const count = getTodayOpportunityCount();
  const full = count >= OPP_RANK_MAX;
  btn.disabled = full || isSavingObservation || isPersistingOpp || isDeletingObservations;
  btn.textContent = full ? `今日已满 ${OPP_RANK_MAX} 个` : '加入机会';
}

async function renderObservationsPage() {
  const listEl = document.getElementById('obs-list');
  if (!listEl) return;

  renderObsFilterTabs();
  listEl.innerHTML = '<p class="obs-loading">加载中...</p>';

  try {
    const records = await fetchObservationRecords(obsTimeFilter);
    latestObservationRecords = records;
    const groups = groupObservationRecordsByDay(records)
      .map((group) => ({
        ...group,
        items: flattenOpportunityItems(group.records),
      }))
      .filter((group) => group.items.length);
    if (!groups.length) {
      visibleObservationIds = [];
      selectedObservationIds.clear();
      listEl.innerHTML = obsTimeFilter === 'createdToday'
        ? '<p class="obs-empty">今日暂无机会，点击下方加入。</p>'
        : '<p class="obs-empty">暂无机会，点击下方加入。</p>';
      updateObsSelectionControls();
      updateObsAddButton();
      syncAdminCountdownTimer();
      return;
    }
    syncObsSelectionWithRows(records);
    const isTodayOnly = obsTimeFilter === 'createdToday';
    listEl.innerHTML = groups.map((group) => {
      const countLabel = `${group.items.length}/${OPP_RANK_MAX}`;
      const title = isTodayOnly
        ? `今日 · ${countLabel}`
        : `${formatObservationDateLabel(group.date)} · ${countLabel}`;
      return `<section class="obs-board">${renderOpportunityBoard(group.items, { title })}</section>`;
    }).join('');
    updateObsSelectionControls();
    updateObsAddButton();
    updateAdminCountdowns();
    syncAdminCountdownTimer();
  } catch (err) {
    latestObservationRecords = [];
    visibleObservationIds = [];
    selectedObservationIds.clear();
    listEl.innerHTML = `<p class="obs-error">加载失败：${escapeHtml(String(err?.message || '未知错误'))}</p>`;
    updateObsSelectionControls();
    updateObsAddButton();
    syncAdminCountdownTimer();
  }
}

function openObservationFormPicker(item = null) {
  const picker = document.getElementById('obs-form-picker');
  const errorEl = document.getElementById('obs-form-error');
  if (!picker) return;
  const source = item && typeof item === 'object' && item.itemKey ? item : null;
  if (!source && getTodayOpportunityCount() >= OPP_RANK_MAX) {
    showToast(`今日最多 ${OPP_RANK_MAX} 个机会`);
    return;
  }
  editingOppTarget = source
    ? { itemKey: source.itemKey, item: source }
    : null;
  renderObservationFormList(source || {});
  if (errorEl) errorEl.textContent = '';
  picker.hidden = false;
}

function closeObservationFormPicker() {
  const picker = document.getElementById('obs-form-picker');
  const listEl = document.getElementById('obs-form-list');
  const errorEl = document.getElementById('obs-form-error');
  if (!picker) return;
  picker.hidden = true;
  editingOppTarget = null;
  if (listEl) listEl.innerHTML = '';
  if (errorEl) errorEl.textContent = '';
}

let isSavingObservation = false;

async function submitObservationForm() {
  const errorEl = document.getElementById('obs-form-error');
  const submitBtn = document.getElementById('obs-form-submit');
  const items = collectObservationFormItems();
  if (!items.length) {
    if (errorEl) errorEl.textContent = '请填写名称。';
    document.querySelector('#obs-form-list .obs-form-row__name')?.focus();
    return;
  }
  const item = items[0];
  if (errorEl) errorEl.textContent = '';
  if (isSavingObservation) return;

  isSavingObservation = true;
  updateObsAddButton();
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '保存中';
  }

  try {
    if (editingOppTarget?.itemKey) {
      const dayRecords = getDayRecordsForItemKey(editingOppTarget.itemKey);
      const current = flattenOpportunityItems(dayRecords);
      const next = current.map((entry) => (
        entry.itemKey === editingOppTarget.itemKey
          ? {
            ...entry,
            name: item.name,
            description: item.description,
          }
          : entry
      ));
      await persistDayOpportunityBoard(dayRecords, next);
      closeObservationFormPicker();
      showToast('已更新');
    } else {
      const todayRecords = await fetchObservationRecords('createdToday');
      const current = flattenOpportunityItems(todayRecords);
      if (current.length >= OPP_RANK_MAX) {
        throw new Error(`今日最多 ${OPP_RANK_MAX} 个机会`);
      }
      await persistDayOpportunityBoard(todayRecords, [
        ...current,
        {
          id: makeObservationItemId(),
          rank: current.length + 1,
          name: item.name,
          description: item.description,
        },
      ]);
      closeObservationFormPicker();
      showToast('已加入今日榜');
    }
    if (currentPage === 'observations') await renderObservationsPage();
  } catch (err) {
    if (errorEl) errorEl.textContent = `保存失败：${String(err?.message || '未知错误')}`;
  } finally {
    isSavingObservation = false;
    updateObsAddButton();
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '保存';
    }
  }
}

async function moveOpportunityItem(itemKey, delta) {
  const key = String(itemKey ?? '').trim();
  const step = Number(delta);
  if (!key || !Number.isFinite(step) || !step || isPersistingOpp || isObsSelectionMode) return;
  const dayRecords = getDayRecordsForItemKey(key);
  const current = flattenOpportunityItems(dayRecords);
  const index = current.findIndex((item) => item.itemKey === key);
  const nextIndex = index + step;
  if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;
  const next = current.slice();
  const [moved] = next.splice(index, 1);
  next.splice(nextIndex, 0, moved);
  isPersistingOpp = true;
  updateObsAddButton();
  try {
    await persistDayOpportunityBoard(dayRecords, next.map((item, rankIndex) => ({
      ...item,
      rank: rankIndex + 1,
    })));
    await renderObservationsPage();
  } catch (err) {
    showToast(`排序失败：${String(err?.message || '未知错误')}`);
  } finally {
    isPersistingOpp = false;
    updateObsAddButton();
  }
}

function findOpportunityItemByKey(itemKey) {
  const records = getDayRecordsForItemKey(itemKey);
  return flattenOpportunityItems(records).find((item) => item.itemKey === itemKey) || null;
}

function setFrontMode(mode, options = {}) {
  const next = normalizeFrontMode(mode);
  if (editingStrategyId && !options.force && next !== frontMode) return;
  frontMode = next;
  const trendPanel = document.getElementById('front-trend-panel');
  const fishPanel = document.getElementById('front-fish-panel');
  if (trendPanel) trendPanel.hidden = frontMode !== FRONT_MODE_TREND;
  if (fishPanel) fishPanel.hidden = frontMode !== FRONT_MODE_FISH;
  syncFrontModeSwitchUI();
  if (!isFrontPage()) return;
  updateSaveButtonLabels();
  updateHeaderClearButton();
  updateTradeModeAppearance();
  if (frontMode === FRONT_MODE_FISH) autoGenerateFishIfReady();
  else autoGenerateIfReady();
}

function setPage(mode, options = {}) {
  const { preserveFrontForm = false } = options;
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

  // 兼容旧入口：trend / assist / fish 都归入前台
  let requestedMode = mode;
  let requestedFrontMode = options.frontMode ?? null;
  if (mode === 'trend') {
    requestedMode = 'front';
    requestedFrontMode = FRONT_MODE_TREND;
  } else if (mode === 'assist') {
    requestedMode = 'front';
    requestedFrontMode = FRONT_MODE_TREND;
  } else if (mode === 'fish') {
    requestedMode = 'front';
    requestedFrontMode = FRONT_MODE_FISH;
  }

  const allowedPages = ['admin', 'stats', 'methodology', 'cases', 'observations', 'front'];
  const normalizedMode = allowedPages.includes(requestedMode) ? requestedMode : 'front';
  const wasFront = isFrontPage(currentPage);
  const wasEditing = Boolean(editingStrategyId);
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
  btnMethodology.classList.toggle('is-active', toMethodology);
  btnCases.classList.toggle('is-active', toCases);
  btnObservations.classList.toggle('is-active', toObservations);
  btnObservations.setAttribute('aria-selected', toObservations ? 'true' : 'false');

  const moreToggle = document.getElementById('admin-more-toggle');
  if (moreToggle) {
    moreToggle.classList.toggle('is-active', toStats || toMethodology || toCases);
  }
  closeAdminMoreMenu();

  if (!toObservations) resetObsPageState();

  updateHeaderClearButton();

  if (toAdmin) {
    const restoreId = String(pendingAdminFocusId || '').trim();
    const keepAdminState = Boolean(restoreId) || wasEditing;
    resetFrontPage();
    resetAssistPage();
    resetFishPage();
    if (keepAdminState) closeOutcomeStatusPicker();
    else resetAdminPageState();
    pendingAdminFocusId = '';
    restoreUnitCostInput();
    renderAdminList()
      .then(() => {
        if (restoreId) scrollAdminItemIntoView(restoreId);
      })
      .catch(() => {});
  } else if (toStats) {
    pendingAdminFocusId = '';
    resetFrontPage();
    resetAssistPage();
    resetFishPage();
    resetAdminPageState();
    renderStatsPage().catch(() => {});
  } else if (toMethodology) {
    pendingAdminFocusId = '';
    resetFrontPage();
    resetAssistPage();
    resetFishPage();
    resetAdminPageState();
    renderMethodologyPage();
  } else if (toCases) {
    pendingAdminFocusId = '';
    resetFrontPage();
    resetAssistPage();
    resetFishPage();
    resetAdminPageState();
    renderCasesPage().catch(() => {});
  } else if (toObservations) {
    pendingAdminFocusId = '';
    resetFrontPage();
    resetAssistPage();
    resetFishPage();
    resetAdminPageState();
    resetObsPageState();
    renderObservationsPage().catch(() => {});
  } else if (toFront) {
    if (preserveFrontForm) closeOutcomeStatusPicker();
    else resetAdminPageState();
    if (!wasFront) {
      if (!preserveFrontForm) {
        resetFrontPage();
        resetAssistPage();
        resetFishPage();
        frontMode = FRONT_MODE_TREND;
      }
    }
    if (requestedFrontMode) {
      frontMode = normalizeFrontMode(requestedFrontMode);
    }
    setFrontMode(frontMode, { force: options.forceFrontMode === true });
    if (preserveFrontForm) {
      updateSaveButtonLabels();
      updateHeaderClearButton();
    }
    syncPinButtonUI();
  }

  syncAdminCountdownTimer();
}

function showToast() {
  const toast = document.getElementById('app-toast');
  if (!toast) return;
  if (toast._toastTimer) {
    clearTimeout(toast._toastTimer);
    toast._toastTimer = null;
  }
  toast.hidden = true;
  toast.textContent = '';
}

function flashCopyStrategyBtn(btn) {
  if (!btn) return;
  if (btn._flashTimer) {
    clearTimeout(btn._flashTimer);
    btn._flashTimer = null;
  }
  btn.textContent = btn.dataset.defaultLabel || '保存';
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
    const record = enrichStrategyRecordForSubmit({
      ...currentStrategyRecord,
      strategyName: name,
    });
    logSave('info', 'record 已就绪', record);
    const isEditing = Boolean(editingStrategyId);
    try {
      if (isEditing) {
        await updateStrategy(editingStrategyId, record);
      } else {
        await createStrategy(record);
      }
      saved = true;
      logSave('info', isEditing ? '更新成功' : '保存成功');
    } catch (err) {
      logSave('error', 'Supabase 保存失败', {
        message: err?.message || String(err),
      });
      if (errEl) errEl.textContent = formatStrategySaveError(err);
      flashCopyStrategyBtn(btn, '保存失败');
      return;
    }
    if (saved) {
      clearEditingStrategy();
      setPage('admin');
    }
    flashCopyStrategyBtn(btn, saved ? (isEditing ? '已修改' : '已保存') : '保存失败');
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

function togglePinDraft() {
  if (!editingStrategyId || !editingStrategyPreserve) return;
  const nextPinned = !isStrategyPinned({ viewState: editingStrategyPreserve.viewState });
  editingStrategyPreserve.viewState = setPinnedInViewState(
    editingStrategyPreserve.viewState,
    nextPinned,
  );
  syncPinButtonUI();
}

const btnTogglePin = document.getElementById('btn-toggle-pin');
if (btnTogglePin) btnTogglePin.addEventListener('click', togglePinDraft);

let isSavingAssist = false;

async function saveAssistOutput() {
  const btn = document.getElementById('btn-save-assist');
  const errEl = document.getElementById('assist-error');
  const nameEl = document.getElementById('assist-name-input');
  const name = String(nameEl?.value ?? '').trim();
  if (!name) {
    if (errEl) errEl.textContent = '保存前请填写名称。';
    flashCopyStrategyBtn(btn, '请填名称');
    return;
  }
  if (errEl) errEl.textContent = '';
  if (!currentAssistCopyText || !currentAssistRecord) {
    flashCopyStrategyBtn(btn, '无内容');
    return;
  }
  if (isSavingAssist) return;
  isSavingAssist = true;
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
  const isEditing = Boolean(editingStrategyId);
  try {
    const record = enrichStrategyRecordForSubmit({
      ...currentAssistRecord,
      strategyName: name,
    });
    if (isEditing) {
      await updateStrategy(editingStrategyId, record);
    } else {
      await createStrategy(record);
    }
    saved = true;
    clearEditingStrategy();
    setPage('admin');
    flashCopyStrategyBtn(btn, isEditing ? '已修改' : '已保存');
  } catch (err) {
    logSave('error', '顺势而为保存失败', {
      message: err?.message || String(err),
    });
    if (errEl) errEl.textContent = formatStrategySaveError(err);
    flashCopyStrategyBtn(btn, '保存失败');
  } finally {
    isSavingAssist = false;
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      if (!saved && !btn._flashTimer) {
        btn.textContent = btn.dataset.defaultLabel || '保存';
      }
    }
  }
}

const btnSaveAssist = document.getElementById('btn-save-assist');
if (btnSaveAssist) btnSaveAssist.addEventListener('click', () => {
  saveAssistOutput().catch(() => {});
});

let isSavingFish = false;

async function saveFishOutput() {
  const btn = document.getElementById('btn-save-fish');
  const errEl = document.getElementById('fish-error');
  const nameEl = document.getElementById('fish-name-input');
  const name = String(nameEl?.value ?? '').trim();
  if (!name) {
    if (errEl) errEl.textContent = '保存前请填写名称。';
    flashCopyStrategyBtn(btn, '请填名称');
    return;
  }
  if (errEl) errEl.textContent = '';
  if (!currentFishCopyText || !currentFishRecord) {
    flashCopyStrategyBtn(btn, '无内容');
    return;
  }
  if (isSavingFish) return;
  isSavingFish = true;
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
  const isEditing = Boolean(editingStrategyId);
  try {
    const record = enrichStrategyRecordForSubmit({
      ...currentFishRecord,
      strategyName: name,
    });
    if (isEditing) {
      await updateStrategy(editingStrategyId, record);
    } else {
      await createStrategy(record);
    }
    saved = true;
    clearEditingStrategy();
    setPage('admin');
    flashCopyStrategyBtn(btn, isEditing ? '已修改' : '已保存');
  } catch (err) {
    logSave('error', '吃鱼助手保存失败', {
      message: err?.message || String(err),
    });
    if (errEl) errEl.textContent = formatStrategySaveError(err);
    flashCopyStrategyBtn(btn, '保存失败');
  } finally {
    isSavingFish = false;
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      if (!saved && !btn._flashTimer) {
        btn.textContent = btn.dataset.defaultLabel || '保存';
      }
    }
  }
}

const btnSaveFish = document.getElementById('btn-save-fish');
if (btnSaveFish) btnSaveFish.addEventListener('click', () => {
  saveFishOutput().catch(() => {});
});

const fishNameInput = document.getElementById('fish-name-input');
const fishFromInput = document.getElementById('fish-from-input');
const fishToInput = document.getElementById('fish-to-input');
if (fishNameInput) fishNameInput.addEventListener('input', autoGenerateFishIfReady);
if (fishFromInput) fishFromInput.addEventListener('input', autoGenerateFishIfReady);
if (fishToInput) fishToInput.addEventListener('input', autoGenerateFishIfReady);

const assistNameInput = document.getElementById('assist-name-input');
const assistFromInput = document.getElementById('assist-from-input');
const assistToInput = document.getElementById('assist-to-input');
if (assistNameInput) assistNameInput.addEventListener('input', autoGenerateAssistIfReady);
if (assistFromInput) assistFromInput.addEventListener('input', autoGenerateAssistIfReady);
if (assistToInput) assistToInput.addEventListener('input', autoGenerateAssistIfReady);

const clearAll = () => {
  if (isFrontPage() && editingStrategyId) {
    setPage('admin');
    return;
  }
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
const btnUnitCostSave = document.getElementById('unit-cost-save');
if (btnUnitCostSave) btnUnitCostSave.addEventListener('click', () => {
  handleUnitCostSave().catch(() => {});
});
const unitCostInput = document.getElementById('unit-cost-input');
if (unitCostInput) {
  unitCostInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUnitCostSave().catch(() => {});
    }
  });
}
const btnTabMethodology = document.getElementById('btn-tab-methodology');
if (btnTabMethodology) btnTabMethodology.addEventListener('click', () => setPage('methodology'));
const btnTabCases = document.getElementById('btn-tab-cases');
if (btnTabCases) btnTabCases.addEventListener('click', () => setPage('cases'));
const btnTabObservations = document.getElementById('btn-tab-observations');
if (btnTabObservations) btnTabObservations.addEventListener('click', () => setPage('observations'));
document.querySelectorAll('[data-timeframe]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const scope = btn.closest('#front-assist-panel') ? 'assist' : 'trend';
    setFrontTimeframeMode(btn.getAttribute('data-timeframe'), { scope });
  });
});

const btnFrontModeTrend = document.getElementById('btn-front-mode-trend');
if (btnFrontModeTrend) btnFrontModeTrend.addEventListener('click', () => setFrontMode(FRONT_MODE_TREND));
const btnFrontModeFish = document.getElementById('btn-front-mode-fish');
if (btnFrontModeFish) btnFrontModeFish.addEventListener('click', () => setFrontMode(FRONT_MODE_FISH));

function isAdminMoreMenuOpen() {
  const menu = document.getElementById('admin-more-menu');
  return Boolean(menu && !menu.hidden);
}

function openAdminMoreMenu() {
  const menu = document.getElementById('admin-more-menu');
  const toggle = document.getElementById('admin-more-toggle');
  if (!menu || !toggle) return;
  menu.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
}

function closeAdminMoreMenu() {
  const menu = document.getElementById('admin-more-menu');
  const toggle = document.getElementById('admin-more-toggle');
  if (!menu || !toggle) return;
  menu.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
}

function toggleAdminMoreMenu() {
  if (isAdminMoreMenuOpen()) closeAdminMoreMenu();
  else openAdminMoreMenu();
}

const adminMoreToggle = document.getElementById('admin-more-toggle');
if (adminMoreToggle) {
  adminMoreToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleAdminMoreMenu();
  });
}

document.addEventListener('click', (e) => {
  if (!isAdminMoreMenuOpen()) return;
  const more = document.querySelector('.admin-more');
  const target = e.target;
  if (more && target instanceof Node && more.contains(target)) return;
  closeAdminMoreMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (isAdminMoreMenuOpen()) closeAdminMoreMenu();
  if (isUnpinAllArmed) {
    disarmUnpinAll();
    renderAdminActiveNames();
  }
});

const obsAddBtn = document.getElementById('obs-add-btn');
if (obsAddBtn) obsAddBtn.addEventListener('click', () => openObservationFormPicker());

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
  obsListEl.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;
    const moveBtn = target.closest('[data-opp-move]');
    if (moveBtn) {
      e.preventDefault();
      moveOpportunityItem(moveBtn.getAttribute('data-opp-key'), moveBtn.getAttribute('data-opp-move'))
        .catch(() => {});
      return;
    }
    if (isObsSelectionMode) return;
    if (target.closest('.admin-item__selector')) return;
    const row = target.closest('[data-opp-key]');
    if (!row) return;
    const item = findOpportunityItemByKey(row.getAttribute('data-opp-key'));
    if (!item) return;
    openObservationFormPicker(item);
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
    }
  });
}

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
    disarmUnpinAll();
    adminTimeFilter = nextFilter;
    adminNameFilter = '';
    adminSortByExpiresAsc = false;
    renderAdminList().catch(() => {});
  });
}

const obsFilterTabsEl = document.getElementById('obs-filter-tabs');
if (obsFilterTabsEl) {
  obsFilterTabsEl.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target.closest('[data-obs-time-filter]') : null;
    if (!target) return;
    const nextFilter = normalizeObsTimeFilter(target.getAttribute('data-obs-time-filter'));
    if (obsTimeFilter === nextFilter) return;
    obsTimeFilter = nextFilter;
    renderObservationsPage().catch(() => {});
  });
}

const adminActiveNamesEl = document.getElementById('admin-active-names');
if (adminActiveNamesEl) {
  adminActiveNamesEl.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;
    if (target.closest('[data-admin-sort-expires]')) {
      toggleAdminSortByExpires();
      return;
    }
    if (target.closest('[data-admin-unpin-all]')) {
      requestUnpinDisplayedAdminStrategies();
      return;
    }
    const nameTarget = target.closest('[data-admin-name-filter]');
    if (!nameTarget) return;
    const name = nameTarget.getAttribute('data-admin-name-filter');
    if (!name) return;
    toggleAdminNameFilter(name);
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

    const copyBtn = target.closest('.admin-copy-value');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const text = String(copyBtn.getAttribute('data-copy-text') ?? '').trim();
      if (!text) return;
      const ok = await copyTextToClipboard(text);
      showToast(ok ? '已复制' : '复制失败');
      return;
    }

    const editBtn = target.closest('[data-admin-edit]');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = String(editBtn.getAttribute('data-id') ?? '').trim();
      if (!id || isAdminSelectionMode || isDeletingStrategies) return;
      const row = latestAdminRows.find((item) => String(item?.id ?? '').trim() === id);
      const displayId = String(editBtn.closest('.admin-item')?.getAttribute('data-id') ?? id).trim();
      if (row) startEditStrategy(row, { focusId: displayId });
      return;
    }

    const modeCycleBtn = target.closest('[data-admin-mode-cycle]');
    if (modeCycleBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = String(modeCycleBtn.getAttribute('data-id') ?? '').trim();
      if (!id || modeCycleBtn.disabled) return;
      const row = latestAdminRows.find((item) => String(item?.id ?? '').trim() === id);
      if (!row) return;
      const nextMode = getNextCycledViewMode(row);
      if (!nextMode) {
        showToast('当前单据无法切换趋势力预测');
        return;
      }
      setAdminStrategyViewMode(id, row, nextMode);
      return;
    }

    const counterFoldBtn = target.closest('[data-counter-fold]');
    if (counterFoldBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = String(counterFoldBtn.getAttribute('data-id') ?? '').trim();
      if (!id) return;
      if (expandedCounterTrendIds.has(id)) expandedCounterTrendIds.delete(id);
      else expandedCounterTrendIds.add(id);
      renderAdminListItems();
      return;
    }

    const concessionSelectRow = target.closest('[data-admin-concession-select]');
    if (concessionSelectRow) {
      e.preventDefault();
      e.stopPropagation();
      if (isAdminSelectionMode || isDeletingStrategies) return;
      const id = String(concessionSelectRow.getAttribute('data-id') ?? '').trim();
      if (!id) return;
      const row = latestAdminRows.find((item) => String(item?.id ?? '').trim() === id);
      if (!row) return;
      const rateRaw = String(concessionSelectRow.getAttribute('data-rate') ?? '').trim();
      const priceRaw = String(concessionSelectRow.getAttribute('data-price') ?? '').trim();
      const rate = Number(rateRaw);
      const price = toNumber(priceRaw);
      const current = getSelectedConcessionFromRow(row);
      const sameRate = current?.rate != null && Number.isFinite(rate) && Math.abs(current.rate - rate) < 1e-9;
      const samePrice = current?.price != null && price != null && current.price === price;
      // 已选中同一行则保持，不再取消；点其他行则切换（同 tab）
      if (sameRate || samePrice) return;
      setSelectedConcession(id, row, {
        rate: Number.isFinite(rate) ? rate : null,
        price,
      }).catch(() => {});
      return;
    }

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

window.addEventListener('storage', (e) => {
  if (e.key !== AUTH_STORAGE_KEY) return;
  if (!e.newValue) {
    authSession = null;
    if (authRefreshTimer) {
      clearTimeout(authRefreshTimer);
      authRefreshTimer = null;
    }
    return;
  }
  syncAuthSessionFromStorage();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !authSession?.refresh_token) return;
  if (!isAccessTokenValid()) {
    refreshAuthSessionSafe().catch((err) => {
      if (isAuthRefreshTokenInvalid(err)) forceLogout();
    });
  }
});

initApp().catch(() => showLoginPage());
