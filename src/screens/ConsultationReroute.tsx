import { useState, useEffect } from "react";
import { api } from "../bridge";
import * as a from "../generated/consultation";
import { Field, LoadState, Modal, ErrorBox, useLoad } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
export function ConsultationReroute({
  ticket,
  user,
  locked,
  onBusy,
  onChanged,
  onRerouted,
}: {
  ticket: a.OpdTicketDetailOut;
  user: ClinicalUser;
  locked: boolean;
  onBusy: (busy: boolean) => void;
  onChanged: () => Promise<void>;
  onRerouted: () => void;
}) {
  const [open, setOpen] = useState(false),
    [target, setTarget] = useState(""),
    [reason, setReason] = useState(""),
    [review, setReview] = useState<a.RerouteIn>(),
    [error, setError] = useState<unknown>();
  const doctors = useLoad(
    () => (open ? a.opdDoctors() : Promise.resolve([])),
    [open],
  );
  const choices = new Map<string, string>();
  for (const d of doctors.data || []) {
    choices.set(
      "doctor:" + d.employee_id,
      `${d.full_name} · ${d.department_name || ""} · ${d.waiting} ${t("waiting", "منتظر")}`,
    );
    if (d.department_id && d.department_name)
      choices.set("department:" + d.department_id, d.department_name);
  }
  const write = useClinicalWrite(
    user,
    "consultation-reroute:" + ticket.ticket_id,
    async (value) => {
      if (
        value.patient_id !== ticket.patient_id ||
        value.ticket_id !== ticket.ticket_id
      )
        throw Error("Re-route response identity differs. Read current slip.");
      setOpen(false);
      setReview(undefined);
      setReason("");
      setTarget("");
      await onChanged();
      onRerouted();
    },
  );
  useEffect(() => {
    onBusy(write.blocked);
    return () => onBusy(false);
  }, [write.blocked]);
  useEffect(() => {
    setReview(undefined);
  }, [ticket.row_version, ticket.queue?.queue_id]);
  const eligible =
    ticket.queue?.status === "Active" &&
    !!ticket.queue.called_at &&
    ticket.approval_lock === "None" &&
    ["Waiting", "InConsultation"].includes(ticket.status);
  function confirm() {
    if (!review || !eligible || locked || write.blocked) return;
    const queueId = ticket.queue!.queue_id;
    write.start(
      {
        method: "POST",
        path: `/opd-queues/${queueId}/reroute`,
        body: review,
        permission: "opd.queue.reroute",
        protection: "reconcile",
        reconcilePath: `/opd-tickets/${ticket.ticket_id}`,
        label: t("Re-route / Refer", "دوسرے ڈاکٹر کو حوالہ"),
      },
      async () => {
        const fresh = await api<a.OpdTicketDetailOut>(
          "GET",
          `/opd-tickets/${ticket.ticket_id}`,
        );
        const current = await a.opdDoctors();
        const available = review.target_doctor_id
          ? current.some((d) => d.employee_id === review.target_doctor_id)
          : current.some(
              (d) => d.department_id === review.target_department_id,
            );
        if (
          fresh.patient_id !== ticket.patient_id ||
          fresh.queue?.queue_id !== queueId ||
          fresh.queue.status !== "Active" ||
          !fresh.queue.called_at ||
          fresh.approval_lock !== "None" ||
          !available
        )
          throw Error(
            t(
              "Queue or destination changed. Refresh and review; your reason is kept.",
              "قطار یا منزل بدلی۔ تازہ کر کے جائزہ لیں؛ وجہ محفوظ ہے۔",
            ),
          );
      },
    );
  }
  if (!user.permissions.includes("opd.queue.reroute")) return null;
  return (
    <>
      <button
        data-help="consultation.handover"
        disabled={locked || write.blocked || !eligible}
        onClick={() => setOpen(true)}
      >
        {t("Re-route / Refer", "دوسرے ڈاکٹر کو حوالہ")}
      </button>
      {open && (
        <Modal
          title={t("Re-route / Refer", "دوسرے ڈاکٹر کو حوالہ")}
          onClose={() => {
            if (!write.blocked) setOpen(false);
          }}
        >
          <section
            data-unsaved={!!reason || !!target}
            data-write-pending={write.blocked}
          >
            <p>
              {ticket.patient_name} · {ticket.mrn} · {ticket.ticket_number}
            </p>
            <p>
              {t(
                "The same slip goes to the top of the new queue. No new payment and no refund. This closes the consultation; unsent note changes will be discarded when you confirm.",
                "وہی پرچی نئی قطار میں سب سے اوپر جائے گی۔ نئی ادائیگی یا واپسی نہیں۔ تصدیق پر معائنہ بند اور غیر ارسال نوٹ کی تبدیلیاں ختم ہوں گی۔",
              )}
            </p>
            <fieldset disabled={locked || write.blocked}>
              <LoadState {...doctors} retry={doctors.reload} />
              <Field label={t("Doctor or department", "ڈاکٹر یا شعبہ")}>
                <select
                  data-help="consultation.handover"
                  data-field="target_doctor_id target_department_id"
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setReview(undefined);
                  }}
                >
                  <option value="">
                    {t("Choose destination", "منزل چنیں")}
                  </option>
                  {[...choices].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Reason", "وجہ")}>
                <textarea
                  data-help="consultation.handover"
                  data-field="reason"
                  maxLength={500}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReview(undefined);
                  }}
                />
              </Field>
              <button
                data-help="consultation.handover"
                disabled={!choices.has(target) || reason.trim().length < 3}
                onClick={() => {
                  setError(undefined);
                  const [kind, id] = target.split(":");
                  setReview({
                    reason: reason.trim(),
                    ...(kind === "doctor"
                      ? { target_doctor_id: Number(id) }
                      : { target_department_id: Number(id) }),
                  });
                }}
              >
                {t("Review re-route", "حوالگی کا جائزہ")}
              </button>
              {review && (
                <>
                  <p>
                    {choices.get(target)} · {review.reason}
                  </p>
                  <button data-help="consultation.handover" onClick={confirm}>
                    {t("Confirm re-route", "حوالگی کی تصدیق")}
                  </button>
                </>
              )}
            </fieldset>
            <ErrorBox error={error} />
            <ClinicalWriteFeedback
              write={write}
              onReviewed={() => {
                setReview(undefined);
                void onChanged();
              }}
            />
          </section>
        </Modal>
      )}
    </>
  );
}
