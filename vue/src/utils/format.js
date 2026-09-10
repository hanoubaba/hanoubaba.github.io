export function toNumber(value) {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function clampPriceAtZero(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n < 0 ? 0 : n;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatHHMM(h, m) {
  return `${pad2(h)}:${pad2(m)}`;
}

export function formatPrice(n) {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 20,
  });
}

export function formatFixedDecimals(n, decimals) {
  if (!Number.isFinite(n)) return '';
  const d = Math.max(0, Math.min(20, Math.floor(decimals)));
  return n.toLocaleString('en-US', {
    useGrouping: false,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function formatTrimmedFixedDecimals(n, decimals) {
  const fixed = formatFixedDecimals(n, decimals);
  return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function formatQuantity(n) {
  return formatFixedDecimals(n, 1);
}

export function getDecimalPlacesFromInput(value) {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  if (!normalized) return 0;
  const dot = normalized.indexOf('.');
  if (dot === -1) return 0;
  const frac = normalized.slice(dot + 1);
  if (!/^\d*$/.test(frac)) return 0;
  return frac.length;
}

export function getPriceDecimalPlacesFromValues(...values) {
  return values.reduce((max, value) => {
    const text = String(value ?? '').trim();
    if (!text) return max;
    return Math.max(max, getDecimalPlacesFromInput(text));
  }, 0);
}

export function formatAdminPriceFromValue(value, decimalPlaces) {
  const n = toNumber(value);
  if (n == null) return String(value ?? '').trim();
  const decimals = Math.max(0, Math.min(20, Math.floor(Number(decimalPlaces) || 0)));
  return formatTrimmedFixedDecimals(n, decimals);
}

export function formatAdminDecimalFromValue(value, maxDecimals = 3) {
  const n = toNumber(value);
  if (n == null) return String(value ?? '').trim();
  return formatTrimmedFixedDecimals(n, maxDecimals);
}

export function dbNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function dbValueToString(value) {
  return value == null ? '' : String(value);
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ratesMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((rate, index) => Math.abs(Number(rate) - Number(b[index])) < 1e-9);
}
