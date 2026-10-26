const criticalAlarmScreen = workspace => workspace === 'lab_tech' ? 'critical_results_bench' : workspace === 'lab_verifier' ? 'critical_results_verifier' : ['doctor','anaesthesia'].includes(workspace) ? 'critical_results_doctor' : undefined;
// Only a current, exact open laboratory record may trigger the bench alarm.
function criticalAlarmRecord(record, id, sources = ['Lab']) {
  if (!Number.isSafeInteger(id) || id <= 0 || record?.critical_result_id !== id || !sources.includes(record.source)) throw new Error('Critical alarm identity mismatch');
  return record.status === 'Open';
}
module.exports = {criticalAlarmRecord,criticalAlarmScreen};
