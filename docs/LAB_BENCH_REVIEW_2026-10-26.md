# Scanner-first lab bench — P3 position37

Implementation checkpoint only. DEV maintenance still blocks authenticated workflow acceptance; no business record or label-printer run occurred in this session.

The scoped Lab Technician screen supports actual worklist/barcode reads, identity proof before Pending collection or receipt, separate collection/receiving, patient-specific dynamic numeric/text metrics with live preview flags, result submission for independent verification, sample rejection, linked re-runs and published-result amendments. It preserves original server priority/due/overdue/send-out information. Actual performer/verifier stamps and correction lineage remain visible. No price, invoice or cash field is rendered, including unknown-result reconciliation.

Collect/receive/initial result are state guarded: no automatic or explicit replay button. Read current lab state and compare the exact sample/item/patient and actual result IDs before a deliberate next action. Reject/re-run/correction use an original UUID/body and explicit replay only within retention. Review rechecks actor, service, permission, exact identity/state/version/metric schema before POST. A wrong wristband stops collection/receipt. EmergencyOverride needs actual emergency priority, explicit unidentifiable statement and note; it is not a mismatch bypass.

Print sample label and Save label PDF read the actual server label. The new native bridge validates sample ID, lab_label type, label printer role, barcode and server text, checks the same actor, and uses the existing mapped label renderer. Printing is separate from collection/result writes; cancellation or failure never repeats them. Registered terminals with no label printer cannot silently use the receipt printer. Physical 50mm tube-label readability and placement need a named human check.

## Verification actually completed

- Current full MCP bundle including omitted value lists/testplan/handbook/decisions/examples/schemas, generated types, endpoints, screen/workspace quality/design/handbook and laboratory recipe read live.
- MCP validate_request collection identity and rejection payloads passed; these were schema checks, not executed business calls.
- npm test117/117PASS, including six new bench/label policy tests, negative confirmation-help coverage and price-free rendering/recovery check. Numeric/text flags, required/finite values, identity proof/emergency note, rejection enum/Other note, exact state snapshot and label identity/role binding covered.
- TypeScript, native main syntax and git diff --check pass. DEV bootstrap index-DbfX0p_i.js built with existing size warning. Mandatory npm run build STOPPED at missing actual bench English screenshot; Urdu and earlier Lab-only/Charity media also pending. No gate disabled or screenshot fabricated.

English/Urdu page, control/task inventory, Lab Technician guide and shared F1/zoom integration are delivered in source. Actual F1/focus/native scanner/layout/Urdu/zoom, reconnect/event, state-guard loss, reagent/BOM, identity/payment refusal, re-run/correction, native PDF/printer and human fresh-data/translation/editor checks remain pending. No endpoint/event/full testplan/human acceptance claim is made.

## Fresh journey after maintenance

1. Create a fresh owned synthetic paid Lab-only order or authorised clinical lab order. Record actual patient/requisition/item/sample/barcode and original write keys before effects. Never use real care/money/specimens or repeat an unfinished journal. Keep terminal4 MainReception mapping unchanged.
2. Sign in as demo lab technician, use the scoped bench and actual worklist/USB scanner plus Enter. Verify patient name/MRN/age, test and sample. Check manual fallback, no-match/error, leading zeros and unsaved-draft/focus protection. Preserve server emergency/due order; show Overdue text and send-out handover. Never show prices or cash controls.
3. Verify correct versus wrong wristband, TwoIdentifiers asked statement, emergency note and routine refusal. Check LAB_PAYMENT_REQUIRED without collecting money in the lab. Pending collect/receive needs identity; separate receipt starts turnaround. Label the tube at the patient side; printer/PDF cancellation must not repeat collection.
4. Enter actual configured numeric/text values. Check reference boundaries, critical limits/text C and required/finite validation against server recorded flags. Test reagent/BOM refusal. Submit once to PendingVerification, never local publication; have an independent verifier use their separate screen.
5. Lose a real reply locally after the server handles collect/receive/initial result. No replay button: read actual state and compare result IDs. Separately test reject/re-run/correction lost replies with identical original keys/bodies. Rejection returns a real replacement barcode; amendments retain the Published original and require re-verification. Verify no duplicate stock/result/charge.
6. Check current server send-out metadata/partner result entry, old rejected sample protections, real pending/critical events/reconnect, original author stamps and signed history. A critical result is communicated/acknowledged through its authorised workflow, never inferred from this screen.
7. Check both languages/themes at250%, native zoom bounds/reset and F1 from hidden scanner/fields/dialogs without stealing input. Capture actual synthetic EN/UR media, inspect tube-label printer/PDF, run mandatory build/tests and submit only newly verified evidence. Human alone enters Review code/signs review.

Open operational blocker26 and earlier21–25/Charity/Lab-only live backlog remain in handoff. The existing hourly reminder includes the bench. Potential contract question for real retest: scan schema includes price_at_order although the technician UI must never show prices; no authenticated role payload could be inspected during maintenance, so no new backend finding is claimed or reported from that schema alone.
