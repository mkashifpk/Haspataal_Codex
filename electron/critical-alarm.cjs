const criticalAlarmScreen = workspace => workspace === 'lab_tech' ? 'critical_results_bench' : workspace === 'lab_verifier' ? 'critical_results_verifier' : undefined;
// Only a current, exact open laboratory record may trigger the bench alarm.
function criticalAlarmRecord(record, id) {
  if (!Number.isSafeInteger(id) || id <= 0 || record?.critical_result_id !== id || record.source !== 'Lab') throw new Error('Critical alarm identity mismatch');
  return record.status === 'Open';
}
module.exports = {criticalAlarmRecord,criticalAlarmScreen};
