// Move only durable Facility recovery holds when upgrading the bundled origin.
// Isolated views have no preload/Node/IPC access and are never application windows.
async function migrateRecovery({ WebContentsView, legacyUrl, targetUrl }) {
  const views = [];
  const open = async (url) => {
    const view = new WebContentsView({ webPreferences: {
      sandbox: true, contextIsolation: true, nodeIntegration: false,
    }});
    views.push(view);
    await view.webContents.loadURL(url);
    return view.webContents;
  };
  try {
    const legacy = await open(legacyUrl);
    const entries = await legacy.executeJavaScript(`Object.entries(localStorage).filter(([key]) => key.startsWith('haspataal.facility-apply:'))`);
    if (!entries.length) return;
    const target = await open(targetUrl);
    await target.executeJavaScript(`(() => {
      const entries = ${JSON.stringify(entries)};
      for (const [key, value] of entries) {
        const existing = localStorage.getItem(key);
        if (existing !== null && existing !== value) throw new Error('Conflicting Facility recovery holds');
      }
      for (const [key, value] of entries) localStorage.setItem(key, value);
    })()`);
    // A crash before deletion is safe: an identical copy can be migrated again.
    await legacy.executeJavaScript(`(() => {
      for (const [key, value] of ${JSON.stringify(entries)}) {
        if (localStorage.getItem(key) === value) localStorage.removeItem(key);
      }
    })()`);
  } finally {
    for (const view of views) view.webContents.close();
  }
}
module.exports = { migrateRecovery };
