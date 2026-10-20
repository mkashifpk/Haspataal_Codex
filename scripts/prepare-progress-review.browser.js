(() => {
  "use strict";
  const pending = [{"id":15,"screen":"report_incident","items":["ep:GET /incident-types","ep:GET /incidents","ep:GET /staff/lookup","q:f1_help","q:handbook"],"build":"0.1.0; baseline 006c8685bfd7b4a5511a18091d77caa8893ee075 + uncommitted cash-shift step; index-KU_DNFF8.js SHA256 a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54; tested 2026-10-20"},{"id":16,"screen":"connect_server","items":["ep:GET /meta/server-info","ep:GET /terminals/whoami","q:f1_help","q:handbook","rule:0a85fe6eb5","rule:0c28f497d6","rule:7fa4f922c1"],"build":"0.1.0; baseline 006c8685bfd7b4a5511a18091d77caa8893ee075 + uncommitted cash-shift step; index-KU_DNFF8.js SHA256 a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54; tested 2026-10-20"},{"id":17,"screen":"login","items":["ep:GET /health","ep:GET /health/live","ep:GET /meta/license","ep:GET /terminals/whoami","ep:POST /auth/login","q:f1_help","q:handbook","rule:0a37b50feb","rule:343a338979","rule:d343d623a8","rule:f0462c4840","rule:f787ce1cd4"],"build":"0.1.0; baseline 006c8685bfd7b4a5511a18091d77caa8893ee075 + uncommitted cash-shift step; index-KU_DNFF8.js SHA256 a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54; tested 2026-10-20"},{"id":18,"screen":"workspace_picker","items":["ep:GET /auth/me","ep:GET /auth/workspaces","ep:GET /establishment","q:f1_help","q:handbook","rule:48d2320390","rule:7264321365","rule:ef8faf697b","rule:fdf9aa47f8"],"build":"0.1.0; baseline 006c8685bfd7b4a5511a18091d77caa8893ee075 + uncommitted cash-shift step; index-KU_DNFF8.js SHA256 a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54; tested 2026-10-20"},{"id":19,"screen":"settings","items":["ep:GET /admin/change-requests","ep:GET /admin/settings","ep:GET /settings/me","ep:GET /settings/sections","ep:PUT /settings/me","q:f1_help","q:handbook","rule:4bb773c484","rule:629688d168","rule:7d8ad20153","rule:bf70f7fbcf"],"build":"0.1.0; baseline 006c8685bfd7b4a5511a18091d77caa8893ee075 + uncommitted cash-shift step; index-KU_DNFF8.js SHA256 a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54; tested 2026-10-20"},{"id":20,"screen":"help_center","items":["ep:GET /meta/handbook","ep:GET /settings/me","q:f1_help","q:handbook","q:zoom","rule:d6cf6002f7","rule:dd1ce2ac87"],"build":"0.1.0; baseline 006c8685bfd7b4a5511a18091d77caa8893ee075 + uncommitted cash-shift step; index-KU_DNFF8.js SHA256 a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54; tested 2026-10-20"},{"id":21,"screen":"notifications","items":["ep:GET /notifications","ep:GET /notifications/unread-count","q:f1_help","q:handbook"],"build":"0.1.0; baseline 006c8685bfd7b4a5511a18091d77caa8893ee075 + uncommitted cash-shift step; index-KU_DNFF8.js SHA256 a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54; tested 2026-10-20"},{"id":22,"screen":"approval_queue","items":["ep:GET /approvals","ep:GET /approvals/{request_id}","q:f1_help","q:handbook","q:permissions","rule:2365195ebb","rule:44286b431d","rule:ae799475da","rule:ef377318b9"],"build":"0.1.0; baseline 006c8685bfd7b4a5511a18091d77caa8893ee075 + uncommitted cash-shift step; index-KU_DNFF8.js SHA256 a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54; tested 2026-10-20"},{"id":23,"screen":"app_shell","items":["ep:GET /meta/enums","ep:GET /meta/error-codes","ep:GET /meta/events","ep:GET /meta/settings","ep:GET /meta/workspaces","ep:POST /auth/logout","q:f1_help","q:handbook"],"build":"0.1.0; baseline 006c8685bfd7b4a5511a18091d77caa8893ee075 + uncommitted cash-shift step; index-KU_DNFF8.js SHA256 a41aef310a85841d32d71edebde6c9d02e354df3960cec2142ca0fa7e69cae54; tested 2026-10-20"}];
  const existing = document.getElementById("haspataal-review-helper");
  if (existing) { existing.scrollIntoView(); return; }
  if (!location.pathname.startsWith("/docs/") || location.protocol !== "https:") {
    alert("Open your HTTPS Haspataal docs portal, then run this bookmark there."); return;
  }
  const panel = document.createElement("aside");
  panel.id = "haspataal-review-helper";
  panel.setAttribute("aria-label", "Prepare reported progress review");
  Object.assign(panel.style, { position: "fixed", zIndex: "2147483647", right: "12px", top: "12px",
    width: "min(420px, calc(100vw - 24px))", maxHeight: "85vh", overflow: "auto", padding: "16px",
    background: "#fff", color: "#182b32", border: "2px solid #17685e", borderRadius: "10px",
    boxShadow: "0 4px 24px #0004", font: "14px/1.5 system-ui", boxSizing: "border-box" });
  function el(tag, text) { const item = document.createElement(tag); if (text) item.textContent = text; return item; }
  panel.append(el("h2", "Prepare progress review"));
  panel.append(el("p", "Select your pending proposal, choose its review form, then prepare its reported items. You make the final Accept decision in the portal."));
  const label = el("label", "Pending proposal snapshot (20-Oct-2026)");
  const select = el("select"); select.style.width = "100%";
  for (const p of pending) { const option = el("option", "#" + p.id + " — " + p.screen); option.value = String(p.id); select.append(option); }
  label.append(select); panel.append(label);
  const worksheetLabel = el("label", "Completed human-review worksheet reference");
  const worksheet = el("textarea"); worksheet.rows = 3; worksheet.style.width = "100%";
  worksheet.placeholder = "Paste the actual completed worksheet path/link and tested build.";
  worksheetLabel.append(worksheet); panel.append(worksheetLabel);
  panel.append(el("p", "A downloaded template or a worksheet with “Not recorded/Pending” facts is not completed review evidence. This helper cannot read or certify the referenced file."));
  const status = el("p", "No portal form selected."); status.setAttribute("role", "status");
  const build = el("details"); build.append(el("summary", "Proposal build"));
  const buildText = el("p"); build.append(buildText); panel.append(build);
  const buttons = el("div"); panel.append(buttons, status);
  panel.append(el("p", "Disabled/returned/accepted records, declarations, CSRF and server validation are never bypassed. Nothing is submitted automatically. Reloading removes unsaved preparation."));
  document.body.append(panel);
  let form, field, picking, lastAcceptButton;
  const proposal = () => pending.find(p => p.id === Number(select.value));
  const isDisabled = input => input.matches(":disabled");
  const rubric = value => /^(ep:|ev:|rule:|q:)/.test(value);
  function say(message) { status.textContent = message; }
  function reset() { form = field = lastAcceptButton = undefined; buildText.textContent = proposal().build; say("Choose this proposal's review form."); }
  select.addEventListener("change", reset); reset();
  function button(text, action) {
    const b = el("button", text); b.type = "button";
    Object.assign(b.style, { margin: "4px", padding: "7px" });
    b.addEventListener("click", action); buttons.append(b); return b;
  }
  function stopPick() { if (picking) document.removeEventListener("click", picking, true); picking = undefined; }
  function pick(mode) {
    stopPick();
    say(mode === "form" ? "Click an item inside the pending proposal's Accept review form." : "Click that form's Review worksheet text field.");
    picking = event => {
      if (panel.contains(event.target)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const target = event.target instanceof Element ? event.target : null;
      const selectedForm = target?.closest("form");
      if (!selectedForm) { say("That is not a native portal form. Choose a control inside the proposal's Accept box."); return; }
      if (mode === "form") {
        const boxes = [...selectedForm.querySelectorAll('input[type="checkbox"]')];
        const allowed = new Set(proposal().items);
        const matching = boxes.filter(box => allowed.has(box.value));
        if ([...allowed].some(value => !boxes.some(box => box.value === value))) {
          say("This form does not contain this proposal's full reported item list. Check the proposal number or portal layout; no controls changed."); return;
        }
        if (!matching.length || matching.every(isDisabled)) {
          say("No enabled reported items in this form. Returned/accepted forms cannot be enabled by this helper."); return;
        }
        // If the portal exposes a proposal identity, refuse a different record.
        const ids = [...selectedForm.querySelectorAll('input[type="hidden"]')].filter(input => /proposal.*id/i.test(input.name));
        if (ids.some(input => input.value !== String(proposal().id))) {
          say("This form identifies a different proposal. Choose #" + proposal().id + "."); return;
        }
        form = selectedForm; field = undefined;
        lastAcceptButton = [...form.querySelectorAll('button, input[type="submit"]')].find(input =>
          /accept/i.test(input.textContent || input.value || "") && !isDisabled(input));
        say("Review form selected for #" + proposal().id + ". Check that the portal heading matches. Select its worksheet field next.");
      } else {
        if (selectedForm !== form) { say("Choose the worksheet field inside the selected review form."); return; }
        if (!(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLInputElement && ["text", "url", "search"].includes(target.type))) {
          say("Choose the native Review worksheet text box, not a declaration or hidden control."); return;
        }
        if (isDisabled(target) || target.readOnly) { say("That field is disabled/read-only. Use the latest pending proposal."); return; }
        const labels = [...(target.labels || [])].map(label => label.textContent).join(" ");
        if (!/worksheet/i.test(labels + " " + target.name + " " + target.getAttribute("aria-label") + " " + target.placeholder)) {
          say("This control is not identified as a worksheet field. Fill it manually; no unknown field will be changed."); return;
        }
        field = target; say("Worksheet field selected. Paste your completed reference above, then Prepare.");
      }
      stopPick();
    };
    document.addEventListener("click", picking, true);
  }
  button("1. Choose review form", () => pick("form"));
  button("2. Choose worksheet field", () => form ? pick("worksheet") : say("Choose the review form first."));
  button("3. Prepare reported items", () => {
    stopPick();
    if (!form?.isConnected) { say("Select the current pending form first."); return; }
    if (!field?.isConnected || field.form !== form) { say("Choose its worksheet field first; required review evidence is not bypassed."); return; }
    if (!worksheet.value.trim()) { say("Enter your actual completed worksheet reference and tested build."); return; }
    if (isDisabled(field) || field.readOnly) { say("The worksheet field is no longer editable. Refresh the portal."); return; }
    const boxes = [...form.querySelectorAll('input[type="checkbox"]')];
    const allowed = new Set(proposal().items);
    if ([...allowed].some(value => !boxes.some(box => box.value === value))) {
      say("The form/item list changed. Reload and choose the matching pending proposal again."); return;
    }
    if (boxes.some(box => rubric(box.value) && box.checked && !allowed.has(box.value))) {
      say("This form already selects items outside this proposal. Review and clear those manually; they will not be changed."); return;
    }
    const matching = boxes.filter(box => allowed.has(box.value) && !isDisabled(box));
    if (!matching.length) { say("No enabled reported items. The helper cannot reopen a returned/accepted proposal."); return; }
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(field, worksheet.value.trim());
    field.dispatchEvent(new Event("input", { bubbles: true })); field.dispatchEvent(new Event("change", { bubbles: true }));
    for (const box of matching) {
      if (isDisabled(box)) continue;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked").set.call(box, true);
      box.dispatchEvent(new Event("input", { bubbles: true })); box.dispatchEvent(new Event("change", { bubbles: true }));
    }
    form.scrollIntoView({ block: "center" });
    if (lastAcceptButton?.isConnected && !isDisabled(lastAcceptButton)) lastAcceptButton.focus({ preventScroll: true });
    say("Prepared " + matching.length + " enabled reported items for #" + proposal().id +
      ". Review the worksheet/build and any portal declaration, then click the portal's own Accept button yourself. Nothing submitted.");
  });
  button("Close helper", () => { stopPick(); panel.remove(); });
})();
