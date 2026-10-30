// Read-only recovery: every print gets the authenticated server's recorded label.
async function readPreparedDoseLabel(api, marId, workspace) {
  if (!Number.isSafeInteger(marId) || marId <= 0) throw Error('Select a recorded preparation');
  const reply = await api('GET', `/mar/${marId}/dose-label`, undefined, workspace);
  if (!reply.ok) return reply;
  const payload = reply.data;
  if (payload?.document_type !== 'dose_label' || payload.printer_role !== 'label' || payload.fields?.mar_id !== marId || payload.fields?.reprint !== true || typeof payload.text !== 'string') throw Error('Unexpected dose-label response');
  return reply;
}
module.exports = {readPreparedDoseLabel};
