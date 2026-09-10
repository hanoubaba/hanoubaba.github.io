import { TIME } from '@/config';
import { formatHHMM, pad2 } from './format.js';

export function minutesFromValue(val) {
  if (!val || !/^\d{1,2}:\d{2}$/.test(val)) return null;
  const [h, m] = val.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function formatDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatStartSlotValue(d) {
  return `${formatDateKey(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function parseStartSlotValue(value) {
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

export function parseDateValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function formatSlotLabel(at, now = new Date()) {
  const time = formatHHMM(at.getHours(), at.getMinutes());
  if (isSameDate(at, now)) return time;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  if (isSameDate(at, yesterday)) return `昨天 ${time}`;
  return `${at.getMonth() + 1}/${at.getDate()} ${time}`;
}

export function formatSlotLabelForMode(at, now, mode) {
  if (normalizeTimeframeMode(mode) === '1d') {
    if (isSameDate(at, now)) return '今天';
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    if (isSameDate(at, yesterday)) return '昨天';
    return `${at.getMonth() + 1}/${at.getDate()}`;
  }
  return formatSlotLabel(at, now);
}

export function floorDateToStep(d, stepMinutes) {
  const mins = d.getHours() * 60 + d.getMinutes();
  const slotMins = Math.floor(mins / stepMinutes) * stepMinutes;
  const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  slot.setMinutes(slotMins);
  return slot;
}

export function normalizeTimeframeMode(mode) {
  const value = String(mode ?? '').trim();
  return TIME.minutes[value] ? value : TIME.default;
}

export function normalizeFrontTrendTimeframe(mode) {
  const value = String(mode ?? '').trim();
  return TIME.frontTrend.includes(value) ? value : TIME.default;
}

export function getTimeframeMinutes(mode = TIME.default) {
  return TIME.minutes[normalizeTimeframeMode(mode)] ?? TIME.minutes[TIME.default];
}

export function getTimeframeLabel(mode) {
  const value = String(mode ?? '').trim();
  return TIME.labels[value] || value;
}

export function getTimeframeShortLabel(mode) {
  const value = String(mode ?? '').trim();
  return TIME.minutes[value] ? value : '';
}

export function getTimeSlotsByMode(mode) {
  const slots = [];
  const normalizedMode = normalizeTimeframeMode(mode);
  const stepMinutes = getTimeframeMinutes(normalizedMode);
  const now = new Date();
  const currentSlot = floorDateToStep(now, stepMinutes);
  for (let i = TIME.startSlotCount - 1; i >= 0; i -= 1) {
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

export function resolveStartTimeSelection(mode, prevValue) {
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

export function getStartDateTime(startValue, timeframeMode = TIME.default) {
  const parsed = parseStartSlotValue(startValue);
  if (parsed) return parsed;

  const startMins = minutesFromValue(startValue);
  if (startMins == null) return null;

  const slots = getTimeSlotsByMode(timeframeMode);
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

export function addPeriodToStart(startValue, periodMinutes, timeframeMode = TIME.default) {
  const startAt = getStartDateTime(startValue, timeframeMode);
  if (!startAt) return null;
  return new Date(startAt.getTime() + periodMinutes * 60 * 1000);
}

export function getLocalDayRange(base = new Date()) {
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function formatCompactDateTimeLabel(d, base = new Date()) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const date = d.getFullYear() === base.getFullYear()
    ? `${d.getMonth() + 1}月${d.getDate()}日`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatAdminTimeRange(startAt, endAt) {
  const start = startAt ? formatCompactDateTimeLabel(startAt) : '—';
  const end = endAt ? formatCompactDateTimeLabel(endAt) : '—';
  return `${start} — ${end}`;
}

export function formatCountdownTo(endAt, now = new Date()) {
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

export function isMobileTimePickerEnabled() {
  return window.matchMedia('(max-width: 820px) and (pointer: coarse)').matches;
}
