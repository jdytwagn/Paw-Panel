(() => {
  const api = window.notchAPI;
  if (!['darwin', 'win32'].includes(api?.platform)) return;

  const app = document.getElementById('app');
  const sprite = document.getElementById('desktop-pet-sprite');
  const collapseButton = document.getElementById('collapse-btn');
  const card = document.getElementById('settings-pet-card');
  const entryGroup = document.getElementById('settings-pet-entry');
  const entryChoices = [...entryGroup.querySelectorAll('[data-entry]')];
  const choices = [...card.querySelectorAll('[data-pet]')];
  const customChoice = card.querySelector('[data-pet="custom"]');
  const importButton = document.getElementById('settings-pet-import');
  const status = document.getElementById('settings-pet-status');
  const defaultImage = choices[0].querySelector('img').src;
  let entry = api.desktopPetEntry || api.platform === 'win32' ? 'pet' : 'notch';

  function applyEntry() {
    const enabled = entry === 'pet';
    document.documentElement.classList.toggle('desktop-pet-entry', enabled);
    sprite.hidden = !enabled;
    collapseButton.hidden = !enabled;
  }

  function renderPet({ selected, customImage, entry: preferredEntry }) {
    entry = preferredEntry;
    for (const button of entryChoices) button.setAttribute('aria-pressed', String(button.dataset.entry === entry));
    if (app.classList.contains('collapsed')) applyEntry();
    const customPreview = customChoice.querySelector('img');
    customChoice.hidden = !customImage;
    if (customImage) customPreview.src = customImage;
    const activeChoice = choices.find((button) => !button.hidden && button.dataset.pet === selected) || choices[0];
    for (const button of choices) button.setAttribute('aria-pressed', String(button === activeChoice));
    sprite.src = activeChoice.querySelector('img').src || defaultImage;
  }

  async function updatePet(request, successMessage) {
    const controls = [...entryChoices, ...choices, importButton];
    for (const button of controls) button.disabled = true;
    try {
      const result = await request();
      if (result.canceled) return;
      if (result.pet) renderPet(result.pet);
      status.textContent = result.error || successMessage;
      status.classList.toggle('error', Boolean(result.error));
    } catch {
      status.textContent = '无法更新桌宠，请重试。';
      status.classList.add('error');
    } finally {
      for (const button of controls) button.disabled = false;
    }
  }

  sprite.src = defaultImage;
  applyEntry();
  entryGroup.hidden = api.platform !== 'darwin';
  document.addEventListener('notch:modechange', (event) => {
    if (!event.detail.expanded) applyEntry();
  });
  api.getDesktopPet().then((pet) => {
    if (pet) renderPet(pet);
  }).catch(() => {}).finally(() => { card.hidden = false; });
  for (const button of entryChoices) {
    button.addEventListener('click', () => updatePet(() => api.setDesktopEntry(button.dataset.entry), '已保存，收起面板后切换入口。'));
  }
  for (const button of choices) {
    button.addEventListener('click', () => updatePet(() => api.selectDesktopPet(button.dataset.pet), '已保存桌宠形象。'));
  }
  importButton.addEventListener('click', () => updatePet(api.importDesktopPet, '已导入并选中自定义桌宠。'));
})();
