# Backend fixes and UI reconciliation — 19 October 2026

Checked through the live Haspataal MCP server for implementation **1**. Server build: `2026-10-19T02:19:27.475638+00:00`; contract fingerprint: `0b5ab90e400dfbb822d3`; knowledge revision: `318d65bdd91cd873`. There are no open reports returned by `my_backend_issues` at this checkpoint.

## Report-by-report result

| Report | Backend status | Independent verification and UI impact |
| --- | --- | --- |
| #1 Public-operation generator comments | Fixed | Regenerated clients describe login, terminal identity, licence and public Settings sections as public/conditional access rather than requiring login. Refreshed the affected clients and bundles. |
| #2 Approval eligibility / co-signing | Fixed (backend confirmed the original concern in part) | Live Owner responses include `can_decide=true`; Reception's own requests include `can_decide=false` and a reason. `self_decision` is declared for the solo exception. Removed the obsolete client blocks on self/AP approval: decisions follow server eligibility; solo self-decisions require a note. Removed generated co-signer fields: the backend says these were unused, and this queue does not collect them. Large-cash separation of duties remains server-enforced. |
| #3 Incident staff selection | Fixed | Reception successfully calls `/staff/lookup?q=Ahmed&limit=5` without HR-directory permission. Incidents now uses the shared real staff picker. |
| #4 Frontend concurrency/error review | Rejected as a backend issue | The team confirmed these were frontend defects. The prior local fixes remain in place: patient request guards and edit snapshot, visible financial/terminal lookup failures, and `event_type` handling. This rejection does not mean those frontend defects were acceptable or reverted. |
| #5 Registration staff/payroll link | Fixed | Registration now uses `/staff/lookup`, supports the API's 2–80 character query and maximum 20 results, and sends the selected employee ID. The formerly disabled reception picker is enabled; no unrestricted HR response or manually typed ID is used. |
| #6 Missing-reference error details | Fixed | A refusal-only atomic registration with an invalid staff reference returned 422 `REFERENCE_NOT_FOUND`, `details.field=linked_employee_id`, request `a4b5aeedfb7842a1aaaa7d7a96bbfa5b`. A subsequent patient search was empty, confirming rollback. The UI marks the staff/service selector using the actual response field and displays all server details. |

The approval response's `can_decide` is the generic decision eligibility. Its contract explicitly warns that type-specific checks may still refuse a write, such as a large cash drop decided by its own cashier. The client does not invent a replacement rule or collect a co-signer password.

## Contract and implementation changes

- Refreshed eight saved screen bundles and generated clients: connection, login, app shell, approvals, charity approvals, incident report, registration and settings.
- `src/StaffPicker.tsx`: common staff lookup, server-bounded queries, visible failures and stale-response protection. Used by Registration and Incidents.
- `src/approval-policy.ts`, `src/screens/Approvals.tsx`: server eligibility, solo note requirement, normal AP decisions, detail refresh on realtime updates and an eligibility recheck before mutation. The generic confirmation remains in place.
- `electron/main.cjs`: unwrap the newly documented health JSON envelopes consistently with other APIs. The unauthenticated live-health check works before login.
- Updated English/Urdu help and removed obsolete issue #2/#3/#5 blocked-workflow messages. Registration's other acceptance items remain pending.

## Available tools and new API capabilities

`what_changed` identifies two newly documented API operations: `GET /staff/lookup` and `GET /health/live`. The application already used the live-health path; its formal contract now includes a typed envelope. These are REST API capabilities, not newly installed MCP tools.

There are **54 callable Haspataal MCP tools** in the current environment. `docs/mcp-tool-inventory.json` saves the names for comparison on a later visit. No previous inventory was saved, so this review cannot prove which tool names were newly introduced on this particular date.

Useful available capabilities checked in this review:

- `what_changed`: contract/schema changes and the exact screens/handbook pages to revisit.
- `get_screen_bundle`, `get_endpoint`, `generate_typescript`: used to retrieve and integrate these fixes.
- `get_settings_blueprint`: server-defined Settings tiers, sections, permission/access rules and service dependencies.
- `get_terminal_installer_blueprint`: offline Windows installer, provisioning and release requirements for the later packaging phase.
- `sandbox_call`, `my_backend_issues`: live reproduction and team responses. No tool installation or plugin change was needed.

## Verification and limits

- Build passed; the existing Vite bundle-size warning remains.
- **11 tests passed**, including regression cases for server-driven decisions, solo note requirements, own-request cancellation and completed requests.
- **32 live API checks passed**.
- `scripts/backend-fixes-check.mjs` passed in Electron: public health envelope before login; real Reception staff pickers in Incidents and Registration; requester approval hidden/cancellation permitted; eligible Owner approval enabled; rejection requires a note. Evidence: `artifacts/backend-fixes-check.json` and the `*-fixed.png` screenshots.
- No approval decisions, payments, or successful registrations were submitted during this task. The invalid-reference probes were deliberate refusal checks. Login/logout session actions were used.
- One initial Electron run encountered server connection timeouts; retry after the initial workspace load passed. One sandbox refusal probe lost its transport response; the same key/body was retried, the refusal confirmed and rollback reconciled. No uncertain write remains.
- Solo-practice and AP decision policy branches were checked by unit tests, not by changing hospital policy or executing financial decisions on shared DEV data. Physical hardware, native Urdu approval and named human acceptance remain separate requirements.
