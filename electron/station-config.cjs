const fs = require('node:fs');
function saveStationConfig(file, config, encryption) {
  if (!encryption.isEncryptionAvailable()) throw new Error('Secure station storage is unavailable. Ask IT to configure this terminal.');
  if (!config || typeof config.station_id !== 'string' || typeof config.station_key !== 'string' || !config.station_id.trim() || !config.station_key.trim())
    throw new Error('Station ID and key are required');
  const encrypted = encryption.encryptString(JSON.stringify(config));
  fs.writeFileSync(file + '.tmp', encrypted);
  fs.renameSync(file + '.tmp', file);
}
function loadStationConfig(file, encryption) {
  if (!fs.existsSync(file)) return null;
  if (!encryption.isEncryptionAvailable()) throw new Error('Secure station storage is unavailable. Ask IT to restore it.');
  return JSON.parse(encryption.decryptString(fs.readFileSync(file)));
}
module.exports = { saveStationConfig, loadStationConfig };
