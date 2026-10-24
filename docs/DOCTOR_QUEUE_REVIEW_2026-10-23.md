# Doctor's queue — implementation and review checkpoint

Scope: Phase2 position21, `doctor_queue`, one screen only. Baseline `13b2fef`; existing user/Antigravity and Receivables changes preserved. Backend14/15 deferred as requested; neither is masked or considered resolved.

## Staff task and design

During OPD a doctor, specialist, surgeon or anaesthetist verifies the next patient's identity and token, calls the patient, or hands them to another clinician with an explicit reason. The server determines calling order. Large token numbers and a text-labelled transfer marker support the token-hall design; existing shell, modal, field and error patterns remain shared. No decorative animation, guessed urgency, local token sorting or clinical alerts are added. H09 design ownership and H08 native Urdu approval remain open.

## Implemented

- `src/screens/DoctorQueue.tsx`: server-ordered live entries with patient/MRN/slip, date/token, status/payment/approval, age/gender, queued/last-called time, reroute reason and wait minutes. Values are server snapshots. Empty and failed reads do not present stale patients as current.
- Queue reads on `opd.queue.updated`, successful realtime reconnect and deliberate Refresh. No queue polling. Connection and records-only state prevent new actions.
- Separate Call patient/Call again confirmation and destination/reason re-route. Current source identity/state is re-read before either action; active real catalogue destination is checked before a transfer. Re-route permission is separate from queue permission. Inputs stay in memory.
- Single-flight buttons. Call is a repeat-effect operation: a second call announces again. Re-route is state-guarded: the old source can already be closed. Neither is automatically retried. An uncertain result locks the modal/navigation and enables read-only reconciliation with reception/receiving clinician, never a success claim or blind resubmission.
- `src/generated/doctor_queue.ts` comes from MCP; complete bundle, quality briefs, design principles and handbook source are saved under `contracts/doctor_queue*.json`. Supporting destination lookup uses the current OPD service catalogue; it offers real currently active catalogue doctors/departments only.
- Draft Urdu UI plus matching screen/control instructions, role explanations and FAQs; contextual F1, visible Help, search and existing shared keyboard/Settings zoom. The full doctor workspace FAQ remains pending with its later clinical screens; this screen does not imply whole-workspace delivery.

## Printing boundary

Final PDF inspection caught a FRONTEND shared handbook print defect: a scrolled dialog's overflow clipped the beginning (title missing). Print CSS now releases dialog overflow/height/margins; verify the whole page after scrolling rather than resetting the test to hide the defect. This is tracked here, not filed as a backend bug. Human physical-printer/dialog review remains pending. No additional complete unclaimed Help-center rubric item is ready from this supporting print fix; its previously accepted claims are not duplicated.

MCP declares **no queue print endpoint** and `prints:false` for both actions. The handbook's native Print handbook page is available. OPD slip printing remains reception's existing workflow; finalized clinical-note printing belongs to the forthcoming consultation screen. A printing failure must never repeat registration, payment, calling or transfer. Physical print and native-dialog review need the human's environment. A test-boundary cancellation and print-to-PDF rendering are not physical printer acceptance.

## Human review preparation — results intentionally blank

Use the portal's official **doctor workspace worksheet** (`/docs`, Human review with new records) and record a named reviewer, build and worksheet reference. This checklist prepares the test; it does not fill or sign results.

| Role/task | Steps to test | Human result / evidence |
|---|---|---|
| Reception → doctor | Register a NEW synthetic patient through UI, settle the slip using an authorized method, record patient/ticket/queue IDs. In a second doctor window see the patient arrive without Refresh. | Pending |
| Doctor call | Verify MRN/name/token/date, call once, check InConsultation and reception/display. Deliberately call again only when needed. Check duplicate-click protection. | Pending |
| Specialist/surgeon/anaesthetist | Repeat the permitted queue workflow with each supported role's own assigned queue; no guessed employee IDs. Confirm actual permitted navigation and separate re-route permission. | Pending |
| Transfer | Choose the intended catalogue doctor or department, tell the patient the destination, record a meaningful 3–500 character reason. Verify the receiving queue's top position and highlighted reason, and reception's handover. | Pending |
| Refusal/recovery | Pending approval, closed/stale entry, records-only service and disconnected stream must not submit a new action. Failed reads hide stale rows. Lost answers require read-only reconciliation; no automatic call/re-route replay. | Pending |
| Cancel/navigation | Cancel unsent draft; decline discard and check input retained. During unknown result check Close/Escape/navigation remain blocked. F1 from fields/dialog keeps draft and returns focus. | Pending |
| Urdu and accessibility | Native speaker reviews every label/help/clinical reason instruction. Both languages/themes at100/250%, keyboard-only workflow, long names and mixed-direction IDs; zoom bounds/reset/Settings/persistence/reopened windows. | Pending |
| Printing | Help printing/native cancel/error; actual A4 readability and permission-filtered handbook. Existing reception slip and later clinical document handovers remain separate tasks. | Pending |
| Independent editor | Reviewer other than author, complete role journey; three before/after iterations required for this busy screen by MCP D9. | Pending |

No unsupported edit, undo or delete is offered: re-route is a separate authorized action, and reception owns permitted deferral/cancellation. No clinical note is finalized here. Named human fresh-data/translation/editor/physical printing acceptance and full Phase2 completion remain pending.

## Verification journal

Final checkpoint: **implemented and ready for manual review; not a complete Phase2 or MCP acceptance gate**. Proposal **71** was saved and verified, **awaiting human review on /docs -> My progress**. Exact payload `docs/codex-doctor-queue-verified-workflow-20261023-v1.json`; 31-file/hash/phase manifest `docs/doctor-queue-final-build-2026-10-23.json`. No q:tested, human, F1/FAQ/zoom worksheet, independent editor or whole-screen completion claim. Reconnect/rapid-transfer review rules remain pending full acceptance evidence. Backend14/15 remain deferred; no new backend defect found.

- `npm run build`: PASS21screens323controls91groups33FAQseeds30workspaceguides+TypeScript/Vite. `npm test`:52PASS; last unit run preceded the final print-only CSS updates, which passed targeted native/PDF verification. Diff check passed.
- Clinical phases: NEW patient18/MRN000016/ticket14/invoice14Card1500 from UI exactly once; original queue7doctor10 call200, deliberate separate re-call200 lost aftercommit reconciled without replay; first re-route200 lost aftercommit -> NEWqueue8doctor11 at top with reason/from7. Single-flight/frozen unknown fields/Escape, F1 retained draft/focus and invalid reason/destination checks passed. Original finance fixtures untouched. Business phases are verified separately from later harness failures; those failures were retained, not claimed as full-run passes.
- Final read-only4PASS: real empty surgeon queue/reception navigation denial; both languages/themes250% usable controls; native zoom bounds/reset/Settings agreement; renderer-offline help/search/bundled image; persistent real GET reply loss gave visible errors/hidden stale rows and explicit read recovery. API access evidence saved. Read-only/print phases have ZERO business POSTs; exact shared preference values restored and sessions logged out/apps closed.
- Final print regression PASS after CSS repair: actual scrolled Help dialog, native cancellation visible on screen, full PDF retains title/start/lastFAQ/example and excludes transient diagnostics. `python scripts/verify-handbook-print.py artifacts/doctor-queue-final-handbook.pdf --report artifacts/doctor-queue-print-proof-20261023.json` PASS4pages/1image113004bytes/SHA256b94981116e6fa2e5f60cadd0de957c1ed1b07232805aa860be9eb2c695a8ae47. Final renderer `index-vvJ1GOCE.js` SHA256aab38b102e690d69c554168ba3970d723897c9e0c324c4fc8b33531c7317cebd; native physical printing and native Urdu review pending.
- Human result cells above remain intentionally **Pending**. Next screen after this review is roadmap position22 `icd_picker`; consultation follows. Do not rerun a business fixture to compensate for an absent test output. For safe regression use `node scripts/doctor-queue-check.mjs --read-only --no-capture`, or add `--print-only` for the print fix.

Results and exact synthetic state are recorded incrementally in `handoff.md`, ignored `artifacts/doctor-queue-check.json` and its immutable archives; final confirmed checks/build/proposal will be appended here after verification. Initial test failure was a harness fault-injection argument error, after registration and one call had genuinely succeeded; it did not justify another registration/payment. Test preference-value restoration excludes the backend's `updated_at` timestamp and was independently read back.

Closeout diagnostic: final native logout acknowledgement returned SESSION_CHANGED. The ORIGINAL isolated profile was reopened and verified signed out (user null; encrypted session.enc absent); see docs/doctor-queue-session-closeout-2026-10-23.json. No broad shared-account revocation or reset was performed, and unrelated/MCP sessions are not claimed absent. Raw journals retain the diagnostic. No uncertain business write remains.
