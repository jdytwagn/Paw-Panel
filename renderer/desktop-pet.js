(() => {
  const api = window.notchAPI;
  if (!['darwin', 'win32'].includes(api?.platform)) return;

  const app = document.getElementById('app');
  const launcher = document.getElementById('notch');
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
  let drag = null;
  let suppressClick = false;

  launcher.addEventListener('pointerdown', (event) => {
    if (entry !== 'pet' || !app.classList.contains('collapsed') || event.button !== 0 || !event.isPrimary) return;
    suppressClick = false;
    drag = { id: event.pointerId, x: event.screenX, y: event.screenY, moved: false };
    launcher.setPointerCapture(event.pointerId);
    api.dragDesktopPet('start', { x: event.clientX, y: event.clientY });
  });

  launcher.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(event.screenX - drag.x, event.screenY - drag.y) < 5) return;
      drag.moved = true;
      launcher.classList.add('pet-dragging');
    }
    api.dragDesktopPet('move');
  });

  function finishDrag(event) {
    if (drag?.id !== event.pointerId) return;
    suppressClick = drag.moved;
    drag = null;
    launcher.classList.remove('pet-dragging');
    api.dragDesktopPet('end');
  }
  launcher.addEventListener('pointerup', finishDrag);
  launcher.addEventListener('pointercancel', finishDrag);
  launcher.addEventListener('lostpointercapture', finishDrag);
  launcher.addEventListener('click', (event) => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.stopImmediatePropagation();
  }, { capture: true });

  function applyEntry() {
    const enabled = entry === 'pet';
    document.documentElement.classList.toggle('desktop-pet-entry', enabled);
    sprite.hidden = !enabled;
    collapseButton.hidden = !enabled;
    launcher.title = enabled ? '单击打开爪爪面板，按住拖动' : '打开爪爪面板';
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
