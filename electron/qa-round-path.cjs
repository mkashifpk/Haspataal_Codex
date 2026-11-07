// Only a signed QA round's PDF, identified by a canonical positive server id.
exports.isQaRoundPdfPath=value=>typeof value==='string'&&value===value.trim()&&/^\/qa\/rounds\/[1-9]\d*\/pdf$/.test(value);
