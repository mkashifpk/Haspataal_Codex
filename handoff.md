# Haspataal checkpoint
Last updated: 31 October 2026, Antigravity (Codex pair), Asia/Karachi.

## Active request: Server update (30 Oct 2026 commit e6df884), #50, #51, Decision 61 refactoring
Resumed from baseline commit `a9af820`. Checking and refactoring screens against backend issue fixes #50 and #51, decision 61 merged-patient rules, DEV synthetic tests 9.a-9.h, help/FAQ updates, and MCP progress proposals.

- Current status:
  - Step 1: Confirmed baseline git commit `a9af820`.
  - Step 2: Called `overview`, `what_changed`, `my_progress`, `my_backend_issues`. Verified `server_build: 2026-10-31T00:19:38.433994+00:00` matches `fixed_in` for #50 and #51.
  - Step 3: Regenerated errors via `generate_typescript(kind: "errors")`; confirmed only `EMPLOYEE_STATUS_INVALID` added. Re-read all designated contracts, endpoints, state machine, and workflows.
  - Step 4 & 5: Verified `staff_directory` and `onboarding_wizard` not yet built.
  - Step 6: `ITConsole.tsx` refactored: added real-time listener for `hr.provisioning.requested` to reload queue, preserved form body and role selections on submission failure, and integrated `CLINICAL_LICENSE_REQUIRED` error guidance.
  - Step 7: Verified `DoctorInpatients.tsx`, `MyBeds.tsx`, `VitalsFlowsheet.tsx` rely strictly on server `is_overdue` and show `vitals.due` only for own/unassigned patients.
  - Step 8: Merged patients (decision 61): refactored `ConsentsAdmissions.tsx`, `Wristbands.tsx`, `Dispense.tsx`, `DoctorInpatients.tsx`, `MyBeds.tsx`, `PendingAdmissions.tsx`, `ConsultationReroute.tsx`, `LabOnlyWalkIn.tsx` to eliminate cross-identity assertions, retain original `patient_id` on clinical records, display master demographics, reload wristbands on `patient.merged`, and format empty contact for unlinked newborns.
  - Step 9 synthetic tests on DEV:
    - 9.a: PASS (demo.hr employee 36 /status Active -> 409 EMPLOYEE_STATUS_INVALID; CNIC upload; repeat -> 409).
    - 9.b: PASS (POST .../submit -> 200 Awaiting_IT_Provisioning; status Active -> 409 with details.next_step 'POST /admin/users').
    - 9.c: PASS (Status Suspended -> 200; status Active -> 200 Awaiting_IT_Provisioning; verified in GET /admin/provisioning-queue).
    - 9.d: PASS (demo.it provisioned user 34 synth.user36 -> Active; demo.hr left_on before join date -> 422 left_on; left_on today -> 200 with user null; Suspended -> 409; Active -> 200; demo.it re-enabled user 34 -> restored).
    - 9.e: In Progress (admission 1 CodeRedActive, no doctor, vitals recorded 25 min past, schedule 15 min set; awaiting vitals.due delivery & flowsheet verification).
    - 9.f: Pending (prescribe PRN/routine dose, verify medication.due for demo.nurse).
    - 9.g: Pending (trauma profile, unpaid registration ticket, merge into male permanent patient, pay ticket, verify patient_name/mrn).
    - 9.h: Pending (Code Red female admission, arrival, newborn delivery, mother merge, verify newborn name and mobile).
  - Step 10: Pending (Update F1 help and role FAQs in `src/help.ts`).
  - Step 11: Pending (Replace outdated fixtures/snapshots).
  - Step 12: Pending (Commit changes, submit propose_progress, update handoff).

- Files involved:
  - `src/foundation-errors.ts`
  - `src/generated/errors.ts`
  - `src/screens/ConsentsAdmissions.tsx`
  - `src/screens/ConsultationReroute.tsx`
  - `src/screens/Dispense.tsx`
  - `src/screens/DoctorInpatients.tsx`
  - `src/screens/ITConsole.tsx`
  - `src/screens/LabOnlyWalkIn.tsx`
  - `src/screens/MyBeds.tsx`
  - `src/screens/PendingAdmissions.tsx`
  - `src/screens/Wristbands.tsx`
  - `src/help.ts`
  - `handoff.md`

- Next concrete step: Check `sandbox_events` for `demo.nurse` and `demo.doctor` to verify `vitals.due` delivery for Code Red admission 1, and check `GET /admissions/1/flowsheet` for `is_overdue: true` and `last_alerted_at`.
