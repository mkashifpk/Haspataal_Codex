// Only a current, exact open laboratory record may trigger the bench alarm.
function criticalAlarmRecord(record, id) {
  if (!Number.isSafeInteger(id) || id <= 0 || record?.critical_result_id !== id || record.source !== 'Lab') throw new Error('Critical alarm identity mismatch');
  return record.status === 'Open';
}
module.exports = {criticalAlarmRecord};
