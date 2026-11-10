const periodDocuments = new Set([
  '/blood/statistics/pdf', '/blood/registers/transfusions/pdf',
  '/blood/registers/reactions/pdf', '/blood/storage-checks/pdf',
  '/blood-center/registers/pdf', '/maternity/assessments/register/pdf',
  '/maternity/labour-register/pdf',
]);

exports.isQualityRegisterPdfPath = value => {
  if (typeof value !== 'string' || value !== value.trim()) return false;
  if (value === '/consent-policy/pdf') return true;
  if (value === '/mlc/contacts/pdf') return true;
  if (/^\/quality\/record-reviews\/[1-9]\d*\/report\/pdf$/.test(value)) return true;
  if (/^\/deaths\/[1-9]\d*\/pdf\?document=(?:certificate|autopsy_order)$/.test(value)) return true;
  if (/^\/(?:incidents\/[1-9]\d*\/adr-report|blood\/reactions\/[1-9]\d*)\/pdf$/.test(value)) return true;
  const match = /^(\/[^?]+)\?date_from=\d{4}-\d{2}-\d{2}&date_to=\d{4}-\d{2}-\d{2}$/.exec(value);
  return !!match && periodDocuments.has(match[1]);
};
