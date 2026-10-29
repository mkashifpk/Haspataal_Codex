import type { AdmissionDetailOut } from './generated/doctor_inpatients';
export type InpatientAction = 'details' | 'discharge';
export function inpatientActionAllowed(action: InpatientAction, row: AdmissionDetailOut, view: string | undefined, permissions: string[]) {
  if (!['full','open_work'].includes(view || '')) return false;
  return action === 'details'
    ? row.admission_reason === null && !['Cancelled','Discharged'].includes(row.status) && ['ipd.admission.request','ipd.discharge.initiate'].some(p=>permissions.includes(p))
    : row.status === 'Admitted' && permissions.includes('ipd.discharge.initiate');
}
export const inpatientSnapshot = (r: AdmissionDetailOut) => JSON.stringify([r.admission_id,r.patient_id,r.row_version,r.status,r.admission_reason,r.provisional_diagnosis,r.bed_id,r.discharge.started,r.discharge.blocked_on]);
export function inpatientEventMatches(selected: {admission_id:number;patient_id:number}|undefined, payload: {admission_id?:unknown;patient_id?:unknown}) {
  if (!selected) return false;
  if (typeof payload.admission_id === 'number') return payload.admission_id === selected.admission_id;
  if (typeof payload.patient_id === 'number') return payload.patient_id === selected.patient_id;
  return true; // An event without a record reference requests a conservative resync.
}
