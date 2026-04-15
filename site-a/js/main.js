const btn = document.getElementById('btn-a');
const msg = document.getElementById('msg-a');

if (btn && msg) {
  btn.addEventListener('click', () => {
    msg.textContent = `Site A 运行正常，时间：${new Date().toLocaleString()}`;
  });
}
