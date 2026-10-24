# Phase 2 review checkpoint — 24 October 2026

Phase 2 is **Outpatient front desk and consultation**, 19 screens. All have UI implementations; this does not mean every API/event/rule or human acceptance gate is complete. The portal still reports zero fully accepted screens because partial claims and proposals do not close the full screen checklist. Only the human portal review awards progress.

Current source: `fe68bd3`, renderer `index-C6mdBa9P.js`. Build/help coverage and 74 unit tests passed. Final six-role readonly navigation:76visits/28authenticated screen IDs, zero errors/5xx/businesswrites; preferences restored and signedout for all6. Real DEV tests use synthetic records only. The earlier pre-reset evidence is historical; do not reuse its record IDs.

## Backend fixes applied and verified

- #17: names containing digits now search correctly; actual UI/API checks passed.
- #18: searching old merged MRN `MRN-2026-000006` finds master11/current `MRN-2026-000007` once. UI explains the old identifier match in English/Urdu. Never repeat merge10→11.
- #14: fresh refund/approval/cash-back software workflow passed.
- #15: Owner can open dues; Cashier can settle but sees no write-off action. UI permission guidance corrected.
- #16: own unsampled laboratory cancellation passed. Fresh other-doctor and sampled-order refusal cases remain to be exercised.

## Screen checks and remaining review

| Screen | Latest evidence / manual focus | Still pending |
|---|---|---|
| My cash shift | Zero opening, uncertain-write recovery, count and close; use separate cash-shift worksheet | Named drawer/physical handover review |
| Patient Search | Digit names, merged identifiers/master, edit/recovery | Remaining refusal variants and named review |
| Registration + OPD slip | Optional UPMRN, duplicate guidance, same-key atomic registration/payment recovery | AR/emergency/service refusal matrix, physical slip printing |
| Queue management | Fresh Defer/Reactivate and refund workflow | Re-route reason/flag variants and full event/refusal plan |
| Refund / waiver / credit | Fresh refund approval and credit authorisation | Post-consult VIP waiver/elevated approver variants |
| Mandatory cash-back | Exact amount, blocking confirmation, original drawer net zero | Waiver-refund variant and physical review |
| Outstanding dues | Cashier permission fix, separate Card AR collection, invoice/F1 read | Positive Owner write-off with active debt, full refusal matrix |
| Patient document vault | Consent/Skip/reselect fix, separate photo and outside report, original photo download | Camera hardware; remaining upload/error/retry matrix |
| Tariff | Role navigation/read smoke | Fresh role-specific review of displayed services/prices |
| Doctor queue | Actual arrival/call into consultation | Reasoned re-route and remaining event variants |
| ICD picker | Real catalogue/code-only storage, diagnosis title readback | Full current catalogue/version/refusal plan and human terminology review |
| Consultation | Final coded NotExamined note, consent deliberately chosen | Clinic-required refusal/VCO/Declined variants, procedure gates and outstanding event checks |
| E-prescription | Linked encounter, complete OPD directions, empty handover blocked | Actual handover, remaining safety/service/refusal branches and physical print |
| Lab & imaging | Own unsampled CBC order/cancellation | Sampled/other-doctor refusals, imaging and remaining event/service branches |
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

110–114 accepted. New115 Receivables,116 Cash-back,117 Documents,118 Education and119 Referral are **awaiting human review on /docs -> My progress**, together with109 Cash shift. Only tested new items were proposed; full-plan and human gates were not claimed. Check live feedback before any further proposal.
