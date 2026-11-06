// Deliberately accepts only the two fixed report operations and exactly their documented filters.
exports.isComplaintReportPath = value => typeof value === 'string' && (value === '/complaints/policy/pdf' || /^\/complaints\/register\/pdf\?date_from=\d{4}-\d{2}-\d{2}&date_to=\d{4}-\d{2}-\d{2}$/.test(value));
