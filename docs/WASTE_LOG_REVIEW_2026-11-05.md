> Historical pre-reset evidence. Backend7429acf supersedes the examples and limitations below; see [current audit](backend-refresh-2026-11-05/AUDIT.md). Never replay old record IDs or keys.

# Hospital waste log — screen162

Implemented in the existing React/Electron app on main6cd3b4d with inherited work preserved. No commit, deployment or installer release. The Operations route follows the server's scoped handbook, permissions and runtime establishment view; the separate IPC counterpart is not claimed.

## Behavior

- Actual collection date/category/area, measured kg, optional bags, registered department/authorized ward or free location. Blank date uses server today; blank bags remain null. Category is deliberately selected; no guessed identifiers or defaults implying success.
- Optional handover known at creation: real vendor directory, consignment and disposal. Hidden handover values are excluded when unchecked. Contractor/receipt required when handover is selected; each category/area is weighed separately. No fabricated disposal success.
- Server date/category filters and bounded rows (up to5000), local area/vendor/receipt search, immutable saved detail with recorder/timestamp, server category/month totals. Local search does not recompute totals. Reversed dates clear the prior ledger rather than leaving misleading old results.
- Existing clinical-write controller freezes original actor/body/key and unresolved input/navigation. Same-key retries are bounded to backend retention; date-specific reconciliation supports backdated entries. Confirmed creation is separate from follow-up reads; no duplicate collection after a refresh failure.
- English/Urdu UI,21 authored control guides, bilingual screen instructions and6 role FAQs, contextual F1 and real handbook images. Shared zoom/theme behavior retained. Urdu and named human/editor acceptance remain pending.

## Confirmed backend gap — officially reported #53

The rule requires collection-time weighing and contractor consignment at handover. The current append-only GET/POST API accepts collection-only entries but offers no operation attaching a later handover to an existing collection. Creating another entry would double-count its weight.

Reproduction: UI saved synthetic waste1,0.25kgNonRisk on2026-11-05, without handover; independent GET shows handed_over_kg0. Endpoint reference/search exposes only collection GET/POST. Sandbox PUT /infection/waste/1 returns404NOT_FOUND, request e2932b49cdd847538845df4f9a812787; subsequent GET200 request3f445caa1593405ca09917954756f172 preserves the original row. Native bridge independently rejects unsupported routes before HTTP, as intended.

Recommended solution: an idempotent handover operation referencing existing waste IDs, with documented permission, consignment/contractor validation, conflict/partial-batch behavior, recovery and category totals. Refresh generated contracts/help after a backend fix. Until then, the app clearly warns staff to contact Operations/IT and never enter the same weight twice. The full collection/later-handover rule is not proposed as complete.

Official report #53 New/Medium confirmed by the Haspataal backend issue tool; exact payload and receipt in `docs/screen162-2026-11-05/`. Existing #52 remains a separate equipment-vendor documentation gap. This finding does not establish which coding agent authored backend behavior.

## Verification

- `npm.cmd test`:863/863pass,19suites. Three new policy cases cover runtime access, actual weight/area/category and blank-vs-zero bags, collection-only exclusion and handover requirements.
- `npm.cmd run build`: mandatory help coverage161screens/4297controls/3222groups, TypeScript and DEV production bundle passed. `npm.cmd run build:release` passed including compiled-out DEV attribution/review material. DEV delivery restore recorded separately in the manifest; no signed installer/deployment.
- Real UI: synthetic collection1 created once, actual committed response lost, original-key/body replay returned sameID. Fields/cancel/navigation held; hidden handover omitted and blank bags null. Distinct second batch2:0.5kgSharps/1bag with synthetic consignment and actual directory vendor2. These are explicitly synthetic tests, no actual waste/handover.
- Independent final read verifies both rows and category totals: NonRisk0.25kg/0handed; Sharps0.5kg/0.5handed. Zero-weight POST422VALIDATION_ERROR request8ada23ca6a6e49d1bb175e0aa5f80f49.
- `node scripts/waste-final-read.mjs` passed on finalrenderer: server totals match UI, local empty search leaves totals intact, actual EN/UR images, ledger/editor Light/DarkHighContrast250% without horizontal page overflow, contextual F1/focus/draft, cancel without a third batch.
- `node scripts/waste-access-check.mjs` passed: Reception route absent, native GET/POST PERMISSION_REQUIRED before HTTP, vendor directory allowed. Independent backend GET403 request28825369d6944ed186d755961790bff9; POST403 request8425349ff7e44914a7548a831b22aa7d. No unauthorized records saved.
- Initial journey harness stopped on an ambiguous help selector before writes; corrected after verifying zero writes. Later stopped because a probe expected backend404 through the native allowlist (correctly blocked beforeHTTP). The remaining journey resumed from saved waste1 without recreating it. A later case-sensitive test text mismatch stopped after both records were confirmed. Final independent read/access checks passed; these harness failures and original journals remain preserved, not reported as a single passing original script.
- Preferences restored and sessions signed out. No patient/payment/clinical writes. No business polling, mock backend successes, human Review codes, self-approval or physical-device claims.

## Limits and continuation

Full later-handover workflow depends on #53; no edit/delete endpoint is invented. Named human fresh-data/translation/editor review, shared keyboard bounds acceptance and full facility/role journey matrix remain pending. Existing foundation/live/station suites were not rerun for this isolated screen. Earlier results remain historical. Next roadmap position163 is `my_investigations`; fetch its current contracts and quality/handbook requirements before implementation.

Ignored exact write/transport journals live under `artifacts/screen162/` and `artifacts/screen162-*-transport.json`. Preserve waste1and2; do not rerun creation to replace missing chat output. Portable final evidence and build hashes are saved beside the backend report.
