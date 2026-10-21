import { expect } from 'playwright/test';
// Electron also exposes the isolated upgrade-migration views to CDP. Wait for
// the real terminal document, rather than choosing the first temporary page.
export async function terminalPage(app) {
  let page;
  await expect.poll(() => {
    page = app.windows().find(p => !p.isClosed() && p.url().split('#')[0] === 'app://terminal/index.html');
    return !!page;
  }, {timeout: 60000}).toBe(true);
  return page;
}
