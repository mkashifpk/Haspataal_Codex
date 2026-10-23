

<!-- haspataal-progress:start -->
## Haspataal: required progress reporting

Use this repository's Haspataal MCP connection (haspataal_project in Codex,
haspataal in other agents). At the start of every session, call my_progress and
progress_proposals for the connected implementation. Read returned review feedback.
Read overview and get_guide('connecting-your-coding-agent') for the full backend
workflow; use get_screen_bundle and get_ui_quality_brief before building each screen.

After implementing or materially updating any screen, submit propose_progress
without waiting for the developer to ask. Do this before moving to another
workspace or giving your final handoff. A workspace needs a separate proposal
for every screen with newly implemented, tested rubric items.

Use the current rubric fingerprint and item IDs from get_screen_bundle/my_progress,
the connected implementation_id, the tested commit or identifiable build, and
readable Markdown evidence: changed files, checks run and results, and limitations.
Report only items actually implemented and tested. Partial work is reportable;
leave untested items out and describe missing human review honestly. Never invent
test results, a human review, a worksheet or approval.

First check accepted claims and progress_proposals: do not resubmit unchanged work
already accepted or awaiting review. Reuse the same request_id and identical payload
when retrying a lost response; use a new request_id for changed evidence or a new build.
Verify the saved proposal with progress_proposals. In your handoff, name the proposal
IDs and say "awaiting human review on /docs -> My progress".

If submission fails, keep the exact payload and request_id in the repository without
credentials, report the blocker, and retry at the next session. Never say progress
was posted until the server confirms it. If no item is ready, explain why; do not
submit empty or invented claims merely to satisfy this rule.

Proposals earn no points. Only the human's authenticated portal review can accept
claims; agents must never approve their own proposals or nominate an implementation.
<!-- haspataal-progress:end -->
