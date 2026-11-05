import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { stationHeaders, isStationNetworkFailure } = require('../electron/station-security.cjs');
const { saveStationConfig, loadStationConfig } = require('../electron/station-config.cjs');

test('station transport rejects renderer overrides and restricts station keys to exact routes', () => {
  assert.deepEqual(stationHeaders('/badge-stations/me?station_id=UNSENT', { 'x-station-key': 'unit-unsent' }), { 'X-Station-Key': 'unit-unsent' });
  for (const name of ['Authorization', 'X-Terminal-Mac', 'X-Active-Workspace', 'Idempotency-Key'])
    assert.throws(() => stationHeaders('/badge-stations/scans', { [name]: 'unit-unsent' }), /not permitted/);
  for (const route of ['/auth/me', '/badge-stations-malicious', '/badge-stations/me/other'])
    assert.throws(() => stationHeaders(route, { 'X-Station-Key': 'unit-unsent' }), /not permitted/);
  assert.throws(() => stationHeaders('/badge-stations/scans', { 'X-Station-Key': 'bad\r\nvalue' }), /Invalid/);
});

test('station network failures are classified without disguising TLS or application errors', () => {
  assert.equal(isStationNetworkFailure({ code: 'ECONNRESET' }), true);
  assert.equal(isStationNetworkFailure(new Error('Server connection timed out')), true);
  assert.equal(isStationNetworkFailure({ code: 'CERT_HAS_EXPIRED' }), false);
  assert.equal(isStationNetworkFailure(new Error('Invalid API path')), false);
});

test('station configuration fails closed when native encryption is unavailable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haspataal-station-'));
  const file = path.join(dir, 'config.enc');
  try {
    const unavailable = { isEncryptionAvailable: () => false };
    assert.equal(loadStationConfig(file, unavailable), null);
    assert.throws(() => saveStationConfig(file, { station_id: 'UNSENT', station_key: 'unit-unsent' }, unavailable), /unavailable/);
    assert.equal(fs.existsSync(file), false);
    fs.writeFileSync(file, 'unreadable');
    assert.throws(() => loadStationConfig(file, unavailable), /unavailable/);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
