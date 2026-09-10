import { ADMIN_FILTER, ENDPOINTS, SUPABASE } from '@/config';
import { getLocalDayRange } from '@/utils/time.js';
import { supabaseFetch, getSupabaseHeaders } from './client.js';
import { fromDbRecord, fromStatsRecord, toDbRecord } from '@/domain/mapping.js';
import { normalizeStrategyViewMode, normalizeViewState } from '@/domain/types.js';

function normalizeAdminTimeFilter(value) {
  return Object.prototype.hasOwnProperty.call(ADMIN_FILTER.labels, value) ? value : ADMIN_FILTER.default;
}

export function buildStrategiesQuery(filterValue = 'all', nameSearch = '') {
  const filter = normalizeAdminTimeFilter(filterValue);
  const params = ['select=*', 'order=created_at.desc'];
  const search = String(nameSearch ?? '').trim().replace(/\s+/g, ' ');
  if (search) params.push(`strategy_name=ilike.${encodeURIComponent(`*${search}*`)}`);
  if (filter === 'active') {
    params.push(`or=(expires_at.gt.${encodeURIComponent(new Date().toISOString())},expires_at.is.null)`);
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

export async function fetchStrategies(filterValue = 'all', nameSearch = '') {
  const res = await supabaseFetch(`${ENDPOINTS.strategies}?${buildStrategiesQuery(filterValue, nameSearch)}`, {
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map(fromDbRecord) : [];
}

export async function createStrategy(record) {
  const payload = toDbRecord(record);
  const res = await supabaseFetch(ENDPOINTS.strategies, {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
}

export async function updateStrategy(id, record) {
  const normalizedId = String(id ?? '').trim();
  if (!normalizedId) throw new Error('缺少策略 ID');
  const payload = toDbRecord(record);
  const res = await supabaseFetch(`${ENDPOINTS.strategies}?id=eq.${encodeURIComponent(normalizedId)}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
}

export async function deleteStrategies(ids) {
  const normalizedIds = Array.from(new Set((Array.isArray(ids) ? ids : [ids]).map((id) => String(id ?? '').trim()).filter(Boolean)));
  if (!normalizedIds.length) return;
  const idFilter = encodeURIComponent(`(${normalizedIds.join(',')})`);
  const res = await supabaseFetch(`${ENDPOINTS.strategies}?id=in.${idFilter}`, {
    method: 'DELETE',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function updateStrategyOutcomeStatus(id, outcomeStatus, remark) {
  const res = await supabaseFetch(`${ENDPOINTS.strategies}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      outcome_status: outcomeStatus,
      outcome_remark: String(remark ?? '').trim(),
    }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function updateStrategyView(id, { viewMode, viewState } = {}) {
  const payload = { view_mode: normalizeStrategyViewMode(viewMode) };
  if (viewState !== undefined) payload.view_state = normalizeViewState(viewState);
  const res = await supabaseFetch(`${ENDPOINTS.strategies}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
}

function buildStrategyStatsPayload(filterValue = 'all', nameSearch = '', options = {}) {
  const { ignoreAdminFilters = false } = options;
  const timeFilter = normalizeAdminTimeFilter(filterValue);
  const payload = {
    p_name_search: ignoreAdminFilters ? null : (String(nameSearch ?? '').trim() || null),
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

export async function fetchStrategyStats(filterValue = 'all', nameSearch = '', options = {}) {
  const res = await supabaseFetch(ENDPOINTS.strategyStats, {
    method: 'POST',
    headers: getSupabaseHeaders(),
    body: JSON.stringify(buildStrategyStatsPayload(filterValue, nameSearch, options)),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  return fromStatsRecord(row || {});
}

export async function fetchRecent10Stats() {
  const res = await supabaseFetch(ENDPOINTS.recent10Stats, {
    method: 'POST',
    headers: getSupabaseHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  const n = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  return {
    totalCount: n(row?.total_count),
    profitCount: n(row?.profit_count),
    lossCount: n(row?.loss_count),
    notFilledCount: n(row?.not_filled_count),
    pendingCount: n(row?.pending_count),
    openedCount: n(row?.opened_count),
    winRate: n(row?.win_rate),
    openRate: n(row?.open_rate),
  };
}

export async function fetchAppSettings() {
  const res = await supabaseFetch(`${ENDPOINTS.settings}?id=eq.${encodeURIComponent(SUPABASE.settingsId)}&select=unit_cost`);
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  return row?.unit_cost;
}

export async function saveAppSettings(unitCost) {
  const res = await supabaseFetch(`${ENDPOINTS.settings}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: SUPABASE.settingsId,
      unit_cost: unitCost,
    }),
  });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return unitCost;
}
