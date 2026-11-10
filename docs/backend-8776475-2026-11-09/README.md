# DEV 8776475 verification

The starting commit was 5fc3716. The DEV build was 2026-11-09T17:10:47.430848+00:00, equal to fixed_in for reports #62–#64. Contract 257cc319fed31b6ed2ac and rubric f5cb9ab955e1. what_changed reported four catalogue additions and no API changes. The regenerated screen clients added bindings and models for the four existing operations. No existing declaration, including its generated documentation, changed or disappeared.

| Journey | Synthetic DEV API evidence | Native Electron evidence |
| --- | --- | --- |
| #62 ADR report | Nurse created one ADR. Quality's filtered list returned the matching drug ID and only ADR rows. Its report returned saved=false and its drug stock returned batches. | 62-native.json records the menu filters, selection and stock, and opening the same incident from its register row. |
| #63 Transfusion registers | Lab Tech received and discarded one unit as BagDamaged. Quality found that unit with the Discarded filter and read its chain. | 63-native.json records the Discarded and unfiltered reads and unit detail. A newly completed transfusion and its reaction/PDF were outside this run. |
| #64 Blood center registers | The ready-to-release scenario supplied a fresh donation. Quality's same-day list had donor number, age and sex without a donor name. The selected detail was returned. | 64-native.json records period selection, the five-column list, opening the matching donation and the visible logged-read notice. The independent audit-log entries were outside this run. |
| Ward supply indent | Head Nurse selected a named ward from the live matrix and created indent 1. Exact ID readback returned Pending. | ward-native.json records a distinct native synthetic indent 2 and exact automatic readback from the POST result. A real approval.resolved event was outside this run. |

The native checks used renderer index-BjfHXEUO.js and captured bilingual handbook images. The plan JSON files are the current MCP cases and acceptance rules. This run exercised the four requested selector journeys with real DEV data. Other plan cases such as a signed ADR, a full transfusion with reaction/PDF and a resolved ward approval remain unverified. More is wired to each server cursor but the synthetic result sets did not fill a page.

The inventory in id-sources.json contains the current bundle path metadata for 198 delivered screens. This is catalogue coverage. The frontend audit confirmed and corrected concrete typed/default path sources in staff ID cards and badges, ER visit charts, discharge summaries, both ward transfers, lab verification, own-medicine identification, and Ops bed actions. It disabled direct entry for opening a local-anaesthesia recovery stay while report #65 is open. The rest of the frontend ID call sites and all remaining legacy typed-ID candidates still need review. The extra audit edits are outside the four targeted progress proposals. Only sanitized synthetic IDs and request references are retained.

No human worksheet, Review code or sign-off was entered.

Final build passed handbook coverage (198 screens), TypeScript and DEV bundle. Renderer index-CR8pmPXO.js SHA-256 eaf3ca3d3c296588c474e96815f829b44cc1d315a5aff6dbb8eb21ddff51aa1e. Final npm test passed 873 of 873. The later build includes the legacy audit changes. Four native journeys ran on the identifiable earlier renderer above. Report #66 records the working Ops asset directory source omitted by the bundle.
