const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { app, dialog, screen } = require('electron');
const { panelBounds } = require('../platform');

app.commandLine.appendSwitch('user-data-dir', process.env.TODO_TEST_USER_DATA);
const isMac = process.platform === 'darwin';
if (isMac) app.commandLine.appendSwitch('use-mock-keychain');
const importPath = path.join(process.env.TODO_TEST_USER_DATA, 'pet.png');
let dialogResult = { canceled: true, filePaths: [] };
dialog.showOpenDialog = async () => dialogResult;

async function waitFor(predicate, description) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await predicate()) return;
    await delay(50);
  }
  assert.fail(description);
}

async function checkPet(window) {
  const evaluate = (script) => window.webContents.executeJavaScript(script);
  const sprite = 'document.getElementById("desktop-pet-sprite")';
  const isSelected = (id) => evaluate(`document.querySelector('[data-pet="${id}"]').getAttribute('aria-pressed') === 'true'`);
  const hasMode = (mode) => evaluate(`document.getElementById('app').classList.contains('${mode}')`);
  function assertBounds(expanded, petEntry = true) {
    const actual = window.getBounds();
    const expected = panelBounds(process.platform, screen.getDisplayMatching(actual), expanded, petEntry);
    // Windows can round a DIP edge when converting between physical and logical pixels.
    for (const key of Object.keys(expected)) {
      assert.ok(Math.abs(actual[key] - expected[key]) <= 1, `${key}: expected ${expected[key]}, got ${actual[key]}`);
    }
  }

  await waitFor(() => window.isVisible() && evaluate(`${sprite}.naturalWidth > 0`), 'The desktop pet should load');
  if (process.env.TODO_TEST_PHASE === 'restart') {
    await waitFor(() => isSelected('custom'), 'The custom pet selection should survive restart');
    assertBounds(false);
    assert.match(await evaluate(`${sprite}.src`), /^data:image\/png;base64,/);
    if (isMac) {
      assert.equal(await evaluate(`!${sprite}.hidden`), true);
      await evaluate('document.getElementById("notch").click()');
      await waitFor(() => hasMode('expanded'), 'The restored pet should open the panel');
      await evaluate('document.getElementById("tab-button-settings").click()');
      await evaluate('document.querySelector("[data-entry=notch]").click()');
      await waitFor(() => evaluate('document.querySelector("[data-entry=notch]").getAttribute("aria-pressed") === "true"'), 'The notch preference should be selected');
      await evaluate('document.getElementById("collapse-btn").click()');
      await waitFor(() => hasMode('collapsed'), 'Closing should restore the notch');
      assertBounds(false, false);
      assert.equal(await evaluate(`${sprite}.hidden`), true);
    }
    return;
  }

  assert.equal(await isSelected('mochi'), true);
  await waitFor(() => evaluate('!document.getElementById("settings-pet-card").hidden'), 'Pet settings should be ready');
  if (isMac) {
    assertBounds(false, false);
    assert.equal(await evaluate(`${sprite}.hidden`), true);
    await evaluate('document.getElementById("notch").click()');
    await waitFor(() => hasMode('expanded'), 'The default notch should open the panel');
    await evaluate('document.getElementById("tab-button-settings").click()');
    await evaluate('document.querySelector("[data-entry=pet]").click()');
    await waitFor(() => evaluate('document.querySelector("[data-entry=pet]").getAttribute("aria-pressed") === "true"'), 'The pet preference should be selected');
    await evaluate('document.querySelector(".topbar").click()');
    await waitFor(() => hasMode('collapsed'), 'Closing should switch to the pet');
  }
  assertBounds(false);
  window.focus();
  window.webContents.focus();
  window.webContents.sendInputEvent({ type: 'mouseDown', x: 44, y: 44, button: 'left', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: 44, y: 44, button: 'left', clickCount: 1 });
  await waitFor(() => hasMode('expanded'), 'Clicking the desktop pet should open the panel');
  assertBounds(true);
  assert.equal(await evaluate('getComputedStyle(document.getElementById("notch")).display'), 'none');
  assert.equal(await evaluate('document.getElementById("collapse-btn").checkVisibility()'), true);

  await evaluate('document.getElementById("tab-button-settings").click()');
  await evaluate('document.querySelector("[data-pet=sprout]").click()');
  await waitFor(() => isSelected('sprout'), 'A preset choice should update the desktop pet');
  assert.match(await evaluate(`${sprite}.src`), /sprout\.png$/);

  await evaluate('document.getElementById("settings-pet-import").click()');
  await waitFor(() => evaluate('!document.getElementById("settings-pet-import").disabled'), 'Canceling the picker should finish');
  assert.equal(await isSelected('sprout'), true);
  dialogResult = { canceled: false, filePaths: [importPath] };
  fs.writeFileSync(importPath, 'invalid image');
  await evaluate('document.getElementById("settings-pet-import").click()');
  await waitFor(() => evaluate('document.getElementById("settings-pet-status").classList.contains("error")'), 'Invalid images should report an error');
  assert.equal(await isSelected('sprout'), true);

  fs.copyFileSync(path.join(__dirname, '../renderer/assets/pets/puff.png'), importPath);
  await evaluate('document.getElementById("settings-pet-import").click()');
  await waitFor(() => isSelected('custom'), 'The imported pet should be selected');
  fs.unlinkSync(importPath);
  await evaluate('document.getElementById("collapse-btn").click()');
  await waitFor(() => hasMode('collapsed'), 'Closing should restore the desktop pet');
  assertBounds(false);
  assert.match(await evaluate(`${sprite}.src`), /^data:image\/png;base64,/);
}

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      await checkPet(window);
      console.log(`Desktop pet checks passed (${process.platform}, ${process.env.TODO_TEST_PHASE})`);
      app.quit();
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});
require('../main.js');
