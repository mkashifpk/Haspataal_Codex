// Renderer-supplied headers may authenticate a station, never override the
// native session, terminal identity, DEV attribution or human review headers.
function stationHeaders(path, input = {}) {
  const result = {};
  for (const [name, value] of Object.entries(input || {})) {
    if (name.toLowerCase() !== 'x-station-key' || !/^\/badge-stations\/(me|scans)(?:\?|$)/.test(path))
      throw new Error('Renderer header is not permitted for this endpoint');
    if (typeof value !== 'string' || !value || value.length > 4096 || /[\r\n]/.test(value))
      throw new Error('Invalid station credential header');
    result['X-Station-Key'] = value;
  }
  return result;
}

function isStationNetworkFailure(error) {
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'].includes(error?.code)
    || error?.message === 'Server connection timed out';
}
module.exports = { stationHeaders, isStationNetworkFailure };
