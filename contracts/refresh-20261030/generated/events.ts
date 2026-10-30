/** opd.queue.updated: A queue entry was created, called in, deferred, re-routed, completed or cancelled. Doctor screens refresh their queue without polling. Audience: permission opd.queue.view + the assigned doctor (a department's queue: its doctors). */
export interface OpdQueueUpdatedPayload {
  queue_id: number;
  ticket_id: number;
  patient_id: number;
  patient_name: string;
  mrn: string;
  token_no: number;
  token_date: string;
  queue_group: string;
  doctor_id: number | null;
  department_id: number | null;
  priority: number;
  status: "Active" | "Suspended" | "Deferred" | "Rerouted" | "Completed" | "Cancelled" | "Expired";
  called_at: string | null;
  change: "insert" | "update";
  rerouted_from_queue_id: number | null;
}

/** opd.ticket.status_changed: Ticket visit status, payment status or approval lock changed. Audience: permissions opd.queue.view / opd.ticket.view + assigned doctor. */
export interface OpdTicketStatusChangedPayload {
  ticket_id: number;
  ticket_number: string;
  patient_id: number;
  doctor_id: number | null;
  status: string;
  payment_status: string;
  approval_lock: "None" | "RefundPending" | "WaiverPending" | "CreditPending";
  is_clinical_locked: boolean;
}

/** approval.requested: A privileged action is frozen awaiting approval (approval-ping pattern). Audience: holders of the request's required permission. */
export interface ApprovalRequestedPayload {
  request_id: number;
  approval_type: string;
  summary: string;
  amount: number | null;
  patient_id: number | null;
  is_elevated: boolean;
  subject_type: string;
  subject_id: number;
}

/** approval.resolved: An approval request was approved/rejected/cancelled; unfreeze the requester's screen. Audience: the requester + approvers. */
export interface ApprovalResolvedPayload {
  request_id: number;
  approval_type: string;
  status: string;
  subject_type: string;
  subject_id: number;
  decision_note: string | null;
}

/** waiver.refund_order.ready: A post-consult waiver was approved: reception must hand cash back. Audience: permission opd.cash_back.dispense. */
export interface WaiverRefundOrderReadyPayload {
  waiver_refund_order_id: number;
  ticket_id: number;
  ticket_number: string;
  refund_amount: number;
}

/** refund.ready: A refund was approved: reception must hand cash back. Audience: permission opd.cash_back.dispense. */
export interface RefundReadyPayload {
  disbursement_id: number;
  ticket_id: number;
  ticket_number: string;
  amount: number;
}

/** bed.state_changed: A bed changed state; update the live bed matrix. Audience: permission ipd.bed.view. */
export interface BedStateChangedPayload {
  bed_id: number;
  ward_id: number;
  label: string;
  from_state: string;
  to_state: string;
}

/** bed.waitlist.notification: A bed became available in a ward that has waitlisted patients. Audience: permission ipd.waitlist.manage. */
export interface BedWaitlistNotificationPayload {
  ward_id: number;
  bed_id: number;
  waitlist_id: number;
  patient_id: number;
  patient_name: string;
}

/** admission.requested: A doctor requested an admission (Admission_Pending). Audience: permission ipd.admission.allocate. */
export interface AdmissionRequestedPayload {
  admission_id: number;
  patient_id: number;
  patient_name: string;
  requested_ward_id: number | null;
}

/** admission.cancelled: A pending admission was cancelled before the patient was admitted; a reserved bed is free again. Audience: permission ipd.admission.allocate; the primary doctor. */
export interface AdmissionCancelledPayload {
  admission_id: number;
  patient_id: number;
  from_status: string;
  bed_id: number | null;
}

/** admission.code_red: CODE RED trauma incoming: flash red + chime on the destination, pharmacy and OT. Audience: permissions ipd.admission.view, pharmacy.queue.view, ot.booking.manage, ipd.flowsheet.record. */
export interface AdmissionCodeRedPayload {
  admission_id: number;
  patient_id: number;
  temp_identifier: string;
  ward_id: number | null;
  ward_name: string | null;
  bed_id: number | null;
  bed_label: string | null;
  ot_id: number | null;
  eta_minutes: number | null;
  message: string;
}

/** admission.overflow_assigned: Patient placed outside the primary ward; primary doctor still owns rounds. Audience: permission ipd.admission.view + primary doctor. */
export interface AdmissionOverflowAssignedPayload {
  admission_id: number;
  bed_id: number;
  ward_id: number;
  requested_ward_id: number;
}

/** admission.doctor_changed: An inpatient has another treating doctor: a Code Red taken over, a handover or a reassignment (decisions 58); move the patient between the doctors' rounds. Audience: permissions ipd.admission.view, ipd.admission.reassign + the previous and the new doctor. */
export interface AdmissionDoctorChangedPayload {
  admission_id: number;
  patient_id: number;
  kind: "TakeOver" | "Handover" | "Reassigned";
  from_doctor_id: number | null;
  to_doctor_id: number;
}

/** admission.discharge.stage_changed: A discharge clearance stage changed. Audience: permission ipd.admission.view. */
export interface AdmissionDischargeStageChangedPayload {
  admission_id: number;
  stage: string;
  status: string;
  sequence_no: number;
}

/** vitals.due: Vitals are due/overdue for an admission: the nurses record them, the doctors' rounds show the patient's vitals due (refresh GET /admissions/{admission_id}/flowsheet: is_overdue). Audience: permissions ipd.flowsheet.record, ipd.flowsheet.view. */
export interface VitalsDuePayload {
  admission_id: number;
  patient_name: string;
  bed_label: string;
  due_at: string;
  overdue_minutes: number;
}

/** medication.due: Scheduled MAR doses are due within the next window. Audience: permission ipd.mar.administer. */
export interface MedicationDuePayload {
  admission_id: number;
  mar_ids: number[];
  bed_label: string;
  due_at: string;
}

/** pharmacy.stock.updated: Live formulary colour for a drug changed. Audience: permission pharmacy.formulary.view. */
export interface PharmacyStockUpdatedPayload {
  drug_id: number;
  qty_available: number;
  stock_status: "InStock" | "Low" | "OutOfStock";
}

/** pharmacy.prescription.pending: A new prescription entered the pharmacy queue. Audience: permission pharmacy.queue.view. */
export interface PharmacyPrescriptionPendingPayload {
  prescription_id: number;
  prescription_number: string;
  patient_name: string;
  source: string;
}

/** pharmacy.low_stock: Drug fell below its low-stock threshold (worker). Audience: permission pharmacy.stock.view. */
export interface PharmacyLowStockPayload {
  drug_id: number;
  name: string;
  qty_available: number;
  threshold: number;
}

/** lab.result.pending_verification: A technician submitted a result: the verifier queue, and every bench's worklist (the test left Processing). Audience: permission lab.result.verify or lab.result.enter. */
export interface LabResultPendingVerificationPayload {
  result_id: number;
  requisition_id: number;
  lab_requisition_item_id: number;
  test_name: string;
  has_critical_value: boolean;
}

/** lab.result.published: A verified result is now visible to the ordering doctor; for a lab-only walk-in (no ordering doctor) the reception desk may hand its report over. Audience: ordering doctor + lab verifiers; a lab-only walk-in's: also the users holding both patient.create and lab.requisition.create (the desk that registers walk-ins). */
export interface LabResultPublishedPayload {
  result_id: number;
  requisition_id: number;
  patient_id: number;
  patient_name: string;
  test_name: string;
  has_critical_value: boolean;
}

/** lab.result.critical_pending: A critical value was entered and awaits verification: verifiers check it first; the ordering doctor knows it is coming. Audience: ordering doctor + lab verifiers. */
export interface LabResultCriticalPendingPayload {
  result_id: number;
  requisition_id: number;
  patient_id: number;
  patient_name: string;
  test_name: string;
  release_after_minutes: number;
}

/** lab.result.provisional: A critical value still unverified after lab_critical_release_minutes is shown to the ordering doctor, marked Pending verification. Audience: ordering doctor + lab verifiers. */
export interface LabResultProvisionalPayload {
  result_id: number;
  requisition_id: number;
  patient_id: number;
  patient_name: string;
  test_name: string;
}

/** lab.result.provisional_withdrawn: A provisionally shown critical value was rejected by the verifier: the doctor must not act on it. Audience: ordering doctor + lab verifiers. */
export interface LabResultProvisionalWithdrawnPayload {
  result_id: number;
  requisition_id: number;
  patient_id: number;
  patient_name: string;
  test_name: string;
}

/** lab.reagent.low_stock: Reagent below threshold (worker). Audience: permission lab.reagent.manage. */
export interface LabReagentLowStockPayload {
  reagent_id: number;
  name: string;
  qty_available: number;
}

/** imaging.study.available: A PACS study was linked to an imaging order. Audience: ordering doctor + imaging viewers. */
export interface ImagingStudyAvailablePayload {
  imaging_order_id: number;
  patient_id: number;
  viewer_url: string | null;
}

/** imaging.order.created: New imaging order on the radiographer worklist. Audience: permission imaging.order.update. */
export interface ImagingOrderCreatedPayload {
  imaging_order_id: number;
  modality: string;
  priority: "Routine" | "Urgent" | "STAT";
}

/** imaging.report.ready: The radiology report was entered (by the hospital's radiologist, or the partner centre's report of an outsourced examination). Priority critical when it carries a critical finding (the critical results log has the entry: critical_result.updated). Audience: ordering doctor. */
export interface ImagingReportReadyPayload {
  imaging_order_id: number;
  patient_id: number;
}

/** ot.emergency_hold: Code Red locked a theater: prepare it immediately. Audience: permission ot.booking.manage. */
export interface OtEmergencyHoldPayload {
  booking_id: number;
  ot_id: number;
  ot_name: string;
  procedure_name: string;
  hold_until: string;
}

/** ot.settlement.finalized: Surgery finalized: bill raised, commissions routed (AP queue refresh). Audience: permissions finance.ap.settle, ot.finalize. */
export interface OtSettlementFinalizedPayload {
  booking_id: number;
  settlement_id: number;
  invoice_id: number;
  net_profit: number;
  total_commissions: number;
}

/** bed.reservation.expired: A bed reservation lapsed (patient never arrived); bed is Available again. Audience: permission ipd.admission.allocate. */
export interface BedReservationExpiredPayload {
  admission_id: number;
  bed_id: number;
}

/** ticket.clinical_lockout: A ticket crossed into a clinically-locked state (refund no longer possible). Audience: permission opd.ticket.view. */
export interface TicketClinicalLockoutPayload {
  ticket_id: number;
  ticket_number: string;
}

/** ticket.forfeited: An expired, never-reactivated ticket was forfeited (end of validity). Audience: permission opd.ticket.view. */
export interface TicketForfeitedPayload {
  ticket_id: number;
  ticket_number: string;
}

/** ot.status.updated: Airport-board style OT status (no patient identifiers). Audience: broadcast. */
export interface OtStatusUpdatedPayload {
  ot_id: number;
  ot_name: string;
  state: "Available" | "EmergencyHold" | "InSurgery" | "CleaningPrep" | "OutOfService";
  active_procedure: string | null;
}

/** ot.booking.updated: OT booking changed. Audience: permissions ot.booking.manage, ot.booking.view + primary surgeon. */
export interface OtBookingUpdatedPayload {
  booking_id: number;
  booking_number: string;
  ot_id: number | null;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  procedure_name: string;
  surgeon_name: string;
}

/** work_order.updated: Work order created or status changed. Audience: permissions ops.workorder.manage, ops.feed.view. */
export interface WorkOrderUpdatedPayload {
  work_order_id: number;
  wo_number: string;
  status: string;
  category: string;
  priority: string;
}

/** ops.badge.scan: Live facility feed: a badge scan was processed (RFID, printed QR or biometric station). Audience: permission ops.feed.view. */
export interface OpsBadgeScanPayload {
  scan_id: number;
  station_id: string;
  station_label: string;
  holder: string | null;
  outcome: string;
  detail: string | null;
  at: string;
}

/** roster.changed: A duty roster entry was created, changed or cancelled: refresh the planner / my duties. Audience: the rostered employee, and holders of roster.manage.all, roster.view.all and the scope permission of the employee's staff category (roster.manage.nursing / roster.manage.support). */
export interface RosterChangedPayload {
  roster_id: number;
  employee_id: number;
  action: "created" | "updated" | "cancelled";
  roster_date: string;
  shift_name: string;
  ward_id: number | null;
  department_id: number | null;
}

/** roster.swap.updated: A duty swap was asked, answered, approved, rejected, withdrawn or expired: refresh the swap lists (the two colleagues' self-service, the planner's approvals). Audience: the requester and the colleague, and holders of roster.manage.all, roster.view.all and the scope permission of their staff category. */
export interface RosterSwapUpdatedPayload {
  swap_id: number;
  status: "Requested" | "Accepted" | "Approved" | "Declined" | "Rejected" | "Cancelled" | "Expired";
  roster_id: number;
  requester_employee_id: number;
  covering_employee_id: number;
}

/** attendance.flagged: Late/absent flag computed for an employee. Audience: permissions hr.attendance.view, hr.leave.approve. */
export interface AttendanceFlaggedPayload {
  employee_id: number;
  attendance_date: string;
  status: "Late" | "Absent" | "HalfDay";
  late_minutes: number;
}

/** patient.merged: A duplicate/trauma profile was merged into a master record: reload open patient screens. Audience: permission patient.view. */
export interface PatientMergedPayload {
  source_patient_id: number;
  target_patient_id: number;
}

/** hr.provisioning.requested: HR submitted a profile; IT must create the login. Audience: permission admin.user.provision. */
export interface HrProvisioningRequestedPayload {
  employee_id: number;
  emp_number: string;
  full_name: string;
  designation: string;
}

/** leave.requested: A direct report requested leave. Audience: the supervisor (or permission hr.leave.manage). */
export interface LeaveRequestedPayload {
  leave_request_id: number;
  employee_id: number;
  full_name: string;
  leave_type: string;
  days: number;
  from_date: string;
  to_date: string;
}

/** record_review.updated: A medical record review cycle changed status, or one of its records was reviewed (live progress on the Quality Officer's screen). Audience: permission quality.review.manage. */
export interface RecordReviewUpdatedPayload {
  cycle_id: number;
  cycle_number: string;
  status: string;
  reviewed: number;
  total: number;
}

/** death.recorded: A doctor recorded a patient's death: close the patient's open screens for new orders, show the bed as a death on the ward and the bed matrix, add it to the death register. Audience: permissions ipd.admission.view, death.register.view. */
export interface DeathRecordedPayload {
  death_id: number;
  death_number: string;
  patient_id: number;
  admission_id: number | null;
  setting: "Inpatient" | "Emergency" | "Outpatient" | "BroughtDead";
  death_at: string;
}

/** er.visit.updated: An emergency patient arrived, was triaged or re-triaged, changed stage (with the doctor, observation, waiting for admission, a bed or a referral), was classed medico-legal or left: refresh the ER board. Priority high when a patient becomes triage level 1 (resuscitation). Audience: permission er.visit.view. */
export interface ErVisitUpdatedPayload {
  er_visit_id: number;
  er_number: string;
  patient_id: number;
  stage: "Arrived" | "Triaged" | "InTreatment" | "Observation" | "AwaitingAdmission" | "AwaitingBed" | "AwaitingReferral" | "Departed";
  triage_level: number | null;
  disposition: string | null;
  is_medico_legal: boolean | null;
  change: "insert" | "update";
}

/** ot.clinical.updated: A part of the surgical record of an operation was written, signed or corrected (the pre-operative note, a pre-anaesthesia assessment, a pause of the safety checklist, the anaesthesia record, the operative note, the recovery stay or an observation in recovery, a consent of the operation): reload the surgical record and the recovery board. Audience: permission ot.clinical.view + primary surgeon. */
export interface OtClinicalUpdatedPayload {
  booking_id: number;
  record: "PreOpNote" | "PreAnaesthesia" | "SafetyChecklist" | "AnaesthesiaRecord" | "OperativeNote" | "Recovery" | "Consent";
  status: string | null;
  change: "insert" | "update";
}

/** consent.updated: A consent was prepared, decided (given, refused), withdrawn, cancelled or its signed form scanned: refresh the consent worklist and the consents of the patient, the admission or the operation. Audience: permission consent.view. */
export interface ConsentUpdatedPayload {
  consent_id: number;
  consent_number: string;
  patient_id: number;
  admission_id: number | null;
  booking_id: number | null;
  category: "General" | "Procedure" | "Anaesthesia" | "Transfusion" | "HighRiskTreatment" | "AgainstMedicalAdvice" | "Other";
  status: "Draft" | "Given" | "Refused" | "Withdrawn" | "Cancelled";
  change: "insert" | "update";
}

/** medication.order.updated: A verbal order was taken or countersigned, or the pharmacist's query on an order was raised, answered or withdrawn: refresh the prescriber's countersign and query list and the pharmacy queue. Audience: permissions pharmacy.queue.view, medication.safety.view; the prescriber. */
export interface MedicationOrderUpdatedPayload {
  prescription_id: number;
  prescription_number: string;
  prescriber_id: number;
  change: "VerbalOrder" | "Countersigned" | "QueryRaised" | "QueryAnswered" | "QueryWithdrawn";
  query_id: number | null;
}

/** pharmacy.recall.updated: A batch recall was opened, its stock removed, a patient contact recorded, or the recall closed or cancelled: refresh the recall register, the pharmacy stock and the ward stock. Priority high when it opens. Audience: permissions pharmacy.recall.view, pharmacy.dispense, ward.inventory.view. */
export interface PharmacyRecallUpdatedPayload {
  recall_id: number;
  recall_number: string;
  drug_id: number;
  drug_name: string;
  status: "Open" | "Closed" | "Cancelled";
  change: "Opened" | "StockRemoved" | "PatientContacted" | "Closed" | "Cancelled";
}

/** blood.request.created: A doctor requested blood: the blood bank's worklist refreshes (GET /blood/requests). Priority high for an Emergency request. Audience: permission blood.bank.operate. */
export interface BloodRequestCreatedPayload {
  request_id: number;
  request_number: string;
  urgency: "Routine" | "Urgent" | "Emergency";
  component: string;
  units_requested: number;
  uncrossmatched: boolean;
}

/** blood.unit.issued: A unit of blood left the blood bank for a patient: it must be started at the bedside by start_by (30 minutes) or signed back. Priority high. Audience: permission blood.transfuse. */
export interface BloodUnitIssuedPayload {
  transfusion_id: number;
  request_id: number;
  request_number: string;
  unit_number: string;
  start_by: string;
}

/** blood.consent.withdrawn: The patient withdrew a transfusion consent: every open request it covered without a unit out is cancelled (`cancelled_requests`); a unit already out (`units_out`) must not be started: sign it back or record it as not given, and stop a transfusion that is running. Critical while a unit is out. Audience: permissions blood.transfuse, blood.crossmatch, blood.bank.operate. */
export interface BloodConsentWithdrawnPayload {
  consent_id: number;
  cancelled_requests: string[];
  units_out: unknown[];
}

/** blood.storage.out_of_range: A blood refrigerator, plasma freezer or platelet incubator reading was out of its range: the blood bank checks the units and the action recorded. Priority high. Audience: permission blood.bank.operate. */
export interface BloodStorageOutOfRangePayload {
  check_id: number;
  equipment: string;
  storage_kind: "BloodRefrigerator" | "PlasmaFreezer" | "PlateletIncubator";
  temperature_c: string;
  min_c: string | null;
  max_c: string;
  action_taken: string | null;
}

/** blood.reaction.reported: A transfusion reaction was reported with its incident: the blood bank rechecks the groups and decides whether to inform the Authority (the Act s.13); quality reviews the incident. Audience: permissions blood.bank.manage, blood.bank.operate, incident.manage. */
export interface BloodReactionReportedPayload {
  reaction_id: number;
  transfusion_id: number;
  incident_id: number;
  incident_number: string;
  wrong_blood: boolean;
}

/** blood_center.donation.reactive: A donation's screen was reactive: none of it is released, its components are discarded, and a doctor tells a repeat-reactive donor confidentially and refers them (PBTA Standards ch.4 S.2.1.4; the Act s.10(2)(e)). Priority high. Audience: permissions blood_center.donor.assess, blood_center.process. */
export interface BloodCenterDonationReactivePayload {
  donation_id: number;
  donation_number: string;
  donor_id: number;
  markers: string[];
  repeat_reactive: boolean;
}

/** blood_center.component.released: A component of the hospital's own blood center left quarantine into the blood bank's stock: the stock refreshes (GET /blood/units). Audience: permission blood.bank.operate. */
export interface BloodCenterComponentReleasedPayload {
  component_id: number;
  unit_id: number;
  unit_number: string;
  component: string;
  abo: string;
  rh: string;
  expires_at: string;
}

/** pharmacy.storage.out_of_range: A medicine store, refrigerator or freezer reading was out of its range: the pharmacy and the ward check the stock and the action recorded. Priority high. Audience: permissions pharmacy.storage.record, pharmacy.stock.view. */
export interface PharmacyStorageOutOfRangePayload {
  check_id: number;
  storage_area: string;
  storage_kind: "Room" | "Refrigerator" | "Freezer" | "ColdChainBox";
  ward_id: number | null;
  temperature_c: string;
  min_c: string;
  max_c: string;
  action_taken: string | null;
  recorded_by_name: string;
}

/** critical_result.updated: A critical lab value, a positive test for a priority disease or a critical imaging finding entered the critical results log (Opened, priority critical: tell the doctor NOW and record it), was told to someone (Communicated), acknowledged by a doctor (Acknowledged), or escalated because nobody responsible was told in time (Escalated): refresh the critical results list and the doctor's worklist. Audience: permissions diagnostics.critical.communicate, diagnostics.critical.view; the requesting doctor; on escalation also diagnostics.critical.escalation. */
export interface CriticalResultUpdatedPayload {
  critical_result_id: number;
  critical_number: string;
  source: "Lab" | "Imaging";
  patient_id: number;
  admission_id: number | null;
  status: "Open" | "Communicated" | "Acknowledged";
  change: "Opened" | "Communicated" | "AuthorityInformed" | "Acknowledged" | "Escalated";
}

/** incident.reported: An incident, an adverse event (a theatre one has booking_id) or a near miss was reported: refresh the incident register. Priority critical for a sentinel event (review it at once), high for severe harm or a death. Audience: permissions incident.manage, incident.view. */
export interface IncidentReportedPayload {
  incident_id: number;
  incident_number: string;
  type_code: string;
  area: string;
  is_sentinel: boolean;
  harm: "NoHarm" | "Mild" | "Moderate" | "Severe" | "Death";
  status: "Reported";
  booking_id: number | null;
  change: "Reported";
}

/** incident.updated: An incident was reviewed (classed, the investigator named), withdrawn, analysed, got an action or was closed: refresh the register and the investigator's list. Audience: permissions incident.manage, incident.view; the investigator. */
export interface IncidentUpdatedPayload {
  incident_id: number;
  incident_number: string;
  type_code: string;
  area: string;
  is_sentinel: boolean;
  harm: "NoHarm" | "Mild" | "Moderate" | "Severe" | "Death";
  status: "Reported" | "UnderReview" | "Analysed" | "Closed" | "Withdrawn";
  booking_id: number | null;
  change: "Reviewed" | "Withdrawn" | "Analysed" | "ActionAdded" | "Closed";
}

/** complaint.received: A complaint was recorded: refresh the complaints register (acknowledge it within complaint_acknowledge_hours). Audience: permissions complaint.manage, complaint.view. */
export interface ComplaintReceivedPayload {
  complaint_id: number;
  complaint_number: string;
  status: "Received";
  priority: null;
  category: string;
  change: "Received";
}

/** complaint.updated: A complaint was acknowledged (or judged not maintainable), the complainant informed or given more time, the findings written, the outcome conveyed, appealed (priority high), the appeal decided, closed, withdrawn or given an action: refresh the register and the investigator's list. Audience: permissions complaint.manage, complaint.view; the investigator. */
export interface ComplaintUpdatedPayload {
  complaint_id: number;
  complaint_number: string;
  status: "Received" | "Acknowledged" | "Resolved" | "Appealed" | "Closed" | "Withdrawn" | "NotMaintainable";
  priority: "Urgent" | "High" | "Normal" | "Low" | null;
  category: string;
  change: "Acknowledged" | "NotMaintainable" | "Progress" | "Extension" | "Other" | "Findings" | "Resolved" | "Appealed" | "AppealDecided" | "Closed" | "Withdrawn" | "ActionAdded";
}

/** cssd.cycle.updated: A sterilization cycle got its results (released, quarantined for its biological indicator, or failed: priority critical) or a load was recalled (critical: return its packs): refresh the CSSD board, the sterile stock and the theatre's packs. Audience: permissions cssd.operate, cssd.manage, cssd.view; a recall also cssd.pack.use. */
export interface CssdCycleUpdatedPayload {
  cycle_id: number;
  cycle_number: string;
  cycle_type: "Load" | "BowieDick" | "LeakTest" | "BiologicalTest";
  status: "Released" | "Quarantined" | "Failed" | "Recalled";
}

/** admission.transferred: An inpatient moved to another bed or ward: refresh the bed matrix, the ward lists and, when rate_changed (priority high), the estimate worklist: tell the family the new estimate (MSDS PRE 79). Audience: permissions ipd.admission.view, estimate.prepare. */
export interface AdmissionTransferredPayload {
  admission_id: number;
  transfer_id: number;
  from_ward_id: number;
  to_ward_id: number;
  to_bed_id: number;
  rate_changed: boolean;
}

/** msds.mock_interview.recorded: A supervisor recorded a mock PHC interview: refresh the interview readiness and the mock interview list; the member of staff questioned refreshes their progress and deck. Audience: permissions msds.interview.manage, msds.interview.conduct; the member of staff questioned. */
export interface MsdsMockInterviewRecordedPayload {
  mock_interview_id: number;
  interview_number: string;
  employee_id: number;
  role_code: string;
  questions: number;
  met: number;
}

/** msds.pack_export.ready: The combined inspection pack the user asked for is ready to download, or failed (status). Audience: the requesting user. */
export interface MsdsPackExportReadyPayload {
  export_id: number;
  status: string;
}

/** establishment.changed: The establishment's profile or its services changed (Settings, facility): read GET /establishment again and show or hide the actions of each service (only Active ones start new work); the letterhead carries the new PHC category from its effective date. Audience: broadcast. */
export interface EstablishmentChangedPayload {
  change_id: number;
  revision: number;
  profile: "Clinic" | "IIC" | "IIB" | "IIA" | "I" | null;
  capabilities: string[];
}

/** risk.critical_event: A CRITICAL risk finding (e.g. voided-but-examined). Audience: permission risk.view. */
export interface RiskCriticalEventPayload {
  risk_event_id: number;
  rule_code: string;
  summary: string;
  entity_type: string;
  entity_id: string;
}

/** notification.created: A new inbox notification for the user (refresh the bell badge). Emitted by the database for every notification, whichever feature created it (migration 0013). Audience: the target user, or every holder of the target permission. */
export interface NotificationCreatedPayload {
  notification_id: number;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  entity_type: string | null;
  entity_id: string | null;
}

/** session.revoked: Your session was revoked (logout elsewhere, deactivation, kill switch). Log out now. Audience: the affected user(s) / broadcast for kill switch. */
export interface SessionRevokedPayload {
  reason: string;
}

/** system.maintenance: Maintenance mode or its message changed (Control Center or PUT /admin/maintenance). message: the text to show on the maintenance screen word for word (IT's own, else the server's default; empty when enabled is false). Audience: broadcast. */
export interface SystemMaintenancePayload {
  enabled: boolean;
  message: string;
}

/** system.license: The server's license state changed (e.g. a hardware change started the grace period, or a new license was installed). Same body as GET /api/v1/meta/license: show `message` and the vendor contact as a banner on every screen while `state` is grace or locked; remove it when it is ok. Audience: broadcast. */
export interface SystemLicensePayload {
  state: "ok" | "grace" | "locked" | "dev";
  reason: string | null;
  message: string;
  grace_until: string | null;
  days_left: number | null;
  vendor: Record<string, unknown>;
  logins: "all" | "super_admin_only";
}

/** A message on /ws/v1/events (see get_guide('realtime')). */
export type HmsEvent =
  | { type: "event"; event_id: number; event_type: "opd.queue.updated"; priority: string; created_at: string; payload: OpdQueueUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "opd.ticket.status_changed"; priority: string; created_at: string; payload: OpdTicketStatusChangedPayload }
  | { type: "event"; event_id: number; event_type: "approval.requested"; priority: string; created_at: string; payload: ApprovalRequestedPayload }
  | { type: "event"; event_id: number; event_type: "approval.resolved"; priority: string; created_at: string; payload: ApprovalResolvedPayload }
  | { type: "event"; event_id: number; event_type: "waiver.refund_order.ready"; priority: string; created_at: string; payload: WaiverRefundOrderReadyPayload }
  | { type: "event"; event_id: number; event_type: "refund.ready"; priority: string; created_at: string; payload: RefundReadyPayload }
  | { type: "event"; event_id: number; event_type: "bed.state_changed"; priority: string; created_at: string; payload: BedStateChangedPayload }
  | { type: "event"; event_id: number; event_type: "bed.waitlist.notification"; priority: string; created_at: string; payload: BedWaitlistNotificationPayload }
  | { type: "event"; event_id: number; event_type: "admission.requested"; priority: string; created_at: string; payload: AdmissionRequestedPayload }
  | { type: "event"; event_id: number; event_type: "admission.cancelled"; priority: string; created_at: string; payload: AdmissionCancelledPayload }
  | { type: "event"; event_id: number; event_type: "admission.code_red"; priority: string; created_at: string; payload: AdmissionCodeRedPayload }
  | { type: "event"; event_id: number; event_type: "admission.overflow_assigned"; priority: string; created_at: string; payload: AdmissionOverflowAssignedPayload }
  | { type: "event"; event_id: number; event_type: "admission.doctor_changed"; priority: string; created_at: string; payload: AdmissionDoctorChangedPayload }
  | { type: "event"; event_id: number; event_type: "admission.discharge.stage_changed"; priority: string; created_at: string; payload: AdmissionDischargeStageChangedPayload }
  | { type: "event"; event_id: number; event_type: "vitals.due"; priority: string; created_at: string; payload: VitalsDuePayload }
  | { type: "event"; event_id: number; event_type: "medication.due"; priority: string; created_at: string; payload: MedicationDuePayload }
  | { type: "event"; event_id: number; event_type: "pharmacy.stock.updated"; priority: string; created_at: string; payload: PharmacyStockUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "pharmacy.prescription.pending"; priority: string; created_at: string; payload: PharmacyPrescriptionPendingPayload }
  | { type: "event"; event_id: number; event_type: "pharmacy.low_stock"; priority: string; created_at: string; payload: PharmacyLowStockPayload }
  | { type: "event"; event_id: number; event_type: "lab.result.pending_verification"; priority: string; created_at: string; payload: LabResultPendingVerificationPayload }
  | { type: "event"; event_id: number; event_type: "lab.result.published"; priority: string; created_at: string; payload: LabResultPublishedPayload }
  | { type: "event"; event_id: number; event_type: "lab.result.critical_pending"; priority: string; created_at: string; payload: LabResultCriticalPendingPayload }
  | { type: "event"; event_id: number; event_type: "lab.result.provisional"; priority: string; created_at: string; payload: LabResultProvisionalPayload }
  | { type: "event"; event_id: number; event_type: "lab.result.provisional_withdrawn"; priority: string; created_at: string; payload: LabResultProvisionalWithdrawnPayload }
  | { type: "event"; event_id: number; event_type: "lab.reagent.low_stock"; priority: string; created_at: string; payload: LabReagentLowStockPayload }
  | { type: "event"; event_id: number; event_type: "imaging.study.available"; priority: string; created_at: string; payload: ImagingStudyAvailablePayload }
  | { type: "event"; event_id: number; event_type: "imaging.order.created"; priority: string; created_at: string; payload: ImagingOrderCreatedPayload }
  | { type: "event"; event_id: number; event_type: "imaging.report.ready"; priority: string; created_at: string; payload: ImagingReportReadyPayload }
  | { type: "event"; event_id: number; event_type: "ot.emergency_hold"; priority: string; created_at: string; payload: OtEmergencyHoldPayload }
  | { type: "event"; event_id: number; event_type: "ot.settlement.finalized"; priority: string; created_at: string; payload: OtSettlementFinalizedPayload }
  | { type: "event"; event_id: number; event_type: "bed.reservation.expired"; priority: string; created_at: string; payload: BedReservationExpiredPayload }
  | { type: "event"; event_id: number; event_type: "ticket.clinical_lockout"; priority: string; created_at: string; payload: TicketClinicalLockoutPayload }
  | { type: "event"; event_id: number; event_type: "ticket.forfeited"; priority: string; created_at: string; payload: TicketForfeitedPayload }
  | { type: "event"; event_id: number; event_type: "ot.status.updated"; priority: string; created_at: string; payload: OtStatusUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "ot.booking.updated"; priority: string; created_at: string; payload: OtBookingUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "work_order.updated"; priority: string; created_at: string; payload: WorkOrderUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "ops.badge.scan"; priority: string; created_at: string; payload: OpsBadgeScanPayload }
  | { type: "event"; event_id: number; event_type: "roster.changed"; priority: string; created_at: string; payload: RosterChangedPayload }
  | { type: "event"; event_id: number; event_type: "roster.swap.updated"; priority: string; created_at: string; payload: RosterSwapUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "attendance.flagged"; priority: string; created_at: string; payload: AttendanceFlaggedPayload }
  | { type: "event"; event_id: number; event_type: "patient.merged"; priority: string; created_at: string; payload: PatientMergedPayload }
  | { type: "event"; event_id: number; event_type: "hr.provisioning.requested"; priority: string; created_at: string; payload: HrProvisioningRequestedPayload }
  | { type: "event"; event_id: number; event_type: "leave.requested"; priority: string; created_at: string; payload: LeaveRequestedPayload }
  | { type: "event"; event_id: number; event_type: "record_review.updated"; priority: string; created_at: string; payload: RecordReviewUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "death.recorded"; priority: string; created_at: string; payload: DeathRecordedPayload }
  | { type: "event"; event_id: number; event_type: "er.visit.updated"; priority: string; created_at: string; payload: ErVisitUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "ot.clinical.updated"; priority: string; created_at: string; payload: OtClinicalUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "consent.updated"; priority: string; created_at: string; payload: ConsentUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "medication.order.updated"; priority: string; created_at: string; payload: MedicationOrderUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "pharmacy.recall.updated"; priority: string; created_at: string; payload: PharmacyRecallUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "blood.request.created"; priority: string; created_at: string; payload: BloodRequestCreatedPayload }
  | { type: "event"; event_id: number; event_type: "blood.unit.issued"; priority: string; created_at: string; payload: BloodUnitIssuedPayload }
  | { type: "event"; event_id: number; event_type: "blood.consent.withdrawn"; priority: string; created_at: string; payload: BloodConsentWithdrawnPayload }
  | { type: "event"; event_id: number; event_type: "blood.storage.out_of_range"; priority: string; created_at: string; payload: BloodStorageOutOfRangePayload }
  | { type: "event"; event_id: number; event_type: "blood.reaction.reported"; priority: string; created_at: string; payload: BloodReactionReportedPayload }
  | { type: "event"; event_id: number; event_type: "blood_center.donation.reactive"; priority: string; created_at: string; payload: BloodCenterDonationReactivePayload }
  | { type: "event"; event_id: number; event_type: "blood_center.component.released"; priority: string; created_at: string; payload: BloodCenterComponentReleasedPayload }
  | { type: "event"; event_id: number; event_type: "pharmacy.storage.out_of_range"; priority: string; created_at: string; payload: PharmacyStorageOutOfRangePayload }
  | { type: "event"; event_id: number; event_type: "critical_result.updated"; priority: string; created_at: string; payload: CriticalResultUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "incident.reported"; priority: string; created_at: string; payload: IncidentReportedPayload }
  | { type: "event"; event_id: number; event_type: "incident.updated"; priority: string; created_at: string; payload: IncidentUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "complaint.received"; priority: string; created_at: string; payload: ComplaintReceivedPayload }
  | { type: "event"; event_id: number; event_type: "complaint.updated"; priority: string; created_at: string; payload: ComplaintUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "cssd.cycle.updated"; priority: string; created_at: string; payload: CssdCycleUpdatedPayload }
  | { type: "event"; event_id: number; event_type: "admission.transferred"; priority: string; created_at: string; payload: AdmissionTransferredPayload }
  | { type: "event"; event_id: number; event_type: "msds.mock_interview.recorded"; priority: string; created_at: string; payload: MsdsMockInterviewRecordedPayload }
  | { type: "event"; event_id: number; event_type: "msds.pack_export.ready"; priority: string; created_at: string; payload: MsdsPackExportReadyPayload }
  | { type: "event"; event_id: number; event_type: "establishment.changed"; priority: string; created_at: string; payload: EstablishmentChangedPayload }
  | { type: "event"; event_id: number; event_type: "risk.critical_event"; priority: string; created_at: string; payload: RiskCriticalEventPayload }
  | { type: "event"; event_id: number; event_type: "notification.created"; priority: string; created_at: string; payload: NotificationCreatedPayload }
  | { type: "event"; event_id: number; event_type: "session.revoked"; priority: string; created_at: string; payload: SessionRevokedPayload }
  | { type: "event"; event_id: number; event_type: "system.maintenance"; priority: string; created_at: string; payload: SystemMaintenancePayload }
  | { type: "event"; event_id: number; event_type: "system.license"; priority: string; created_at: string; payload: SystemLicensePayload };
