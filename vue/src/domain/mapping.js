import {
  COST,
  FISH,
  TIER,
  VIEW_MODE,
} from '@/config';
import {
  dbValueToString,
  formatPrice,
  toNumber,
} from '@/utils/format.js';
import {
  getTimeframeLabel,
  getTimeframeMinutes,
  normalizeTimeframeMode,
  parseDateValue,
} from '@/utils/time.js';
import {
  hasConcessions,
  isAssistConcessionSet,
} from './concessions.js';
import {
  buildFishTimeRange,
  isFishTakeProfitMultiple,
  normalizeStrategyViewMode,
  normalizeViewState,
} from './types.js';
import {
  clampOpenCostMultiplier,
  getOpenCostTotal,
  getStrategyGradeFromOpenCost,
  normalizeStrategyGrade,
} from './price.js';

export function normalizeConcessions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const normalized = {
        rate: Number(item?.rate),
        price: dbValueToString(item?.price),
        quantity: dbValueToString(item?.quantity),
      };
      if (item?.display === true) normalized.display = true;
      if (item?.rateLabel) normalized.rateLabel = item.rateLabel;
      if (item?.hideQuantity === true) normalized.hideQuantity = true;
      if (item?.showSideActions === true) normalized.showSideActions = true;
      if (item?.reuseMinTierCost === true) normalized.reuseMinTierCost = true;
      return normalized;
    })
    .filter((item) => Number.isFinite(item.rate) && item.price);
}

export function parseConcessionsFromDb(value) {
  if (value == null) return null;
  const items = normalizeConcessions(value);
  return items.length ? items : null;
}

export function normalizeOutcomeStatus(outcomeStatus) {
  return outcomeStatus === 'profit' || outcomeStatus === 'loss' || outcomeStatus === 'not_filled'
    ? outcomeStatus
    : 'pending';
}

export function fromDbRecord(row) {
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

export function toDbRecord(record) {
  const startAt = parseDateValue(record.startAt);
  const expiresAt = parseDateValue(record.expiresAt);
  const openCostTotal = Number(record.openCostTotal) || getOpenCostTotal(record.openCostMultiplier);
  const openCostMultiplier = clampOpenCostMultiplier(record.openCostMultiplier ?? openCostTotal / COST.openBase);
  const isFish = isAssistConcessionSet(record.concessions) && isFishTakeProfitMultiple(record.takeProfitRMultiple);
  const fishTime = isFish ? buildFishTimeRange(startAt || new Date()) : null;
  const resolvedStart = isFish ? parseDateValue(fishTime.startAt) : startAt;
  const resolvedExpires = isFish ? parseDateValue(fishTime.expiresAt) : expiresAt;
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
    price_adjustment_rate: Number(record.priceAdjustmentRate ?? TIER.priceAdjustmentRate),
    price_adjustment: toNumber(record.priceAdjustment ?? 0),
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
    view_mode: normalizeStrategyViewMode(record.viewMode ?? VIEW_MODE.trend),
  };
}

export function fromStatsRecord(row) {
  const n = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  return {
    totalCount: n(row?.total_count),
    profitCount: n(row?.profit_count),
    lossCount: n(row?.loss_count),
    openedCount: n(row?.opened_count),
    winRate: n(row?.win_rate),
    openRate: n(row?.open_rate),
  };
}

export function buildStrategyCopyText({ name, price, quantity, takeProfit, stopLoss, description }) {
  const lines = [
    formatStrategyCardTitleSafe(name),
    `开始价格：${String(price ?? '').trim()}`,
    `数量：${String(quantity ?? '').trim()}`,
    `止盈：${String(takeProfit ?? '').trim()}`,
    `止损价格：${String(stopLoss ?? '').trim()}`,
  ];
  const note = String(description ?? '').trim();
  if (note) lines.push(`描述：${note}`);
  return lines.join('\n');
}

function formatStrategyCardTitleSafe(name) {
  const base = String(name || '未命名').trim() || '未命名';
  return /[A-Z]/.test(base) ? base.toLowerCase() : base;
}

export function formatInputPrice(value) {
  return formatPrice(toNumber(value) ?? Number(value));
}
