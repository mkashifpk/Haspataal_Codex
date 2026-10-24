import { useEffect, type ReactNode } from "react";
import { bilingual as t, tr } from "./i18n";
import { Details, Empty, LoadState, useLoad } from "./components";
import { api } from "./bridge";
import { hasUnsavedChanges } from "./unsaved";
import { TicketLookup, useTicketDesk } from "./screens/TicketDesk";
import * as queue from "./generated/doctor_queue";
import * as patients from "./generated/patient_search";
export type ClinicalUser = {
  user_id: number;
  employee_id?: number | null;
  permissions: string[];
};
export type VisitContext = {
  ticket: queue.OpdTicketDetailOut;
  patient: patients.PatientDetailOut;
  ready: boolean;
  reload: () => Promise<void>;
};
export function mayChangeClinicalContext() {
  if (document.querySelector('[data-write-pending="true"]')) return false;
  return (
    !hasUnsavedChanges() ||
    window.confirm(
      t("Discard the unsaved clinical draft?", "غیر محفوظ طبی مسودہ چھوڑ دیں؟"),
    )
  );
}
export function ClinicalVisit({
  user,
  revision,
  initialTicket,
  children,
}: {
  user: ClinicalUser;
  revision: number;
  initialTicket?: number;
  children: (ctx: VisitContext) => ReactNode;
}) {
  const desk = useTicketDesk(revision),
    ticket = desk.record?.ticket;
  const board = useLoad(
    () =>
      user.permissions.includes("opd.queue.doctor")
        ? queue.myQueue()
        : Promise.resolve([]),
    [revision, user.permissions.includes("opd.queue.doctor")],
  );
  const profile = useLoad(
    () =>
      ticket
        ? patients.getPatient(ticket.patient_id)
        : Promise.resolve(undefined),
    [ticket?.patient_id, revision],
  );
  useEffect(() => {
    if (initialTicket) desk.select(initialTicket);
  }, [initialTicket]);
  const patient = profile.data,
    ready =
      !!ticket &&
      !!patient &&
      patient.patient_id === ticket.patient_id &&
      !desk.loading &&
      !desk.error &&
      !profile.loading &&
      !profile.error;
  const blocked = !!document.querySelector('[data-write-pending="true"]');
  return (
    <section>
      <TicketLookup
        disabled={blocked}
        onScan={(number) => {
          if (mayChangeClinicalContext()) void desk.scan(number);
        }}
      />
      <details>
        <summary data-help="clinical.context">
          {t("Choose from my live queue", "میری جاری قطار سے چنیں")}
        </summary>
        <LoadState {...board} retry={board.reload} />
        {!board.loading &&
          !board.error &&
          (board.data || []).map((r) => (
            <p key={r.queue_id}>
              <button
                data-help="clinical.context"
                disabled={blocked}
                onClick={() => {
                  if (mayChangeClinicalContext()) desk.select(r.ticket_id);
                }}
              >
                <bdi>
                  {r.token_no} · {r.patient_name} · {r.mrn} · {r.ticket_number}
                </bdi>
              </button>
            </p>
          ))}
      </details>
      <LoadState {...desk} retry={desk.reload} />
      <LoadState {...profile} retry={profile.reload} />
      {ticket && (
        <section className="card">
          <h2>
            {ticket.patient_name} · <bdi>{ticket.mrn}</bdi>
          </h2>
          <p>
            <bdi>{ticket.ticket_number}</bdi> · {tr(ticket.status)} ·{" "}
            {tr(ticket.payment_status)} ·{" "}
            {ticket.doctor_name || ticket.department_name}
          </p>
          {patient && (
            <>
              <p>
                {t("Age / date of birth", "عمر / تاریخ پیدائش")}:{" "}
                <bdi>
                  {(patient.dob || patient.age_years) ??
                    t("Not recorded", "درج نہیں")}
                </bdi>{" "}
                · {tr(patient.gender || "unknown")} ·{" "}
                {t("Blood group", "خون کا گروپ")}:{" "}
                <bdi>
                  {patient.blood_group || t("Not recorded", "درج نہیں")}
                </bdi>
              </p>
              <p>
                {t("Allergies", "الرجی")}:{" "}
                {patient.allergies || t("Not recorded", "درج نہیں")}
              </p>
              {patient.is_deceased && (
                <p role="alert">
                  {t(
                    "Deceased patient: no new orders. Late documentation must remain clearly identified.",
                    "مریض وفات پا چکا ہے: نئے احکامات نہیں۔ بعد کی دستاویز واضح شناخت کے ساتھ ہو۔",
                  )}
                </p>
              )}
              {!!patient.mlc_numbers.length && (
                <p role="alert">
                  {t("MEDICO-LEGAL", "میڈیکو لیگل")}:{" "}
                  {patient.mlc_numbers.join(", ")}
                </p>
              )}
              {patient.temp_identifier && (
                <p>
                  {t("Temporary identity", "عارضی شناخت")}:{" "}
                  {patient.temp_identifier}
                </p>
              )}
              <details>
                <summary data-help="clinical.context">
                  {t(
                    "Outstanding dues and linked identity",
                    "بقایا اور متعلقہ شناخت",
                  )}
                </summary>
                <Details value={patient.outstanding} />
                {patient.merged_profiles.map((p) => (
                  <p key={p.patient_id}>{p.mrn}</p>
                ))}
              </details>
              {patient.patient_id !== ticket.patient_id && (
                <p role="alert">
                  {t(
                    "Patient identity changed after a merge. Reconcile this draft and open the current master visit before writing.",
                    "ضم ہونے پر مریض کی شناخت بدل گئی۔ مسودہ چیک کرکے لکھنے سے پہلے اصل موجودہ پرچی کھولیں۔",
                  )}
                </p>
              )}
            </>
          )}
          {ticket.is_clinical_locked && (
            <p className="error" role="alert">
              {ticket.clinical_lock_reason ||
                t(
                  "Clinical editing is locked. Re-read the visit before continuing.",
                  "طبی ترمیم مقفل ہے۔ جاری رکھنے سے پہلے پرچی تازہ کریں۔",
                )}
            </p>
          )}
          {ticket.approval_lock !== "None" && (
            <p className="notice">
              {tr(ticket.approval_lock)} · {ticket.pending_approval?.summary}
            </p>
          )}
          {!ready && (
            <p role="status">
              {t(
                "Checking current patient context; actions are paused and your draft is retained.",
                "مریض کی موجودہ معلومات چیک ہو رہی ہیں؛ عمل رکے ہیں اور مسودہ برقرار ہے۔",
              )}
            </p>
          )}
        </section>
      )}
      {ticket && patient ? (
        <div key={ticket.ticket_id}>
          {children({
            ticket,
            patient,
            ready,
            reload: async () => {
              await Promise.all([
                desk.reload(),
                profile.reload(),
                board.reload(),
              ]);
            },
          })}
        </div>
      ) : (
        !desk.loading &&
        !desk.error &&
        !ticket && (
          <Empty>
            {t(
              "Open a slip or select a real patient from your queue.",
              "پرچی کھولیں یا اپنی قطار سے مریض چنیں۔",
            )}
          </Empty>
        )
      )}
    </section>
  );
}
