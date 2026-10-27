// Published payloads are refresh hints at Reception, including high/critical priority.
// All displayed clinical values must come from ordinary authorized reads.
export function walkinPublicationMatches(shown: {patientId:number;reqId:number}, payload: {patient_id?:unknown;requisition_id?:unknown}): boolean {
  return (shown.reqId > 0 && shown.reqId === payload.requisition_id) ||
    (shown.patientId > 0 && shown.patientId === payload.patient_id);
}
