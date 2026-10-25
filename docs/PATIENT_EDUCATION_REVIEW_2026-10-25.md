# Patient Education — 25 October 2026

The refreshed DEV catalogue was empty. Two distinctly synthetic material metadata records were created through the MCP sandbox, then retired using their original version after the tests. They describe no usable clinical resource. No seeded/other staff material was changed. Current patient5/ticket5/FinalNotExamined encounter1 identity was verified before use. No real guidance or care is claimed.

Fixed `PatientEducation.tsx`: the material selector no longer offers cached choices while the real catalogue request is pending or failed. It keeps the selected ID visibly awaiting recheck, refuses to save a selected material until a successful catalogue read, and visibly retains an inactive selection for deliberate replacement. A read-only refresh button preserves the draft. The fresh preflight still checks actual material activity. Bilingual contextual guidance was updated.

Real Electron/DEV verification on JIGPB3tb:

- Leaflet without material refused without POST; all five methods, all three recipients, active Leaflet/Video, encounter1 and actual author stamps verified through fresh education entries1–6.
- Doubleclick/lost201 recovery used the identical key/body, returned the same education ID, and created one original. A separate corrective entry preserved the original record and stamp.
- Loading/failure/retry hides stale material choices, preserves the selected ID and refuses save; actual retirement between selection/save is refused in preflight without POST. Actual cursor/history error/retry hides stale rows and does not turn failure into an empty result.
- Doctor patient-only lookup and consultation handoff both read the new history. Manage-only Quality can read the API; its authorised workspace list excludes Doctor, so the readonly form branch was not UI-tested. Cashier has no menu and native guards refuse before HTTP; the sandbox confirms all three API403 responses.
- Actual API NOT_FOUND, REFERENCE_NOT_FOUND, missing-material and different-patient encounter refusals were verified. These were intentional invalid identifiers, never guessed successful records.
- Contextual F1 kept draft/focus. Native zoom clamped at100/250 and reset100, sharing persisted Settings state. English/Urdu Light/high-contrast layouts at250 had no document overflow; full-page synthetic handbook images visually inspected.

`npm test`:77 passed. `npm run build`:help558controls/181groups/30screens, TypeScript and Vite passed. Regenerated MCP TypeScript matches the checked-in education source exactly; refreshed bundle saved. Existing large bundle warning persists.

Evidence: `phase2-education-evidence-2026-10-25.json`, `phase2-education-refusals-2026-10-25.json`, and guarded dated scripts. Original ignored journals retain keys and bodies; durable evidence preserves writes and receipts. Do not rerun the business script after its confirmed writes. Retirement's first Playwright OPTION-disabled matcher was corrected to check the actual HTML attribute; the second owned material verified recovery. The first cashier expectation was corrected to distinguish native PERMISSION_REQUIRED from server FORBIDDEN. All profiles restored/signed out; no uncertain business write remains.

Named clinician/language/editor/role-FAQ/physical-resource review remains pending. Patient-record read logging was not independently audited. No untested human gate or unchanged accepted item is proposed. The screen has no prescribed education-specific event or material-document endpoint; no event/file/PDF success was invented.
