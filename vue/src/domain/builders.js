import { ASSIST, COST, FISH, RISK, TIER, TIER_ASSIST, TRADE_MODE, VIEW_MODE } from '@/config';
import {
  formatPrice,
  formatQuantity,
  formatTrimmedFixedDecimals,
  getDecimalPlacesFromInput,
  toNumber,
} from '@/utils/format.js';
import {
  addPeriodToStart,
  getStartDateTime,
  getTimeframeLabel,
  getTimeframeMinutes,
} from '@/utils/time.js';
import {
  applyAdminFixedTierQuantities,
  buildConcessionItems,
  formatConcessionPercent,
  getConfiguredDisplayRates,
  getMinFundedTierCostShare,
  hasAdminTierCostBudget,
  normalizeConcessionRateConfig,
  resolveTierOpenCost,
} from './concessions.js';
import {
  buildFishTimeRange,
} from './types.js';
import {
  calcAdjustedOpenPrice,
  calcAssistTakeProfitPrice,
  calcAssistTierPrice,
  calcQuantityByRisk,
  calcTakeProfit,
  getOpenCost,
  getOpenCostTotal,
  getStrategyGradeFromOpenCost,
} from './price.js';
import { buildStrategyCopyText } from './mapping.js';

export function buildTrendRecord({
  name,
  open,
  stop,
  startTimeValue,
  timeframe,
  description = '',
  preserve = null,
}) {
  const priceDecimalPlaces = Math.max(getDecimalPlacesFromInput(String(open)), getDecimalPlacesFromInput(String(stop))) + 1;
  const openNum = toNumber(open);
  const stopNum = toNumber(stop);
  const openCost = getOpenCost();
  const unitMin = getTimeframeMinutes(timeframe);
  const spanMinutes = unitMin * RISK.durationPeriods;
  const adjustedOpen = calcAdjustedOpenPrice(openNum, stopNum, priceDecimalPlaces);
  const openCostTotal = getOpenCostTotal();
  const quantity = calcQuantityByRisk(openCost, adjustedOpen, stopNum);
  const tp = calcTakeProfit(adjustedOpen, stopNum, RISK.takeProfitR);
  const side = adjustedOpen > stopNum ? 'long' : 'short';
  const startAt = getStartDateTime(startTimeValue, timeframe);
  const endAt = addPeriodToStart(startTimeValue, spanMinutes, timeframe);
  const concessionItems = buildConcessionItems(
    adjustedOpen,
    stopNum,
    openCostTotal,
    priceDecimalPlaces,
    TIER.concessionRates,
    false,
  );
  const primaryItem = concessionItems.find((item) => Math.abs(Number(item.rate) - TIER.priceAdjustmentRate) < 1e-9);
  const qty = primaryItem?.quantity ?? formatQuantity(quantity);
  const priceLabel = formatTrimmedFixedDecimals(adjustedOpen, priceDecimalPlaces);
  const tpLabel = formatTrimmedFixedDecimals(tp, Math.max(0, priceDecimalPlaces));
  const stopLabel = formatPrice(stopNum);
  const alarmName = String(name ?? '').trim() || 'test';
  const record = {
    strategyName: alarmName,
    description,
    positionSide: side,
    inputPrice: formatPrice(openNum),
    inputStopLoss: formatPrice(stopNum),
    entryPrice: priceLabel,
    quantity: qty,
    takeProfitPrice: tpLabel,
    stopLossPrice: stopLabel,
    openCost,
    openCostMultiplier: COST.multiplierDefault,
    openCostTotal,
    tierCount: TIER.defaultCount,
    tradeMode: TRADE_MODE.normal,
    grade: getStrategyGradeFromOpenCost(openCost, openCostTotal, TIER.defaultCount),
    priceAdjustmentRate: TIER.priceAdjustmentRate,
    priceAdjustment: '0',
    concessions: concessionItems,
    takeProfitRMultiple: RISK.takeProfitR,
    timeframe,
    timeframeMinutes: unitMin,
    timeframeLabel: getTimeframeLabel(timeframe),
    validPeriods: RISK.durationPeriods,
    durationMinutes: spanMinutes,
    startAt: startAt ? startAt.toISOString() : null,
    expiresAt: endAt ? endAt.toISOString() : null,
    outcomeStatus: 'pending',
    viewMode: VIEW_MODE.trend,
  };
  if (preserve) {
    record.outcomeStatus = preserve.outcomeStatus ?? record.outcomeStatus;
    record.outcomeRemark = preserve.outcomeRemark ?? '';
    record.viewMode = preserve.viewMode ?? record.viewMode;
    record.viewState = preserve.viewState ?? record.viewState;
    record.description = String(preserve.description ?? description ?? '').trim();
  }
  return {
    record,
    copyText: buildStrategyCopyText({
      name: alarmName,
      price: priceLabel,
      quantity: qty,
      takeProfit: tpLabel,
      stopLoss: stopLabel,
      description: record.description,
    }),
  };
}

export function buildAssistConcessionItems(from, to, openCostTotal, decimalPlaces, fixedTierOpenCost = null) {
  if (from == null || to == null || from === to || !hasAdminTierCostBudget(openCostTotal, fixedTierOpenCost)) {
    return [];
  }
  const stop = from;
  const minFundedShare = getMinFundedTierCostShare(ASSIST.ratios);
  const items = [];
  for (const rateConfig of ASSIST.ratios) {
    const { rate, costShare, reuseMinTierCost } = normalizeConcessionRateConfig(rateConfig);
    const price = calcAssistTierPrice(from, to, rate, decimalPlaces);
    if (price == null || !(price > 0) || price === stop) continue;
    const share = reuseMinTierCost ? minFundedShare : costShare;
    const tierOpenCost = share != null && share > 0
      ? resolveTierOpenCost(openCostTotal, share, fixedTierOpenCost)
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

export function buildFishRecord({ name, from, to, unitCost, description = '', preserve = null }) {
  const fromNum = toNumber(from);
  const toNum = toNumber(to);
  const priceDecimalPlaces = Math.max(3, Math.max(getDecimalPlacesFromInput(String(from)), getDecimalPlacesFromInput(String(to))) + 1);
  const openCostTotal = getOpenCostTotal();
  const concessionItems = buildAssistConcessionItems(fromNum, toNum, openCostTotal, priceDecimalPlaces, unitCost);
  if (!concessionItems.length) return null;
  const takeProfit = calcAssistTakeProfitPrice(fromNum, toNum, FISH.takeProfitMultiple);
  const primaryItem = concessionItems[0];
  const openCost = openCostTotal / TIER.defaultCount;
  const fishTime = buildFishTimeRange();
  const alarmName = String(name ?? '').trim() || 'test';
  const stopLabel = formatTrimmedFixedDecimals(fromNum, priceDecimalPlaces);
  const tpLabel = formatTrimmedFixedDecimals(takeProfit, priceDecimalPlaces);
  const record = {
    strategyName: alarmName,
    description,
    positionSide: fromNum > toNum ? 'short' : 'long',
    inputPrice: formatTrimmedFixedDecimals(fromNum, priceDecimalPlaces),
    inputStopLoss: formatTrimmedFixedDecimals(toNum, priceDecimalPlaces),
    entryPrice: primaryItem.price,
    quantity: primaryItem.quantity,
    takeProfitPrice: tpLabel,
    stopLossPrice: stopLabel,
    openCost,
    openCostMultiplier: COST.multiplierDefault,
    openCostTotal,
    tierCount: TIER.defaultCount,
    tradeMode: TRADE_MODE.normal,
    grade: getStrategyGradeFromOpenCost(openCost, openCostTotal, TIER.defaultCount),
    priceAdjustmentRate: 0,
    priceAdjustment: '0',
    concessions: concessionItems,
    takeProfitRMultiple: FISH.takeProfitMultiple,
    ...fishTime,
    outcomeStatus: 'pending',
    viewMode: VIEW_MODE.trend,
  };
  if (preserve) {
    record.outcomeStatus = preserve.outcomeStatus ?? record.outcomeStatus;
    record.outcomeRemark = preserve.outcomeRemark ?? '';
    record.viewMode = preserve.viewMode ?? record.viewMode;
    record.viewState = preserve.viewState ?? record.viewState;
    record.description = String(preserve.description ?? description ?? '').trim();
  }
  return {
    record,
    copyText: [
      alarmName,
      ...concessionItems.map((item) => `${formatConcessionPercent(item.rate)}：${item.price} / ${item.quantity}`),
      `止盈价格：${tpLabel}`,
      `止损价格：${stopLabel}`,
    ].join('\n'),
  };
}

export function buildLinkedTierAssistDisplay(row, unitCost) {
  const state = (row?.viewState && row.viewState.tierAssist) || null;
  const decimalPlaces = Math.max(3, getDecimalPlacesFromInput(String(row?.entryPrice ?? '')), getDecimalPlacesFromInput(String(row?.stopLossPrice ?? '')));
  const side = state?.side === 'short' ? 'short' : 'long';
  const entryPrice = toNumber(state?.entryPrice ?? row?.entryPrice);
  const stopLoss = toNumber(state?.stopLoss ?? row?.stopLossPrice);
  let takeProfit = toNumber(state?.takeProfit);
  if (takeProfit == null) takeProfit = calcTakeProfit(entryPrice, stopLoss, TIER_ASSIST.takeProfitMultiple);
  if (entryPrice == null || stopLoss == null || entryPrice === stopLoss) {
    return { side, concessions: [], takeProfitLabel: '—', stopLabel: '—' };
  }
  const concessionItems = buildConcessionItems(
    entryPrice,
    stopLoss,
    null,
    decimalPlaces,
    TIER_ASSIST.rates,
    false,
    { fixedTierOpenCost: unitCost },
  );
  const allowedRates = getConfiguredDisplayRates(TIER_ASSIST.rates);
  const concessions = applyAdminFixedTierQuantities(concessionItems, stopLoss, unitCost).filter((item) => (
    allowedRates.some((rate) => Math.abs(Number(item.rate) - rate) < 1e-9)
  ));
  return {
    side,
    concessions,
    takeProfitLabel: takeProfit != null ? formatTrimmedFixedDecimals(takeProfit, decimalPlaces) : '—',
    stopLabel: formatTrimmedFixedDecimals(stopLoss, decimalPlaces),
  };
}
