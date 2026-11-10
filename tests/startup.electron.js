const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const profile = process.env.TODO_TEST_USER_DATA;
app.commandLine.appendSwitch('user-data-dir', profile);
// The production bootstrap may inspect encrypted legacy settings on this Mac.
// Use Chromium's test keychain so a regression test never prompts for user keys.
if (process.platform === 'darwin') app.commandLine.appendSwitch('use-mock-keychain');
fs.writeFileSync(path.join(profile, 'workspace.json'), JSON.stringify({version:1, localStorage:{
  'notch-home-note':'Recovered workspace note',
  'notch-recordings':JSON.stringify([{id:'startup-recording',createdAt:1788709776699,durationMs:1558,transcript:'',audioPath:'recordings/retained.webm',mimeType:'audio/webm',title:'Saved recording',category:'未分类'}]),
}}));
const errors = [];
setTimeout(() => { console.error('Production startup timed out', errors); app.exit(1); }, 25000);
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (details) => {
    if (details.level === 'error') errors.push(`${details.message} (${details.sourceId}:${details.lineNumber})`);
  });
  contents.once('did-finish-load', () => {
    if (!contents.getURL().endsWith('/renderer/index.html')) return;
    setTimeout(async () => {
      try {
        const state = await contents.executeJavaScript(`({home:!!window.NotchHome,workspace:!!window.NotchWorkspace,note:document.getElementById('home-note').value,recordings:document.querySelectorAll('.recording-item').length})`);
        assert.deepEqual(errors, []);
        assert.deepEqual(state, {home:true,workspace:true,note:'Recovered workspace note',recordings:1});
        const coverName = process.platform === 'darwin' ? 'mirror-cover-mac.jpg' : 'mirror-cover.jpg';
        const covers = await contents.executeJavaScript(`
          Array.from(document.querySelectorAll('.mirror-photo, #settings-mirror-preview'),
            (image) => image.naturalWidth > 0 && image.src.endsWith('/assets/${coverName}'))
        `);
        assert.deepEqual(covers, [true, true, true], 'Both mirror layers and the settings preview should load the illustrated cover');
        console.log('Production workspace recovery checks passed');
        app.quit();
      } catch (error) { console.error(error); app.exit(1); }
    }, 2000);
  });
});
require('../main.js');
