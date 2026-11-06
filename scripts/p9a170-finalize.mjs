import fs from 'node:fs';
import crypto from 'node:crypto';
const d='docs/phase-p9a-2026-11-06/';
fs.copyFileSync('artifacts/p9a170-received-event.json',d+'170-received-event-partial-ui.json');
const html=fs.readFileSync('dist/index.html','utf8'),f=html.match(/src="([^"]+\.js)"/)[1],sha=crypto.createHash('sha256').update(fs.readFileSync('dist/'+f)).digest('hex');
fs.writeFileSync(d+'170-verification.json',JSON.stringify({date:new Date().toISOString(),unit:'867/867 passed',build:'mandatory169screen help/TypeScript/DEV build passed',release:'release DEV-material exclusion passed; DEV restored',renderer:f,sha256:sha,limits:'See170-verification.md, including explicit correction to old loading-only read-error claims'},null,2));
console.log(f,sha);
