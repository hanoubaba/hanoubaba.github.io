import { COST, GRADE, TIER } from '@/config';
import { clampPriceAtZero, formatFixedDecimals, toNumber } from '@/utils/format.js';

export function clampOpenCostMultiplier(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return COST.multiplierDefault;
  return Math.min(COST.multiplierMax, Math.max(COST.multiplierMin, n));
}

export function getOpenCostTotal(multiplier = COST.multiplierDefault) {
  return COST.openBase * clampOpenCostMultiplier(multiplier);
}

export function getOpenCost() {
  const total = getOpenCostTotal();
  return total / TIER.defaultCount;
}

export function normalizeUnitCost(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function getStrategyGradeFromOpenCost(openCost, openCostTotal, tierCount = TIER.defaultCount) {
  const total = openCostTotal != null
    ? Number(openCostTotal)
    : Math.round(Number(openCost) * tierCount);
  if (COST.premiumTotals.includes(total)) return GRADE.premium;
  if (Number(openCost) === COST.premiumOpenCost) return GRADE.premium;
  return GRADE.normal;
}

export function normalizeStrategyGrade(grade) {
  return String(grade ?? '').trim() === GRADE.premium ? GRADE.premium : GRADE.normal;
}

export function calcTakeProfit(open, stop, multiplier = 1) {
  const stopDiff = Math.abs(open - stop);
  const m = Number(multiplier);
  if (!(stopDiff > 0) || !Number.isFinite(m) || m <= 0) return null;
  const move = stopDiff * m;
  const raw = open > stop ? open + move : open - move;
  return clampPriceAtZero(raw);
}

export function calcAssistTakeProfitPrice(from, to, multiple) {
  const start = Number(from);
  const end = Number(to);
  const m = Number(multiple);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end || !Number.isFinite(m) || m <= 0) {
    return null;
  }
  const tp = start + m * (end - start);
  return Number.isFinite(tp) && tp > 0 ? tp : null;
}

export function calcAdjustedOpenPrice(open, _stop, decimalPlaces) {
  return Number(formatFixedDecimals(open, decimalPlaces));
}

export function calcConcessionalEntryPrice(entryPrice, stopLoss, rate, decimalPlaces, reverse = false) {
  const stopDiff = Math.abs(entryPrice - stopLoss);
  if (!(stopDiff > 0) || !Number.isFinite(rate)) return null;
  const awayFromStop = entryPrice > stopLoss ? 1 : -1;
  const direction = reverse ? -awayFromStop : awayFromStop;
  const price = clampPriceAtZero(entryPrice + direction * rate * stopDiff);
  if (price == null) return null;
  return Number(formatFixedDecimals(price, decimalPlaces));
}

export function calcQuantityByRisk(openCost, entryPrice, stopLoss) {
  const stopDiff = Math.abs(entryPrice - stopLoss);
  if (!(stopDiff > 0) || openCost == null || !(openCost > 0)) return null;
  return openCost / stopDiff;
}

export function calcAssistTierPrice(from, to, ratio, decimalPlaces) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(ratio)) return null;
  const price = from + (to - from) * ratio;
  if (!Number.isFinite(price)) return null;
  return Number(formatFixedDecimals(price, decimalPlaces));
}

export function normalizeReferenceTakeProfitPrice(price) {
  return clampPriceAtZero(price);
}

export function buildTakeProfitLabel(entryPrice, stopLoss, multiple, decimalPlaces = 0) {
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopLoss);
  if (entry == null || stop == null || entry === stop) return '—';
  const tp = calcTakeProfit(entry, stop, multiple);
  if (tp == null) return '—';
  const normalized = normalizeReferenceTakeProfitPrice(tp);
  if (normalized == null) return '—';
  const decimals = Math.max(0, Math.min(20, Math.floor(Number(decimalPlaces) || 0)));
  return formatFixedDecimals(normalized, decimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
