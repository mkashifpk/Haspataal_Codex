# Screen170: Complaints register

Implemented in `src/screens/ComplaintRegister.tsx`, with optional embedded follow-up/intake modes in the existing components. The original screen164 and166 modes were separately rechecked. The server's current permission/can_* flags govern writes. Required communication choices start empty; original descriptions and final decisions are never edited. Intake pending state releases only after a confirmed save. Each write retains its own body/key across lost replies. Documents are a separate native print/PDF operation, with a narrow complaint-PDF allowlist.

## Real DEV evidence

- `170-ack-ui.json`: fresh complaint5 acknowledged with named directory choices; genuine lost200/original-key replay, Progress, invalid extension422 and corrected extension.
- `170-findings-ui.json`: separate synthetic incident4 created and linked in findings, action7 for Hina's actual user_id; lost replies/original-key replays produced one effect each.
- `170-outcome-ui.json`: findings-required refusal was separately saved; outcome recorded, early closure refused without waiver, corrected synthetic waiver closed5. Action7 remains Open; original words unchanged.
- Partial branch journals accurately retain test interruptions. Complaint7 withdrawn;8 NotMaintainable;9 and10 withdrawn. Confirmed modal-save pending release and next-action enablement passed in `170-pending-regression-partial-ui.json`; only its final, incorrect Notifications selector failed. Correct heading/navigation subsequently passed in `170-events-ui.json`. No failed mutation journey was blindly rerun.
- `170-events-ui.json`: actual native complaint.updated268, eight genuinely lost GET replies, visible TERMINAL_ERROR before clearing the fault; stale record hidden, unsent draft retained/disabled, explicit Refresh recovered and reset review. Browser sent no business writes.
- `164-170-default-regression-ui.json` and `166-genuine-read-error-ui.json`: original shared component modes, F1/drafts/English/Urdu and native zoom regression passed.
- `170-preflight-ui.json`: actual server PDF save/preview and F1/modal/zoom checks passed. Its original read-error claim is superseded by the correction below.
- Real final-state negatives returned409 COMPLAINT_STATE_INVALID. No-findings outcome returned409 COMPLAINT_FINDINGS_REQUIRED. Exact sanitized request results accompany these files.

## Evidence correction and limits

The original166-final-read and170-preflight read-error checks cleared the fault during loading, before any GET reply was lost. Those specific persistent-read-failure statements were incorrect. Their other assertions, and independently verified POST lost-reply/replay evidence, remain valid. The strengthened `scripts/p9a166-read.mjs` now waits for both reply_lost and a visible ErrorBox before clearing the fault. Its rerun `166-genuine-read-error-ui.json` confirms two lost GET replies and retained draft/recovery. The actual170 updated-event run confirms eight. This explicitly corrects the read-error evidence associated with pending proposals352–355; only the materially updated q:states evidence is being submitted again.

The optional complaint.received observer timed out at15:40:50; the distinct synthetic fixture11 was created at15:40:56, after it had closed. This was orchestration timing, not evidence of a backend event defect. No received-event claim is made. Fixture11 is confirmed201 and kept for subsequent appeal testing, never recreated.

Backend58 limits the any-staff acknowledgement directory rule;59 concerns a server-generated acknowledgement for an unacknowledged withdrawal.56/57 remain open. No guessed directory, text patch or permission bypass was added. Broad all-role/full-plan/overdue/large-list claims, named human journeys, translation/editor approval and physical printer acceptance remain pending. No Review code was entered or review signed.
