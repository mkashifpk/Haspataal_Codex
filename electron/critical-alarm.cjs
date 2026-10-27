const criticalAlarmScreen = workspace => workspace === 'radiology' ? 'critical_results_radiology' : workspace === 'lab_tech' ? 'critical_results_bench' : workspace === 'lab_verifier' ? 'critical_results_verifier' : ['doctor','anaesthesia'].includes(workspace) ? 'critical_results_doctor' : undefined;
const criticalAlarmSources = screen => screen === 'critical_results_doctor' ? ['Lab','Imaging'] : screen === 'critical_results_radiology' ? ['Imaging'] : ['Lab'];
// Only a current, exact open record from the workspace's source may trigger its alarm.
function criticalAlarmRecord(record, id, sources = ['Lab']) {
  if (!Number.isSafeInteger(id) || id <= 0 || record?.critical_result_id !== id || !sources.includes(record.source)) throw new Error('Critical alarm identity mismatch');
  return record.status === 'Open';
}
module.exports = {criticalAlarmRecord,criticalAlarmScreen,criticalAlarmSources};
