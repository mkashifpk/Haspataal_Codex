import React from "react";
import { PatientProgrammes, type PatientProgrammesProps } from "./PatientProgrammes";

export function PatientProgrammesTriage(props: Omit<PatientProgrammesProps, "screenId">) {
  return <PatientProgrammes {...props} screenId="patient_programmes_triage" />;
}
