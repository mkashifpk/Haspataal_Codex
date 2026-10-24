# Phase 2 review checkpoint — updated 25 October 2026

Phase 2 is **Outpatient front desk and consultation**, 19 screens. All have UI implementations; this does not mean every API/event/rule or human acceptance gate is complete. The portal still reports zero fully accepted screens because partial claims and proposals do not close the full screen checklist. Only the human portal review awards progress.

Current source includes ab48870 ICD Refresh and the pending Receivables update, renderer index-D21_PzNk.js. Current build/help coverage passed; **76 unit tests passed** on the Receivables receipt core (DvSn1Yo3), before the final invoice empty-message addition. Prior six-role navigation on fe68bd3 passed76visits/28authenticated IDs, zero errors/5xx/businesswrites; all6preferences restored/signedout. New targeted consent/upload checks passed on Cd4gDgdp. Real DEV tests use synthetic records only. The earlier pre-reset evidence is historical; do not reuse its record IDs.

## Backend fixes applied and verified

- #17: names containing digits now search correctly; actual UI/API checks passed.
- #18: searching old merged MRN `MRN-2026-000006` finds master11/current `MRN-2026-000007` once. UI explains the old identifier match in English/Urdu. Never repeat merge10→11.
- #14: fresh refund/approval/cash-back software workflow passed.
- #15: Owner can open dues; Cashier can settle but sees no write-off action. UI permission guidance corrected.
- #16: fresh own-unsampled UI200, other-doctor403FORBIDDEN and sampled409LAB_ITEM_STATE_INVALID all passed; unsupported cancellation actions hidden.

## Screen checks and remaining review

| Screen | Latest evidence / manual focus | Still pending |
|---|---|---|
| My cash shift | Zero opening, uncertain-write recovery, count and close; use separate cash-shift worksheet | Named drawer/physical handover review |
| Patient Search | Digit names, merged identifiers/master, edit/recovery | Remaining refusal variants and named review |
| Registration + OPD slip | Optional UPMRN, duplicate guidance, same-key recovery; fresh AR block and explicit emergency bypass | Inactive-service and remaining refusal variants, physical slip printing |
| Queue management | Fresh Defer/Reactivate/refund; two-doctor reasoned reroute and live handover | Full expiry/forfeiture and remaining refusal plan |
| Refund / waiver / credit | Fresh refund/credit plus post-consult waiver/lost-reply recovery/Owner decision | Elevated post-clinical risk/approver variants passed (129 Accepted); original prompt2 cash-back pending correct drawer/accounting workflow, backend #19 |
| Mandatory cash-back | Both refund and waiver-refund blocking prompts/confirmations; isolated drawers net zero | Physical review and remaining denied-drawer variants |
| Outstanding dues | Cashier permission fix, separate Card AR collection, invoice/F1 read | Positive Owner partial/full write-off and lost-reply original-key recovery passed25Oct on AR3; invoice state checks passed; remaining full refusal/human matrix |
| Patient document vault | Consent/Skip/reselect fix, separate uploads/download, lost201 original-key replay/one attachment | Camera hardware and remaining type/size/date/denied-upload matrix |
| Tariff | Role navigation/read smoke; fresh categories/empty state (q:states), PDF save (q:tested), contextual F1 (q:f1_help), and bounded 100-250% zoom (q:zoom) PASS | Fresh role-specific review of displayed services/prices and named human journey |
| Doctor queue | Actual arrival/call; reason required, live top/highlighted handover and restore | Remaining reconnect/refusal variants and human workflow |
| ICD picker | Real catalogue/code-only storage, diagnosis title readback | Refresh/list invalidation, real API refusals, access, native zoom, F1/draft checks passed25Oct; 131 pending. Configured-unloaded-system UI and human terminology review remain |
| Consultation | Server-selected Clinic guidance; consent switches, Final VCO/Declined, lost201 retry, VCO PDF | Actual Clinic422 on controlled Clinic setup, procedure gates and remaining events |
| E-prescription | Linked encounter, complete OPD directions, empty handover blocked; fresh High-Alert/LASA warnings, lost201 same-key replay, standard print payload, and actual handover (POST /prescriptions/{id}/handover) PASS | Inpatient MAR generation, physical slip printing, remaining safety/service/refusal branches and human review |
| Lab & imaging | Own unsampled200; other-doctor403; sampled409; prohibited actions hidden | Imaging and remaining event/service branches |
| External referral | Lost-create replay; lost-cancel original read; fixed stale detail refresh; real PDF | Actual receiving acknowledgement; contact-list branch and remaining negative cases |
| Referral register | Read-only role navigation/filter/detail implementation | Fresh cancellation/filter review in Quality and remaining plan |
| Patient education | Linked encounter, lost201 same-key recovery, immutable corrective entry | Positive material branches, remaining denied/error cases, human staff workflow |
| Patient programmes | Patient selection/help and prior active/history workflows | Remaining service-state and enrolment refusal variants |
| Home visit record | Prior fresh create/correction plus current search fixes | Remaining real API-plan/service-state variants and human review |

Every screen also needs the named human fresh-data journey, reviewed role FAQ, Urdu wording, editor/design review, physical printing where relevant and current portal worksheet. Layout screenshots and automation do not replace those gates. Items listed as pending are verification/acceptance gaps; they are not all known missing UI features.

## Fresh records for read-only inspection

Verify the synthetic name before using any identifier. Do not recreate transactions to inspect them.

- Patient13: `DEMO-P2-CYCLE-1792854112893`, MRN000009, ticket2/OPD000002. Final note1, Rx1, cancelled requisition1. Document1 is a synthetic image marked “DEMO ONLY - NO PATIENT”; document2 is an outside report from “DEMO ONLY external facility”. Education1 has separate corrective entry2. No actual care, specimen, guidance or medicine handover occurred.
- Patient14/ticket3: synthetic1500 Cash sale fully refunded and cash-back confirmed. Owned shift8 closed expected0/declared0, account40/terminal8 inactive. Do not reopen/replay.
- Patient15/ticket4: synthetic credit1500, AR1 settled by Card/payment5. Invoice5 remains CreditAuthorized with **balance0** because AR repayment is a separate collection. Do not collect that invoice again.
- Referrals1 and2 are cancelled synthetic plans. No transfer or receiving acknowledgement occurred. Referral1 preserved the originally failing stale-UI reproduction; referral2 passed the corrected recovery test.

Original keys/receipts and failed-test limitations are in the dated evidence files named in `handoff.md`. Continue using the current MCP screen bundle/test plan before each further workflow.

## Progress review

Latest portal read25Oct: 110–130 Accepted (including129 elevated-refund risk rule and130 clinical-lockout event). **109 Cash shift and131 ICD are awaiting human review on /docs -> My progress**. Score974,163endpoints,0fully accepted screens. Receivables states/zoom proposal132 saved and verified Pending for source2144510; awaiting human review on /docs -> My progress. Full-plan and human gates remain pending; check live feedback before new proposals.

## New synthetic records from this continuation

- Patient16 DEMO-AR-EMERGENCY-1792861877963, ticket5/OPD000005: original credit approved, AR2 Card-settled; two reasoned re-routes returned it to Doctor10. Simulated VCO note3/Declined note4; no actual examination/care. Emergency-bypass ticket6 was voided, debt is clear. Never repeat these writes.
- Patient17/ticket7: final note2, waiver approval4/cash-back1500 confirmed, ends Waivered. Isolated employee43/user41/terminal9/shift9 closed PendingCollection expected0/declared0; account/terminal inactive. First harness Plan-label failure corrected by resuming original sale, no replacement payment.
- Patient13: lab requisition2 Cancelled, requisition3 sampled-refusal test; invoice10 paid800Card. Synthetic sample3 subsequently RejectedOther, requisition remains InProgress/re-run workflow; NO actual specimen/result. New outside attachment3 original-key upload recovery passed.

DEV currently has profileIIB and active services: it cannot prove Clinic-only422 or retired-service paths in that state. No shared profile/service changed and no backend response fabricated. PACS study/viewer cases need an actual linked DEV study; camera/thermal printer/cash handovers and named role/Urdu/editor reviews need the relevant human/hardware. Remaining negative API variants stay explicit. These limits are not new backend bug reports or full-plan passes.

25Oct fresh Owner write-off fixture: patient18 DEMO-AR-WRITEOFF-1792873698881/MRN000014, ticket8/invoice11, approval6/creditrequest3/AR3. Partial10 original200 lost/replayed SAME key/body once, then remaining1490 written off; cumulative1500/statusWrittenOff, queue removed/patient debt flag cleared. No cash/payment/drawer writes. Do not recreate or repeat. Original keys/results and retained harness failures in docs/receivables-owner-active-evidence-2026-10-25.json. Backend19 opening-float accounting remains New/unanswered; original patient13/ticket2 is Refunded/locked with prompt2 cash-back1500 pending, not dispensed.
