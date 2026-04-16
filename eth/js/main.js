function toNumber(value) {
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatPrice(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function calc(side) {
  const input = document.getElementById('current-price');
  const errorEl = document.getElementById('error');

  const price = toNumber(input && 'value' in input ? input.value : '');
  if (errorEl) errorEl.textContent = '';

  if (price === null) {
    if (errorEl) errorEl.textContent = '请输入有效的当前价格（数字）。';
    setText('open-price', '—');
    setText('tp-price', '—');
    setText('sl-price', '—');
    return;
  }

  let open = price;
  let tp = price;
  let sl = price;

  if (side === 'long') {
    open = price + 5;
    tp = price + 50;
    sl = price - 50;
  } else if (side === 'short') {
    open = price - 5;
    tp = price - 50;
    sl = price + 50;
  }

  setText('open-price', formatPrice(open));
  setText('tp-price', formatPrice(tp));
  setText('sl-price', formatPrice(sl));
}

const btnLong = document.getElementById('btn-long');
const btnShort = document.getElementById('btn-short');
const input = document.getElementById('current-price');

if (btnLong) btnLong.addEventListener('click', () => calc('long'));
if (btnShort) btnShort.addEventListener('click', () => calc('short'));
if (input) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') calc('long');
  });
}
