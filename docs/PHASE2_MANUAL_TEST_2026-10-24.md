# Phase 2 manual review

Implementation: Codex1. Git baseline `main` / `13b2fefe1f655b80c93ba4267b64cea7a9acdc47` plus the preserved working tree. Current build and final verification are recorded in `handoff.md`. This is a test plan, not a signed acceptance worksheet.

All 19 Phase2 screen implementations (roadmap positions12–30) are present. This does **not** mean the MCP completion gate has been met: named fresh-data review, role journeys, Urdu review and hardware acceptance are still pending. Start the Windows app with `npm start` after `npm run build`, using the existing authorized local DEV configuration. Keep all new records clearly synthetic.

## Start with one complete OPD journey

1. As the authorized receptionist/cashier, verify the actual terminal and own cash shift. Register a new synthetic patient **without a photo**, verify the amount/method and save once. Check the returned patient/MRN/slip/invoice/receipt and printed slip. Photo or outside-report upload is a separate later action; a print/upload failure must not repeat registration/payment.
2. Find that same patient and verify identity, allergies, outstanding/merge/temporary/medico-legal/death flags. Check permitted profile edits and stale-version refusal. Upload/reopen a synthetic outside report with source/date; check its Outside label and actual access permissions. Browse the published tariff and permitted documents without creating a charge.
3. Follow the new slip through Reception queue and the correct doctor's live queue. Call the patient once; check token/doctor/department, payment/approval locks and a deliberate reroute with reason. Use a separate fresh visit to test defer/reactivate/cancel paths where the server permits them.
4. As that doctor, open the consultation from the queue. Deliberately select examination consent, write the note and choose an actual ICD term. Save draft, reopen/edit with version protection, then finalize. Check a separate appended correction and both stamps. Check A4/PDF in English and Urdu, including VCO, identity, code/source and author stamp. A failed read/print must not create another note.
5. Create a fresh synthetic prescription with real catalogue choices, route, dose, frequency, duration and destination. Verify the server's actual stock/safety/refusal messages. Check printed instructions and cancel only where permitted. Never confirm a physical handover that did not occur. Pharmacy fulfilment is a later phase.
6. Create a real synthetic lab/imaging order from actual offered services. Verify identity, requisition/accession and invoice references. Test your own unsampled lab cancellation. Positive sample processing, published/partial/critical reports and PACS require the authorized diagnostic roles and actual upstream data; missing reports must never be replaced by invented results. Lab/radiology production workspaces are later phases.
7. Create an external referral with the real destination, reason, urgency, transport/summary and same-patient note link. Check the actual letter and stamps, then cancellation with reason and CANCELLED reprint. Only record receiving acknowledgement when the synthetic test explicitly simulates that handover. Quality's separate Referral register must show the same fresh record, date/status/pending filters, detail and permitted read-only actions.
8. Record the education actually demonstrated during the synthetic test, choosing topic/method/recipient. Leaflet/Video require a real active material. Reopen history; append an explanatory corrective entry preserving the original. Do not invent a certificate or document download.
9. Check the admission/waiver/completion dialogs. Admission requires the actual Active inpatient service, a reason and provisional diagnosis; its successful handover creates an Admissions request, not an allocated bed. Post-consult waiver creates a separate approval request. Complete the OPD visit only after reviewing all handovers. Use separate fresh cases so one request's lock does not contaminate another test.

## Finance and approval cases

Use separate new synthetic cases for discount ceiling, unpaid void, refund, VIP waiver, credit, denied actions and version conflicts. Follow each actual approval result into the correct reception/cashier prompt. The authenticated requester/approver/own-shift rules come from the server; do not grant extra roles just to force a pass.

For Receivables, Cashier collects/settles and never writes off. Owner/Hospital Admin uses the permitted Outstanding dues screen from their own workspace. Verify amount/reason validation, real balances, one effect on double click and original-key recovery after an uncertain reply. Do not repeat the retained fixtures below.

Never acknowledge actual cash delivery unless it happened. The synthetic ticket13/disbursement1 prompt is intentionally **undispensed**. Backend issue14 is reported Fixed; a newly generated refund event still needs independent deployed verification (historical event529 retains its original string payload).

## Community services are enabled for DEV testing

Both services are now **Active**, confirmed establishment revision4 after user-authorized setup and real service-state tests. Home-visit arrangements and programme1 are explicitly DEV software simulations, not live patient care. The normal Doctor workspace now exposes **Preventive programmes of a patient** and **Record a home visit**. Use their direct patient search; an OPD slip is not required.

Programme1 is **DEMO Phase2 immunization records 20261024**, with BCG/OPV-0 service labels explicitly marked DEV simulation. Its guideline reference is the published [National Immunization Policy2022, Federal Directorate of Immunization](https://www.epi.gov.pk/wp-content/uploads/2023/01/NationalImmunizationPolicy2022-compressed.pdf); no dose or schedule was copied into the app. Use a fresh synthetic patient/card for your human review. The three retained test enrolments are already closed; do not replay their actions.

Agent verification now includes actual Active creation/recovery/correction, programme due handoff, all three closure outcomes, live Retiring/Active transitions, existing services continuing during retirement, new-work controls disappearing, Home history during retirement, actual permission refusals, and official policy/list PDFs. These are agent results, not your signed fresh-data/role/translation/device review. Both services were returned to Active and should remain enabled for your tests.

- **Patient programmes:** with an actual offered programme and its guideline, enrol a fresh synthetic patient/card; record a listed service with actual test time/batch and the next date **from the card**, never a computed schedule. Reopen signed history and due list, follow its actual patient link, close Completed/TransferredOut/Discontinued with the required explanation. Test permitted existing work during retirement and refusal of new enrolment; preserve append-only entries. Offered-list PDF requires the appropriate management/MSDS permission.
- **Home visit:** record a completed synthetic visit, requester/relation, request/visit times, actual test address, companion, history, deliberate consent/findings, assessment/care/outcome/referral destination/follow-up. Reject future/before-request time. Reopen signed history/detail; append a separate explanatory corrective record preserving the original. Check the actual policy/arrangements notice PDF. No planned visit, invented care, dispatch or certificate is implied.

## Apply to every screen and supported role

Use F1 from fields and confirmations, visible Help, workspace guides and the detailed role FAQs; verify focus/draft retention, permission filtering and offline bundled help. Check English/Urdu and both themes at100% and250%; keyboard, Settings and new windows must share bounded100–250% zoom/reset/persistence. Native Urdu/clinical/editor review remains unsigned. Test real printer/scanner/camera refusal and recovery where available.

Use the authenticated `/docs` → **My progress** review process and its actual worksheet requirements. Record the named reviewer, build, fresh synthetic IDs, each outcome/refusal and any remaining issue. Approve only the tested claims. Proposals alone do not increase completed-screen counts.

## Retained evidence — never recreate for cleanup

- Patient18 / MRN-2026-000016 / ticket14 / queue8: visit/queue now Completed after verified original-key recovery, paid once, original Final encounter1 + correction1; Rx1/2 Cancelled; lab1 Cancelled; imaging1 Cancelled; referral1 Cancelled/unacknowledged; education1/2 retained append-only. No physical transfer, medicine, sample or home care occurred.
- Patient16 / invoice12 / AR1: due1440, paid10, written-off10, balance1420 after backend15 retest. Original write-off key/result are in `backend15-owner-retest-2026-10-23.json`. Do not settle/write off again to reproduce that checkpoint.
- Clinical evidence/proposal payloads: `codex-*-20261023-v1.json`. Proposals72–81 were accepted;82–85 (new community Active/state checks) awaited human review at the last check. The current `handoff.md` records any later proposal/status.
- Community patient18: programme1 remains offered; enrol1 TransferredOut/entry1, enrol2 Completed/entry2, enrol3 Discontinued/no entries. Homevisit1 original and2 corrective remain signed/append-only, with the original unchanged. These were software simulations only; no vaccine, actual visit/examination, care or transfer occurred. Exact originals in community evidence JSON files and handoff.
- Backend16: Low documentation mismatch in the doctor lab-cancellation worksheet, still New. Follow current own-unsampled cancellation permission/endpoint; do not describe this as a runtime cancellation failure.

Phase3 (pharmacy/diagnostics production workflows) has not been started.
