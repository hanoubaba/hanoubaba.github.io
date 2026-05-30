(function () {
  function resolvePageSwitchUrl(targetDir) {
    if (!targetDir) return '#';
    var path = location.protocol === 'file:'
      ? '../' + targetDir + '/index.html'
      : '../' + targetDir + '/';
    try {
      return new URL(path, location.href).href;
    } catch (_err) {
      return '../' + targetDir + '/index.html';
    }
  }

  document.querySelectorAll('.page-switch[data-switch-target]').forEach(function (link) {
    var target = link.getAttribute('data-switch-target');
    if (target) link.href = resolvePageSwitchUrl(target);
  });
})();
