import { ENDPOINTS } from '@/config';
import { getLocalDayRange } from '@/utils/time.js';
import { supabaseFetch, getSupabaseHeaders } from './client.js';

function hasObservationItemContent(item = {}) {
  return Boolean(String(item?.name ?? '').trim() || String(item?.description ?? '').trim());
}

export function normalizeObservationItems(items) {
  const source = Array.isArray(items) ? items : [];
  return source
    .map((item) => ({
      name: String(item?.name ?? '').trim(),
      time: String(item?.time ?? '').trim(),
      timeLabel: String(item?.timeLabel ?? '').trim(),
      price: String(item?.price ?? '').trim(),
      stopLoss: String(item?.stopLoss ?? item?.stop ?? '').trim(),
      description: String(item?.description ?? item?.desc ?? item?.note ?? '').trim(),
      heat: String(item?.heat ?? '').trim(),
      change: String(item?.change ?? '').trim(),
      pattern: String(item?.pattern ?? '').trim(),
    }))
    .filter((item) => hasObservationItemContent(item));
}

function parseLegacyObservationContent(content) {
  const lines = String(content ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const [first, ...rest] = lines;
  const colonIndex = first.indexOf(':');
  if (colonIndex > 0 && !rest.length) {
    return [{ name: first.slice(0, colonIndex).trim(), description: first.slice(colonIndex + 1).trim() }];
  }
  return [{ name: first, description: rest.join('\n') }];
}

export function fromObservationRecord(row) {
  let items = Array.isArray(row?.items) ? normalizeObservationItems(row.items) : [];
  if (!items.length && typeof row?.content === 'string' && row.content.trim()) {
    items = normalizeObservationItems(parseLegacyObservationContent(row.content));
  }
  return {
    id: String(row?.id ?? '').trim(),
    createdAt: row?.created_at ?? row?.createdAt ?? null,
    items,
  };
}

export async function fetchObservationRecords(filterValue = 'createdToday') {
  const params = ['select=*', 'order=created_at.desc'];
  if (filterValue === 'createdToday') {
    const { start, end } = getLocalDayRange();
    params.push(`created_at=gte.${encodeURIComponent(start.toISOString())}`);
    params.push(`created_at=lt.${encodeURIComponent(end.toISOString())}`);
  }
  const res = await supabaseFetch(`${ENDPOINTS.observations}?${params.join('&')}`, {
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map(fromObservationRecord) : [];
}

export async function createObservationRecord(items) {
  const payload = { items: normalizeObservationItems(items) };
  const res = await supabaseFetch(ENDPOINTS.observations, {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    const retryRes = await supabaseFetch(ENDPOINTS.observations, {
      method: 'POST',
      headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        content: payload.items.map((item) => [item.name, item.description].filter(Boolean).join('：')).join('\n'),
        items: payload.items,
      }),
    });
    if (!retryRes.ok) throw new Error(text || await retryRes.text());
  }
}

export async function deleteObservationRecords(ids) {
  const normalizedIds = Array.from(new Set((Array.isArray(ids) ? ids : [ids]).map((id) => String(id ?? '').trim()).filter(Boolean)));
  if (!normalizedIds.length) return;
  const idFilter = encodeURIComponent(`(${normalizedIds.join(',')})`);
  const res = await supabaseFetch(`${ENDPOINTS.observations}?id=in.${idFilter}`, {
    method: 'DELETE',
    headers: getSupabaseHeaders({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) throw new Error(await res.text());
}
