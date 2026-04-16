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

function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

function flashCopyButton(btn, label, duration = 1100) {
  if (!btn) return;
  if (!btn.dataset.defaultCopyLabel) btn.dataset.defaultCopyLabel = btn.textContent;
  if (btn._copyFlashTimer) clearTimeout(btn._copyFlashTimer);
  btn.textContent = label;
  btn._copyFlashTimer = setTimeout(() => {
    btn.textContent = btn.dataset.defaultCopyLabel || '复制';
    btn._copyFlashTimer = null;
  }, duration);
}

async function copyFromTarget(targetId, btn) {
  const valueEl = document.getElementById(targetId);
  const raw = (valueEl?.textContent ?? '').trim();
  if (!raw || raw === '—') {
    flashCopyButton(btn, '无内容');
    return;
  }
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(raw);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) ok = copyFallback(raw);
  flashCopyButton(btn, ok ? '已复制' : '失败');
}

function setDirectionHint(side) {
  const el = document.getElementById('direction-hint');
  if (!el) return;
  el.classList.remove('direction-hint--long', 'direction-hint--short');
  if (side === 'long') {
    el.classList.add('direction-hint--long');
    el.textContent = '本次以做多计算';
  } else if (side === 'short') {
    el.classList.add('direction-hint--short');
    el.textContent = '本次以做空计算';
  } else {
    el.textContent = '';
  }
}

function setActiveSide(side, btnLong, btnShort) {
  if (btnLong) btnLong.classList.toggle('is-active', side === 'long');
  if (btnShort) btnShort.classList.toggle('is-active', side === 'short');
}

function calc(side, btnLong, btnShort) {
  const input = document.getElementById('current-price');
  const errorEl = document.getElementById('error');

  const price = toNumber(input && 'value' in input ? input.value : '');
  if (errorEl) errorEl.textContent = '';

  if (price === null) {
    if (errorEl) errorEl.textContent = '请输入有效的当前价格（数字）。';
    setText('open-price', '—');
    setText('tp-price', '—');
    setText('sl-price', '—');
    setDirectionHint(null);
    setActiveSide(null, btnLong, btnShort);
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
  setDirectionHint(side);
  setActiveSide(side, btnLong, btnShort);
}

const btnLong = document.getElementById('btn-long');
const btnShort = document.getElementById('btn-short');
const input = document.getElementById('current-price');

if (btnLong) btnLong.addEventListener('click', () => calc('long', btnLong, btnShort));
if (btnShort) btnShort.addEventListener('click', () => calc('short', btnLong, btnShort));
if (input) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') calc('long', btnLong, btnShort);
  });
}

document.querySelectorAll('.btn-copy').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-copy-for');
    if (id) copyFromTarget(id, btn);
  });
});
