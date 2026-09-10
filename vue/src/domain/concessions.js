import { ASSIST, TIER, TIER_ASSIST } from '@/config';
import {
  formatQuantity,
  formatTrimmedFixedDecimals,
  ratesMatch,
  toNumber,
} from '@/utils/format.js';
import { calcConcessionalEntryPrice, calcQuantityByRisk } from './price.js';

export function normalizeConcessionRateConfig(rateConfig) {
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

export function isDisplayRateConfig(rateConfig) {
  const { rate, display } = normalizeConcessionRateConfig(rateConfig);
  return Number(rate) !== 0 || display === true;
}

export function isFundedRateConfig(rateConfig) {
  const config = normalizeConcessionRateConfig(rateConfig);
  return !config.reuseMinTierCost && isDisplayRateConfig(rateConfig);
}

export function getConfiguredDisplayRates(rateConfigs) {
  return (Array.isArray(rateConfigs) ? rateConfigs : [])
    .filter(isDisplayRateConfig)
    .map((item) => Number(normalizeConcessionRateConfig(item).rate))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

export function getDisplayConcessionItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => Number(item.rate) !== 0 || item.display === true)
    .slice()
    .sort((a, b) => Number(a.rate) - Number(b.rate));
}

export function getSortedDisplayRates(concessions) {
  return getDisplayConcessionItems(concessions)
    .map((item) => Number(item.rate))
    .filter(Number.isFinite);
}

export function hasConcessions(concessions) {
  return Array.isArray(concessions) && concessions.length > 0;
}

export function getMinFundedTierCostShare(rates) {
  const funded = (Array.isArray(rates) ? rates : [])
    .filter(isFundedRateConfig)
    .map((item) => normalizeConcessionRateConfig(item).costShare)
    .filter((share) => share != null && share > 0);
  if (!funded.length) return null;
  return Math.min(...funded);
}

export function countFundedRateConfigs(rates) {
  return (Array.isArray(rates) ? rates : []).filter(isFundedRateConfig).length;
}

export function getTierOpenCostBudget(openCostTotal, costShare) {
  const total = Number(openCostTotal);
  const share = Number(costShare);
  if (!(total > 0) || !(share > 0)) return null;
  return total * share;
}

export function resolveTierOpenCost(openCostTotal, costShare, fixedTierOpenCost = null) {
  const fixed = Number(fixedTierOpenCost);
  if (Number.isFinite(fixed) && fixed > 0) return fixed;
  return getTierOpenCostBudget(openCostTotal, costShare);
}

export function hasAdminTierCostBudget(openCostTotal = null, fixedTierOpenCost = null) {
  const fixed = Number(fixedTierOpenCost);
  if (Number.isFinite(fixed) && fixed > 0) return true;
  const total = Number(openCostTotal);
  return Number.isFinite(total) && total > 0;
}

export function buildConcessionItems(
  entryPrice,
  stopLoss,
  openCostTotal,
  decimalPlaces,
  rates = TIER.concessionRates,
  reverse = false,
  options = {},
) {
  const fixedTierOpenCost = options?.fixedTierOpenCost ?? null;
  const fundedCount = countFundedRateConfigs(rates);
  const minFundedShare = getMinFundedTierCostShare(rates);
  const items = [];
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
      quantity: formatQuantity(qty),
    };
    if (display) item.display = true;
    if (reuseMinTierCost) item.reuseMinTierCost = true;
    items.push(item);
  }
  return items;
}

export function applyAdminFixedTierQuantities(concessions, stopLoss, unitCost) {
  if (!hasConcessions(concessions)) return [];
  const stop = toNumber(stopLoss);
  if (stop == null || !(unitCost > 0)) return concessions.slice();
  return concessions.map((item) => {
    const next = { ...item };
    const price = toNumber(item.price);
    const qty = price == null ? null : calcQuantityByRisk(unitCost, price, stop);
    if (qty != null) next.quantity = formatQuantity(qty);
    return next;
  });
}

export function isCurrentTrendConcessionSet(concessions) {
  const rates = getSortedDisplayRates(concessions);
  return ratesMatch(rates, [0, 0.1, 0.2, 0.5, 0.8])
    || ratesMatch(rates, [0.2, 0.5, 0.8])
    || ratesMatch(rates, [0, 0.3, 0.8]);
}

export function isTierAssistConcessionSet(concessions) {
  const rates = getSortedDisplayRates(concessions);
  return ratesMatch(rates, getConfiguredDisplayRates(TIER_ASSIST.rates))
    || TIER_ASSIST.legacyRates.some((legacy) => ratesMatch(rates, legacy));
}

export function isCurrentAssistConcessionSet(concessions) {
  return ratesMatch(getSortedDisplayRates(concessions), getConfiguredDisplayRates(ASSIST.ratios));
}

export function isAssistConcessionSet(concessions) {
  const rates = getSortedDisplayRates(concessions);
  return isCurrentAssistConcessionSet(concessions)
    || ASSIST.legacyRates.some((legacy) => ratesMatch(rates, legacy));
}

export function formatConcessionPercent(rate) {
  const pct = Math.round(Number(rate) * 100);
  if (!Number.isFinite(pct)) return '—';
  return `${String(pct).padStart(2, '0')}%`;
}

export function formatCounterTrendRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)}R`;
}

export function getAssistTierLabel(rate) {
  const matched = ASSIST.ratios.find((item) => Math.abs(Number(rate) - item.rate) < 1e-9);
  return matched?.label || formatConcessionPercent(rate);
}

export function shouldHideAssistQuantity(rate) {
  return Math.abs(Number(rate) - ASSIST.hideQuantityRate) < 1e-9;
}

export function isBestConcessionRate(rate) {
  const n = Number(rate);
  return Number.isFinite(n) && n <= TIER.bestRateMax + 1e-9;
}

export function getConcessionBoundaryZone(item, boundary) {
  if (!boundary) return 'none';
  if (typeof boundary.getZone === 'function') return boundary.getZone(item) || 'none';
  if (boundary.rate != null && Number.isFinite(Number(item?.rate))) {
    const r = Number(item.rate);
    if (r > Number(boundary.rate) + 1e-9) return 'beyond';
    return 'within';
  }
  return 'none';
}
