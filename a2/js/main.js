const btn = document.getElementById('btn-b');
const msg = document.getElementById('msg-b');

if (btn && msg) {
  btn.addEventListener('click', () => {
    msg.textContent = `Site B 可用，时间：${new Date().toLocaleString()}`;
  });
}
