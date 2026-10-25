# Home Visit Record — 25 October 2026

Read the current full MCP bundle/schemas/quality/design/roadmap/workflow/test plan and create/register/detail/notice contracts. Regenerated TypeScript matches existing source. Home visits were configured and enabled using the developer's prior DEV-testing authorisation; arrangements explicitly state that this is software testing with no actual visits or care.

Fixed `HomeVisitRecord.tsx`: a pending/failed policy read hides cached availability, keeps new work paused and distinguishes unverified policy from inactive service. Retry restores the unsent draft. Opening a different visit clears the prior detail/correction action immediately; a failed read cannot leave the old visit appearing selected. Loading history/detail hides stale details and never asserts an empty record on failure. Bilingual policy/detail recovery guidance updated.

Fresh normal Doctor UI, verified current synthetic patient5:

- Home1 and separate corrective home2: deliberate unselected consent/time/outcome, VCO-only examination, consent-clear confirmation/cancel, missing referral destination/consent/future/before-request checks, cancelled final confirmation all caused zero POST.
- Rapid submission confirmed once; a real lost201 used identical original key/body and SAME visit ID. Original record/stamp deep-equal after correction2; no PATCH/delete.
- Real register/detail/cursor/empty/history, F1/draft/focus, Active official notice preview and saved PDF verified. Final native zoom bounds100/250/reset and EN/UR Light/highcontrast250/no overflow; refreshed full-page images visually inspected.
- Actual failed policy/detail/list reads reproduced baseline stale information. Final retry checks restore draft/requested record with zero clinical writes.
- Real establishment.changed transitions Active→Retiring→Retired→Active, no fabricated capability replies. Inactive new/corrective actions absent; server409 CAPABILITY_INACTIVE; history persists and official inactive notice PDF remains readable. Both services finally Active at revision9. Retired change8 lost its MCP tool response; GET state/history reconciled the original result without repeating it.
- Actual API403, unknown-patient REFERENCE_NOT_FOUND, future/before-request/non-VCO findings/missing destination/reversed dates/search-limit422, missing-detail404 and HR patient-search403 checked. Cashier may read public policy but has no home-record menu; native guards refuse register/detail. Quality without record permission reads both new records through the actual register.

Build/help/TypeScript/Vite PASS (30screens,558controls,181groups);77 unitPASS after Home changes. Final BtG-9zaw; positive create/correction Ctr8WjAI and states DbbxBnM0. Existing large-bundle warning. All test profiles restored/signed out, no unknown business write or running command. No real visit, physical consent/examination/care/transfer or printer acceptance claimed.

Evidence: dated phase2-home-evidence/refusals/service-gates JSON and guarded scripts. Original ignored transport journals retain write keys/bodies. Never rerun confirmed visits to inspect them.

Backend/MCP issue **20 New** reports intermittent sandbox transport closures after committed writes, with reconciliation receipts and no guessed root cause. This is separate from the working terminal workflows and the frontend state defects fixed here. Issue19 remains Fixed/retested.

Full q:tested remains unclaimed: not every documented missing-patient error variant or never-run hidden/setup daily UI state was freshly demonstrated. Human fresh-data/translation/roleFAQ/editor/physical reviews and independent access-log audit remain pending. Do not duplicate accepted endpoints/consent/correction/help claims.
