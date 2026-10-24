# Phase 2 acceptance audit — 24 October 2026

Source: live Haspataal MCP for mkashif / implementation1, rubric66605e3aa343, backend build2026-10-24T06:32:06.067860+00:00. Git baseline f70732c; audit only, no app source changes or new workflow writes/tests.

Current server summary: **867 accepted points (5.39%), 160 endpoint claims, 0/268 completed screens**. Phase2 has **19 screens, 0 fully accepted**. Existing interfaces were implemented and previously navigation-tested; the figures below measure accepted checklist coverage, not code volume or implementation percentages. Unclaimed items may already have code but lack adequate tested/reviewed evidence.

Proposals107(app_shell)/108(workspace_picker) pending, awaiting human review on /docs -> My progress.105/106 accepted. Approving107/108 alone will not close a whole screen. Backend17/18 stillNew/no answer; affect search testing. No new backend defect found in this audit.

A screen requires all endpoint/event/rule and UI-quality claims, including contextual F1, bilingual handbook and supported-role FAQs, bounded shared zoom, tested safe operations and named human fresh-data/editor review. Human worksheet reference is required for the compulsory review claims; an informal chat statement or automated navigation pass does not satisfy the portal gate. We must also finish agent-owned testing/evidence; this is not solely waiting for the user.

## Recommended next screen: My cash shift

First Phase2 screen in the server dependency roadmap. Already accepted21/45points: all four listed endpoint consumers, counted-cash closing rule, handbook/F1/zoom. Remaining: enforce/test this terminal counter/open-shift rule; loading/empty/error states; permission controls; safe writes; complete API test plan; supported-role EN/UR FAQs; human fresh-data review; design and editor pass. Audit existing src/screens/CashShift.tsx and src/cash-shift-safety.ts before changing code. Next implementation session must read full bundle/quality/design/endpoints, inspect existing evidence, then verify missing scenarios and submit only new tested claims. Never close an existing shared demo shift merely to manufacture evidence.

## Exact pending acceptance checklist

### My cash shift (my_cash_shift) — 21/45 accepted points

- rule:6d79bd21de: Every cash action needs an open shift at this counter (node from GET /terminals/whoami cash_node).
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:role_faq: Complete role-specific FAQs
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Patient search (patient_search) — 16/51 accepted points

- rule:5c7aabbadf: Search as the user types (debounce 250 ms); a USB scanner types an MRN barcode + Enter.
- rule:30c67b70d7: If outstanding.has_outstanding_ar: show outstanding.banner_text in a red banner above the patient card.
- rule:fd66e16ee9: Merged records resolve to the master record automatically; never show merged duplicates as separate patients.
- rule:abc016fdd8: mlc_numbers not empty: a red MEDICO-LEGAL banner with the numbers (MSDS 154). is_deceased: a DECEASED banner (death_at); never start a new visit for a deceased patient.
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### New registration + OPD slip (registration) — 36/77 accepted points

- ev:opd.queue.updated: opd.queue.updated
- rule:66ed513e91: Patient Photo is OPTIONAL here and everywhere (never a required field, never a blocker): offer 'Take photo' (camera) or 'Choose file' (JPEG or PNG), preview, retake, and 'Skip' needing no reason. Ask first; respect a refusal (purdah, privacy) and never delay an emergency, an injured face or a patient who cannot cooperate. Upload it after the patient exists: POST /patients/{patient_id}/documents doc_type=Photo, its own Idempotency-Key, so a failed upload never repeats a registration, a payment or an admission. Show photo_document_id (patient, admission) through GET /patient-documents/{document_id}/download.
- rule:794ff452da: 'Reports brought by the patient' (optional, any number): file (PDF, or a JPEG/PNG scan or photo of the paper), type (LabReport, Imaging, DischargeSummary, Prescription, ReferralLetter, Other), title (the test or report, e.g. 'CBC'), issued by (source_facility, required) and the date on it (document_date) → POST /patients/{patient_id}/documents with is_outside=true. List them labelled 'Outside: <facility>, <date>', apart from this hospital's own results: they are never shown or counted as this hospital's lab or imaging results.
- rule:17eacdfd42: AR_OUTSTANDING_BLOCK: show the dues banner; Emergency source bypasses the block.
- rule:f7c9c90eea: Print print_payload.text on the 80 mm thermal printer mapped to this terminal (GET /terminals/whoami).
- rule:937add537d: POST /reception/registrations starts new emergency_department work for an emergency patient (source Emergency) without an open emergency visit: offer that choice only while emergency_department is Active (GET /establishment active); the rest of the action stays.
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Queue management (queue_management) — 29/60 accepted points

- ev:ticket.forfeited: ticket.forfeited
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Refund / VIP waiver / credit requests (refund_waiver_credit) — 28/62 accepted points

- ep:POST /opd-tickets/{ticket_id}/vip-waiver-post-consult: POST /opd-tickets/{ticket_id}/vip-waiver-post-consult
- rule:f79a7aacce: Refunds after clinical activity need the elevated approver and are risk-flagged — suggest the post-consult VIP waiver.
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Mandatory cash-back prompts (cash_back_prompts) — 7/46 accepted points

- ep:POST /opd-tickets/{ticket_id}/refund/confirm-dispensation: POST /opd-tickets/{ticket_id}/refund/confirm-dispensation
- ep:POST /opd-tickets/{ticket_id}/waiver-refund/confirm-dispensation: POST /opd-tickets/{ticket_id}/waiver-refund/confirm-dispensation
- rule:e73e13667e: Show ticket.cash_back_prompts as a blocking modal with the exact amount until confirmed.
- rule:4d3fbedfc4: Cash leaves YOUR open shift drawer (open one first: SHIFT_NOT_OPEN).
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Outstanding dues (Udhaar) (receivables) — 25/52 accepted points

- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Patient document vault (patient_documents) — 13/46 accepted points

- rule:7571033b1d: Upload PDF, JPEG or PNG (multipart/form-data, at most MAX_UPLOAD_MB): UNSUPPORTED_MEDIA_TYPE for another type, a PDF as the Photo or a file that is not what it claims; VALIDATION_ERROR for a damaged image, an outside document without its facility or a future date; PAYLOAD_TOO_LARGE (details.max_bytes) above the limit.
- rule:66ed513e91: Patient Photo is OPTIONAL here and everywhere (never a required field, never a blocker): offer 'Take photo' (camera) or 'Choose file' (JPEG or PNG), preview, retake, and 'Skip' needing no reason. Ask first; respect a refusal (purdah, privacy) and never delay an emergency, an injured face or a patient who cannot cooperate. Upload it after the patient exists: POST /patients/{patient_id}/documents doc_type=Photo, its own Idempotency-Key, so a failed upload never repeats a registration, a payment or an admission. Show photo_document_id (patient, admission) through GET /patient-documents/{document_id}/download.
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Tariff (tariff_display) — 8/35 accepted points

- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### My live queue (doctor_queue) — 21/46 accepted points

- rule:39e2daff74: Re-route needs a reason; rapid re-routes without notes are flagged for review.
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### ICD code picker (component) (icd_picker) — 24/49 accepted points

- q:permissions: Actions by permission
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Consultation (EMR) (consultation) — 72/119 accepted points

- ev:lab.result.published: lab.result.published
- ev:imaging.study.available: imaging.study.available
- ev:ticket.clinical_lockout: ticket.clinical_lockout
- rule:d7b42aa3f5: CLINICAL_LOCKOUT: show error.message verbatim ('Patient ticket has been refunded…') and disable editing.
- rule:06b43829f2: Examination consent before the examination field: three buttons, none selected — 'Verbal consent obtained (VCO)', 'Patient declined', 'Not examined' (examination_consent). Never pre-select one; Declined and Not examined disable the examination field. Under the Clinic profile (GET /establishment) the note cannot be finalized without it (EXAMINATION_CONSENT_REQUIRED). The printed note and prescription show 'VCO'.
- rule:c1bf7f3f23: Under the Clinic profile 'Submit consultation' also needs the complaint (or history), the examination findings when VCO was obtained, a diagnosis and the plan (treatment or referral): mark the empty fields from CONSULTATION_INCOMPLETE details.missing and keep the draft.
- rule:e5ab0089a6: POST /clinical-encounters starts new outpatient_procedures work for a Procedure note with its procedure, not an admission's: offer that choice only while outpatient_procedures is Active (GET /establishment active); the rest of the action stays.
- rule:14c510028d: PATCH /clinical-encounters/{encounter_id} starts new outpatient_procedures work for the procedure of an outpatient's Procedure note: offer that choice only while outpatient_procedures is Active (GET /establishment active); the rest of the action stays.
- rule:a64c2f367f: POST /admissions starts new inpatient work: offer it only while inpatient is Active (GET /establishment active).
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### E-prescription builder (eprescription) — 21/67 accepted points

- ep:POST /prescriptions/{prescription_id}/handover: POST /prescriptions/{prescription_id}/handover
- rule:a0b954034e: Offer 'Hospital Pharmacy' only while dispensing is Active (GET /establishment; the operation is in x-capability-gates); otherwise the only choice is the printed slip for an outside pharmacy.
- rule:df86f34424: Inpatient orders require dose, route, frequency (or PRN/STAT) and start time — the MAR is generated from them.
- rule:116b498e61: Outpatient (OPD, ER) lines need the dose, the route, how often and for how many days; a single STAT dose the dose and the route (PRESCRIPTION_INCOMPLETE, details.lines lists each line's missing fields: mark them). Pass the consultation's encounter_id so the printout carries its complaint, findings, diagnosis and VCO.
- rule:7874298bee: The printout (print-payload) is the standard prescription: the patient's particulars, the directions in words ('1 tablet oral twice a day for 5 days'), the prescriber's stamp and a signature line. Printing proves nothing: 'Handed over' (POST /prescriptions/{id}/handover) records to whom (patient, or a named attendant) and how the copy is kept (electronic, carbon copy, or the scan of the signed copy from the patient's documents).
- rule:5a13c8d3a4: Show each medicine's high_alert_category (red) and lasa_with ('looks like …', ask to confirm). A restricted medicine (is_restricted) needs the RestrictedPrescribing privilege; only PMDC doctors or holders of the Prescribing privilege prescribe (PRESCRIBER_NOT_AUTHORIZED, MSDS 52).
- rule:b258a2c31b: self_administration (inpatients): the patient may take an oral, inhaled or topical non-high-alert medicine themselves (SELF_ADMINISTRATION_INVALID otherwise).
- rule:72ad58bc73: POST /prescriptions starts new dispensing work for the hospital pharmacy (destination HospitalPharmacy): offer that choice only while dispensing is Active (GET /establishment active); the rest of the action stays.
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Lab & imaging orders + results (lab_orders_results) — 57/106 accepted points

- ev:imaging.study.available: imaging.study.available
- rule:9fee661557: Cancel an order of your own while no test is sampled: POST /lab/requisitions/{requisition_id}/cancel with the reason (another doctor's order: FORBIDDEN, the lab admin cancels it; a sampled test: LAB_ITEM_STATE_INVALID, so hide the button once a sample is collected).
- rule:c157cc0e95: Critical values (has_critical_value) → red, sticky alert; acknowledge them on the critical results screen.
- rule:78bd8fc8e4: Show each test's is_send_out / partner_name (tell the patient it goes to that laboratory) and due_at; a rejected sample means a new one to take (the doctor is notified).
- rule:0e2b0b1f3f: Imaging order: give the side (laterality) of a limb or paired organ; for an inpatient how they come (transport: Walking, Wheelchair, Trolley, Bed, Portable) and escort (a Doctor for special and interventional procedures). Urgent and STAT run against the emergency turnaround.
- rule:878a246423: Open viewer_url in a separate BrowserWindow when imaging.study.available arrives.
- rule:d53f145296: Exists for the service laboratory or outsourced_diagnostics or imaging (work): show it as GET /establishment views.screens says for screen_id lab_orders_results (full; open_work: without its new work, with the banner "No new ... from now on"; records: history and corrections only; setup: only from Facility settings; hidden: in no menu), after login and again on establishment.changed. Never decide it from the profile's category.
- rule:c52ddd6121: POST /lab/requisitions starts new outsourced_diagnostics work for a send-out test (availability SendOut): offer that choice only while outsourced_diagnostics is Active (GET /establishment active); the rest of the action stays.
- rule:60f2f5ae7d: POST /lab/requisitions starts new laboratory work for an in-house test (availability InHouse): offer that choice only while laboratory is Active (GET /establishment active); the rest of the action stays.
- rule:24a5b3d716: POST /imaging/orders starts new imaging work: offer it only while imaging is Active (GET /establishment active).
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Refer out (external referral) (external_referral) — 21/57 accepted points

- ep:POST /referrals/{referral_id}/acknowledge: POST /referrals/{referral_id}/acknowledge
- rule:e15de3a042: The receiving facility: pick it from the contact list (GET /mlc/contacts, kinds ReferralHospital, TraumaCentre, BloodBank, MlrHospital) or type it when the patient chooses (tick 'at the patient's request').
- rule:1a78f4b185: Transport: Own / Ambulance / Rescue / With our staff. With our staff needs the escort's name and shows 'Acknowledgement pending' until the receiving facility's acknowledgement is recorded (who received the patient and when).
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Referral register (referral_register) — 13/40 accepted points

- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Health education given (patient_education) — 11/44 accepted points

- rule:66f6b058d4: A 'Health education' action in the consultation and the patient's chart: topic, method (Verbal, Leaflet, Written instructions, Demonstration, Video), given to (Patient, Attendant, Both), the material (required for a leaflet or a video: GET /education/materials), a note; in a consultation send its encounter_id.
- rule:844677f241: The patient's list is the patient's record: the read is logged.
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Preventive programmes of a patient (patient_programmes) — 28/63 accepted points

- rule:288e88802f: Only while the preventive_programmes service is Active (GET /establishment: x-capability); while it is Retiring keep 'Record service' and 'Close' for the patients already enrolled and say 'No new enrolment from now on'. The patient's history stays readable afterwards.
- rule:aeeeb885d1: Enrol: pick an offered programme (GET /preventive-programmes) and type the programme's card or register number. PROGRAMME_ENROLLED: open the existing enrolment instead.
- rule:7003ff809a: Exists for the service preventive_programmes (work): show it as GET /establishment views.screens says for screen_id patient_programmes (full; open_work: without its new work, with the banner "No new ... from now on"; records: history and corrections only; setup: only from Facility settings; hidden: in no menu), after login and again on establishment.changed. Never decide it from the profile's category.
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass

### Record a home visit (home_visit_record) — 17/50 accepted points

- rule:a1485eaf83: Only while home visits are provided (x-capability home_visits; CAPABILITY_INACTIVE otherwise).
- rule:15c6e59af8: Exists for the service home_visits (work): show it as GET /establishment views.screens says for screen_id home_visit_record (full; open_work: without its new work, with the banner "No new ... from now on"; records: history and corrections only; setup: only from Facility settings; hidden: in no menu), after login and again on establishment.changed. Never decide it from the profile's category.
- q:states: Loading, empty and error states
- q:permissions: Actions by permission
- q:writes: Safe writes
- q:tested: Test plan passed
- q:handbook: Handbook page
- q:f1_help: F1 contextual help
- q:role_faq: Complete role-specific FAQs
- q:zoom: Keyboard zoom: 100-250% only
- q:fresh_data: Human review with newly created data
- q:character: Design principles applied
- q:editor: Editor's pass
