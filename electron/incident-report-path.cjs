// Only the fixed incident register PDF and its two required date filters.
exports.isIncidentReportPath=value=>typeof value==='string'&&value===value.trim()&&/^\/incidents\/register\/pdf\?date_from=\d{4}-\d{2}-\d{2}&date_to=\d{4}-\d{2}-\d{2}$/.test(value);
