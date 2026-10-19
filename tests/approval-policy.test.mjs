import test from "node:test";
import assert from "node:assert/strict";
import { approvalControls } from "../src/approval-policy.ts";
const pending = {
  status: "Pending",
  requester_id: 2,
  can_decide: true,
  self_decision: null,
};
test("server eligibility permits an ordinary or AP decision without a client co-signer block", () => {
  const actions = approvalControls(pending, 1, "");
  assert(actions.canApprove);
  assert(actions.showDecisions);
  assert(!actions.canReject);
});
test("solo self-decision requires the server's permission and a nonblank note", () => {
  const own = {
    ...pending,
    requester_id: 1,
    self_decision: "allowed_with_note",
  };
  assert(!approvalControls(own, 1, " ").canApprove);
  assert(approvalControls(own, 1, "Solo practice reason").canApprove);
  assert(
    !approvalControls({ ...own, can_decide: false }, 1, "A reason")
      .showDecisions,
  );
});
test("own requests can be cancelled but cannot bypass a server refusal to decide", () => {
  const own = {
    ...pending,
    requester_id: 1,
    can_decide: false,
    self_decision: "forbidden",
  };
  const actions = approvalControls(own, 1, "Withdraw request");
  assert(!actions.canApprove);
  assert(!actions.canReject);
  assert(actions.canCancel);
});
test("completed requests and whitespace-only rejection notes cannot create another decision", () => {
  assert(
    !approvalControls({ ...pending, status: "Approved" }, 1, "note").canApprove,
  );
  assert(
    !approvalControls(
      { ...pending, status: "Cancelled", requester_id: 1 },
      1,
      "note",
    ).canCancel,
  );
  assert(!approvalControls(pending, 1, " ").canReject);
  assert(approvalControls(pending, 1, "Incorrect amount").canReject);
});
