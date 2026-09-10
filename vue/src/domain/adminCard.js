import { ASSIST, COUNTER_TREND, FISH, LABELS, RISK, STRATEGY_TYPE, VIEW_MODE } from '@/config';
import { formatAdminPriceFromValue, formatTrimmedFixedDecimals, toNumber } from '@/utils/format.js';
import { formatAdminTimeRange, getTimeframeShortLabel } from '@/utils/time.js';
import {
  applyAdminFixedTierQuantities,
  buildConcessionItems,
  formatConcessionPercent,
  formatCounterTrendRate,
  getAssistTierLabel,
  getConfiguredDisplayRates,
  getDisplayConcessionItems,
  hasConcessions,
  shouldHideAssistQuantity,
} from '@/domain/concessions.js';
import { calcAssistTakeProfitPrice, calcTakeProfit } from '@/domain/price.js';
import { buildAssistConcessionItems, buildLinkedTierAssistDisplay } from '@/domain/builders.js';
import {
  buildCounterTrendConcessions,
  canShowCounterTrend,
  filterCounterTrendConcessionItems,
  getCounterTrendTimeRange,
  isCounterTrendItemCurrent,
} from '@/domain/counterTrend.js';
import {
  findRelatedByType,
  formatAssistStrategyTitle,
  formatFishStrategyTitle,
  formatStrategyCardTitle,
  formatTierAssistStrategyTitle,
  getAdminModeChipClass,
  getAdminStrategyTypeInfo,
  getPositionSideLabel,
  getPositionSideMod,
  getTierAssistViewState,
  isLinkedFishRow,
  normalizeStrategyViewMode,
} from '@/domain/types.js';
import { getStrategyEndAt, getStrategyStartAt, getTimeBadgeInfo, isCountdownWithinUrgentWindow } from '@/domain/timeStatus.js';
import { TIER } from '@/config';

function getAdminPriceDecimalPlaces(row) {
  return Math.max(
    0,
    String(row?.inputPrice ?? '').includes('.') ? String(row.inputPrice).split('.')[1]?.length || 0 : 0,
    String(row?.entryPrice ?? '').includes('.') ? String(row.entryPrice).split('.')[1]?.length || 0 : 0,
    String(row?.stopLossPrice ?? '').includes('.') ? String(row.stopLossPrice).split('.')[1]?.length || 0 : 0,
  );
}

export function isAdminCounterTrendView(row) {
  return getAdminStrategyTypeInfo(row).type === STRATEGY_TYPE.trend
    && canShowCounterTrend(row)
    && normalizeStrategyViewMode(row?.viewMode) === VIEW_MODE.counterTrend;
}

export function isAdminTierAssistView(row) {
  return getAdminStrategyTypeInfo(row).type === STRATEGY_TYPE.trend
    && normalizeStrategyViewMode(row?.viewMode) === VIEW_MODE.tierAssist
    && Boolean(getTierAssistViewState(row));
}

export function isAdminFishView(row, rows) {
  return getAdminStrategyTypeInfo(row).type === STRATEGY_TYPE.trend
    && normalizeStrategyViewMode(row?.viewMode) === VIEW_MODE.fish
    && Boolean(findRelatedByType(row, rows, STRATEGY_TYPE.fish));
}

export function getAdminDisplayViewMode(row, rows) {
  const type = getAdminStrategyTypeInfo(row).type;
  if (type === STRATEGY_TYPE.fish) return VIEW_MODE.fish;
  if (type === STRATEGY_TYPE.tierAssist) return VIEW_MODE.tierAssist;
  if (type === STRATEGY_TYPE.assist) return 'assist';
  if (isAdminFishView(row, rows)) return VIEW_MODE.fish;
  if (isAdminTierAssistView(row)) return VIEW_MODE.tierAssist;
  if (isAdminCounterTrendView(row)) return VIEW_MODE.counterTrend;
  return VIEW_MODE.trend;
}

export function getOptionalModes(row, rows) {
  const type = getAdminStrategyTypeInfo(row).type;
  if (type !== STRATEGY_TYPE.trend) return [];
  const current = getAdminDisplayViewMode(row, rows);
  const canCounter = canShowCounterTrend(row);
  const canTier = Boolean(getTierAssistViewState(row));
  const canFish = Boolean(findRelatedByType(row, rows, STRATEGY_TYPE.fish));
  return [
    current !== VIEW_MODE.trend ? { value: VIEW_MODE.trend, label: LABELS.viewModes[VIEW_MODE.trend], mod: 'trend' } : null,
    canCounter && current !== VIEW_MODE.counterTrend ? { value: VIEW_MODE.counterTrend, label: LABELS.viewModes[VIEW_MODE.counterTrend], mod: 'counter' } : null,
    canTier && current !== VIEW_MODE.tierAssist ? { value: VIEW_MODE.tierAssist, label: LABELS.viewModes[VIEW_MODE.tierAssist], mod: 'tier' } : null,
    (canFish || current !== VIEW_MODE.fish) && current !== VIEW_MODE.fish
      ? { value: VIEW_MODE.fish, label: LABELS.viewModes[VIEW_MODE.fish], mod: 'fish' }
      : null,
  ].filter(Boolean);
}

function prepareConcessionRows(items, options = {}) {
  let displayItems = getDisplayConcessionItems(items);
  if (options.reverseOrder) displayItems = displayItems.slice().reverse();
  return displayItems.map((item) => {
    const rateLabel = item.rateLabel
      ? String(item.rateLabel)
      : (options.formatRate ? options.formatRate(item.rate) : formatConcessionPercent(item.rate));
    return {
      ...item,
      rateLabel,
      current: typeof options.isCurrentItem === 'function' ? options.isCurrentItem(item) : false,
      hideQty: item.hideQuantity === true || options.sideActions,
      isRRow: String(item.rateLabel || '').toUpperCase() === 'R' || Math.abs(Number(item.rate) - 1) < 1e-9,
      is100R: Math.abs(Number(item.rate) - COUNTER_TREND.foldHideRate) < 1e-9,
      hideAssistQty: options.assistLabels && shouldHideAssistQuantity(item.rate),
    };
  });
}

export function buildAdminCardModel(row, {
  rows = [],
  unitCost,
  selectedIds = [],
  selectionMode = false,
  expanded = false,
} = {}) {
  const rawId = String(row?.id ?? '').trim();
  const strategyType = getAdminStrategyTypeInfo(row);
  const showCounterTrend = Boolean(rawId && isAdminCounterTrendView(row));
  const showTierAssistView = Boolean(rawId && isAdminTierAssistView(row));
  const showFishView = Boolean(rawId && isAdminFishView(row, rows));
  const relatedFish = showFishView ? findRelatedByType(row, rows, STRATEGY_TYPE.fish) : null;
  const linkedTier = showTierAssistView ? buildLinkedTierAssistDisplay(row, unitCost) : null;
  const baseSideMod = getPositionSideMod(row?.positionSide);
  const sideMod = showFishView && relatedFish
    ? getPositionSideMod(relatedFish.positionSide)
    : (showCounterTrend
      ? (baseSideMod === 'long' ? 'short' : 'long')
      : (linkedTier ? getPositionSideMod(linkedTier.side) : baseSideMod));
  const isAssistStrategy = strategyType.type === STRATEGY_TYPE.assist;
  const isFishStrategy = strategyType.type === STRATEGY_TYPE.fish;
  const isTierAssistStrategy = strategyType.type === STRATEGY_TYPE.tierAssist;
  const isAssistLike = isAssistStrategy || isFishStrategy || showFishView;
  const nameRaw = String(row?.strategyName ?? '').trim();
  const title = formatStrategyCardTitle(nameRaw);
  const remark = String(row?.outcomeRemark ?? '').trim();
  const decimalPlaces = getAdminPriceDecimalPlaces(row);
  let concessions = [];
  let stopLabel = '—';
  let takeProfitLabel = '—';
  let tenRBoundary = null;
  let reverseOrder = false;
  let formatRate = formatConcessionPercent;
  let rateHeader = '让利';
  let sideActions = false;

  if (showCounterTrend) {
    const counter = buildCounterTrendConcessions(row);
    concessions = filterCounterTrendConcessionItems(counter.items, expanded);
    takeProfitLabel = counter.refTakeProfit || '—';
    stopLabel = counter.stopLoss || '—';
    tenRBoundary = { rate: COUNTER_TREND.stopMultiple, label: '10R 分界' };
    reverseOrder = true;
    formatRate = formatCounterTrendRate;
    rateHeader = '倍数';
    sideActions = true;
  } else if (showTierAssistView) {
    concessions = linkedTier?.concessions || [];
    takeProfitLabel = linkedTier?.takeProfitLabel || '—';
    stopLabel = linkedTier?.stopLabel || '—';
  } else if (showFishView && relatedFish) {
    concessions = buildAssistConcessionItems(
      toNumber(relatedFish?.inputPrice ?? relatedFish?.stopLossPrice),
      toNumber(relatedFish?.inputStopLoss),
      null,
      Math.max(3, decimalPlaces),
      unitCost,
    );
    const assistFrom = toNumber(relatedFish?.inputPrice ?? relatedFish?.stopLossPrice);
    const assistTo = toNumber(relatedFish?.inputStopLoss);
    const assistTp = calcAssistTakeProfitPrice(assistFrom, assistTo, FISH.takeProfitMultiple);
    takeProfitLabel = assistTp != null
      ? formatTrimmedFixedDecimals(assistTp, decimalPlaces)
      : (formatAdminPriceFromValue(relatedFish?.takeProfitPrice, decimalPlaces) || '—');
    stopLabel = formatAdminPriceFromValue(relatedFish?.inputPrice ?? relatedFish?.stopLossPrice, decimalPlaces) || '—';
  } else if (isAssistLike) {
    const source = showFishView ? relatedFish : row;
    concessions = buildAssistConcessionItems(
      toNumber(source?.inputPrice ?? source?.stopLossPrice),
      toNumber(source?.inputStopLoss),
      null,
      Math.max(3, decimalPlaces),
      unitCost,
    );
    const assistFrom = toNumber(source?.inputPrice ?? source?.stopLossPrice);
    const assistTo = toNumber(source?.inputStopLoss);
    const tpMultiple = isFishStrategy || showFishView ? FISH.takeProfitMultiple : ASSIST.takeProfitMultiple;
    const assistTp = calcAssistTakeProfitPrice(assistFrom, assistTo, tpMultiple);
    takeProfitLabel = assistTp != null
      ? formatTrimmedFixedDecimals(assistTp, decimalPlaces)
      : (formatAdminPriceFromValue(source?.takeProfitPrice, decimalPlaces) || '—');
    stopLabel = formatAdminPriceFromValue(source?.inputPrice ?? source?.stopLossPrice, decimalPlaces) || '—';
  } else if (isTierAssistStrategy) {
    const saved = hasConcessions(row?.concessions) ? row.concessions : [];
    const allowedRates = getConfiguredDisplayRates(TIER.concessionRates);
    concessions = applyAdminFixedTierQuantities(saved, row?.stopLossPrice, unitCost);
    takeProfitLabel = formatAdminPriceFromValue(row?.takeProfitPrice, decimalPlaces) || '—';
    stopLabel = formatAdminPriceFromValue(row?.stopLossPrice, decimalPlaces) || '—';
  } else {
    const saved = hasConcessions(row?.concessions) ? row.concessions : [];
    concessions = applyAdminFixedTierQuantities(saved, row?.stopLossPrice, unitCost);
    if (!concessions.length) {
      concessions = buildConcessionItems(
        toNumber(row?.entryPrice),
        toNumber(row?.stopLossPrice),
        null,
        decimalPlaces,
        TIER.concessionRates,
        false,
        { fixedTierOpenCost: unitCost },
      );
    }
    const tp = calcTakeProfit(toNumber(row?.entryPrice), toNumber(row?.stopLossPrice), RISK.bestTakeProfitR);
    takeProfitLabel = tp != null ? formatTrimmedFixedDecimals(tp, decimalPlaces) : '—';
    stopLabel = formatAdminPriceFromValue(row?.stopLossPrice, decimalPlaces) || '—';
  }

  const concessionRows = prepareConcessionRows(concessions, {
    reverseOrder,
    formatRate: isAssistLike ? getAssistTierLabel : formatRate,
    assistLabels: isAssistLike,
    sideActions,
    isCurrentItem: (item) => showCounterTrend && isCounterTrendItemCurrent(item, row),
  });

  const grouped = [];
  if (tenRBoundary) {
    let bucket = [];
    let zone = null;
    const flush = () => {
      if (!bucket.length) return;
      grouped.push({ zone, items: bucket });
      bucket = [];
    };
    for (const item of concessionRows) {
      const nextZone = Number(item.rate) > Number(tenRBoundary.rate) + 1e-9 ? 'beyond' : 'within';
      if (zone != null && nextZone !== zone) flush();
      zone = nextZone;
      bucket.push(item);
    }
    flush();
  } else {
    grouped.push({ zone: 'none', items: concessionRows });
  }

  const displayMode = getAdminDisplayViewMode(row, rows);
  const currentModeLabel = LABELS.viewModes[displayMode] || LABELS.viewModes[VIEW_MODE.trend];
  const sideLabel = getPositionSideLabel(sideMod);
  const showTimeMeta = strategyType.type === STRATEGY_TYPE.trend && !showFishView;
  const counterTimeRange = showCounterTrend ? getCounterTrendTimeRange(row) : null;
  const startAt = showCounterTrend ? counterTimeRange?.startAt : getStrategyStartAt(row);
  const endAt = showCounterTrend ? counterTimeRange?.endAt : getStrategyEndAt(row);
  const timeBadge = showTimeMeta ? getTimeBadgeInfo(endAt) : null;
  const canShowEdit = Boolean(
    rawId
    && !selectionMode
    && (showFishView || isFishStrategy || (
      strategyType.type === STRATEGY_TYPE.trend
      && !showCounterTrend
      && !showTierAssistView
      && !showFishView
    )),
  );
  const editTargetId = showFishView && relatedFish ? String(relatedFish.id ?? '').trim() : rawId;

  return {
    rawId,
    title,
    remark,
    sideMod,
    sideLabel: showCounterTrend ? '' : sideLabel,
    showCounterTrend,
    showTierAssistView,
    showFishView,
    isAssistStrategy,
    isFishStrategy,
    isTierAssistStrategy,
    isAssistLike,
    currentModeLabel,
    currentModeTagClass: displayMode === VIEW_MODE.fish
      ? 'admin-fish-tag'
      : displayMode === VIEW_MODE.tierAssist
        ? 'admin-tier-assist-tag'
        : displayMode === VIEW_MODE.counterTrend
          ? 'admin-counter-tag'
          : displayMode === 'assist'
            ? 'admin-assist-tag'
            : 'admin-trend-tag',
    timeframe: showTimeMeta ? getTimeframeShortLabel(row?.timeframe) : '',
    grouped,
    reverseOrder,
    sideActions,
    rateHeader,
    qtyHeader: sideActions ? '操作' : '数量',
    takeProfitLabel,
    stopLabel,
    showTpSl: !showCounterTrend,
    timeRange: showTimeMeta ? formatAdminTimeRange(startAt, endAt) : '',
    timeBadge,
    timeBadgeUrgent: timeBadge?.type === 'active' && isCountdownWithinUrgentWindow(endAt),
    expiresAt: endAt ? endAt.toISOString() : '',
    selected: selectedIds.includes(rawId),
    selectionMode,
    canShowEdit,
    editTargetId,
    optionalModes: getOptionalModes(row, rows),
    chipClass: getAdminModeChipClass(displayMode),
    displayMode,
    cardClass: [
      'admin-item',
      `admin-item--${sideMod}`,
      showCounterTrend ? 'admin-item--counter-trend' : '',
      isAssistStrategy ? 'admin-item--assist' : '',
      isFishStrategy || showFishView ? 'admin-item--fish' : '',
      showTierAssistView || isTierAssistStrategy ? 'admin-item--tier-assist' : '',
    ].filter(Boolean).join(' '),
  };
}

export function collectAdminNameCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    const raw = String(row?.strategyName ?? '').trim();
    if (!raw) continue;
    const display = formatStrategyCardTitle(raw);
    const key = display.toLowerCase();
    if (!counts.has(key)) {
      counts.set(key, { name: display, count: 0, mode: getAdminDisplayViewMode(row, rows) });
    }
    counts.get(key).count += 1;
    counts.get(key).mode = getAdminDisplayViewMode(row, rows);
  }
  return Array.from(counts.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  }));
}

export { isLinkedFishRow, getAdminStrategyTypeInfo, formatStrategyCardTitle, findRelatedByType };
