import { useEffect, useRef, useState } from "react";
import { api } from "../bridge";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { tr } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import * as queue from "../generated/doctor_queue";
import { serviceCatalog } from "../generated/registration";
import { definiteWriteRefusal } from "../write-attempt";

type Review = { kind: "call" | "reroute"; row: queue.DoctorQueueEntryOut };
export function DoctorQueue({
  permissions,
  readOnly,
  connected,
  stream,
  timeZone,
  onConsultation,
}: {
  permissions: string[];
  readOnly: boolean;
  connected: boolean;
  stream: string;
  timeZone?: string;
  onConsultation?: (ticketId:number)=>void;
}) {
  const time = (value: string) =>
    timeZone ? formatHospitalTime(value, timeZone) : value;
  const permitted = permissions.includes("opd.queue.doctor");
  const [revision, setRevision] = useState(0);
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (
          (e.type === "event" && e.event_type === "opd.queue.updated") ||
          (e.type === "stream" && e.status === "Live" && e.resync)
        )
          setRevision((n) => n + 1);
      }),
    [],
  );
  const rows = useLoad(
    () => (permitted ? queue.myQueue() : Promise.resolve([])),
    [permitted, revision],
  );
  const catalog = useLoad(
    () =>
      permitted && permissions.includes("opd.queue.reroute")
        ? serviceCatalog({ category: "OPD" })
        : Promise.resolve([]),
    [permitted, revision, permissions.includes("opd.queue.reroute")],
  );
  const [review, setReview] = useState<Review>(),
    [target, setTarget] = useState(""),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [reconciled, setReconciled] = useState(false);
  const [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [result, setResult] = useState<queue.OpdTicketDetailOut>();
  const flight = useRef(false);
  const writable = connected && stream === "Live" && !readOnly && permitted;
  const entries = !rows.loading && !rows.error ? rows.data || [] : [];
  const current = entries.find((r) => r.queue_id === review?.row.queue_id);
  const eligible = (r: queue.DoctorQueueEntryOut) =>
    r.queue_status === "Active" &&
    r.approval_lock === "None" &&
    ["Waiting", "InConsultation"].includes(r.ticket_status);
  const choices = new Map<string, string>();
  for (const s of catalog.data || [])
    if (s.is_active) {
      if (
        s.doctor_id &&
        s.doctor_name &&
        `doctor:${s.doctor_id}` !== review?.row.queue_group
      )
        choices.set(`doctor:${s.doctor_id}`, s.doctor_name);
      if (s.department_id && s.department_name)
        choices.set(`department:${s.department_id}`, s.department_name);
    }
  const close = () => {
    if (flight.current || unknown) return;
    if (
      (reason || target) &&
      !window.confirm(tr("Discard the unsent re-route?"))
    )
      return;
    setReview(undefined);
    setReason("");
    setTarget("");
    setError(undefined);
  };
  const open = (kind: Review["kind"], row: queue.DoctorQueueEntryOut) => {
    setReview({ kind, row });
    setTarget("");
    setReason("");
    setError(undefined);
    setNotice("");
    setReconciled(false);
  };
  async function submit() {
    if (flight.current || unknown || !review || !writable) return;
    if (
      review.kind === "reroute" &&
      (!choices.has(target) ||
        reason.trim().length < 3 ||
        reason.trim().length > 500)
    ) {
      setError(
        new Error(
          tr("Choose a destination and enter a reason of 3–500 characters."),
        ),
      );
      return;
    }
    flight.current = true;
    setBusy(true);
    setError(undefined);
    let sent = false;
    try {
      const fresh = await queue.myQueue();
      const r = fresh.find(
        (r) =>
          r.queue_id === review.row.queue_id &&
          r.ticket_id === review.row.ticket_id &&
          r.patient_id === review.row.patient_id,
      );
      if (
        !r ||
        !eligible(r) ||
        r.ticket_status !== review.row.ticket_status ||
        r.called_at !== review.row.called_at ||
        r.approval_lock !== review.row.approval_lock
      )
        throw new Error(
          tr(
            "The queue changed. Close and review the current queue before acting.",
          ),
        );
      if (
        review.kind === "reroute" &&
        !permissions.includes("opd.queue.reroute")
      )
        throw new Error(tr("Permission required"));
      let body: queue.RerouteIn | undefined;
      if (review.kind === "reroute") {
        const latest = await serviceCatalog({ category: "OPD" });
        const [kind, id] = target.split(":");
        if (
          !latest.some(
            (s) =>
              s.is_active &&
              (kind === "doctor"
                ? s.doctor_id === Number(id)
                : s.department_id === Number(id)),
          )
        )
          throw new Error(
            tr(
              "The destination is no longer available. Refresh and choose again.",
            ),
          );
        body = {
          ...(kind === "doctor"
            ? { target_doctor_id: Number(id) }
            : { target_department_id: Number(id) }),
          reason: reason.trim(),
        };
      }
      sent = true;
      // These are repeat-effect/state-guard writes, NOT idempotent replay operations.
      const confirmed = await api<queue.OpdTicketDetailOut>(
        "POST",
        `/opd-queues/${r.queue_id}/${review.kind}`,
        body,
      );
      setResult(confirmed);
      setNotice(
        review.kind === "call"
          ? "Patient called. Verify the patient identity before consultation."
          : "Patient re-routed. Reception and the receiving queue update automatically.",
      );
      setReview(undefined);
      setReason("");
      setTarget("");
      void rows.reload();
    } catch (e) {
      setError(e);
      if (sent && !definiteWriteRefusal(e)) {
        setUnknown(true);
        setReconciled(false);
      } else void rows.reload();
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function reconcile() {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setReconciled(false);
    try {
      await queue.myQueue();
      await rows.reload();
      setReconciled(true);
    } catch (e) {
      setError(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  if (!permitted) return <Empty>{tr("Permission required")}</Empty>;
  return (
    <div
      data-write-pending={busy || unknown}
      data-unsaved={!!reason || !!target}
    >
      <div className="section-heading">
        <div>
          <h1>{tr("My live queue")}</h1>
          <p>
            {tr(
              "Verify the token, slip and patient identity, then call the next patient.",
            )}
          </p>
        </div>
        <button
          data-help="doctorqueue.read"
          disabled={busy}
          onClick={() => void rows.reload()}
        >
          {tr("Refresh")}
        </button>
      </div>
      <p role="status">
        {tr(stream)} · {tr("Updates arrive automatically; no polling.")}
      </p>
      {!writable && (
        <p className="notice">
          {tr(
            readOnly
              ? "Records only: new queue actions are unavailable."
              : "Wait for a live connection before calling or re-routing.",
          )}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {tr(notice)}
        </p>
      )}
      {result && (
        <section className="panel">
          <strong>{result.patient_name}</strong> ·{" "}
          <bdi>
            {result.mrn} · {result.ticket_number}
          </bdi>{" "}
          · {tr(result.status)}
          {result.queue && (
            <>
              {" "}
              · {tr("Token")} <bdi>{result.queue.token_no}</bdi>
            </>
          )}
        </section>
      )}
      <LoadState {...rows} retry={rows.reload} />
      {!rows.loading && !rows.error && !entries.length && (
        <Empty>
          {tr(
            "No patients are waiting in your queue. New settled or authorized slips appear here automatically.",
          )}
        </Empty>
      )}
      <div className="doctor-token-hall">
        {entries.map((r, index) => (
          <section
            key={r.queue_id}
            className={
              r.is_rerouted
                ? "panel doctor-token rerouted"
                : "panel doctor-token"
            }
          >
            <div>
              <span className="muted">{tr("Token")}</span>
              <div className="doctor-token-number" dir="ltr">
                {r.token_no}
              </div>
              <span>{r.token_date}</span>
            </div>
            <div>
              <h2>{r.patient_name}</h2>
              <p>
                <bdi>
                  {r.mrn} · {r.ticket_number}
                </bdi>
              </p>
              <p>
                {tr("Age")} <bdi>{r.age_years ?? tr("Not recorded")}</bdi> ·{" "}
                {tr(r.gender || "unknown")}
              </p>
              <p>
                {tr(r.ticket_status)} · {tr(r.payment_status)} ·{" "}
                {tr(r.queue_status)}
              </p>
              {r.approval_lock !== "None" && (
                <p className="notice">{tr(r.approval_lock)}</p>
              )}
              {r.is_rerouted && (
                <p className="notice">
                  <strong>↪ {tr("Re-routed patient")}</strong> ·{" "}
                  {r.reroute_reason || tr("Not recorded")}
                </p>
              )}
              <p>
                {tr("Waiting minutes")} <bdi>{r.waiting_minutes}</bdi> ·{" "}
                {tr("Queued at")} <bdi>{time(r.queued_at)}</bdi>
              </p>
              {r.called_at && (
                <p>
                  {tr("Last called")} <bdi>{time(r.called_at)}</bdi>
                </p>
              )}
              {index === 0 && (
                <strong>
                  {tr(
                    r.ticket_status === "InConsultation"
                      ? "In consultation"
                      : "Next in server calling order",
                  )}
                </strong>
              )}
            </div>
            <div className="actions">
              <button
                data-help="doctorqueue.call"
                disabled={!writable || !eligible(r) || busy || unknown}
                onClick={() => open("call", r)}
              >
                {tr(r.called_at ? "Call again" : "Call patient")}
              </button>
              {permissions.includes("opd.queue.reroute") && (
                <button
                  data-help="doctorqueue.reroute"
                  disabled={!writable || !eligible(r) || busy || unknown}
                  onClick={() => open("reroute", r)}
                >
                  {tr("Re-route patient")}
                </button>
              )}
              {onConsultation && <button data-help="doctorqueue.consultation" disabled={busy||unknown} onClick={()=>onConsultation(r.ticket_id)}>{tr("Open consultation")}</button>}
            </div>
          </section>
        ))}
      </div>
      {review && (
        <Modal
          title={tr(
            review.kind === "call"
              ? "Confirm patient call"
              : "Re-route patient",
          )}
          onClose={close}
          closable={!busy && !unknown}
        >
          <p>
            <strong>{review.row.patient_name}</strong> ·{" "}
            <bdi>
              {review.row.mrn} · {review.row.ticket_number}
            </bdi>{" "}
            · {tr("Token")} <bdi>{review.row.token_no}</bdi>
          </p>
          <p>
            {tr(
              review.kind === "call"
                ? "This announces the patient. Calling again announces them again; it is never retried automatically."
                : "The patient moves to the top of the receiving queue. Explain the destination and record the clinical reason.",
            )}
          </p>
          {review.kind === "reroute" && (
            <>
              <LoadState {...catalog} retry={catalog.reload} />
              <Field label={tr("Destination")}>
                <select
                  data-help="doctorqueue.reroute"
                  value={target}
                  disabled={busy || unknown}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">{tr("Choose destination")}</option>
                  {Array.from(choices).map(([id, label]) => (
                    <option key={id} value={id}>
                      {tr(id.startsWith("doctor:") ? "Doctor" : "Department")} ·{" "}
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={tr("Re-route reason (3–500 characters)")}>
                <textarea data-field="reason"
                  data-help="doctorqueue.reroute"
                  value={reason}
                  minLength={3}
                  maxLength={500}
                  disabled={busy || unknown}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            </>
          )}
          <ErrorBox error={error} />
          {unknown && (
            <div className="notice">
              <p>
                {tr(
                  "The reply was lost. Do not repeat the action. Refresh the source queue and confirm the outcome with reception or the receiving clinician.",
                )}
              </p>
              <button
                data-help="doctorqueue.reconcile"
                disabled={busy}
                onClick={() => void reconcile()}
              >
                {tr("Re-read queue to reconcile")}
              </button>
              {reconciled && !rows.loading && !rows.error && (
                <>
                  <p>
                    {tr(
                      current
                        ? "The source entry is still visible. Check its status and last-call time; another announcement needs a deliberate new action."
                        : "The source entry is absent. Confirm the destination with reception; do not create a replacement re-route.",
                    )}
                  </p>
                  {current && (
                    <p>
                      {tr(current.ticket_status)} ·{" "}
                      {current.called_at
                        ? time(current.called_at)
                        : tr("Not recorded")}
                    </p>
                  )}
                  <button
                    data-help="doctorqueue.reconcile"
                    disabled={busy}
                    onClick={() => {
                      setUnknown(false);
                      setReview(undefined);
                      setReason("");
                      setTarget("");
                      setError(undefined);
                    }}
                  >
                    {tr("Finish reconciliation; return to queue")}
                  </button>
                </>
              )}
            </div>
          )}
          {!unknown && (
            <div className="actions">
              <button
                data-help="doctorqueue.cancel"
                disabled={busy}
                onClick={close}
              >
                {tr("Cancel")}
              </button>
              <button
                data-help="doctorqueue.confirm"
                disabled={
                  busy ||
                  !writable ||
                  rows.loading ||
                  !!rows.error ||
                  (review.kind === "reroute" &&
                    (catalog.loading || !!catalog.error))
                }
                onClick={() => void submit()}
              >
                {tr(busy ? "Working…" : "Confirm")}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
