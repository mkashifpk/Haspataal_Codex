function assertLabLabel(payload, sampleId) {
  if (
    !Number.isSafeInteger(sampleId) ||
    sampleId <= 0 ||
    payload?.document_type !== "lab_label" ||
    payload.printer_role !== "label" ||
    payload.fields?.sample_id !== sampleId ||
    typeof payload.fields.barcode !== "string" ||
    !payload.fields.barcode ||
    typeof payload.text !== "string"
  )
    throw Error("The lab label does not match this sample.");
}
module.exports = { assertLabLabel };
