# Phase P9A implementation

User request: build the remaining Phase P9A screens and report reproduced backend gaps. Work proceeds in roadmap order, with a tested commit and progress proposal per screen; human acceptance is separate. User confirmed all remaining screens164–193.

| Position | Screen | Current status |
|---|---|---|
|163|my_investigations|Previously implemented db216b6; proposal342 pending human review|
|164|my_complaint_investigations|Implemented/tested3ce23ae; proposal350 selected claims accepted7Nov. Non-register investigator list blocked by backend56|
|165|my_actions|Implemented/tested d209b79; proposal351 selected claims accepted7Nov. Full human/editor/translation acceptance pending|
|166|record_complaint_reception|Implemented/tested4e1df5c (base62d0ee1); proposal352 selected claims accepted7Nov. Cross-desk appeal lookup blocked by57; human gates pending|
|167|record_complaint_admissions|Implemented/tested4e1df5c (base62d0ee1); proposal353 selected claims accepted7Nov. Cross-desk appeal lookup blocked by57; human gates pending|
|168|record_complaint_er|Implemented/tested4e1df5c (base62d0ee1); proposal354 selected claims accepted7Nov. Cross-desk appeal lookup blocked by57; human gates pending|
|169|record_complaint_ward|Implemented/tested4e1df5c (base62d0ee1); proposal355 selected claims accepted7Nov. Cross-desk appeal lookup blocked by57; human gates pending|
|170|complaints_register|Implemented/tested f3b0ba4; proposal356 selected claims accepted7Nov. Backend58/59 and human gates pending|
|171|complaint_appeals|Implemented/tested3377da0; proposal361 selected claims accepted7Nov|
|172|complaint_statistics|Implemented/tested625fb79 (baseedb73e4); proposal362 selected claims accepted7Nov|
|173|complaint_statistics_owner|Implemented/tested07ed430; proposal363 selected claims accepted7Nov|
|174|incident_types|Implemented/testedc2a6d7b; proposal364 selected claims accepted7Nov|
|175|incident_register|Implemented/testedfeae856; proposal365 verified pending human review|
|176|incident_register_owner|Implemented/tested99980a7; proposal366 verified pending human review|
|177|incident_screening|Implemented/testedbcae14e; proposal367 verified pending; issue60New; remaining role/source/human gates pending|
|178|incident_statistics|Implemented/testeda7bcdfd; proposal368 verified pending; human/full breadth gates pending|
|179|incident_statistics_owner|Implemented/testedc8f08ad; proposal369 verified pending; human/full breadth gates pending|
|180|action_register|Implemented/tested4bbed64; proposal370 verified pending; issue61New; human/full breadth gates pending|
|181|qa_rounds|Implemented/tested676a9ab; proposal371 verified pending; human/full breadth gates pending|
|182|qa_rounds_owner|Implemented and tested in 3b70b76. Proposal 372 verified pending human review.|
|183|record_feedback_reception|037b90e, proposal 373 verified pending.|
|184|patient_feedback|76389bf, proposal 374 verified pending.|
|185|education_materials|cb1e4fc, proposal 375 verified pending.|
|186|home_visit_policy|f98a6e0, proposal 376 verified pending. Shared policy write untested.|
|187|home_visit_register|Implemented. DEV view hidden and verified. Interactive register and proposal pending.|
|188|preventive_programmes_setup|Implemented. Facility setup create and stop-offering tested. Proposal 377 verified pending human review.|
|189|adr_report|Implemented. ADR prefill, stock picker, save and sending lock tested. Backend report 62. Proposal 378 verified pending human review.|
|190|blood_registers|Implemented. DEV statistics, empty trace source and PDFs tested. Backend report 63. Proposal 379 verified pending human review.|
|191|blood_center_registers|Implemented. DEV return, empty donation source and PDF tested. Backend report 64. Proposal 380 verified pending human review.|
|192|obstetric_register|Implemented. DEV period reads, Draft filter and PDFs tested. Proposal 381 verified pending human review.|
|193|labour_register_columns|Implemented. Synthetic column create, append choice and retire tested. Proposal 382 verified pending human review.|

The 7 November DEV build fixed reports #56–#61. The 9 November follow-up verified Ops assignment access, four-desk tracking and a fresh cross-desk appeal, expanded staff directory and acknowledgement, withdrawal letter refusal, screening wording and the named department filter. Reports #62–#64 describe missing selector sources in the ADR, transfusion and blood-center bundles. The existing permission-checked source calls returned 200. See [the follow-up evidence](phase-p9a-2026-11-06/nov9-tracking-verification.md).

All tests use clearly synthetic DEV records with fresh request identities. No human Review code/signature is entered. Translation/editor/device and complete named human journeys stay pending; the progress portal's authenticated human owns acceptance.

The 9 November follow-up is implemented in b46a2e0. Proposals 383–388 were verified pending human review for the four tracking desks, screening prerequisites and the action-register department directory.
