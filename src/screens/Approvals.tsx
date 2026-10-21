import { approvalControls } from "../approval-policy";
import { tr } from "../i18n";
import { useEffect, useRef, useState } from "react";
import * as approvals from "../generated/approval_queue";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
export function Approvals({
  user,
  revision,
  charity = false,
}: {
  user: any;
  revision: number;
  charity?: boolean;
}) {
  const [mine, setMine] = useState(false),
    [status, setStatus] = useState<
      "Pending" | "Approved" | "Rejected" | "Cancelled"
    >("Pending"),
    [selected, setSelected] = useState<approvals.ApprovalOut>(),
    [note, setNote] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [effect, setEffect] = useState<unknown>(),
    [confirm, setConfirm] = useState<"approve" | "reject" | "cancel">();
  const [detailBusy, setDetailBusy] = useState(false);
  const detailGeneration = useRef(0);
  const deciding = useRef(false);
  const getControls = (row: approvals.ApprovalOut) => {
    const base = approvalControls(row, user.user_id, note);
    if (!charity) return base;
    const own = row.requester_id === user.user_id;
    return {
      ...base,
      canCancel: false,
      showDecisions: base.showDecisions && !own,
      canApprove: base.canApprove && !own,
      canReject: base.canReject && !own,
    };
  };
  async function loadSelected(id: number, reset = false) {
    if (reset && busy) return;
    if (
      reset &&
      selected &&
      note.trim() &&
      !window.confirm(tr("Discard unsaved input and change section?"))
    )
      return;
    const generation = ++detailGeneration.current;
    setDetailBusy(true);
    if (reset) {
      setSelected(undefined);
      setNote("");
      setConfirm(undefined);
      setError(undefined);
    }
    try {
      const current = await approvals.getApproval(id);
      if (generation === detailGeneration.current) setSelected(current);
    } catch (cause) {
      if (generation === detailGeneration.current) {
        setSelected(undefined);
        setError(cause);
      }
    } finally {
      if (generation === detailGeneration.current) setDetailBusy(false);
    }
  }
  useEffect(() => {
    if (selected) void loadSelected(selected.request_id);
  }, [revision]);
  const r = useLoad(
    () => approvals.listApprovals({ mine, status, limit: 100 }),
    [mine, status, revision],
  );
  // The server scopes the list by the account's permissions. Do not silently
  // discard a supported welfare request by guessing an approval-type allowlist.
  const rows = r.data;
  async function decide() {
    if (!selected || !confirm || busy || deciding.current || detailBusy) return;
    const allowed = (a: approvals.ApprovalOut) => {
      const c = getControls(a);
      return confirm === "approve"
        ? c.canApprove
        : confirm === "reject"
          ? c.canReject
          : c.canCancel;
    };
    if (!allowed(selected)) return;
    deciding.current = true;
    setError(undefined);
    setBusy(true);
    try {
      const fresh = await approvals.getApproval(selected.request_id);
      if (!allowed(fresh)) {
        setSelected(fresh);
        setConfirm(undefined);
        setError(
          new Error(
            tr(
              "This request changed or you can no longer decide it. Review its current state.",
            ),
          ),
        );
        await r.reload();
        return;
      }
      const d = await approvals[confirm](selected.request_id, {
        note: note.trim() || null,
      });
      setEffect(d.effect);
      ++detailGeneration.current;
      setSelected(undefined);
      setConfirm(undefined);
      await r.reload();
    } catch (e) {
      setError(e);
      setConfirm(undefined);
      await r.reload();
      await loadSelected(selected.request_id);
    } finally {
      deciding.current = false;
      setBusy(false);
    }
  }
  const controls = selected ? getControls(selected) : null;
  return (
    <div data-unsaved={!!note.trim() && !!selected} data-write-pending={busy}>
      <div className="section-heading">
        <div>
          <h1>{tr(charity ? "Charity approvals" : "Approvals")}</h1>
          <p className="muted">
            {tr("Review the request and its consequences before deciding.")}
          </p>
        </div>
      </div>
      <div className="filters">
        <label className="check">
          <input
            data-help="approval.filter"
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
          />
          {tr("My requests")}
        </label>
        <select
          data-help="approval.filter"
          aria-label={tr("Approval status")}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          {["Pending", "Approved", "Rejected", "Cancelled"].map((s) => (
            <option key={s} value={s}>
              {tr(s)}
            </option>
          ))}
        </select>
      </div>
      <LoadState {...r} retry={r.reload} />
      <ErrorBox error={error} />
      {effect !== undefined && (
        <section className="notice" role="status">
          <h3>{tr("Decision recorded")}</h3>
          <Details value={effect} />
        </section>
      )}
      {rows?.length === 0 && (
        <Empty>
          {tr("No")}
          {status.toLowerCase()}
          {tr("requests in this queue.")}
        </Empty>
      )}
      <div className="split">
        <div>
          {rows?.map((a) => (
            <button
              data-help="approval.review"
              className={
                "list-row " +
                (selected?.request_id === a.request_id ? "selected" : "")
              }
              key={a.request_id}
              aria-label={`${tr("Request")} ${a.request_id}: ${a.summary}`}
              onClick={() => void loadSelected(a.request_id, true)}
            >
              <span className="badge">{a.approval_type}</span>
              <strong>{a.summary}</strong>
              <span>
                {a.requester_name} · {a.amount ?? "—"}
              </span>
              <small>
                #{a.request_id} ·{" "}
                {tr(a.status === "Pending" ? "Awaiting approval" : a.status)}
              </small>
            </button>
          ))}
        </div>
        {selected && (
          <section className="card">
            <h2>{selected.summary}</h2>
            {detailBusy && (
              <p role="status">{tr("Refreshing approval eligibility…")}</p>
            )}
            <p>
              {tr("Requested by")}
              {selected.requester_name}
            </p>
            <Details value={selected.payload_jsonb} />
            <Field
              label={tr("Decision note")}
              hint={tr("A note is required when rejecting or cancelling.")}
            >
              <textarea
                data-help="approval.review"
                aria-label={tr("Decision note")}
                disabled={busy || detailBusy}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            {selected.status === "Pending" && (
              <>
                {!selected.can_decide && (
                  <p className="notice">
                    {tr(
                      selected.decide_blocked === "missing_permission"
                        ? "You do not have permission to decide this request."
                        : "Awaiting another approver.",
                    )}
                  </p>
                )}
                {controls?.approveNeedsNote && (
                  <p className="notice">
                    {tr(
                      "The server allows a solo-practice self-decision. A note is required and the decision is audited.",
                    )}
                  </p>
                )}
                <div className="actions">
                  {!charity && selected.requester_id === user.user_id && (
                    <button
                      data-help="approval.decide"
                      disabled={busy || detailBusy || !controls?.canCancel}
                      onClick={() => setConfirm("cancel")}
                    >
                      {tr("Cancel request")}
                    </button>
                  )}
                  {controls?.showDecisions && (
                    <>
                      <button
                        data-help="approval.decide"
                        disabled={busy || detailBusy || !controls.canReject}
                        onClick={() => setConfirm("reject")}
                      >
                        {tr("Reject")}
                      </button>
                      <button
                        data-help="approval.decide"
                        className="primary"
                        disabled={busy || detailBusy || !controls.canApprove}
                        onClick={() => setConfirm("approve")}
                      >
                        {tr("Approve")}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
      {confirm && (
        <Modal
          title={tr(
            `${confirm[0].toUpperCase() + confirm.slice(1)} this request?`,
          )}
          onClose={() => !busy && setConfirm(undefined)}
        >
          <p>{selected?.summary}</p>
          <p>{note || "No decision note."}</p>
          <p>{tr("This applies the decision on the hospital server.")}</p>
          <div className="actions">
            <button
              data-help="approval.decide"
              disabled={busy}
              onClick={() => setConfirm(undefined)}
            >
              {tr("Go back")}
            </button>
            <button
              data-help="approval.decide"
              className="primary"
              disabled={busy}
              onClick={decide}
            >
              {tr("Confirm")} {tr(confirm[0].toUpperCase() + confirm.slice(1))}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
