import type {
  ImagingOrderDetailOut,
  ImagingStatusIn,
  LinkIn,
  ReportIn,
  CriticalFindingOut,
} from "./generated/radiology_worklist";
export const imagingModalities = [
  "XRay",
  "MRI",
  "CT",
  "Ultrasound",
  "Doppler",
  "Mammography",
  "Fluoroscopy",
  "Other",
] as const;
export type RadiologyAction =
  "Scheduled" | "InProgress" | "Completed" | "Cancelled" | "link" | "report";
export function radiologyAccess(
  view: string | undefined,
  permissions: string[],
) {
  const visible = ["full", "open_work", "records"].includes(view || "");
  return {
    visible,
    list:
      visible &&
      view !== "records" &&
      permissions.includes("imaging.order.update"),
    read: visible && permissions.includes("imaging.order.view"),
    update:
      visible &&
      view !== "records" &&
      permissions.includes("imaging.order.update"),
    report:
      visible &&
      view !== "records" &&
      permissions.includes("imaging.report.enter"),
  };
}
export function imagingActionAllowed(
  order: Pick<ImagingOrderDetailOut, "status">,
  action: RadiologyAction,
) {
  if (action === "link")
    return !["Reported", "Cancelled", "Outsourced"].includes(order.status);
  if (action === "report") return order.status === "Completed";
  return (
    (
      {
        Ordered: ["Scheduled", "InProgress", "Cancelled"],
        Scheduled: ["InProgress", "Cancelled"],
        InProgress: ["Completed"],
      } as Record<string, string[]>
    )[order.status]?.includes(action) || false
  );
}
export function imagingSnapshot(order: ImagingOrderDetailOut) {
  return JSON.stringify([
    order.imaging_order_id,
    order.row_version,
    order.patient_id,
    order.mrn,
    order.patient_name,
    order.status,
    order.accession_number,
    order.modality,
    order.body_part,
    order.laterality,
    order.clinical_indication,
    order.transport,
    order.escort,
    order.priority,
    order.pregnancy_check_needed,
    order.orthanc_study_id,
    order.study_instance_uid,
    order.reported_at,
  ]);
}
export type RadiologyDraft = {
  identity: string;
  band: string;
  asked: boolean;
  identityNote: string;
  site: boolean;
  pregnancy: string;
  pregnancyNote: string;
  reason: string;
  contrastChoice: string;
  contrast: string;
  doctorId: string;
  linkMode: string;
  orthanc: string;
  report: string;
  finding: string;
  findingNote: string;
  linkCompletionChecked: boolean;
};
export const emptyRadiologyDraft = (): RadiologyDraft => ({
  identity: "",
  band: "",
  asked: false,
  identityNote: "",
  site: false,
  pregnancy: "",
  pregnancyNote: "",
  reason: "",
  contrastChoice: "",
  contrast: "",
  doctorId: "",
  linkMode: "auto",
  orthanc: "",
  report: "",
  finding: "",
  findingNote: "",
  linkCompletionChecked: false,
});
function bounded(value: string, max: number, label: string) {
  const v = value.trim();
  if (v.length > max) throw Error(`${label}: maximum ${max} characters.`);
  return v;
}
export function radiologyBody(
  action: RadiologyAction,
  order: ImagingOrderDetailOut,
  form: RadiologyDraft,
  findings: CriticalFindingOut[] = [],
  bandVerified = false,
  emergency = false,
): ImagingStatusIn | LinkIn | ReportIn {
  if (!imagingActionAllowed(order, action))
    throw Error(
      "This order no longer allows that action. Refresh and review it again.",
    );
  if (action === "link") {
    if (order.status === "InProgress" && !form.linkCompletionChecked)
      throw Error(
        "Confirm that no contrast was given before completing by study link. If contrast was given, record completion with its doctor first.",
      );
    if (form.linkMode === "auto") return {};
    const orthanc = form.orthanc.trim();
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{8}){4}$/.test(orthanc))
      throw Error(
        "Copy the actual Orthanc study ID from PACS: five groups of eight lower-case hexadecimal digits.",
      );
    return { orthanc_study_id: orthanc };
  }
  if (action === "report") {
    const text = bounded(form.report, 20000, "Report");
    if (text.length < 3)
      throw Error("Enter a report of at least 3 characters.");
    const note = bounded(form.findingNote, 1000, "Critical finding note");
    const finding = form.finding
      ? findings.find(
          (f) =>
            String(f.finding_id) === form.finding &&
            f.is_active &&
            (!f.modality || f.modality === order.modality),
        )
      : undefined;
    if (form.finding && !finding)
      throw Error(
        "The critical finding is unavailable for this modality. Refresh the list.",
      );
    return {
      report_text: text,
      critical_finding_id: finding?.finding_id ?? null,
      critical_finding_note: note || null,
    };
  }
  const body: ImagingStatusIn = { status: action };
  if (action === "Cancelled") {
    const reason = bounded(form.reason, 1000, "Cancellation reason");
    if (!reason) throw Error("Explain why this examination is cancelled.");
    body.reason = reason;
  }
  if (action === "InProgress") {
    if (!form.site)
      throw Error("Check and confirm the site and side against the order.");
    body.site_confirmed = true;
    body.identity_note =
      bounded(form.identityNote, 300, "Identity note") || null;
    if (form.identity === "WristbandScan") {
      if (!bandVerified || form.band.trim().length < 3)
        throw Error("Verify this patient’s wristband before starting.");
      body.wristband_code = bounded(form.band, 80, "Wristband");
      body.identity_check = "WristbandScan";
    } else if (form.identity === "TwoIdentifiers" && form.asked)
      body.identity_check = "TwoIdentifiers";
    else if (
      form.identity === "EmergencyOverride" &&
      emergency &&
      body.identity_note
    )
      body.identity_check = "EmergencyOverride";
    else
      throw Error(
        "Identify the patient with the wristband or two asked and matched identifiers. Emergency override needs an actual emergency and a factual note.",
      );
    if (order.pregnancy_check_needed) {
      if (
        !["NotPregnant", "Pregnant", "Unknown", "NotApplicable"].includes(
          form.pregnancy,
        )
      )
        throw Error("Ask and record pregnancy status before the examination.");
      body.pregnancy_status =
        form.pregnancy as ImagingStatusIn["pregnancy_status"];
      body.pregnancy_note =
        bounded(form.pregnancyNote, 500, "Pregnancy decision") || null;
      if (form.pregnancy === "Pregnant" && !body.pregnancy_note)
        throw Error("Record the pregnancy decision and who made it.");
    }
  }
  if (action === "Completed") {
    if (!["None", "Given"].includes(form.contrastChoice))
      throw Error("Record whether contrast was given.");
    if (form.contrastChoice === "Given") {
      const contrast = bounded(form.contrast, 300, "Contrast");
      if (!contrast)
        throw Error("Record the actual contrast agent, dose and route.");
      if (
        !/^[1-9]\d*$/.test(form.doctorId) ||
        !Number.isSafeInteger(Number(form.doctorId))
      )
        throw Error(
          "Select the actual PMDC doctor physically present from the staff search.",
        );
      body.contrast = contrast;
      body.contrast_doctor_id = Number(form.doctorId);
    }
  }
  return body;
}
