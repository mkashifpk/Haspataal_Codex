// Fixed committee register PDF, mandatory dates and optional documented source only.
exports.isActionRegisterPdfPath=value=>typeof value==='string'&&value===value.trim()&&/^\/quality\/actions\/register\/pdf\?date_from=\d{4}-\d{2}-\d{2}&date_to=\d{4}-\d{2}-\d{2}(?:&source=(?:RecordReview|Incident|Complaint|InfectionAudit|Meeting|Drill|MockInterview|QaRound|PatientFeedback))?$/.test(value);
