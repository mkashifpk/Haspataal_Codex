# DEV Reception cash readiness — 25 October 2026

The cash-shift opening button was disabled correctly: the actual laptop's authenticated native GET /terminals/whoami returned registered=false with no cash_node. The seeded Developer PC mapping used a different MAC/loopback IP, so it did not identify this laptop after the DEV reset. Entering an opening float cannot satisfy a missing server counter assignment.

After checking the full terminal list and confirming no mapping existed for the actual native hardware identity, validated POST /admin/terminals created terminal4, label DEV Reception laptop (Codex), active, cash_node MainReception. An independent administrative GET verified it. No other terminal mapping was changed, no IP fallback configured, and no printer IDs guessed. This is persistent DEV setup for the user's laptop; leave it active for testing. Hardware identity and original write key/body/receipt are journaled in ignored artifacts/dev-reception-terminal-mapping-20261025.json; no credentials are stored there. Request0293e2283049482db8f6d7a041c7d0a6 returned201. Never repeat that confirmed create.

`node scripts/terminal-cash-readiness-check.mjs` PASS:

- Actual native terminal resolves registered=true/MainReception.
- My cash shift has no missing-counter warning; float1500 enables Open cash shift.
- The button was not clicked; no shift, payment or registration was submitted.
- Test preferences restored and account signed out.

`node --check scripts/terminal-cash-readiness-check.mjs` and `git diff --check` pass. Evidence: terminal-cash-readiness-evidence-2026-10-25.json. No application source changed; no rebuild/full regression rerun needed or claimed. The prior application build/test remains c3a7d54/DEV DgWAosqu/79tests, as recorded separately.

No frontend defect or backend contract failure was reproduced. No backend issue report or progress proposal is warranted for this setup-only correction; previously accepted/pending screen claims were not duplicated. Backend issues20/21 remained New at session start.

Manual next step: Refresh My cash shift (or navigate away/back), verify Terminal cash counter is Main reception, enter the actual DEV opening float and open the shift yourself. Open the existing unpaid OPD slip to collect its payment once and verify the returned token in the assigned doctor's queue. Do not create a duplicate registration. Printer mapping remains a separate setup task when actual printer devices are supplied.
