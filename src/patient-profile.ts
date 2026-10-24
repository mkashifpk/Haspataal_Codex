type PatientIdentity = {
  patient_id: number;
  master_patient_id: number;
  merged_into_id: number | null;
  registration_type: string;
};

// GET/source retains the audited merged identity. Read the authoritative master
// separately; never render the source as the current editable patient.
export async function resolvePatientMaster<T extends PatientIdentity>(
  id: number,
  read: (id: number) => Promise<T>,
  stillCurrent: () => boolean = () => true,
): Promise<T | undefined> {
  const visited = new Set<number>();
  while (stillCurrent()) {
    if (!Number.isSafeInteger(id) || id <= 0 || visited.has(id))
      throw new Error("The merged patient record could not be resolved. Refresh or ask reception to check the master record.");
    visited.add(id);
    const patient = await read(id);
    if (!stillCurrent()) return;
    const next = patient.master_patient_id !== patient.patient_id
      ? patient.master_patient_id
      : patient.merged_into_id;
    if (next != null) {
      id = next;
      continue;
    }
    if (patient.registration_type === "Merged")
      throw new Error("The merged patient record could not be resolved. Refresh or ask reception to check the master record.");
    return patient;
  }
}
