import { COUNTER_TREND, RISK } from '@/config';
import { formatTrimmedFixedDecimals, getDecimalPlacesFromInput, toNumber } from '@/utils/format.js';
import { parseDateValue } from '@/utils/time.js';
import { calcTakeProfit } from './price.js';
import { getDisplayConcessionItems } from './concessions.js';
import { getTimeframeMinutes } from '@/utils/time.js';

export function buildCounterTrendConcessions(row) {
  const entryPrice = toNumber(row?.entryPrice);
  const stopLoss = toNumber(row?.stopLossPrice);
  if (entryPrice == null || stopLoss == null || entryPrice === stopLoss) {
    return { items: [], stopLoss: null, refTakeProfit: null };
  }
  const decimalPlaces = Math.max(
    getDecimalPlacesFromInput(String(row?.entryPrice ?? '')),
    getDecimalPlacesFromInput(String(row?.stopLossPrice ?? '')),
    getDecimalPlacesFromInput(String(row?.inputPrice ?? '')),
  );
  const counterStop = calcTakeProfit(entryPrice, stopLoss, COUNTER_TREND.stopMultiple);
  if (counterStop == null) {
    return { items: [], stopLoss: null, refTakeProfit: null };
  }
  const refTakeProfit = formatTrimmedFixedDecimals(entryPrice, decimalPlaces);
  const items = [];
  for (const multiple of [...COUNTER_TREND.entryMultiples, ...COUNTER_TREND.priceOnlyMultiples]) {
    const price = calcTakeProfit(entryPrice, stopLoss, multiple);
    if (price == null) continue;
    items.push({
      rate: multiple,
      display: true,
      hideQuantity: true,
      showSideActions: true,
      price: formatTrimmedFixedDecimals(price, decimalPlaces),
      quantity: '',
    });
  }
  items.push({
    rate: 1,
    rateLabel: 'R',
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

export function canShowCounterTrend(row) {
  const entryPrice = toNumber(row?.entryPrice);
  const stopLoss = toNumber(row?.stopLossPrice);
  if (entryPrice == null || stopLoss == null || entryPrice === stopLoss) return false;
  return calcTakeProfit(entryPrice, stopLoss, COUNTER_TREND.stopMultiple) != null;
}

export function isCounterTrendHighRate(rate) {
  const n = Number(rate);
  return Number.isFinite(n) && n > COUNTER_TREND.collapsedMaxRate + 1e-9;
}

export function filterCounterTrendConcessionItems(items, expanded) {
  if (!Array.isArray(items)) return [];
  if (expanded) return items;
  return items.filter((item) => !isCounterTrendHighRate(item?.rate));
}

export function getCounterTrendDisplayItems(row) {
  const { items } = buildCounterTrendConcessions(row);
  return getDisplayConcessionItems(items).slice().reverse();
}

export function findCounterTrendNeighborPrices(row, rate, price) {
  const displayItems = getCounterTrendDisplayItems(row);
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
    decimalPlaces: Math.max(
      3,
      getDecimalPlacesFromInput(String(row?.entryPrice ?? '')),
      getDecimalPlacesFromInput(String(row?.stopLossPrice ?? '')),
    ),
  };
}

export function getCounterTrendTimeRange(row) {
  const unitMin = Number(row?.timeframeMinutes) > 0
    ? Number(row.timeframeMinutes)
    : getTimeframeMinutes(row?.timeframe);
  const spanMs = unitMin * RISK.durationPeriods * 60 * 1000;
  const originalEnd = parseDateValue(row?.expiresAt);
  const originalStart = parseDateValue(row?.startAt);
  const startAt = originalEnd
    || (originalStart ? new Date(originalStart.getTime() + spanMs) : null);
  if (!startAt) return { startAt: null, endAt: null };
  return {
    startAt,
    endAt: new Date(startAt.getTime() + spanMs),
  };
}

export function isCounterTrendItemCurrent(item, row) {
  const state = row?.viewState?.tierAssist;
  if (!state) return false;
  const rate = Number(state.rate);
  return Number.isFinite(rate) && Math.abs(Number(item?.rate) - rate) < 1e-9;
}

export function buildTierAssistViewState(parentRow, side, rate, price) {
  const neighbors = findCounterTrendNeighborPrices(parentRow, rate, price);
  if (!neighbors || neighbors.currentPrice == null) {
    return { error: '无法定位当前挡位' };
  }
  const entryPrice = neighbors.currentPrice;
  const neighborForStop = side === 'long' ? neighbors.belowPrice : neighbors.abovePrice;
  const takeProfit = side === 'long' ? neighbors.abovePrice : neighbors.belowPrice;
  if (neighborForStop == null || takeProfit == null) {
    return { error: '缺少相邻挡位价格，无法切换' };
  }
  const stopLoss = (entryPrice + neighborForStop) / 2;
  if (side === 'long') {
    if (!(entryPrice > stopLoss) || !(takeProfit > entryPrice)) {
      return { error: '做多需满足：止损 < 开仓 < 止盈' };
    }
  } else if (!(entryPrice < stopLoss) || !(takeProfit < entryPrice)) {
    return { error: '做空需满足：止盈 < 开仓 < 止损' };
  }
  const decimalPlaces = neighbors.decimalPlaces;
  return {
    viewState: {
      ...(parentRow?.viewState || {}),
      tierAssist: {
        side,
        rate: neighbors.currentRate ?? rate,
        entryPrice: formatTrimmedFixedDecimals(entryPrice, decimalPlaces),
        stopLoss: formatTrimmedFixedDecimals(stopLoss, decimalPlaces),
        takeProfit: formatTrimmedFixedDecimals(takeProfit, decimalPlaces),
      },
    },
  };
}
