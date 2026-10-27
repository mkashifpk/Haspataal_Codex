# Imaging worklist — 27 October 2026

Implemented Phase 3 position 45, `radiology_worklist`, in one screen. This is ready for manual review of the non-PACS workflow, not a claim of full workspace acceptance. Next position 46, `critical_results_radiology`, has not been started.

## What changed

`src/screens/RadiologyWorklist.tsx` provides the real server worklist, filters, accession and patient context, stage history, identity/site/pregnancy checks, cancellation, contrast completion using the actual staff picker, final reporting, critical-finding warning, and protected report/PDF output. `src/radiology-policy.ts` centralizes tested safety decisions; generated contracts and the full bundle are saved. Each write freezes its body and idempotency key, refreshes permissions/order/version before submission, and holds uncertain answers for explicit recovery. Printing never repeats clinical writes.

Actual order-created events debounce the list without disturbing a selected draft. Imaging critical-result events match source and patient before refreshing the selected order. Runtime service views and permissions control access. English/Urdu controls, F1 instructions, role FAQs, shared native zoom and handbook screenshots ship with the screen.

## Verification

- `npm test`: **154/154 passed**. `npm run build`: passed, including TypeScript and mandatory handbook coverage (45 screens, 880 controls, 347 groups, 47 FAQ seeds, 30 workspace guides). Existing bundle-size warning remains.
- Real DEV Electron core workflow: schedule, start, complete, cancel, contrast doctor selection, final report/stamp, critical warning, rendered PDF, original PDF and printer cancellation. Lost successful schedule/report answers reused the identical key/body and produced one effect. Wrong band/missing safety decisions produced zero POSTs.
- Real events: new order refreshed only the list and preserved the draft; concurrent scheduling was refused before POST; actual imaging critical event refreshed the selected report. Cashier/doctor access refused before HTTP writes.
- Final renderer `index-CqeZKpOo.js`: read-only server filters, staff-worded EN/UR review, F1/draft focus, signed report, full-page media and both themes at 250%. Full clinical workflow used `index-DqdHUPYi.js`; subsequent changes only improved review wording. Native zoom bounds/reset and intermediate zooms were tested in the event suite.
- Evidence: `radiology-worklist-server-evidence-2026-10-27.json`, `radiology-worklist-ui-evidence-2026-10-27.json`, `radiology-contracts-review-2026-10-27.json`. Scripts are journalled, not safe to blindly rerun.

## Backend and acceptance limits

Issue **31 New**: DEV PACS is disabled; one actual auto-link returned `503 ORTHANC_UNAVAILABLE`. This is a documented optional-integration refusal, not a proven product defect. Original order was reread with no linked study. Positive study linking, viewer and linked auto-completion remain unverified; no invented study IDs or local success. Link endpoint and combined contrast/link rule are excluded from this proposal.

Issue **30 New**: original report overstated an employee/doctor ID distinction. Registration contract explicitly defines doctor_id as employee ID. Actual staff employee10 matches the catalogue doctor and the server accepted it for contrast completion. The UI uses the real staff picker. Remaining eligibility-rich lookup/documentation question is not a blocker. MCP has no report amendment tool; correction is recorded in `RADIOLOGY_FRONTEND_TRACKER_2026-10-27.md`.

No signed human journey, Urdu translation acceptance, independent editor review, real scanner/printer, actual emergency/overdue case, shared service transition or positive PACS test is claimed. No real care, contrast, exposure, money, paper or phone call occurred. Critical communications remain open and explicitly synthetic; the dedicated communication screen is next.

## Manual checks

1. Sign in with an authorized radiographer, open Imaging worklist, and use NEW synthetic doctor-created orders. Check accession, patient, flags, server modality/status filters and no-match state.
2. Schedule/start an order. Confirm wrong wristband and missing identity/site/pregnancy choices block submission. Ask two identifiers or scan the correct band; confirm site/side and applicable pregnancy decision. Test F1 from the open dialog without losing entries.
3. Complete with explicit no contrast, or synthetic contrast details and an actual staff picker doctor. Do not perform real administration. Cancel a separate order with a reason and find its retained history.
4. As an authorized radiologist, report a Completed order, review its final stamp and critical warning where applicable, then preview/save its signed report and original PDF. Printing failure/cancellation must not repeat reporting. Never claim a synthetic phone call occurred.
5. Check English/Urdu, light/dark, keyboard navigation and Settings/native zoom 100–250%. Create a separate order while a draft is open: only the worklist should refresh.
6. Leave positive PACS tests until issue31 supplies a real synthetic integration fixture. Start/sign any human review only through the portal; only the human enters the Review code.

## Owned synthetic state (not reusable after a database reset)

Run `DEMO-RADIOLOGY-1793095684419`: patient3/MRN-2026-000003; Card1500 invoice3/payment3. OPDticket1 was explicitly Deferred after testing to free its consultation slot. Orders1 XRay Reported/critical1;2 Ultrasound Cancelled;3 CT Reported/critical2;4 MRI Scheduled v2/no study;5 Ultrasound Ordered. No uncertain writes. Original keys/answers remain in ignored `artifacts/radiology-worklist-check.json` and UI journals. Never replay registrations, payments, stages, final reports, link or cleanup.
