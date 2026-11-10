(() => {
  const api = window.notchAPI;
  if (api?.platform !== 'win32') return;

  document.documentElement.classList.add('windows-desktop-pet');
  const sprite = document.getElementById('desktop-pet-sprite');
  const card = document.getElementById('settings-pet-card');
  const choices = [...card.querySelectorAll('[data-pet]')];
  const customChoice = card.querySelector('[data-pet="custom"]');
  const importButton = document.getElementById('settings-pet-import');
  const status = document.getElementById('settings-pet-status');
  const defaultImage = choices[0].querySelector('img').src;

  function renderPet({ selected, customImage } = {}) {
    const customPreview = customChoice.querySelector('img');
    customChoice.hidden = !customImage;
    if (customImage) customPreview.src = customImage;
    const activeChoice = choices.find((button) => !button.hidden && button.dataset.pet === selected) || choices[0];
    for (const button of choices) button.setAttribute('aria-pressed', String(button === activeChoice));
    sprite.src = activeChoice.querySelector('img').src || defaultImage;
  }

  async function updatePet(request) {
    for (const button of [...choices, importButton]) button.disabled = true;
    try {
      const result = await request();
      if (result.canceled) return;
      if (result.pet) renderPet(result.pet);
      status.textContent = result.error || '已保存，收起面板后即可看到。';
      status.classList.toggle('error', Boolean(result.error));
    } catch {
      status.textContent = '无法更新桌宠，请重试。';
      status.classList.add('error');
    } finally {
      for (const button of [...choices, importButton]) button.disabled = false;
    }
  }

  sprite.src = defaultImage;
  sprite.hidden = false;
  document.getElementById('collapse-btn').hidden = false;
  api.getDesktopPet().then((pet) => {
    if (pet) renderPet(pet);
  }).catch(() => {}).finally(() => { card.hidden = false; });
  for (const button of choices) {
    button.addEventListener('click', () => updatePet(() => api.selectDesktopPet(button.dataset.pet)));
  }
  importButton.addEventListener('click', () => updatePet(api.importDesktopPet));
})();
