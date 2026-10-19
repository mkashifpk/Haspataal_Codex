import { tr } from "../i18n";
import { useState } from "react";
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
  const r = useLoad(
    () => approvals.listApprovals({ mine, status, limit: 100 }),
    [mine, status, revision],
  );
  const rows = r.data?.filter(
    (x) => !charity || x.approval_type === "PharmacyCharityOverride",
  );
  async function decide() {
    if (!selected || !confirm) return;
    setBusy(true);
    try {
      const d = await approvals[confirm](selected.request_id, {
        note: note || null,
      });
      setEffect(d.effect);
      setSelected(undefined);
      setConfirm(undefined);
      await r.reload();
    } catch (e) {
      setError(e);
      setConfirm(undefined);
      await r.reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>{charity ? "Charity approvals" : "Approvals"}</h1>
          <p className="muted">
            {tr("Review the request and its consequences before deciding.")}
          </p>
        </div>
      </div>
      <div className="filters">
        <label className="check">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
          />
          {tr("My requests")}
        </label>
        <select
          aria-label={tr("Approval status")}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          {["Pending", "Approved", "Rejected", "Cancelled"].map((s) => (
            <option key={s}>{s}</option>
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
              className={
                "list-row " +
                (selected?.request_id === a.request_id ? "selected" : "")
              }
              key={a.request_id}
              onClick={async () => {
                try {
                  setSelected(await approvals.getApproval(a.request_id));
                  setNote("");
                  setError(undefined);
                } catch (e) {
                  setError(e);
                }
              }}
            >
              <span className="badge">{a.approval_type}</span>
              <strong>{a.summary}</strong>
              <span>
                {a.requester_name} · {a.amount ?? "—"}
              </span>
              <small>
                {a.status === "Pending" ? "Awaiting approval" : a.status}
              </small>
            </button>
          ))}
        </div>
        {selected && (
          <section className="card">
            <h2>{selected.summary}</h2>
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
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            {selected.status === "Pending" && (
              <>
                {selected.requester_id === user.user_id && (
                  <p className="notice">
                    {tr(
                      "Self-approval is unavailable until the server exposes eligibility for its solo-practice exception (backend issue #2). You can cancel your request.",
                    )}
                  </p>
                )}
                {selected.approval_type === "APPayment" && (
                  <p className="notice">
                    {tr(
                      "Approval is unavailable pending the server’s co-signer requirement contract (backend issue #2).",
                    )}
                  </p>
                )}
                <div className="actions">
                  {selected.requester_id === user.user_id ? (
                    <button
                      disabled={!note}
                      onClick={() => setConfirm("cancel")}
                    >
                      {tr("Cancel request")}
                    </button>
                  ) : (
                    user.permissions.includes(selected.required_permission) && (
                      <>
                        <button
                          disabled={!note}
                          onClick={() => setConfirm("reject")}
                        >
                          {tr("Reject")}
                        </button>
                        <button
                          className="primary"
                          disabled={selected.approval_type === "APPayment"}
                          onClick={() => setConfirm("approve")}
                        >
                          {tr("Approve")}
                        </button>
                      </>
                    )
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
      {confirm && (
        <Modal
          title={`${confirm[0].toUpperCase() + confirm.slice(1)} this request?`}
          onClose={() => !busy && setConfirm(undefined)}
        >
          <p>{selected?.summary}</p>
          <p>{note || "No decision note."}</p>
          <p>{tr("This applies the decision on the hospital server.")}</p>
          <div className="actions">
            <button disabled={busy} onClick={() => setConfirm(undefined)}>
              {tr("Go back")}
            </button>
            <button className="primary" disabled={busy} onClick={decide}>
              {tr("Confirm")}
              {confirm}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
