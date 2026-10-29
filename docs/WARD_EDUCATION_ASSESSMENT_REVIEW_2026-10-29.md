# Ward screens60–61

Screen60 `patient_education_ward` is Ward health education. Screen61 `nursing_assessment` is Nursing assessment and care plan. The roadmap puts both immediately after59, with no unimplemented ordering dependency. The material setup screen is a forward data handover, not a reason to invent materials or block verbal guidance.

## Staff task and implementation

The ward nurse identifies the actual stay, records what was really explained, then assesses nutrition and reviews the nursing plan. Success is an actual author-stamped server record; opening a screen never gives guidance, orders food, requests a dietitian or provides physical care. The established terminal components, responsive layout, draft Urdu and shared zoom are used under open design/translation decisions H09/H08, not claimed as approved by the clinical owner.

`src/ward-admission.tsx` selects real rostered patients or other permitted live admissions, verifies name/MRN with age/date of birth and flags, loads admission/patient data, protects unsent context and rechecks actor/permission/service before writing. No typed patient/clinician IDs. It exposes a revision so Refresh ward patient/reconnect refreshes child history while keeping the draft. `App.tsx` gates navigation by server views and permissions. MyBeds hands over the actual selected admission; return restores that scope when it belongs to a current duty, without inventing a rostered bed.

`WardEducation.tsx` reuses the existing `PatientEducation` form with a separate ward scope and extra preflight. Existing OPD behaviour uses defaults; no unchanged claims are resubmitted. Topic/method/recipient, actual active material for Leaflet/Video, optional permitted encounter and note use generated types. No admission_id is added to EducationIn. Author-stamped history is append-only; a correction creates a separate entry referencing the original. Pagination and material filtering remain actual reads, never a fake file/player.

`NursingAssessment.tsx` reads server screening_overdue/care_plan_overdue and displays overdue text in red on the actual patient/bed card. No local first-day cutoff. Screening has optional measured weight/height, an explicitly chosen BMI suggestion and all three actual scores. Contract totals preview Low0/Medium1/High2+; Medium/High requires the real plan. Saved screenings append. Care-plan problems/goals/interventions and evaluation start from the current version; updates always send the loaded expected_version. A new plan sends null because no row_version exists, not an invented version. Review freezes identity/body; version conflicts retain input and display fresh data. Explicit read/adopt updates the version without replacing text and requires acknowledgement again. Unknown screening replies allow an explicit identical-key replay; unknown care-plan updates are read/reconciled and never automatically repeated.

Both pages have authored bilingual instructions, detailed task/recovery FAQs, ward-guide additions, task/control coverage, contextual F1 and actual screenshots. Shared100–250% keyboard/Settings zoom and both themes apply. Saved contracts, omitted schemas, current endpoint reads, generated types, quality/design/handbook outline and test plans are in contracts. Request validation accepts all three normal outgoing bodies; no ignored field is sent.

## Verification

| Screen / case | Actual result |
|---|---|
| Ward education empty history / validation | PASS fresh patient12; Leaflet without material refused locally with topic retained and no POST |
| Ward education save / lost reply | Original201 `4ba266db57964ea98bf0226eaccd9383`, reply lost once; same key/body replay201 `7abda7c4c2804c288751dfaf25311491`, replay header true |
| Ward education correction | Separate201 `b660d78921404efa9b7b5d359d0a7a71`, original remains, actual PNC author stamp, no edit/delete |
| Ward education help / layout / return | PASS F1 restores focus and unsent text, EN/UR both themes250, Ward→MyBeds→Ward retains actual admission scope |
| Nutrition | PASS blank history, actual BMI suggestion, High-risk missing plan refused locally; one actual screening plus identical-key replay; saved High risk/author stamp and one history row |
| Care-plan validation | PASS real422 from deliberately bypassed DOM maxLength for4001-character goals; inline field hint/aria-invalid and exact typed text retained. Negative call made no plan |
| Care-plan concurrency | PASS initial version1; second real Nurse terminal creates version2; primary receives actual409 VERSION_CONFLICT and keeps evaluation while displaying current goal/version; explicit read/adopt and deliberate review saves version3 |
| Unknown care-plan update | PASS server commits version4 then actual reply is lost; no Retry original request; GET reconciliation shows current fields/version, return to retained draft and close; no PUT replay |
| Permissions | Accountant education/read assessment403; Doctor nutrition/care writes403, Doctor assessment read200. Actual request IDs in permissions.json |
| Pure policy / help guard | BMI thresholds18.5/20, invalid/missing measurements, risk-plan totals, independent view/state/permission tests; negative mapping checks for assessment and ward context |

Exact nutrition/care request IDs and bodies are in `docs/ward6061/ui-evidence.json`; original full journals remain ignored in artifacts. The first Ward60 attempt failed only an overly broad test selector before any write; the original failure was preserved and the corrected run passed. No business write was repeated to repair an assertion. Tests are software-only synthetic records, not actual patient assessment, counselling, signature, medicine or money.

Final mandatory build/help/TypeScript PASS, asset `index-CIPHQupy.js`:61screens1245controls495groups69FAQseeds30workspaceguides; existing chunk-size warning. Full225/225 automated tests PASS, including two nursing policy and two new negative help-mapping checks. Final GET-only regression PASS on that build for both screens after revision propagation and Urdu-label refinements: typed topic/evaluation survive refresh, child history rereads, F1 focus and EN/UR themes250 work. The first read-only attempt invoked F1 while the identity field was still disabled during refresh and failed its focus assertion; it was preserved and the runner now waits for the field to be enabled. No product success or business effect was invented. All six actual terminal actors confirmed restored/signedout. See final-read-evidence.json and cleanup-evidence.json.

## Limits and manual review

No new backend defect was reproduced; reports41/42/43 remain New at session start. Doctor due-vitals43 stays visible and is not hidden with polling or broader recording permissions. No human Review code was entered or signed. No q:tested, full workspace completion, native translation/editor/fresh-data/device acceptance is claimed.

Follow-up on 29 October: positive Leaflet and Video journeys passed in the Nurse UI on fresh patient13/admission14. Actual education entries3/4 returned201 (`d0d5dc54bf42479eb88140db0a9ee7b6`, `0fab7461248c45ce89b290ab6c5fce4a`); both request bodies validated. The two clearly labelled synthetic materials were retired with their returned versions, and the UI confirmed they remain in history but are absent from the active selector. A separate fresh patient14/admission15 in AdmissionPending received the documented non-retryable409 ADMISSION_STATE_INVALID on a care-plan PUT (`ba6b75a9aae546d7afa72956aef48563`); GET confirmed the state (`f27bd84a41384f708662563fd3d5a0f1`), and the UI disabled assessment actions. No real education, patient care or money. Both terminal sessions restored preferences and signed out. See `docs/ward6061/pending-check-evidence.json` and its supporting intents/results.

Still pending: true first-day overdue on newly created data (requires actual elapsed time, no simulated clock), service-view transitions on shared DEV, remaining lifecycle/refusal variants, named native Urdu/editor and human fresh-data journey. The current care-plan endpoint returns current state only; the UI does not invent a version-history reader.

Fresh scenario35829f: patient12/MRN-2026-000012/ticket11/admission13, own ward12/bed44 D6061-A, Admitted. Education original/corrective entries, one High nutrition screening, care-plan version4 with software-only values. No actual care/medication/stock/payment or fabricated clearance. All IDs came from new responses; never replay fixture writes, keys or test runners after a reset or an uncertain outcome. Follow saved journals and read the server first.

Manual: create a new patient/stay/duty through the app, follow My beds into each screen, check identifiers, record factual education and a corrective entry, assess actual scores/plan and review a care-plan version. Try a conflicting second session, F1 in fields/review, Urdu/RTL and250% zoom. Human alone completes/signs the portal review.
