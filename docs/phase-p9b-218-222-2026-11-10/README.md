# P9B 218–222 DEV verification

DEV build `2026-11-09T17:10:47.430848+00:00`, API fingerprint `257cc319fed31b6ed2ac`, and rubric `f5cb9ab955e1`. The journey JSON files record only requested paths, HTTP status and available request IDs. No test submitted a clinical write or used a review code. Native save dialogs were cancelled.

| Screen | Automated journey | Remaining evidence |
| --- | --- | --- |
| 218 Diagnostic correlation | Open the worklist and register, choose Lab, then filter history to NotAssessable. Validate the append request shape through MCP without submitting it. | An eligible synthetic reported examination, initial and follow-up review, latest review counted, indicator exclusion, and write recovery. |
| 219 Medication safety | Read the period measures, recalls and high-alert reference lists. Fetch the medication policy PDF. | Open a newly created synthetic recall and verify live refresh following a recall event. |
| 220 Estimate statistics | Read period measures and worklist. Fetch the pricing policy and tariff as separate files, then as one combined PDF. | Fresh upstream estimates and worklist transitions, and physical print. |
| 221 Quality surgical statistics | Read period statistics, then read Surgery and Anaesthesia open events. | Fresh upstream surgery, a populated event journey and alternate service views. |
| 222 Owner surgical statistics | Repeat the read-only workflow under the Owner workspace. | Fresh upstream surgery, a populated event journey and alternate service views. |

The native test opens F1 from a control and checks focus restoration, then exercises both languages and themes at 250%. Build and native evidence do not substitute for the named human workspace and translation reviews on the DEV portal.
