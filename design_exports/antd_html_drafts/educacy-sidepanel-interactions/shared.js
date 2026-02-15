(function () {
  const stateChips = document.querySelectorAll('.state-chip[data-switch]');
  const triggers = document.querySelectorAll('[data-switch], [data-target-scene]');
  const scenes = document.querySelectorAll('[data-scene]');

  function setScene(name) {
    if (!name) return;
    stateChips.forEach((chip) => chip.classList.toggle('active', chip.dataset.switch === name));
    scenes.forEach((scene) => scene.classList.toggle('active', scene.dataset.scene === name));
  }

  triggers.forEach((el) => {
    el.addEventListener('click', () => {
      const target = el.dataset.targetScene || el.dataset.switch;
      setScene(target);
    });
  });

  const defaultChip = document.querySelector('.state-chip[data-switch].active');
  if (defaultChip) {
    setScene(defaultChip.dataset.switch);
  } else if (scenes[0]) {
    setScene(scenes[0].dataset.scene);
  }

  const toast = document.querySelector('[data-toast]');
  document.querySelectorAll('[data-toast-message]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!toast) return;
      toast.textContent = btn.dataset.toastMessage;
      toast.classList.add('show');
      clearTimeout(window.__sideToastTimer__);
      window.__sideToastTimer__ = setTimeout(() => toast.classList.remove('show'), 1400);
    });
  });
})();
