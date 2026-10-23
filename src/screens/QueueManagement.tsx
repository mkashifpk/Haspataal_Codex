import { useEffect, useState } from "react";
import * as queue from "../generated/queue_management";
import { Empty, Field, LoadState, Modal, useLoad } from "../components";
import { tr } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import { queueActions } from "../ticket-policy";
import {
  CashBackModal,
  DeskLoading,
  TicketLookup,
  TicketSummary,
  useTicketDesk,
  useTicketWrite,
  WriteFeedback,
} from "./TicketDesk";
export type DeskProps = {
  permissions: string[];
  revision: number;
  readOnly: boolean;
  timeZone?: string;
  currency?: string;
  onShift: () => void;
};
export function QueueManagement({
  permissions,
  revision,
  readOnly,
  timeZone,
  currency,
  onShift,
}: DeskProps) {
  const canQueue = permissions.includes("opd.queue.view"),
    canTicket = permissions.includes("opd.ticket.view");
  const board = useLoad(
    () => (canQueue ? queue.receptionDashboard() : Promise.resolve(undefined)),
    [revision, canQueue],
  );
  const [doctorChoice, setDoctorChoice] = useState<{id:number;label:string}>(),
    [action, setAction] = useState<"defer" | "reactivate" | "cancel">(),
    [reason, setReason] = useState("");
  const doctor = doctorChoice?.id;
  const [review, setReview] = useState<{id:number;version:number;token:number|undefined}>();
  const doctorQueue = useLoad(
    () =>
      doctor && canQueue
        ? queue.queueByDoctor(doctor)
        : Promise.resolve(undefined),
    [doctor, revision, canQueue],
  );
  const desk = useTicketDesk(revision),
    t = desk.record?.ticket;
  const history = useLoad(
    () =>
      t && canTicket
        ? queue.statusHistory(t.ticket_id)
        : Promise.resolve(undefined),
    [t?.ticket_id, revision, canTicket, t?.row_version],
  );
  const write = useTicketWrite(async () => {
    setAction(undefined);
    setReason("");
    await Promise.all([
      desk.reload(),
      board.reload(),
      doctorQueue.reload(),
      history.reload(),
    ]);
  });
  const [, clock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => clock((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const now = desk.record
    ? desk.record.clock + (performance.now() - desk.record.at)
    : NaN;
  const allowed = t ? queueActions(t, permissions, now) : undefined;
  const changedDuringReview = !!action && (!t || !review || review.id !== t.ticket_id || review.version !== t.row_version || review.token !== t.queue?.token_no);
  const doctors = new Map((board.data?.queues || []).filter(q=>q.doctor_id !== null).map(q=>[q.doctor_id!,q.doctor_name || q.queue_group]));
  if (t?.doctor_id && !doctors.has(t.doctor_id)) doctors.set(t.doctor_id,t.doctor_name || String(t.doctor_id));
  if (doctorChoice && !doctors.has(doctorChoice.id)) doctors.set(doctorChoice.id,doctorChoice.label);
  const locked = write.blocked || !!t?.cash_back_prompts.length,
    blocked = locked || desk.loading || !!desk.error || readOnly;
  const select = (id: number) => {
    if (locked) return;
    if (
      reason.trim() &&
      !window.confirm(tr("Discard the unsaved ticket reason?"))
    )
      return;
    setReason("");
    setAction(undefined);
    desk.select(id);
  };
  return (
    <div data-write-pending={write.blocked} data-unsaved={!!reason.trim()}>
      <div className="section-heading">
        <div>
          <h1>{tr("Queue management")}</h1>
          <p>
            {tr(
              "Live doctor and department queues, deferred slips and pending handovers.",
            )}
          </p>
        </div>
        <button
          data-help="queue.refresh"
          disabled={write.busy}
          onClick={() => {
            void board.reload();
            void doctorQueue.reload();
            void desk.reload();
            void history.reload();
          }}
        >
          {tr("Refresh queues")}
        </button>
      </div>
      {readOnly && (
        <p className="notice">
          {tr("Records only — new actions are unavailable for this service.")}
        </p>
      )}
      {canTicket && (
        <TicketLookup
          disabled={locked}
          onScan={(number) => {
            if (
              !reason.trim() ||
              window.confirm(tr("Discard the unsaved ticket reason?"))
            ) {
              setReason("");
              setAction(undefined);
              void desk.scan(number);
            }
          }}
        />
      )}
      <DeskLoading desk={desk} />
      <WriteFeedback
        write={write}
        onCheck={async () => {
          await desk.reload();
          await history.reload();
        }}
      />
      {desk.record && (
        <>
          <TicketSummary
            record={desk.record}
            timeZone={timeZone}
            currency={currency}
          />
          <section className="card">
            <h2>{tr("Slip actions")}</h2>
            <p>
              {tr(
                "Deferral keeps the slip and does not refund money. Reactivation keeps the original token and needs no new payment while valid.",
              )}
            </p>
            {(["defer", "reactivate", "cancel"] as const)
              .filter((k) => allowed?.[k])
              .map((k) => (
                <button
                  data-help="queue.change"
                  disabled={blocked}
                  key={k}
                  onClick={() => {
                    setReason("");
                    setReview({id:t!.ticket_id,version:t!.row_version,token:t!.queue?.token_no});
                    setAction(k);
                  }}
                >
                  {tr(
                    k === "defer"
                      ? "Defer slip"
                      : k === "reactivate"
                        ? "Reactivate slip"
                        : "Cancel unpaid slip",
                  )}
                </button>
              ))}
            {!allowed?.defer && !allowed?.reactivate && !allowed?.cancel && (
              <p>
                {tr(
                  "No queue transition is available for this status and your permissions.",
                )}
              </p>
            )}
          </section>
          {canTicket && (
            <section className="card">
              <h2>{tr("Status history")}</h2>
              <LoadState {...history} retry={history.reload} />
              {history.data?.length === 0 && (
                <Empty>{tr("No status changes recorded.")}</Empty>
              )}
              {history.data?.map((h) => (
                <article key={h.history_id}>
                  <p>
                    {tr(h.field)}: {tr(h.from_value || "Not set")} →{" "}
                    {tr(h.to_value)} · {h.changed_by_name || tr("System")}
                  </p>
                  <p>{h.reason}</p>
                  <small>
                    {timeZone
                      ? formatHospitalTime(h.changed_at, timeZone)
                      : tr("Hospital timezone unavailable")}
                  </small>
                </article>
              ))}
            </section>
          )}
          <CashBackModal
            currency={currency}
            record={desk.record}
            permissions={permissions}
            readOnly={readOnly || desk.loading || !!desk.error}
            reload={desk.reload}
            onShift={onShift}
          />
        </>
      )}
      {canQueue && (
        <>
          <LoadState {...board} retry={board.reload} />
          <section className="card">
            <h2>{tr("Live queues")}</h2>
            <Field label={tr("Doctor queue")}>
              <select
                data-help="queue.filter"
                value={doctor ?? ""}
                disabled={locked}
                onChange={(e) => setDoctorChoice(e.target.value ? {id:Number(e.target.value),label:e.target.selectedOptions[0].text} : undefined)}
              >
                <option value="">{tr("All queues")}</option>
                {[...doctors].map(([id,label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
              </select>
            </Field>
            {board.data?.queues.length === 0 && (
              <Empty>
                {tr(
                  "No active queues. Register and settle a visit to enter its queue.",
                )}
              </Empty>
            )}
            {doctor ? (
              <>
                <LoadState {...doctorQueue} retry={doctorQueue.reload} />
                {doctorQueue.data?.length === 0 && (
                  <Empty>{tr("No patients in this doctor's queue.")}</Empty>
                )}
                {doctorQueue.data?.map((q) => (
                  <article className="card" key={q.queue_id}>
                    <bdi>
                      {q.token_no} · {q.ticket_number}
                    </bdi>
                    <p>
                      {q.patient_name} · <bdi>{q.mrn}</bdi> ·{" "}
                      {tr(q.ticket_status)} · {tr(q.payment_status)} ·{" "}
                      {q.waiting_minutes} {tr("minutes waiting")}
                    </p>
                    {canTicket && (
                      <button
                        data-help="queue.open"
                        disabled={locked}
                        onClick={() => select(q.ticket_id)}
                      >
                        {tr("Open slip")}
                      </button>
                    )}
                  </article>
                ))}
              </>
            ) : (
              board.data?.queues.map((q) => (
                <section key={q.queue_group}>
                  <h3>{q.doctor_name || q.department_name || q.queue_group}</h3>
                  <p>
                    {tr("Waiting")}: {q.waiting} · {tr("In consultation")}:{" "}
                    {q.in_consultation}
                  </p>
                  {q.entries.map((e) => (
                    <article className="card" key={e.queue_id}>
                      <bdi>
                        {e.token_no} · {e.ticket_number}
                      </bdi>
                      <p>
                        {e.patient_name} · {tr(e.status)} ·{" "}
                        {tr(e.payment_status)} · {tr(e.approval_lock)}
                      </p>
                      {canTicket && (
                        <button
                          data-help="queue.open"
                          disabled={locked}
                          onClick={() => select(e.ticket_id)}
                        >
                          {tr("Open slip")}
                        </button>
                      )}
                    </article>
                  ))}
                </section>
              ))
            )}
          </section>
          {(["deferred", "awaiting_approval"] as const).map((group) => (
            <section className="card" key={group}>
              <h2>
                {tr(
                  group === "deferred" ? "Deferred slips" : "Awaiting approval",
                )}
              </h2>
              {board.data?.[group].length === 0 && (
                <Empty>{tr("No slips in this group.")}</Empty>
              )}
              {board.data?.[group].map((s) => (
                <article key={s.ticket_id}>
                  <p>
                    <bdi>{s.ticket_number}</bdi> · {s.patient_name} ·{" "}
                    {tr(s.status)} · {tr(s.payment_status)}
                  </p>
                  {canTicket && (
                    <button
                      data-help="queue.open"
                      disabled={locked}
                      onClick={() => select(s.ticket_id)}
                    >
                      {tr("Open slip")}
                    </button>
                  )}
                </article>
              ))}
            </section>
          ))}
          <section className="card">
            <h2>{tr("Cash-back waiting")}</h2>
            {board.data?.cash_back_prompts.length === 0 && (
              <Empty>{tr("No cash-back waiting.")}</Empty>
            )}
            {board.data?.cash_back_prompts.map((p) => (
              <p key={`${p.kind}:${p.id}`}>
                <bdi>
                  {p.ticket_number} · {p.amount}
                </bdi>{" "}
                {tr(p.kind)}{" "}
                {canTicket && (
                  <button
                    data-help="queue.open"
                    disabled={locked}
                    onClick={() => select(p.ticket_id)}
                  >
                    {tr("Open slip")}
                  </button>
                )}
              </p>
            ))}
          </section>
        </>
      )}
      {action && t && (
        <Modal
          title={tr(
            action === "defer"
              ? "Defer slip"
              : action === "reactivate"
                ? "Reactivate slip"
                : "Cancel unpaid slip",
          )}
          onClose={() => {
            if (write.busy) return;
            if (reason.trim() && !window.confirm(tr("Discard the unsaved ticket reason?"))) return;
            setAction(undefined);
            setReason("");
          }}
        >
          <p>
            <bdi>{t.ticket_number}</bdi> · {t.patient_name} · <bdi>{t.mrn}</bdi>
          </p>
          {changedDuringReview && <p className="error" role="alert">{tr("The slip changed while this dialog was open. Close it and review the current status before another action.")}</p>}
          {action !== "reactivate" ? (
            <Field label={tr("Reason")}>
              <textarea
                data-help="queue.change"
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          ) : (
            <p>{tr("Keep the original token; no new payment is collected.")}</p>
          )}
          <button
            data-help="queue.change"
            disabled={
              blocked ||
              changedDuringReview ||
              !allowed?.[action] ||
              (action !== "reactivate" && reason.trim().length < 3)
            }
            onClick={() => {
              if (changedDuringReview || blocked || !allowed?.[action]) return;
              write.start({
                ticketId: t.ticket_id,
                path: `/opd-tickets/${t.ticket_id}/${action}`,
                body:
                  action === "reactivate"
                    ? undefined
                    : { reason: reason.trim() },
                label: action,
                idempotent: action !== "defer",
              });
              setAction(undefined);
            }}
          >
            {tr("Confirm ticket action")}
          </button>
        </Modal>
      )}
    </div>
  );
}
