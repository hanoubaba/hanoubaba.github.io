import { RISK } from '@/config';
import { formatCountdownTo } from '@/utils/time.js';
import { parseDateValue } from '@/utils/time.js';
import { LABELS, OUTCOME_STATUS } from '@/config';

export function getStrategyEndAt(row) {
  return parseDateValue(row?.expiresAt);
}

export function getStrategyStartAt(row) {
  return parseDateValue(row?.startAt);
}

export function getTimeRangeStatusByEndAt(endAt) {
  if (!endAt) return 'active';
  return Date.now() >= endAt.getTime() ? 'ended' : 'active';
}

export function isCountdownWithinUrgentWindow(endAt, now = new Date()) {
  if (!endAt) return false;
  const diffMs = endAt.getTime() - now.getTime();
  return Number.isFinite(diffMs) && diffMs > 0 && diffMs <= RISK.countdownUrgentHours * 60 * 60 * 1000;
}

export function getTimeBadgeInfo(endAt, now = new Date()) {
  if (!endAt) return null;
  if (getTimeRangeStatusByEndAt(endAt) === 'ended') return null;
  return {
    label: formatCountdownTo(endAt, now),
    type: 'active',
    timeStatus: 'active',
  };
}

export function getOutcomeStatusInfo(outcomeStatus) {
  const normalized = OUTCOME_STATUS[outcomeStatus] ? outcomeStatus : (
    ['profit', 'loss', 'not_filled', 'pending'].includes(outcomeStatus) ? outcomeStatus : OUTCOME_STATUS.pending
  );
  return LABELS.outcomes[normalized] || LABELS.outcomes[OUTCOME_STATUS.pending];
}
