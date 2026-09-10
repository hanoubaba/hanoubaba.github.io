import {
  ASSIST,
  FISH,
  LABELS,
  STRATEGY_TYPE,
  TIER_ASSIST,
  VIEW_MODE,
} from '@/config';
import { toNumber } from '@/utils/format.js';
import { getTimeframeLabel } from '@/utils/time.js';
import {
  hasConcessions,
  isAssistConcessionSet,
  isTierAssistConcessionSet,
} from './concessions.js';

export function formatStrategyCardTitle(name) {
  const base = String(name || LABELS.untitled).trim() || LABELS.untitled;
  return /[A-Z]/.test(base) ? base.toLowerCase() : base;
}

export function getStrategyNameKey(name) {
  return formatStrategyCardTitle(name);
}

export function formatAssistStrategyTitle(name) {
  return `${formatStrategyCardTitle(name)}${ASSIST.titleSuffix}`;
}

export function formatFishStrategyTitle(name) {
  return `${formatStrategyCardTitle(name)}${FISH.titleSuffix}`;
}

export function formatTierAssistStrategyTitle(name) {
  return `${formatStrategyCardTitle(name)}${TIER_ASSIST.titleSuffix}`;
}

export function isFishTakeProfitMultiple(value) {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n - FISH.takeProfitMultiple) < 1e-9;
}

export function getAdminStrategyTypeInfo(row) {
  const rawConcessions = hasConcessions(row?.concessions) ? row.concessions : [];
  if (isTierAssistConcessionSet(rawConcessions)) {
    return { label: LABELS.viewModes[VIEW_MODE.tierAssist], type: STRATEGY_TYPE.tierAssist };
  }
  if (isAssistConcessionSet(rawConcessions)) {
    if (isFishTakeProfitMultiple(row?.takeProfitRMultiple)) {
      return { label: LABELS.viewModes[VIEW_MODE.fish], type: STRATEGY_TYPE.fish };
    }
    return { label: LABELS.viewModes.assist, type: STRATEGY_TYPE.assist };
  }
  return { label: LABELS.viewModes[VIEW_MODE.trend], type: STRATEGY_TYPE.trend };
}

export function normalizeStrategyViewMode(value) {
  if (value === VIEW_MODE.counterTrend) return VIEW_MODE.counterTrend;
  if (value === VIEW_MODE.tierAssist) return VIEW_MODE.tierAssist;
  if (value === VIEW_MODE.fish) return VIEW_MODE.fish;
  return VIEW_MODE.trend;
}

export function normalizeViewState(value) {
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

export function getTierAssistViewState(row) {
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

export function getPositionSideMod(side) {
  return side === 'long' || side === 'short' ? side : 'flat';
}

export function getPositionSideLabel(side) {
  return LABELS.sides[getPositionSideMod(side)] || '';
}

export function getAdminModeChipClass(mode) {
  if (mode === VIEW_MODE.fish) return 'fish';
  if (mode === VIEW_MODE.tierAssist) return 'tier_assist';
  if (mode === VIEW_MODE.counterTrend) return 'counter';
  if (mode === 'assist') return 'assist';
  return 'trend';
}

export function buildFishTimeRange(now = new Date()) {
  const startAt = new Date(now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : Date.now());
  startAt.setMilliseconds(0);
  const durationMinutes = FISH.timeframeMinutes * FISH.validPeriods;
  const expiresAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  return {
    timeframe: FISH.timeframe,
    timeframeMinutes: FISH.timeframeMinutes,
    timeframeLabel: getTimeframeLabel(FISH.timeframe),
    validPeriods: FISH.validPeriods,
    durationMinutes,
    startAt: startAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function findRelatedByType(row, rows, type) {
  const key = getStrategyNameKey(row?.strategyName);
  if (!key || key === LABELS.untitled) return null;
  const selfId = String(row?.id ?? '').trim();
  return (Array.isArray(rows) ? rows : []).find((item) => {
    if (!item || String(item?.id ?? '').trim() === selfId) return false;
    if (getStrategyNameKey(item?.strategyName) !== key) return false;
    return getAdminStrategyTypeInfo(item).type === type;
  }) || null;
}

export function isLinkedFishRow(row, rows) {
  if (getAdminStrategyTypeInfo(row).type !== STRATEGY_TYPE.fish) return false;
  return Boolean(findRelatedByType(row, rows, STRATEGY_TYPE.trend));
}

export function getAdminVisibleRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((row) => (
    getAdminStrategyTypeInfo(row).type !== STRATEGY_TYPE.tierAssist
    && !isLinkedFishRow(row, list)
  ));
}
