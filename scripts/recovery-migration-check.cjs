// Real Electron storage upgrade test; no backend traffic or business writes.
const { app, protocol, net, WebContentsView } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { assetUrl } = require('../electron/local-assets.cjs');
const { migrateRecovery } = require('../electron/recovery-migration.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'app', privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.setPath('userData', fs.mkdtempSync(path.resolve('artifacts/migration-profile-')));
app.whenReady().then(async () => {
  const views = [];
  let code = 0;
  try {
    protocol.handle('app', request => net.fetch(assetUrl(request.url, path.resolve('dist'))));
    const legacyUrl = pathToFileURL(path.resolve('dist/index.html')).href;
    const targetUrl = 'app://terminal/storage-migration.html';
    const open = async url => {
      const view = new WebContentsView({webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
      views.push(view);
      await view.webContents.loadURL(url);
      return view.webContents;
    };
    const old = await open(legacyUrl), current = await open(targetUrl);
    const run = () => migrateRecovery({WebContentsView, legacyUrl, targetUrl});
    const key = 'haspataal.facility-apply:DEMO-MIGRATION:original-key';
    await old.executeJavaScript(`localStorage.setItem(${JSON.stringify(key)}, 'original immutable recovery record'); localStorage.setItem('unrelated', 'leave here')`);
    await run();
    assert.equal(await current.executeJavaScript(`localStorage.getItem(${JSON.stringify(key)})`), 'original immutable recovery record');
    assert.equal(await old.executeJavaScript(`localStorage.getItem(${JSON.stringify(key)})`), null);
    assert.equal(await current.executeJavaScript(`localStorage.getItem('unrelated')`), null);
    // Simulate a crash after copy but before removal.
    await old.executeJavaScript(`localStorage.setItem(${JSON.stringify(key)}, 'original immutable recovery record')`);
    await run();
    assert.equal(await old.executeJavaScript(`localStorage.getItem(${JSON.stringify(key)})`), null);
    await old.executeJavaScript(`localStorage.setItem(${JSON.stringify(key)}, 'conflicting original')`);
    await assert.rejects(run());
    assert.equal(await old.executeJavaScript(`localStorage.getItem(${JSON.stringify(key)})`), 'conflicting original');
    assert.equal(await current.executeJavaScript(`localStorage.getItem(${JSON.stringify(key)})`), 'original immutable recovery record');
    const result = {passed:true, checks:['old-origin recovery hold copied and removed only after success','unrelated storage excluded','crash-after-copy retry is safe','conflict preserves both records and refuses migration']};
    fs.writeFileSync('artifacts/recovery-migration-check.json', JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } catch (error) { code = 1; console.error(error); }
  finally { for (const view of views) view.webContents.close(); app.exit(code); }
});
