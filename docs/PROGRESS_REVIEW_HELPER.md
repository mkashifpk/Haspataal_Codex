# Prepare pending progress reviews

This user-operated helper saves repetitive checkbox/worksheet entry. The named human still makes each final Accept decision through the portal. It does not accept claims as the agent or create missing human evidence.

## Install once

1. Open `docs/install-progress-review-helper.html` in your normal browser.
2. Drag **Prepare Haspataal reviews** to the bookmarks bar. That bookmark contains the local helper; it downloads no code and stores no credentials.
3. Open your HTTPS Haspataal portal **My progress**, implementation **1 / Codex**, then run the bookmark.

## Use for the pending proposals

The snapshot taken on 20-Oct-2026 contains **#15–23**. Proposals #24–28 were already accepted and #1–14 returned. The helper never reopens a returned record or enables disabled controls.

1. In the helper, choose the proposal number matching the portal heading and open that proposal's Accept box.
2. Choose **1. Choose review form**, then click an item inside the portal's Accept form. This identifies the native form without guessing a private acceptance endpoint.
3. Choose **2. Choose worksheet field**, then click the portal's **Review worksheet** text box.
4. Paste your **completed** worksheet path/link and actual tested build into the helper. A download template, an agent audit or a record with missing human outcomes is not a completed worksheet. `docs/review-worksheet-shared (1).md` still contains Not recorded/Pending fields; this helper does not certify those facts.
5. Choose **3. Prepare reported items**. The helper selects only enabled rubric items listed in that proposal and fills the chosen worksheet field. It does not check declarations, alter hidden/CSRF fields, alter disabled controls, or submit the form.
6. Review the selected items and build, complete the portal's human declaration yourself, then click the portal's own **Accept** button. Its native/server validation remains active. Check the saved result, then continue to the next pending proposal; rerun the bookmark after a page reload.

It deliberately has no automatic Accept-all request and never reads browser cookies/tokens or sends network requests. If the portal uses a different layout, fields are disabled, the full item list is absent, or the form selects extra rubric items, it refuses preparation and leaves the decision to the native UI. Missing acceptance requirements are not bypassed.

## Files and verification

- `scripts/prepare-progress-review.browser.js`: standalone bookmarklet/browser script with pending-proposal snapshot and exact reported IDs.
- `docs/install-progress-review-helper.html`: local install/copy page.
- Based on real MCP `progress_proposals(implementation_id=1)` and guide `connecting-your-coding-agent`, section4.
- Syntax/local consistency checks only. No logged-in portal/browser tab was available to verify the live form layout; layout matching fails closed rather than guessing an acceptance API. No portal acceptance performed during creation.

The latest known build is `0.1.0`, baseline `006c8685bfd7b4a5511a18091d77caa8893ee075` plus uncommitted cash-shift changes, JS `index-KU_DNFF8.js`, SHA256 `a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54`. Enter it only if it is the build you actually reviewed. This snapshot does not automatically include future proposals or approve entire unimplemented screens.
