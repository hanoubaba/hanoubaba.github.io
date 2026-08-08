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

const ADMIN_DECIMAL_PLACES = 3;

/** 后台价格：按输入/存储精度展示，去掉尾随 0 */
function formatAdminPriceFromValue(value, decimalPlaces) {
  const n = toNumber(value);
  if (n == null) return String(value ?? '').trim();
  const decimals = Math.max(0, Math.min(20, Math.floor(Number(decimalPlaces) || 0)));
  return formatTrimmedFixedDecimals(n, decimals);
}

/** 后台数量：最多 3 位小数，去掉尾随 0 */
function formatAdminDecimalFromValue(value, maxDecimals = ADMIN_DECIMAL_PLACES) {
  const n = toNumber(value);
  if (n == null) return String(value ?? '').trim();
  return formatTrimmedFixedDecimals(n, maxDecimals);
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

const TIMEFRAME_MINUTES = {
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

const TIMEFRAME_LABELS = {
  '1h': '1小时',
  '4h': '4小时',
  '1d': '1天',
};

function normalizeTimeframeMode(mode) {
  const value = String(mode ?? '').trim();
  return TIMEFRAME_MINUTES[value] ? value : DEFAULT_TIMEFRAME;
}

let frontTimeframeMode = DEFAULT_TIMEFRAME;

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
const OPEN_COST_TOTAL_PREMIUM_LEVELS = [500, 1000];
const TAKE_PROFIT_R_MULTIPLE = 1;
const REF_TAKE_PROFIT_R_LOW = 3;
const REF_TAKE_PROFIT_R_HIGH = 5;
const STRATEGY_DURATION_PERIODS = 10;
/** 反趋势：挂单档位 = 原策略 3/4/5 倍止盈价，止损 = 10 倍止盈价 */
const COUNTER_TREND_ENTRY_MULTIPLES = [3, 4, 5];
const COUNTER_TREND_STOP_MULTIPLE = 10;
/** 辅助开单：10%/20% 复用最小让利档（30%）仓位；本金仅 30%/48% 按 3:2 分配；80% 仅展示 */
const ASSIST_TIER_RATIOS = [
  { rate: 0.1, label: '10%', reuseMinTierCost: true },
  { rate: 0.2, label: '20%', reuseMinTierCost: true },
  { rate: 0.3, label: '30%', costShare: 3 / 5 },
  { rate: 0.48, label: '48%', costShare: 2 / 5 },
  { rate: 0.8, label: '80%', costShare: 0 },
];
/** 兼容旧辅助开单比例识别 */
const ASSIST_TIER_RATES_LEGACY = [1 / 3, 1 / 2, 2 / 3];
const ASSIST_TIER_RATES_LEGACY_66 = [0.3, 0.5, 0.66];
const ASSIST_TIER_RATES_LEGACY_70 = [0.3, 0.5, 0.7];
const ASSIST_TIER_RATES_LEGACY_75 = [0.33, 0.48, 0.75];
const ASSIST_TIER_RATES_LEGACY_30_48_80 = [0.3, 0.48, 0.8];
const ASSIST_TITLE_SUFFIX = ' (反趋势辅助)';

function clampOpenCostMultiplier(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return OPEN_COST_MULTIPLIER_DEFAULT;
  return Math.min(OPEN_COST_MULTIPLIER_MAX, Math.max(OPEN_COST_MULTIPLIER_MIN, n));
}

function getTimeframeMode() {
  return frontTimeframeMode;
}

function getTimeframeMinutes(mode = getTimeframeMode()) {
  return TIMEFRAME_MINUTES[mode] ?? TIMEFRAME_MINUTES[DEFAULT_TIMEFRAME];
}

function getTimeframeLabel(mode) {
  const value = String(mode ?? '').trim();
  return TIMEFRAME_LABELS[value] || value;
}

const FRONT_PAGES = ['front'];
const FRONT_MODE_TREND = 'trend';
const FRONT_MODE_ASSIST = 'assist';
let frontMode = FRONT_MODE_TREND;

function normalizeFrontMode(mode) {
  return mode === FRONT_MODE_ASSIST ? FRONT_MODE_ASSIST : FRONT_MODE_TREND;
}

function isFrontPage(page = currentPage) {
  return page === 'front' || FRONT_PAGES.includes(page);
}

function isFrontAssistMode() {
  return isFrontPage() && frontMode === FRONT_MODE_ASSIST;
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

function getAdminOpenCostMultiplier(strategyId, row) {
  const storedMultiplier = toNumber(row?.openCostMultiplier);
  if (storedMultiplier != null && storedMultiplier > 0) {
    return clampOpenCostMultiplier(storedMultiplier);
  }
  const storedTotal = getOpenCostTotalFromRow(row);
  if (storedTotal != null && storedTotal > 0) {
    return clampOpenCostMultiplier(storedTotal / OPEN_COST_BASE);
  }
  return OPEN_COST_MULTIPLIER_DEFAULT;
}

function setAdminRowCostFields(row, multiplier) {
  if (!row) return null;
  const nextMultiplier = clampOpenCostMultiplier(multiplier);
  const openCostTotal = getOpenCostTotal(nextMultiplier);
  const tierCount = getTierCountFromRow(row);
  const nextRow = {
    ...row,
    openCostMultiplier: nextMultiplier,
    openCostTotal,
    openCost: openCostTotal / tierCount,
    grade: getStrategyGradeFromOpenCost(openCostTotal / tierCount, openCostTotal, tierCount),
  };
  const strategyType = getAdminStrategyTypeInfo(row).type;
  if (strategyType === 'trend') {
    nextRow.concessions = buildTrendAdminConcessions(nextRow, nextMultiplier);
    const primaryItem = nextRow.concessions.find((item) => Math.abs(Number(item.rate)) < 1e-9);
    if (primaryItem?.quantity) nextRow.quantity = primaryItem.quantity;
  } else if (strategyType === 'assist') {
    nextRow.concessions = buildAssistConcessionsFromRow(nextRow, nextMultiplier);
    const primaryItem = nextRow.concessions[0];
    if (primaryItem?.quantity) nextRow.quantity = primaryItem.quantity;
    if (primaryItem?.price) nextRow.entryPrice = primaryItem.price;
  }
  return nextRow;
}

async function setAdminOpenCostMultiplier(strategyId, value, row) {
  const id = String(strategyId ?? '').trim();
  if (!id || updatingAdminCostIds.has(id)) return;
  const nextMultiplier = clampOpenCostMultiplier(value);
  const nextRow = setAdminRowCostFields(row, nextMultiplier);
  if (!nextRow) return;
  updatingAdminCostIds.add(id);
  renderAdminListItems();
  try {
    await updateStrategyOpenCost(id, nextRow);
    latestAdminRows = latestAdminRows.map((item) => (
      String(item?.id ?? '').trim() === id ? nextRow : item
    ));
  } finally {
    updatingAdminCostIds.delete(id);
    renderAdminListItems();
    renderAdminActiveNames();
  }
}

function buildAdminCostMultiplierHtml(strategyId, multiplier) {
  const rawId = String(strategyId ?? '').trim();
  const id = escapeHtml(rawId);
  const value = clampOpenCostMultiplier(multiplier);
  const isSyncing = updatingAdminCostIds.has(rawId);
  const minusDisabled = isSyncing || value <= OPEN_COST_MULTIPLIER_MIN ? ' disabled' : '';
  const plusDisabled = isSyncing || value >= OPEN_COST_MULTIPLIER_MAX ? ' disabled' : '';
  return [
    `<div class="admin-cost-multiplier__stepper" role="group" aria-label="成本倍数" data-id="${id}">`,
    `<button type="button" class="admin-cost-multiplier__btn" data-cost-multiplier-delta="-1" data-id="${id}" aria-label="减少倍数"${minusDisabled}>−</button>`,
    `<span class="admin-cost-multiplier__value" aria-live="polite">${value}</span>`,
    `<button type="button" class="admin-cost-multiplier__btn" data-cost-multiplier-delta="1" data-id="${id}" aria-label="增加倍数"${plusDisabled}>+</button>`,
    '</div>',
  ].join('');
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
  const openCostTotal = getOpenCostTotalFromRow(row);
  if (entryPrice == null || stopLoss == null || !(openCostTotal > 0)) return null;

  const decimalPlaces = getPriceDecimalPlacesFromValues(
    row?.entryPrice,
    row?.stopLossPrice,
    row?.inputPrice,
    row?.inputStopLoss,
  );
  const currentConcessions = buildAdminConcessionsForRow(row);
  const reverse = inferReverseFromConcessions(entryPrice, stopLoss, currentConcessions, decimalPlaces);
  return buildConcessionItems(entryPrice, stopLoss, openCostTotal, decimalPlaces, getConcessionRates(), reverse);
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

function isCurrentTrendConcessionSet(concessions) {
  const rates = getSortedDisplayRates(concessions);
  return ratesMatch(rates, [0, 0.1, 0.2, 0.5, 0.8])
    || ratesMatch(rates, [0.2, 0.5, 0.8])
    || ratesMatch(rates, [0, 0.3, 0.8]);
}

function isAssistConcessionSet(concessions) {
  const rates = getSortedDisplayRates(concessions);
  return ratesMatch(rates, ASSIST_TIER_RATIOS.map((item) => item.rate))
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_66)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_70)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_75)
    || ratesMatch(rates, ASSIST_TIER_RATES_LEGACY_30_48_80);
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

function getAdminStrategyTypeInfo(row) {
  const rawConcessions = hasConcessions(row?.concessions) ? row.concessions : [];
  if (isAssistConcessionSet(rawConcessions)) {
    return { label: '反趋势辅助', type: 'assist' };
  }
  const savedConcessions = buildAdminConcessionsForRow(row);
  if (isAssistConcessionSet(savedConcessions)) {
    return { label: '反趋势辅助', type: 'assist' };
  }
  return { label: '趋势跟随', type: 'trend' };
}

function buildAdminDisplayConcessions(row) {
  const savedConcessions = buildAdminConcessionsForRow(row);
  if (isCurrentTrendConcessionSet(savedConcessions)) {
    return savedConcessions;
  }
  return buildUnifiedConcessionsForRow(row) || savedConcessions;
}

function buildTrendAdminConcessions(row, multiplier = OPEN_COST_MULTIPLIER_DEFAULT) {
  const entryPrice = toNumber(row?.entryPrice);
  const stopLoss = toNumber(row?.stopLossPrice);
  const openCostTotal = getOpenCostTotal(multiplier);
  if (entryPrice == null || stopLoss == null || !(openCostTotal > 0)) return [];

  const decimalPlaces = getAdminPriceDecimalPlacesFromRow(row);
  const savedConcessions = buildAdminConcessionsForRow(row);
  const reverse = inferReverseFromConcessions(entryPrice, stopLoss, savedConcessions, decimalPlaces);
  return buildConcessionItems(entryPrice, stopLoss, openCostTotal, decimalPlaces, getConcessionRates(), reverse);
}

const STRATEGY_VIEW_MODE_TREND = 'trend';
const STRATEGY_VIEW_MODE_COUNTER = 'counter_trend';

function normalizeStrategyViewMode(value) {
  return value === STRATEGY_VIEW_MODE_COUNTER
    ? STRATEGY_VIEW_MODE_COUNTER
    : STRATEGY_VIEW_MODE_TREND;
}

/**
 * 反趋势策略：以原策略 R 倍数推算挂单价与止损。
 * 例：开 10 / 止 9 → 挂 13、14、15，止损 20；本金均分三档后 qty = 档本金 / |价-止损|
 * 参考止盈取原开仓价；时间范围接在原策略结束后再排 10 个周期。
 */
function buildCounterTrendConcessions(row, multiplier = OPEN_COST_MULTIPLIER_DEFAULT) {
  const entryPrice = toNumber(row?.entryPrice);
  const stopLoss = toNumber(row?.stopLossPrice);
  const openCostTotal = getOpenCostTotal(multiplier);
  if (
    entryPrice == null
    || stopLoss == null
    || entryPrice === stopLoss
    || !(openCostTotal > 0)
  ) {
    return { items: [], stopLoss: null, refTakeProfit: null };
  }

  const decimalPlaces = getAdminPriceDecimalPlacesFromRow(row);
  const counterStop = calcTakeProfit(entryPrice, stopLoss, COUNTER_TREND_STOP_MULTIPLE);
  if (counterStop == null) {
    return { items: [], stopLoss: null, refTakeProfit: null };
  }

  const tierShare = 1 / COUNTER_TREND_ENTRY_MULTIPLES.length;
  const tierOpenCost = getTierOpenCostBudget(openCostTotal, tierShare);
  const items = [];
  for (const multiple of COUNTER_TREND_ENTRY_MULTIPLES) {
    const price = calcTakeProfit(entryPrice, stopLoss, multiple);
    if (price == null || price === counterStop) continue;
    const qty = calcQuantityByRisk(tierOpenCost, price, counterStop);
    if (qty == null || !(qty > 0)) continue;
    items.push({
      rate: multiple,
      display: true,
      price: formatTrimmedFixedDecimals(price, decimalPlaces),
      quantity: formatQuantity(qty),
    });
  }
  return {
    items,
    stopLoss: formatTrimmedFixedDecimals(counterStop, decimalPlaces),
    refTakeProfit: formatTrimmedFixedDecimals(entryPrice, decimalPlaces),
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

function calcAssistTierPrice(from, to, ratio, decimalPlaces) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(ratio)) return null;
  const price = from + (to - from) * ratio;
  if (!Number.isFinite(price)) return null;
  return Number(formatFixedDecimals(price, decimalPlaces));
}

function buildAssistConcessionItems(from, to, openCostTotal, decimalPlaces) {
  if (
    from == null
    || to == null
    || from === to
    || !(openCostTotal > 0)
  ) {
    return [];
  }
  const stop = from;
  const minFundedShare = getMinFundedTierCostShare(ASSIST_TIER_RATIOS);
  const items = [];
  for (const rateConfig of ASSIST_TIER_RATIOS) {
    const { rate, costShare, reuseMinTierCost } = normalizeConcessionRateConfig(rateConfig);
    const price = calcAssistTierPrice(from, to, rate, decimalPlaces);
    if (price == null || !(price > 0) || price === stop) continue;
    const share = reuseMinTierCost
      ? minFundedShare
      : (costShare != null ? costShare : null);
    const tierOpenCost = share != null && share > 0
      ? getTierOpenCostBudget(openCostTotal, share)
      : null;
    const qty = tierOpenCost != null ? calcQuantityByRisk(tierOpenCost, price, stop) : null;
    if (share != null && share > 0 && (qty == null || !(qty > 0))) continue;
    const item = {
      rate,
      display: true,
      price: formatTrimmedFixedDecimals(price, decimalPlaces),
      quantity: qty != null && qty > 0 ? formatQuantity(qty) : '0.0',
    };
    if (reuseMinTierCost) item.reuseMinTierCost = true;
    items.push(item);
  }
  return items;
}

function buildAssistConcessionsFromRow(row, multiplier = OPEN_COST_MULTIPLIER_DEFAULT) {
  const from = toNumber(row?.inputPrice ?? row?.stopLossPrice);
  const to = toNumber(row?.inputStopLoss);
  const openCostTotal = getOpenCostTotal(multiplier);
  const decimalPlaces = Math.max(3, getAdminPriceDecimalPlacesFromRow(row));
  return buildAssistConcessionItems(from, to, openCostTotal, decimalPlaces);
}

function isAdminCounterTrendView(row) {
  return canShowCounterTrend(row)
    && normalizeStrategyViewMode(row?.viewMode) === STRATEGY_VIEW_MODE_COUNTER;
}

async function toggleAdminCounterTrend(strategyId, row) {
  const id = String(strategyId ?? '').trim();
  if (!id || !canShowCounterTrend(row) || updatingAdminViewModeIds.has(id)) return;
  const nextViewMode = isAdminCounterTrendView(row)
    ? STRATEGY_VIEW_MODE_TREND
    : STRATEGY_VIEW_MODE_COUNTER;
  const prevViewMode = normalizeStrategyViewMode(row?.viewMode);
  updatingAdminViewModeIds.add(id);
  latestAdminRows = latestAdminRows.map((item) => (
    String(item?.id ?? '').trim() === id ? { ...item, viewMode: nextViewMode } : item
  ));
  renderAdminListItems();
  try {
    await updateStrategyViewMode(id, nextViewMode);
  } catch (err) {
    console.error('[admin-view-mode-sync]', err);
    latestAdminRows = latestAdminRows.map((item) => (
      String(item?.id ?? '').trim() === id ? { ...item, viewMode: prevViewMode } : item
    ));
    showToast('视图切换失败');
  } finally {
    updatingAdminViewModeIds.delete(id);
    renderAdminListItems();
  }
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
      '右侧交易，趋势跟随，见好就收。',
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
  { title: '8、无悖论', paragraphs: ['相邻时间维度趋势不冲突，有冲突不做。'] },
  { title: '9、目标', paragraphs: ['目标35岁之前退休，计划不变。'] },
  {
    title: '10、理性和感性冲突的终极解法',
    items: ['固定策略选一边覆盖。', '统一标准量化分析。', '1个单位0.5倍，超出预期可做T，预期内则坚持到底。'],
  },
  {
    title: '11、让每一个操作都有意义',
    items: ['做好开仓记录。', '做好观测日志。', '4小时定点操作。', '不做任何无效操作。'],
  },
  {
    title: '12、操作手法',
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
    title: '13、基本定律',
    items: [
      '博弈中盈亏比与确定性互斥。盈亏比高的情况往往是还没走向确定，等确定性很高了往往也没有多少盈亏比。',
      '做多赢得多，做空盈利快。',
      '盈亏同源。',
      '多军和空军都不好过，日内30%基本是极限。',
      '这个游戏的核心是，应该做胜率最高的选择，而不是盈利最大选择。',
    ],
  },
  {
    title: '14、提醒自己',
    items: [
      '右侧交易，趋势跟随，4h维度，交易量过亿（差一点都不行）',
      '不做彩票单（1%的概率，10倍的收益，这是愚者行为）',
      '严格选品，耐心等待，保守前进。',
    ],
  },
  {
    title: '15、放弃的艺术',
    items: [
      '不纠结，越轻松越赚钱。',
      '1小时强背离可以退出避险。',
      '已经实现3-5倍的不去参与，风险收益比不高。',
    ],
  },
  {
    title: '16、简要',
    items: [
      '不做BTC 和 ETH，难度太大。',
      '只做自己的行情，不参考其他人的信息。',
      '不加仓不减仓，使用自己的方法判断。',
      '尊重客观事实，不做无法实现的梦。',
      '用4h和1d维度决策方向，1h辅助判断细节。',
      '没有符合生命周期理论的就不操作，找点其他乐子。',
    ],
  },
  {
    title: '17、天道',
    items: [
      '以小博大是弱者思维，胜率太小经不起波澜。以大博小是强者思维，确定性永远排在第一位。',
      '顺境时不要张狂，要懂得居安思危。逆境时不要焦虑，要从风险中看到机会。',
      '不要只盯着风险或者收益，要全面平等的看待。胜率大的时候要坚定选择，当赢则赢。但也要留有余地，因为失败的可能性一直存在。',
      '一开始选择的是自己，选择之初就应该明白可能的全部结果。早有觉悟不是一句空话。',
    ],
  },
  {
    title: '18、最新感悟',
    items: [
      '优先级：趋势跟随＞反趋势预设＞反趋势辅助',
      '反趋势限定方向空，时间空间都满足，否则不做。优先级还是新的趋势跟随单。',
      '严格选品，分批挂单。保持最佳位置挂单的好习惯，经常会有惊喜。',
      '观测和操作，分账号操作，一个账户一个独立单子。可有效减少盯盘造成的负面影响。',
      '波段有害，坚持到底才能指数累加。',
      '已经认证过可行性，只需坚定循环执行。',
      '不对劲就跑，亏不了多少。无需纠结，集中力量到下一单。',
      '放弃多空临界值的单子，做好趋势交易的本分。',
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
    } catch (err) {
      if (isAuthRefreshTokenInvalid(err)) {
        clearAuthSession();
      } else if (isAccessTokenValid()) {
        scheduleAuthRefresh();
        showApp();
        setPage('admin');
        return;
      }
    }
  } else if (authSession?.access_token && isAccessTokenValid()) {
    showApp();
    setPage('admin');
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
  };
}

function toDbRecord(record) {
  const startAt = parseDateValue(record.startAt);
  const expiresAt = parseDateValue(record.expiresAt);
  const openCostTotal = Number(record.openCostTotal) || getOpenCostTotal(record.openCostMultiplier);
  const openCostMultiplier = clampOpenCostMultiplier(record.openCostMultiplier ?? openCostTotal / OPEN_COST_BASE);
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
    open_cost_multiplier: openCostMultiplier,
    open_cost_total: openCostTotal,
    grade: normalizeStrategyGrade(record.grade ?? getStrategyGradeFromOpenCost(record.openCost, openCostTotal)),
    price_adjustment_rate: Number(record.priceAdjustmentRate),
    price_adjustment: toNumber(record.priceAdjustment),
    concessions: hasConcessions(record.concessions)
      ? normalizeConcessions(record.concessions)
      : [],
    take_profit_r_multiple: Number(record.takeProfitRMultiple),
    timeframe: normalizeTimeframeMode(record.timeframe),
    timeframe_minutes: Number(record.timeframeMinutes) || getTimeframeMinutes(record.timeframe),
    valid_periods: Number(record.validPeriods),
    duration_minutes: Number(record.durationMinutes),
    start_at: startAt ? startAt.toISOString() : null,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    outcome_status: normalizeOutcomeStatus(record.outcomeStatus),
    view_mode: normalizeStrategyViewMode(record.viewMode),
  };
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

function renderMethodologyBalanceBannerHtml() {
  return [
    '<aside class="methodology-balance" aria-label="生命周期理论">',
    '<div class="methodology-balance__row">',
    '<div class="methodology-balance__side">',
    '<span class="methodology-balance__stage">趋势跟随</span>',
    '<span class="methodology-balance__desc">时间10，空间3-5倍</span>',
    '</div>',
    '<span class="methodology-balance__arrow" aria-hidden="true">==&gt;</span>',
    '<div class="methodology-balance__side">',
    '<span class="methodology-balance__stage">反趋势预设</span>',
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
  const sectionsHtml = METHODOLOGY_SECTIONS.map((section) => {
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

function clearStrategyOutput(outEl = document.getElementById('strategy-output')) {
  if (!outEl) return;
  outEl.textContent = '';
}

function renderStrategyOutput(outEl, { html }) {
  if (!outEl) return;
  outEl.innerHTML = html || '';
}

function clearStrategyState() {
  currentStrategyCopyText = '';
  currentStrategyRecord = null;
  clearStrategyOutput();
}

function setStrategyState(strategy) {
  if (!strategy) {
    clearStrategyState();
    return;
  }
  currentStrategyCopyText = String(strategy.copyText ?? '').trim();
  currentStrategyRecord = strategy.record ?? null;
  renderStrategyOutput(document.getElementById('strategy-output'), strategy);
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
    `开始价格：${String(price ?? '').trim()}`,
    `数量：${String(quantity ?? '').trim()}`,
    `止盈：${String(takeProfit ?? '').trim()}`,
    `止损价格：${String(stopLoss ?? '').trim()}`,
  ].join('\n');
}

function enrichStrategyRecordForSubmit(record) {
  if (!record) return null;
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
  };
  const timeEl = document.getElementById('start-time');
  const startValue = timeEl && 'value' in timeEl ? String(timeEl.value).trim() : '';
  if (startValue) {
    const startAt = getStartDateTime(startValue);
    const endAt = addPeriodToStart(startValue, durationMinutes);
    next.startAt = startAt ? startAt.toISOString() : next.startAt;
    next.expiresAt = endAt ? endAt.toISOString() : next.expiresAt;
  }
  return next;
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
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function buildReferenceTakeProfitLabel(entryPrice, stopLoss, decimalPlaces) {
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopLoss);
  if (entry == null || stop == null || entry === stop) return '—';
  const tpLowR = calcTakeProfit(entry, stop, REF_TAKE_PROFIT_R_LOW);
  const tpHighR = calcTakeProfit(entry, stop, REF_TAKE_PROFIT_R_HIGH);
  if (tpLowR == null || tpHighR == null) return '—';
  let low = normalizeReferenceTakeProfitPrice(Math.min(tpLowR, tpHighR));
  let high = normalizeReferenceTakeProfitPrice(Math.max(tpLowR, tpHighR));
  if (low == null && high == null) return '—';
  if (low == null) low = high;
  if (high == null) high = low;
  const decimals = decimalPlaces ?? getPriceDecimalPlacesFromValues(entryPrice, stopLoss);
  const lowLabel = formatTrimmedFixedDecimals(low, decimals);
  const highLabel = formatTrimmedFixedDecimals(high, decimals);
  return lowLabel === highLabel ? lowLabel : `${lowLabel}-${highLabel}`;
}

function buildAdminReferenceTakeProfitLabel(entryPrice, stopLoss, decimalPlaces = 0) {
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopLoss);
  if (entry == null || stop == null || entry === stop) return '—';
  const tpLowR = calcTakeProfit(entry, stop, REF_TAKE_PROFIT_R_LOW);
  const tpHighR = calcTakeProfit(entry, stop, REF_TAKE_PROFIT_R_HIGH);
  if (tpLowR == null || tpHighR == null) return '—';
  let low = normalizeReferenceTakeProfitPrice(Math.min(tpLowR, tpHighR));
  let high = normalizeReferenceTakeProfitPrice(Math.max(tpLowR, tpHighR));
  if (low == null && high == null) return '—';
  if (low == null) low = high;
  if (high == null) high = low;
  const decimals = Math.max(0, Math.min(20, Math.floor(Number(decimalPlaces) || 0)));
  const lowLabel = formatTrimmedFixedDecimals(low, decimals);
  const highLabel = formatTrimmedFixedDecimals(high, decimals);
  return lowLabel === highLabel ? lowLabel : `${lowLabel}-${highLabel}`;
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

/** 趋势跟随最佳止盈点位：5R，方向随多空（开>止为多，开<止为空） */
function buildAdminBestTakeProfitLabel(entryPrice, stopLoss, decimalPlaces = 0) {
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopLoss);
  if (entry == null || stop == null || entry === stop) return '—';
  const tp = calcTakeProfit(entry, stop, REF_TAKE_PROFIT_R_HIGH);
  if (tp == null) return '—';
  const normalized = normalizeReferenceTakeProfitPrice(tp);
  if (normalized == null) return '—';
  const decimals = Math.max(0, Math.min(20, Math.floor(Number(decimalPlaces) || 0)));
  return formatTrimmedFixedDecimals(normalized, decimals);
}

function renderAdminTakeProfitStopHtml(takeProfitLabel, stopLossLabel, refTakeProfitLabel = null) {
  const tp = escapeHtml(String(takeProfitLabel ?? '').trim() || '—');
  const sl = escapeHtml(String(stopLossLabel ?? '').trim() || '—');
  const refRaw = String(refTakeProfitLabel ?? '').trim();
  const refHtml = refRaw && refRaw !== '—'
    ? [
      '<span class="admin-item__tp-sl-ref" aria-label="参考止盈">',
      '<span class="admin-item__tp-sl-label">参考止盈</span>',
      `<span class="admin-item__tp-sl-value">${escapeHtml(refRaw)}</span>`,
      '</span>',
    ].join('')
    : '';
  return [
    '<div class="admin-item__tp-sl" aria-label="止盈止损">',
    refHtml,
    '<span class="admin-item__tp-sl-main">',
    '<span class="admin-item__tp-sl-item" aria-label="止盈价格">',
    '<span class="admin-item__tp-sl-label">止盈</span>',
    `<span class="admin-item__tp-sl-value">${tp}</span>`,
    '</span>',
    '<span class="admin-item__tp-sl-item" aria-label="止损价格">',
    '<span class="admin-item__tp-sl-label">止损</span>',
    `<span class="admin-item__tp-sl-value">${sl}</span>`,
    '</span>',
    '</span>',
    '</div>',
  ].join('');
}

function calcAdjustedOpenPrice(open, stop, decimalPlaces) {
  return Number(formatFixedDecimals(open, decimalPlaces));
}

/** 趋势跟随让利价；reverse 仅用于兼容旧数据重算 */
function calcConcessionalEntryPrice(entryPrice, stopLoss, rate, decimalPlaces, reverse = false) {
  const stopDiff = Math.abs(entryPrice - stopLoss);
  if (!(stopDiff > 0) || !Number.isFinite(rate)) return null;
  const awayFromStop = entryPrice > stopLoss ? 1 : -1;
  const direction = reverse ? -awayFromStop : awayFromStop;
  const price = entryPrice + direction * rate * stopDiff;
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

function formatConcessionPercent(rate) {
  return `${Math.round(rate * 100)}%`;
}

function formatCounterTrendRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)}R`;
}

/** 0% / 10% / 20% / 30% 统一标记为 best */
const BEST_CONCESSION_RATE_MAX = 0.3;

function isBestConcessionRate(rate) {
  const n = Number(rate);
  return Number.isFinite(n) && n <= BEST_CONCESSION_RATE_MAX + 1e-9;
}

function withBestConcessionLabel(label, rate) {
  const text = String(label ?? '');
  if (!isBestConcessionRate(rate)) return text;
  return text.includes('（best）') ? text : `${text}（best）`;
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

function buildConcessionItems(entryPrice, stopLoss, openCostTotal, decimalPlaces, rates = getConcessionRates(), reverse = false) {
  const fundedCount = countFundedRateConfigs(rates);
  const minFundedShare = getMinFundedTierCostShare(rates);
  const items = [];
  for (const rateConfig of rates) {
    const { rate, display, costShare, reuseMinTierCost } = normalizeConcessionRateConfig(rateConfig);
    const price = calcConcessionalEntryPrice(entryPrice, stopLoss, rate, decimalPlaces, reverse);
    const share = reuseMinTierCost
      ? minFundedShare
      : (costShare != null ? costShare : (fundedCount > 0 ? 1 / fundedCount : null));
    const tierOpenCost = getTierOpenCostBudget(openCostTotal, share);
    const qty = price == null ? null : calcQuantityByRisk(tierOpenCost, price, stopLoss);
    if (price == null || qty == null) continue;
    const item = {
      rate,
      price: formatTrimmedFixedDecimals(price, decimalPlaces),
      quantity: formatQuantity(qty),
    };
    if (display) item.display = true;
    if (reuseMinTierCost) item.reuseMinTierCost = true;
    items.push(item);
  }
  return items;
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

function renderConcessionRowHtml({
  rowClass,
  item,
  rateLabel,
  stop,
  hideQuantity = false,
  hideStop = false,
}) {
  return [
    `<div class="${rowClass}">`,
    `<span class="${rowClass}__rate">${escapeHtml(rateLabel)}</span>`,
    `<span class="${rowClass}__price">${escapeHtml(item.price)}</span>`,
    `<span class="${rowClass}__qty">${hideQuantity ? '' : escapeHtml(item.quantity)}</span>`,
    hideStop ? '' : `<span class="${rowClass}__stop">${stop}</span>`,
    '</div>',
  ].join('');
}

function renderConcessionsHtml({
  prefix,
  items,
  stopLabel,
  stopHeaderLabel = '止损价格',
  rateHeaderLabel = '让利',
  wrapperClass,
  reverseOrder = false,
  reversePriceQty = false,
  assistLabels = false,
  formatRate = formatConcessionPercent,
  groupBestPeers = false,
  hideStopColumn = false,
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
  const wrapper = hideStopColumn
    ? `${wrapperClass} ${wrapperClass}--no-stop`.trim()
    : wrapperClass;

  const buildRow = (item) => renderConcessionRowHtml({
    rowClass,
    item,
    rateLabel: withBestConcessionLabel(rateFormatter(item.rate), item.rate),
    stop,
    hideQuantity: assistLabels && shouldHideAssistQuantity(item.rate),
    hideStop: hideStopColumn,
  });

  let bodyHtml = '';
  if (groupBestPeers) {
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

  return [
    `<div class="${wrapper}" aria-label="${assistLabels ? '反趋势辅助位置' : '让利档位'}">`,
    `<div class="${rowClass} ${rowClass}--head">`,
    `<span class="${rowClass}__rate">${rateHeader}</span>`,
    `<span class="${rowClass}__price">价格</span>`,
    `<span class="${rowClass}__qty">数量</span>`,
    hideStopColumn ? '' : `<span class="${rowClass}__stop">${stopHeader}</span>`,
    '</div>',
    bodyHtml,
    '</div>',
  ].join('');
}

function renderStrategyConcessionsHtml(items, stopLabel, options = {}) {
  return renderConcessionsHtml({
    prefix: 'strategy',
    items,
    stopLabel,
    stopHeaderLabel: options.stopHeaderLabel,
    rateHeaderLabel: options.rateHeaderLabel,
    wrapperClass: 'strategy-card__concessions',
    reverseOrder: options.reverseOrder === true,
    assistLabels: options.assistLabels === true,
    formatRate: options.formatRate,
  });
}

function buildStrategyDisplayHtml({
  side,
  alarmName,
  stopLabel,
  stopHeaderLabel,
  refTakeProfitLabel,
  concessionItems,
  timeRangeLabel,
  reverseOrder = false,
  assistLabels = false,
  titleText = null,
  titleTagHtml = '',
  cardMod = '',
  footerHtml = null,
}) {
  const sideMod = getPositionSideMod(side);
  const title = titleText == null ? formatStrategyCardTitle(alarmName) : String(titleText);
  const refTakeProfitHtml = refTakeProfitLabel == null
    ? ''
    : renderReferenceTakeProfitHtml('strategy-card__ref-tp', refTakeProfitLabel);
  const timeHtml = timeRangeLabel == null
    ? ''
    : `<div class="strategy-card__time"><span class="strategy-card__time-label">时间范围</span><span class="strategy-card__time-value">${escapeHtml(timeRangeLabel)}</span></div>`;
  const footerBlock = footerHtml == null ? timeHtml : footerHtml;
  const cardClass = [
    'strategy-card',
    `strategy-card--${sideMod}`,
    cardMod ? `strategy-card--${cardMod}` : '',
  ].filter(Boolean).join(' ');
  return [
    `<div class="${cardClass}">`,
    '<div class="strategy-card__head">',
    `<span class="strategy-card__title">${escapeHtml(title)}</span>`,
    titleTagHtml,
    '</div>',
    renderStrategyConcessionsHtml(concessionItems, stopLabel, {
      stopHeaderLabel,
      reverseOrder,
      assistLabels,
    }),
    refTakeProfitHtml,
    footerBlock,
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
      `让利${withBestConcessionLabel(formatConcessionPercent(item.rate), item.rate)}：${item.price} / ${item.quantity} / ${stopLabel}`
    )),
    `参考止盈：${refTakeProfitLabel}`,
    `时间范围：${timeRangeLabel}`,
  ].join('\n');
}

function formatAdminConcessionItems(items, priceDecimalPlaces = 0) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    price: formatAdminPriceFromValue(item?.price, priceDecimalPlaces),
    quantity: formatAdminDecimalFromValue(item?.quantity),
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
    wrapperClass: 'admin-item__concessions',
    reversePriceQty: options.reversePriceQty === true,
    reverseOrder: options.reverseOrder === true,
    assistLabels: options.assistLabels === true,
    formatRate: options.formatRate,
    groupBestPeers: options.groupBestPeers !== false,
    hideStopColumn,
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
  const concessionRates = getConcessionRates();
  const concessionItems = buildConcessionItems(adjustedOpen, stop, openCostTotal, priceDecimalPlaces, concessionRates, reverse);
  const primaryItem = concessionItems.find((item) => Math.abs(Number(item.rate) - PRICE_ADJUSTMENT_RATE) < 1e-9);
  const qty = primaryItem?.quantity ?? formatQuantity(quantity);

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
    stopHeaderLabel: '止损价格',
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

  return { plain, html, copyText, record };
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

  if (!startTime) {
    if (errEl) errEl.textContent = '请选择开始时间。';
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
  if (!Number.isFinite(adjustedOpen) || adjustedOpen <= 0 || !Number.isFinite(takeProfit) || takeProfit <= 0) {
    if (errEl) errEl.textContent = '开始价格或止盈价无效，请检查开始价格与止损价格。';
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

function resetFrontPage() {
  closeMobileTimePicker();
  startTimeUserPicked = false;
  rebuildStartTimeOptions();
  if (openInput) openInput.value = '';
  if (stopInput) stopInput.value = '';
  if (nameInput) nameInput.value = '';
  const errEl = document.getElementById('error');
  if (errEl) errEl.textContent = '';
  clearStrategyState();
}

function clearAssistState() {
  currentAssistCopyText = '';
  currentAssistRecord = null;
  const outEl = document.getElementById('assist-output');
  if (outEl) outEl.innerHTML = '';
}

function resetAssistPage() {
  const nameEl = document.getElementById('assist-name-input');
  const fromEl = document.getElementById('assist-from-input');
  const toEl = document.getElementById('assist-to-input');
  const errEl = document.getElementById('assist-error');
  if (nameEl) nameEl.value = '';
  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
  if (errEl) errEl.textContent = '';
  clearAssistState();
}

function buildAssistStrategy(from, to, openCostTotal, priceDecimalPlaces) {
  const nameEl = document.getElementById('assist-name-input');
  const name = String(nameEl?.value ?? '').trim() || 'test';
  const side = to > from ? 'long' : 'short';
  const stop = from;
  const takeProfit = to;
  const stopLabel = formatTrimmedFixedDecimals(stop, priceDecimalPlaces);
  const tpLabel = formatTrimmedFixedDecimals(takeProfit, priceDecimalPlaces);
  const concessionItems = buildAssistConcessionItems(from, to, openCostTotal, priceDecimalPlaces);
  if (!concessionItems.length) return null;
  const primaryItem = concessionItems[0];
  const timeframe = getTimeframeMode();
  const unitMin = getTimeframeMinutes(timeframe);
  const spanMinutes = unitMin * STRATEGY_DURATION_PERIODS;
  const timeEl = document.getElementById('start-time');
  const startValue = timeEl && 'value' in timeEl ? String(timeEl.value).trim() : '';
  const startAt = startValue ? getStartDateTime(startValue) : new Date();
  const endAt = startValue
    ? addPeriodToStart(startValue, spanMinutes)
    : (startAt ? new Date(startAt.getTime() + spanMinutes * 60 * 1000) : null);
  const openCostMultiplier = OPEN_COST_MULTIPLIER_DEFAULT;
  const openCost = openCostTotal / DEFAULT_TIER_COUNT;

  const fromLabel = formatTrimmedFixedDecimals(from, priceDecimalPlaces);
  const toLabel = formatTrimmedFixedDecimals(to, priceDecimalPlaces);
  const html = buildStrategyDisplayHtml({
    side,
    alarmName: name,
    stopLabel,
    stopHeaderLabel: '止损价格',
    refTakeProfitLabel: null,
    concessionItems,
    timeRangeLabel: null,
    assistLabels: true,
    titleText: formatStrategyCardTitle(name),
    titleTagHtml: '<span class="admin-assist-tag" aria-label="反趋势辅助">反趋势辅助</span>',
    cardMod: 'assist',
    footerHtml: [
      '<div class="strategy-card__time strategy-card__assist-prices">',
      '<span class="strategy-card__time-label">止盈价格</span>',
      `<span class="strategy-card__time-value">${escapeHtml(toLabel)}</span>`,
      '<span class="strategy-card__time-label">止损价格</span>',
      `<span class="strategy-card__time-value">${escapeHtml(fromLabel)}</span>`,
      '</div>',
    ].join(''),
  });
  const copyText = [
    formatAssistStrategyTitle(name),
    ...concessionItems.map((item) => {
      const label = withBestConcessionLabel(getAssistTierLabel(item.rate), item.rate);
      return shouldHideAssistQuantity(item.rate)
        ? `${label}：${item.price}`
        : `${label}：${item.price} / ${item.quantity}`;
    }),
    `止盈价格：${toLabel}`,
    `止损价格：${fromLabel}`,
  ].join('\n');

  const record = {
    strategyName: name,
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

  return { html, copyText, record };
}

function generateAssist() {
  const fromEl = document.getElementById('assist-from-input');
  const toEl = document.getElementById('assist-to-input');
  const errEl = document.getElementById('assist-error');
  const from = toNumber(fromEl && 'value' in fromEl ? fromEl.value : '');
  const to = toNumber(toEl && 'value' in toEl ? toEl.value : '');
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

  const priceDecimals = Math.max(3, getPriceDecimalPlacesFromValues(fromEl?.value, toEl?.value));
  const strategy = buildAssistStrategy(from, to, openCostTotal, priceDecimals);
  if (!strategy) {
    if (errEl) errEl.textContent = '无法生成反趋势辅助档位，请检查 from / to。';
    clearAssistState();
    return;
  }

  currentAssistCopyText = strategy.copyText;
  currentAssistRecord = strategy.record;
  const outEl = document.getElementById('assist-output');
  if (outEl) outEl.innerHTML = strategy.html || '';
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

async function updateStrategyOpenCost(id, row) {
  const encodedId = encodeURIComponent(id);
  const openCostMultiplier = clampOpenCostMultiplier(row?.openCostMultiplier);
  const openCostTotal = getOpenCostTotal(openCostMultiplier);
  const tierCount = getTierCountFromRow(row);
  const openCost = openCostTotal / tierCount;
  const concessions = getAdminStrategyTypeInfo(row).type === 'trend'
    ? buildTrendAdminConcessions(row, openCostMultiplier)
    : normalizeConcessions(row?.concessions);
  const primaryItem = concessions.find((item) => Math.abs(Number(item.rate)) < 1e-9);
  const nextQuantity = primaryItem?.quantity ? toNumber(primaryItem.quantity) : toNumber(row?.quantity);
  const payload = {
    open_cost_multiplier: openCostMultiplier,
    open_cost_total: openCostTotal,
    open_cost: openCost,
    grade: getStrategyGradeFromOpenCost(openCost, openCostTotal, tierCount),
    concessions,
  };
  if (nextQuantity != null && nextQuantity > 0) payload.quantity = nextQuantity;
  const res = await supabaseFetch(`${STRATEGIES_ENDPOINT}?id=eq.${encodedId}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(payload),
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

async function updateStrategyViewMode(id, viewMode) {
  const encodedId = encodeURIComponent(id);
  const res = await supabaseFetch(`${STRATEGIES_ENDPOINT}?id=eq.${encodedId}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      view_mode: normalizeStrategyViewMode(viewMode),
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
let adminNameFilter = '';
let adminSortByExpiresAsc = false;
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
  if (!Array.isArray(rows)) return [];
  if (!adminNameFilter) return rows;
  return rows.filter(rowMatchesAdminNameFilter);
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

function toggleAdminNameFilter(name) {
  const key = getAdminNameFilterKey(name);
  if (!key) return;
  adminNameFilter = adminNameFilter === key ? '' : key;
  renderAdminListItems();
  renderAdminActiveNames();
}

function toggleAdminSortByExpires() {
  adminSortByExpiresAsc = !adminSortByExpiresAsc;
  renderAdminListItems();
  renderAdminActiveNames();
}

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

function collectAdminNameCounts(rows) {
  const order = [];
  const counts = new Map();
  for (const row of rows) {
    const raw = String(row?.strategyName ?? '').trim();
    if (!raw) continue;
    const type = getAdminStrategyTypeInfo(row).type;
    const display = formatStrategyCardTitle(raw);
    const key = display.toLowerCase();
    if (!counts.has(key)) {
      order.push(key);
      counts.set(key, {
        name: display,
        count: 0,
        type,
      });
    }
    counts.get(key).count += 1;
  }
  return order.map((key) => counts.get(key));
}

function getAdminVisibleMultiplierTotal(rows = latestAdminRows) {
  return getFilteredAdminRows(rows).reduce((sum, row) => {
    const type = getAdminStrategyTypeInfo(row).type;
    if (type !== 'trend' && type !== 'assist') return sum;
    const id = String(row?.id ?? '').trim();
    return sum + getAdminOpenCostMultiplier(id, row);
  }, 0);
}

function shouldShowAdminNameSummary() {
  return normalizeAdminTimeFilter(adminTimeFilter) !== 'all';
}

function renderAdminActiveNames(rows = latestAdminRows) {
  const el = document.getElementById('admin-active-names');
  if (!el) return;
  if (!shouldShowAdminNameSummary()) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const nameCounts = collectAdminNameCounts(rows);
  const uniqueTotal = nameCounts.length;
  const showMultiplierTotal = normalizeAdminTimeFilter(adminTimeFilter) === 'active';
  const multiplierTotal = showMultiplierTotal ? getAdminVisibleMultiplierTotal(rows) : null;
  const costTotal = multiplierTotal == null ? null : multiplierTotal * OPEN_COST_BASE;
  el.hidden = false;
  const multiplierHtml = showMultiplierTotal
    ? [
      '<span class="admin-active-names__metric" title="当前进行中的趋势跟随与反趋势辅助成本合计">',
      '<span class="admin-active-names__metric-label">已用本金</span>',
      `<span class="admin-active-names__metric-value">${costTotal}</span>`,
      '</span>',
    ].join('')
    : '';
  const sortHtml = [
    `<button type="button" class="admin-active-names__sort${adminSortByExpiresAsc ? ' is-active' : ''}" data-admin-sort-expires aria-pressed="${adminSortByExpiresAsc ? 'true' : 'false'}" aria-label="按截止时间由近到远排序，${uniqueTotal} 个名称">`,
    `排序 ${uniqueTotal}`,
    '</button>',
  ].join('');
  const activeKey = adminNameFilter;
  const namesHtml = nameCounts.map(({ name, count, type }) => {
    const strategyType = type === 'assist' ? 'assist' : 'trend';
    const isActive = activeKey && getAdminNameFilterKey(name) === activeKey;
    const countHtml = count > 1
      ? `<span class="admin-active-names__count">${count}</span>`
      : '';
    return [
      `<button type="button" class="admin-active-names__item admin-active-names__item--${strategyType}${isActive ? ' is-active' : ''}" data-admin-name-filter="${escapeHtml(name)}" aria-pressed="${isActive ? 'true' : 'false'}">`,
      escapeHtml(name),
      countHtml,
      '</button>',
    ].join('');
  }).join('');
  el.innerHTML = `${sortHtml}${namesHtml}${multiplierHtml}`;
}

function renderAdminControls() {
  renderAdminFilterTabs();
  renderAdminActiveNames();
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
  updatingAdminCostIds.clear();
  updatingAdminViewModeIds.clear();
  renderAdminControls();
  updateAdminSelectionControls();
}

let selectedStrategyIds = new Set();
let isDeletingStrategies = false;
let isAdminSelectionMode = false;
let visibleAdminStrategyIds = [];
let latestAdminRows = [];
let updatingAdminCostIds = new Set();
let updatingAdminViewModeIds = new Set();

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
    latestAdminRows = [];
    updatingAdminCostIds.clear();
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

function buildAdminListItemHtml(row) {
  const rawId = String(row?.id ?? '').trim();
  const id = escapeHtml(rawId);
  const sideRaw = String(row?.positionSide ?? '').trim();
  const nameRaw = String(row?.strategyName ?? '').trim();
  const showCounterTrend = Boolean(rawId && isAdminCounterTrendView(row));
  const baseSideMod = getPositionSideMod(sideRaw);
  const sideMod = showCounterTrend
    ? (baseSideMod === 'long' ? 'short' : 'long')
    : baseSideMod;
  const strategyType = getAdminStrategyTypeInfo(row);
  const isAssistStrategy = strategyType.type === 'assist';
  const title = escapeHtml(formatStrategyCardTitle(nameRaw));
  const titleLabel = escapeHtml(
    isAssistStrategy
      ? `${formatAssistStrategyTitle(nameRaw)}${String(row?.outcomeRemark ?? '').trim() ? `，备注：${String(row.outcomeRemark).trim()}` : ''}`
      : formatAdminCardTitlePlain(nameRaw, row?.outcomeRemark),
  );
  const remarkStampHtml = renderAdminRemarkStampHtml(row?.outcomeRemark);
  const priceDecimalPlaces = getAdminPriceDecimalPlacesFromRow(row);
  const isTrendStrategy = strategyType.type === 'trend';
  const costMultiplier = getAdminOpenCostMultiplier(rawId, row);
  const multiplierHtml = rawId && (isTrendStrategy || isAssistStrategy)
    ? buildAdminCostMultiplierHtml(rawId, costMultiplier)
    : '';
  let concessions;
  let stopLabel;
  let takeProfitLabel;
  let refTakeProfitLabel;
  if (showCounterTrend) {
    const counter = buildCounterTrendConcessions(row, costMultiplier);
    concessions = counter.items;
    // 反趋势预设：止盈=原开仓价，止损=10R（计算逻辑不变，仅改展示位置）
    takeProfitLabel = counter.refTakeProfit || '—';
    stopLabel = counter.stopLoss || '—';
    refTakeProfitLabel = null;
  } else if (isAssistStrategy) {
    concessions = buildAssistConcessionsFromRow(row, costMultiplier);
    // 反趋势辅助：止盈=to，止损=from（计算逻辑不变）
    takeProfitLabel = formatAdminPriceFromValue(row?.inputStopLoss ?? row?.takeProfitPrice, priceDecimalPlaces) || '—';
    stopLabel = formatAdminPriceFromValue(row?.inputPrice ?? row?.stopLossPrice, priceDecimalPlaces) || '—';
    refTakeProfitLabel = null;
  } else {
    concessions = isTrendStrategy
      ? buildTrendAdminConcessions(row, costMultiplier)
      : buildAdminDisplayConcessions(row);
    // 趋势跟随：止盈=5R 最佳点位（区分多空），止损=原止损；保留参考止盈
    takeProfitLabel = buildAdminBestTakeProfitLabel(row?.entryPrice, row?.stopLossPrice, priceDecimalPlaces);
    stopLabel = formatAdminPriceFromValue(row?.stopLossPrice, priceDecimalPlaces) || '—';
    refTakeProfitLabel = buildAdminReferenceTakeProfitLabel(row?.entryPrice, row?.stopLossPrice, priceDecimalPlaces);
  }
  const tpSlHtml = renderAdminTakeProfitStopHtml(takeProfitLabel, stopLabel, refTakeProfitLabel);
  const concessionsHtml = renderAdminConcessionsHtml(concessions, stopLabel, {
    priceDecimalPlaces,
    assistLabels: isAssistStrategy,
    hideStopColumn: true,
    ...(showCounterTrend
      ? {
        formatRate: formatCounterTrendRate,
        rateHeaderLabel: '倍数',
        // 5R 量最大，升序后反转，保证数量从大到小
        reverseOrder: true,
      }
      : {}),
  });
  const baseStartAt = getStrategyStartAt(row);
  const baseEndAt = getStrategyEndAt(row);
  const counterTimeRange = showCounterTrend ? getCounterTrendTimeRange(row) : null;
  const startAt = showCounterTrend ? counterTimeRange?.startAt : baseStartAt;
  const endAt = showCounterTrend ? counterTimeRange?.endAt : baseEndAt;
  const timeRange = escapeHtml(formatAdminTimeRange(startAt, endAt));
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
  const outcomeStatus = normalizeOutcomeStatus(row?.outcomeStatus);
  const outcomeTimeStatus = getTimeRangeStatusByEndAt(baseEndAt);
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
      `<button type="button" class="admin-outcome-status admin-outcome-status--${outcomeInfo.type} admin-outcome-status--actionable" data-id="${id}" data-time-status="${outcomeTimeStatus}" data-outcome-status="${escapeHtml(outcomeStatus)}" data-outcome-remark="${escapeHtml(String(row?.outcomeRemark ?? ''))}" aria-haspopup="dialog" aria-controls="status-picker" aria-label="修改盈利状态">`,
      `<span class="admin-outcome-status__tag">${escapeHtml(outcomeInfo.label)}</span>`,
      '</button>',
    ].join('')
    : [
      `<div class="admin-outcome-status admin-outcome-status--${outcomeInfo.type}">`,
      `<span class="admin-outcome-status__tag">${escapeHtml(outcomeInfo.label)}</span>`,
      '</div>',
    ].join('');
  const counterTrendHtml = rawId && canShowCounterTrend(row)
    ? [
      `<button type="button" class="admin-counter-trend${showCounterTrend ? ' is-active' : ''}${updatingAdminViewModeIds.has(rawId) ? ' is-syncing' : ''}" data-counter-trend-toggle data-id="${id}" aria-pressed="${showCounterTrend ? 'true' : 'false'}" aria-busy="${updatingAdminViewModeIds.has(rawId) ? 'true' : 'false'}"${updatingAdminViewModeIds.has(rawId) ? ' disabled' : ''} aria-label="${showCounterTrend ? '切换回趋势跟随' : '查看反趋势预设'}">`,
      `<span class="admin-counter-trend__tag">${showCounterTrend ? '反趋势预设' : '趋势跟随'}</span>`,
      '</button>',
    ].join('')
    : '';
  const assistTagHtml = isAssistStrategy
    ? '<span class="admin-assist-tag" aria-label="反趋势辅助">反趋势辅助</span>'
    : '';
  const sideLabel = getPositionSideLabel(sideMod);
  const sideTagHtml = sideLabel
    ? `<span class="admin-item__side admin-item__side--${sideMod}" aria-label="${sideLabel}">${sideLabel}</span>`
    : '';
  const titleGroupHtml = [
    '<div class="admin-item__title-wrap">',
    `<span class="admin-item__title">${title}</span>`,
    sideTagHtml,
    counterTrendHtml,
    assistTagHtml,
    '</div>',
  ].join('');
  const headRightHtml = [
    '<div class="admin-item__head-right">',
    outcomeStatusHtml,
    timeBadgeHtml,
    '</div>',
  ].join('');
  const buttonsHtml = multiplierHtml
    ? `<div class="admin-item__buttons">${multiplierHtml}</div>`
    : '';
  return [
    `<article class="admin-item admin-item--${sideMod}${showCounterTrend ? ' admin-item--counter-trend' : ''}${isAssistStrategy ? ' admin-item--assist' : ''}">`,
    remarkStampHtml,
    '<header class="admin-item__head">',
    selectHtml,
    '<div class="admin-item__head-main">',
    titleGroupHtml,
    '<div class="admin-item__sub">',
    `<span class="admin-item__time-range" aria-label="时间范围">${timeRange}</span>`,
    buttonsHtml,
    '</div>',
    '</div>',
    headRightHtml,
    '</header>',
    concessionsHtml,
    tpSlHtml,
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
  listEl.innerHTML = rows.map((row) => buildAdminListItemHtml(row)).join('');
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
      return {
        name,
        time,
        timeLabel,
        price,
        stopLoss,
        description,
      };
    })
    .filter((item) => item.name);
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

async function fetchObservationRecords() {
  const selectFields = observationContentColumnAvailable
    ? 'id,created_at,items,content'
    : 'id,created_at,items';
  const params = `select=${selectFields}&order=created_at.desc`;
  const res = await supabaseFetch(`${OBSERVATIONS_ENDPOINT}?${params}`, {
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (observationContentColumnAvailable && isMissingObservationContentColumnError(errorText)) {
      observationContentColumnAvailable = false;
      return fetchObservationRecords();
    }
    throw new Error(errorText);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map(fromObservationRecord) : [];
}

function buildObservationLegacyContent(items) {
  return normalizeObservationItems(items)
    .map((item) => {
      if (item.time || item.price || item.stopLoss) {
        const timeRange = formatObservationTimeRange(item.time, item.timeLabel);
        return [
          item.name,
          timeRange ? `时间范围：${timeRange}` : '',
          item.price ? `价格：${item.price}` : '',
          item.stopLoss ? `止损：${item.stopLoss}` : '',
        ].filter(Boolean).join('\n');
      }
      return [item.name, item.description].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

async function createObservationRecord(items) {
  const normalizedItems = normalizeObservationItems(items)
    .map((item) => ({
      name: item.name,
      time: item.time,
      timeLabel: item.timeLabel || formatObservationTimeLabel(item.time),
      price: item.price,
      stopLoss: item.stopLoss,
    }))
    .filter((item) => item.name && item.time && item.price && item.stopLoss);
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

function renderObservationDailyFieldsHtml(price, stopLoss) {
  const priceLabel = escapeHtml(String(price ?? '').trim() || '—');
  const stopLabel = escapeHtml(String(stopLoss ?? '').trim() || '—');
  return [
    '<div class="admin-item__concessions admin-item__concessions--daily" aria-label="日线观测字段">',
    '<div class="admin-concession admin-concession--daily-row">',
    '<span class="admin-concession__label">价格</span>',
    `<span class="admin-concession__value">${priceLabel}</span>`,
    '</div>',
    '<div class="admin-concession admin-concession--daily-row">',
    '<span class="admin-concession__label">止损</span>',
    `<span class="admin-concession__value">${stopLabel}</span>`,
    '</div>',
    '</div>',
  ].join('');
}

function getObservationItemSide(item) {
  const price = toNumber(item?.price);
  const stopLoss = toNumber(item?.stopLoss);
  if (price == null || stopLoss == null) return 'flat';
  if (price === stopLoss) return 'flat';
  return price > stopLoss ? 'long' : 'short';
}

function renderObservationLegacyBodyHtml(items) {
  const normalizedItems = normalizeObservationItems(items);
  if (!normalizedItems.length) {
    return '<p class="obs-template-empty">暂无日线观测记录</p>';
  }
  return [
    '<div class="obs-template">',
    normalizedItems.map((item) => [
      '<div class="obs-template__row">',
      `<h3 class="obs-template__name">${escapeHtml(item.name)}</h3>`,
      item.description
        ? `<p class="obs-template__desc">${escapeHtml(item.description)}</p>`
        : '<p class="obs-template__desc obs-template__desc--empty">暂无描述</p>',
      '</div>',
    ].join('')).join(''),
    '</div>',
  ].join('');
}

function renderObservationRecordItem(record) {
  const rawId = String(record?.id ?? '').trim();
  const id = escapeHtml(rawId);
  const items = normalizeObservationItems(record.items);
  const trendItem = items.find((item) => item.time || item.price || item.stopLoss) || null;
  const checked = rawId && selectedObservationIds.has(rawId) ? ' checked' : '';
  const disabled = isDeletingObservations ? ' disabled' : '';
  const selectorDisabled = isDeletingObservations ? ' is-disabled' : '';

  if (!trendItem) {
    const selectHtml = rawId && isObsSelectionMode
      ? [
        `<label class="admin-item__selector${selectorDisabled}" aria-label="选择日线观测记录">`,
        `<input type="checkbox" class="admin-item__select" data-id="${id}"${checked}${disabled}>`,
        '<span class="admin-item__checkmark" aria-hidden="true"></span>',
        '</label>',
      ].join('')
      : '';
    return [
      '<article class="admin-item admin-item--flat obs-record">',
      '<header class="admin-item__head">',
      selectHtml,
      '<div class="admin-item__title-wrap">',
      `<span class="admin-item__title">${escapeHtml(formatStrategyCardTitle(items[0]?.name || '未命名'))}</span>`,
      '</div>',
      '</header>',
      renderObservationLegacyBodyHtml(items),
      '</article>',
    ].join('');
  }

  const title = escapeHtml(formatStrategyCardTitle(trendItem.name));
  const titleLabel = escapeHtml(String(trendItem.name || '未命名').trim() || '未命名');
  const sideMod = getPositionSideMod(getObservationItemSide(trendItem));
  const timeRange = escapeHtml(formatObservationTimeRange(trendItem.time, trendItem.timeLabel));
  const endAt = getObservationEndAt(trendItem.time);
  const timeBadgeHtml = renderObservationCountdownBadgeHtml(endAt);
  const priceDecimalPlaces = getPriceDecimalPlacesFromValues(trendItem.price, trendItem.stopLoss);
  const refTakeProfitLabel = buildAdminReferenceTakeProfitLabel(
    trendItem.price,
    trendItem.stopLoss,
    priceDecimalPlaces,
  );
  const refTakeProfitHtml = refTakeProfitLabel == null
    ? ''
    : renderReferenceTakeProfitHtml('admin-item__ref-tp', refTakeProfitLabel);
  const selectHtml = rawId && isObsSelectionMode
    ? [
      `<label class="admin-item__selector${selectorDisabled}" aria-label="选择 ${titleLabel}">`,
      `<input type="checkbox" class="admin-item__select" data-id="${id}"${checked}${disabled}>`,
      '<span class="admin-item__checkmark" aria-hidden="true"></span>',
      '</label>',
    ].join('')
    : '';
  const headRightHtml = timeBadgeHtml
    ? [
      '<div class="admin-item__head-right">',
      timeBadgeHtml,
      '</div>',
    ].join('')
    : '';

  return [
    `<article class="admin-item admin-item--${sideMod} obs-record">`,
    '<header class="admin-item__head">',
    selectHtml,
    '<div class="admin-item__title-wrap">',
    `<span class="admin-item__title">${title}</span>`,
    '</div>',
    headRightHtml,
    '</header>',
    renderObservationDailyFieldsHtml(trendItem.price, trendItem.stopLoss),
    refTakeProfitHtml,
    '<div class="admin-item__actions">',
    '<div class="admin-item__meta">',
    `<span class="admin-item__time-range" aria-label="时间范围">${timeRange}</span>`,
    '</div>',
    '</div>',
    '</article>',
  ].join('');
}

function renderObservationTimeOptions(selectedValue = '') {
  const slots = getObservationDailyTimeSlots();
  const activeValue = resolveStartTimeSelection(OBS_DAILY_TIMEFRAME, selectedValue);
  const options = [
    '<option value="">请选择</option>',
    ...slots.map((slot) => {
      const selected = slot.value === activeValue ? ' selected' : '';
      return `<option value="${escapeHtml(slot.value)}"${selected}>${escapeHtml(slot.label)}</option>`;
    }),
  ];
  return options.join('');
}

function renderObservationFormRow(item = {}) {
  const name = escapeHtml(String(item?.name ?? ''));
  const price = escapeHtml(String(item?.price ?? ''));
  const stopLoss = escapeHtml(String(item?.stopLoss ?? ''));
  const timeValue = String(item?.time ?? '').trim();
  return [
    '<div class="obs-form-row">',
    '<label class="obs-form-field obs-form-field--name">',
    '<span class="obs-form-field__label">名称</span>',
    `<input class="obs-form-row__name" type="text" value="${name}" placeholder="例如 BTC、ETH、纳指" autocomplete="off" autocapitalize="characters" spellcheck="false" />`,
    '</label>',
    '<label class="obs-form-field obs-form-field--time">',
    '<span class="obs-form-field__label">时间</span>',
    `<select class="obs-form-row__time" autocomplete="off">${renderObservationTimeOptions(timeValue)}</select>`,
    '</label>',
    '<label class="obs-form-field obs-form-field--price">',
    '<span class="obs-form-field__label">价格</span>',
    `<input class="obs-form-row__price" type="text" inputmode="decimal" value="${price}" placeholder="开始价格" autocomplete="off" />`,
    '</label>',
    '<label class="obs-form-field obs-form-field--stop">',
    '<span class="obs-form-field__label">止损</span>',
    `<input class="obs-form-row__stop" type="text" inputmode="decimal" value="${stopLoss}" placeholder="止损" autocomplete="off" />`,
    '</label>',
    '</div>',
  ].join('');
}

function renderObservationFormList() {
  const listEl = document.getElementById('obs-form-list');
  if (!listEl) return;
  listEl.innerHTML = renderObservationFormRow();
  requestAnimationFrame(() => {
    listEl.querySelector('.obs-form-row__name')?.focus();
  });
}

function collectObservationFormItems() {
  return Array.from(document.querySelectorAll('#obs-form-list .obs-form-row'))
    .map((row) => {
      const timeSelect = row.querySelector('.obs-form-row__time');
      const time = String(timeSelect?.value ?? '').trim();
      const timeLabel = String(timeSelect?.selectedOptions?.[0]?.textContent ?? '').trim();
      return {
        name: String(row.querySelector('.obs-form-row__name')?.value ?? '').trim(),
        time,
        timeLabel: timeLabel === '请选择' ? '' : timeLabel,
        price: String(row.querySelector('.obs-form-row__price')?.value ?? '').trim(),
        stopLoss: String(row.querySelector('.obs-form-row__stop')?.value ?? '').trim(),
      };
    })
    .filter((item) => item.name || item.time || item.price || item.stopLoss);
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
  return window.confirm(count > 1 ? `确认删除选中的 ${count} 条日线观测记录？` : '确认删除这条日线观测记录？');
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
      listEl.innerHTML = '<p class="obs-empty">暂无日线观测记录，点击下方按钮新增。</p>';
      updateObsSelectionControls();
      syncAdminCountdownTimer();
      return;
    }
    syncObsSelectionWithRows(records);
    listEl.innerHTML = records.map(renderObservationRecordItem).join('');
    updateObsSelectionControls();
    updateAdminCountdowns();
    syncAdminCountdownTimer();
  } catch (err) {
    visibleObservationIds = [];
    selectedObservationIds.clear();
    listEl.innerHTML = `<p class="obs-error">加载失败：${escapeHtml(String(err?.message || '未知错误'))}</p>`;
    updateObsSelectionControls();
    syncAdminCountdownTimer();
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
    if (errorEl) errorEl.textContent = '请填写名称、时间、价格和止损。';
    document.querySelector('#obs-form-list .obs-form-row__name')?.focus();
    return;
  }
  const item = items[0];
  if (!item.name) {
    if (errorEl) errorEl.textContent = '请填写名称。';
    document.querySelector('#obs-form-list .obs-form-row__name')?.focus();
    return;
  }
  if (!item.time) {
    if (errorEl) errorEl.textContent = '请选择时间。';
    document.querySelector('#obs-form-list .obs-form-row__time')?.focus();
    return;
  }
  const price = toNumber(item.price);
  if (price == null || price <= 0) {
    if (errorEl) errorEl.textContent = '请填写有效的价格。';
    document.querySelector('#obs-form-list .obs-form-row__price')?.focus();
    return;
  }
  const stopLoss = toNumber(item.stopLoss);
  if (stopLoss == null || stopLoss <= 0) {
    if (errorEl) errorEl.textContent = '请填写有效的止损。';
    document.querySelector('#obs-form-list .obs-form-row__stop')?.focus();
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
    await createObservationRecord([{
      ...item,
      price: String(item.price).trim(),
      stopLoss: String(item.stopLoss).trim(),
    }]);
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

function setFrontMode(mode) {
  const nextMode = normalizeFrontMode(mode);
  frontMode = nextMode;

  const trendPanel = document.getElementById('front-trend-panel');
  const assistPanel = document.getElementById('front-assist-panel');
  const btnTrend = document.getElementById('btn-front-mode-trend');
  const btnAssist = document.getElementById('btn-front-mode-assist');
  const toAssist = nextMode === FRONT_MODE_ASSIST;

  if (trendPanel) trendPanel.hidden = toAssist;
  if (assistPanel) assistPanel.hidden = !toAssist;
  if (btnTrend) {
    btnTrend.classList.toggle('is-active', !toAssist);
    btnTrend.setAttribute('aria-selected', toAssist ? 'false' : 'true');
  }
  if (btnAssist) {
    btnAssist.classList.toggle('is-active', toAssist);
    btnAssist.setAttribute('aria-selected', toAssist ? 'true' : 'false');
  }

  if (!isFrontPage()) return;

  if (toAssist) {
    autoGenerateAssistIfReady();
  } else {
    updateTradeModeAppearance();
    autoGenerateIfReady();
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

  // 兼容旧入口：trend / assist 都归入前台
  let requestedMode = mode;
  let requestedFrontMode = null;
  if (mode === 'trend') {
    requestedMode = 'front';
    requestedFrontMode = FRONT_MODE_TREND;
  } else if (mode === 'assist') {
    requestedMode = 'front';
    requestedFrontMode = FRONT_MODE_ASSIST;
  }

  const allowedPages = ['admin', 'stats', 'methodology', 'cases', 'observations', 'front'];
  const normalizedMode = allowedPages.includes(requestedMode) ? requestedMode : 'front';
  const wasFront = isFrontPage(currentPage);
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

  const moreToggle = document.getElementById('admin-more-toggle');
  if (moreToggle) {
    moreToggle.classList.toggle('is-active', toMethodology || toCases || toObservations);
  }
  closeAdminMoreMenu();

  if (!toObservations) resetObsPageState();

  updateHeaderClearButton();

  if (toAdmin) {
    resetFrontPage();
    resetAssistPage();
    resetAdminPageState();
    renderAdminList().catch(() => {});
  } else if (toStats) {
    resetFrontPage();
    resetAssistPage();
    resetAdminPageState();
    renderStatsPage().catch(() => {});
  } else if (toMethodology) {
    resetFrontPage();
    resetAssistPage();
    resetAdminPageState();
    renderMethodologyPage();
  } else if (toCases) {
    resetFrontPage();
    resetAssistPage();
    resetAdminPageState();
    renderCasesPage().catch(() => {});
  } else if (toObservations) {
    resetFrontPage();
    resetAssistPage();
    resetAdminPageState();
    resetObsPageState();
    renderObservationsPage().catch(() => {});
  } else if (toFront) {
    resetAdminPageState();
    if (!wasFront) {
      resetFrontPage();
      resetAssistPage();
      frontMode = FRONT_MODE_TREND;
    }
    if (requestedFrontMode) frontMode = requestedFrontMode;
    setFrontMode(frontMode);
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
    const record = enrichStrategyRecordForSubmit(currentStrategyRecord);
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
  try {
    const record = enrichStrategyRecordForSubmit({
      ...currentAssistRecord,
      strategyName: name,
    });
    await createStrategy(record);
    saved = true;
    if (currentPage === 'admin') await renderAdminList();
    showToast('保存成功');
    resetAssistPage();
    flashCopyStrategyBtn(btn, '已保存');
  } catch (err) {
    logSave('error', '反趋势辅助保存失败', {
      message: err?.message || String(err),
    });
    if (errEl) errEl.textContent = '保存失败。请检查 Supabase 表和权限。';
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

const assistNameInput = document.getElementById('assist-name-input');
const assistFromInput = document.getElementById('assist-from-input');
const assistToInput = document.getElementById('assist-to-input');
if (assistNameInput) assistNameInput.addEventListener('input', autoGenerateAssistIfReady);
if (assistFromInput) assistFromInput.addEventListener('input', autoGenerateAssistIfReady);
if (assistToInput) assistToInput.addEventListener('input', autoGenerateAssistIfReady);

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
const btnFrontModeTrend = document.getElementById('btn-front-mode-trend');
if (btnFrontModeTrend) btnFrontModeTrend.addEventListener('click', () => setFrontMode(FRONT_MODE_TREND));
const btnFrontModeAssist = document.getElementById('btn-front-mode-assist');
if (btnFrontModeAssist) btnFrontModeAssist.addEventListener('click', () => setFrontMode(FRONT_MODE_ASSIST));

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
  if (e.key === 'Escape' && isAdminMoreMenuOpen()) closeAdminMoreMenu();
});

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
    adminTimeFilter = nextFilter;
    adminNameFilter = '';
    adminSortByExpiresAsc = false;
    renderAdminList().catch(() => {});
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

    const multiplierBtn = target.closest('[data-cost-multiplier-delta]');
    if (multiplierBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = String(multiplierBtn.getAttribute('data-id') ?? '').trim();
      const delta = Number(multiplierBtn.getAttribute('data-cost-multiplier-delta'));
      if (!id || !Number.isFinite(delta)) return;
      const row = latestAdminRows.find((item) => String(item?.id ?? '').trim() === id);
      if (!row) return;
      const current = getAdminOpenCostMultiplier(id, row);
      multiplierBtn.disabled = true;
      try {
        await setAdminOpenCostMultiplier(id, current + delta, row);
      } catch (err) {
        console.error('[admin-cost-sync]', err);
        showToast('成本同步失败');
        renderAdminListItems();
      }
      return;
    }

    const counterTrendBtn = target.closest('[data-counter-trend-toggle]');
    if (counterTrendBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = String(counterTrendBtn.getAttribute('data-id') ?? '').trim();
      if (!id || counterTrendBtn.disabled) return;
      const row = latestAdminRows.find((item) => String(item?.id ?? '').trim() === id);
      if (row) toggleAdminCounterTrend(id, row);
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
