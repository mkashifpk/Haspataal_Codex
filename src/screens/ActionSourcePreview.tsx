import { Modal, LoadState, useLoad } from "../components";
import * as cycles from "../generated/action_register_source_cycle";
import * as incidents from "../generated/action_register_source_incident";
import type { QualityActionOut } from "../generated/action_register";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
export function ActionSourcePreview({
  action,
  timeZone,
  onClose,
}: {
  action: QualityActionOut;
  timeZone?: string;
  onClose: () => void;
}) {
  const r = useLoad(
    async () =>
      action.source === "Incident" && action.incident_id != null
        ? {
            kind: "incident" as const,
            value: await incidents.getIncident(action.incident_id),
          }
        : action.source === "RecordReview" && action.cycle_id != null
          ? {
              kind: "cycle" as const,
              value: await cycles.getCycleQualityRecordReviews(action.cycle_id),
            }
          : undefined,
    [action.source, action.incident_id, action.cycle_id],
  );
  const time = (v: string | null) =>
    v == null
      ? t("Not recorded", "درج نہیں")
      : timeZone
        ? formatHospitalTime(v, timeZone)
        : v;
  return (
    <Modal title={t("Source record", "ماخذ ریکارڈ")} onClose={onClose}>
      <p>
        {t(
          "Read-only context for this action. Completing an action does not close its source record.",
          "اس عمل کا ماخذ صرف مطالعے کے لیے۔ عمل مکمل کرنے سے ماخذ بند نہیں ہوتا۔",
        )}
      </p>
      <button data-help="acr.source" onClick={() => void r.reload()}>
        {t("Refresh source record", "ماخذ ریکارڈ تازہ کریں")}
      </button>
      <LoadState {...r} retry={r.reload} />
      {!r.loading &&
        !r.error &&
        r.data?.kind === "incident" &&
        (() => {
          const i = r.data.value;
          return (
            <article>
              <h2>
                {i.incident_number} · {i.type_name}
              </h2>
              <p>
                {t("Affected", "متاثر")}:{" "}
                {i.affected === "Patient"
                  ? (i.patient_name ??
                    t("Patient name not recorded", "مریض نام درج نہیں"))
                  : i.affected === "Staff"
                    ? (i.employee_name ??
                      t("Staff name not recorded", "عملے کا نام درج نہیں"))
                    : i.affected === "Visitor"
                      ? t("Visitor", "ملاقاتی")
                      : t("None", "کوئی نہیں")}
                {i.mrn ? " · " + i.mrn : ""}
              </p>
              <p>
                {t("Occurred", "وقوع")}: {time(i.occurred_at)} · {i.status}
              </p>
              <h3>{t("Original report", "اصل رپورٹ")}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{i.description}</p>
              <p>
                {t("Immediate action", "فوری عمل")}: {i.immediate_action}
              </p>
              <p>
                {t("Reporter", "رپورٹ کنندہ")}: {i.reported_by_name}
              </p>
              {i.report_stamp && <p>{i.report_stamp.text}</p>}
              <p>
                {t("Investigator", "تحقیق کار")}:{" "}
                {i.investigator_name ?? t("Not assigned", "مقرر نہیں")}
              </p>
              <h3>{t("Analysis and lessons", "تجزیہ اور اسباق")}</h3>
              <p>
                {i.analysis_method ?? t("Not signed", "دستخط نہیں")} ·{" "}
                {time(i.analysed_at)}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {i.root_causes ?? t("Not recorded", "درج نہیں")}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {i.lessons ?? t("Not recorded", "درج نہیں")}
              </p>
              <p>
                {i.next_step ??
                  t(
                    "No further source step recorded",
                    "ماخذ کا مزید قدم درج نہیں",
                  )}
              </p>
            </article>
          );
        })()}
      {!r.loading &&
        !r.error &&
        r.data?.kind === "cycle" &&
        (() => {
          const c = r.data.value;
          return (
            <article>
              <h2>
                {c.cycle_number} · {c.title}
              </h2>
              <p>
                {c.period_start} — {c.period_end} · {c.status}
              </p>
              <p>
                {t("Due", "آخری تاریخ")}: {c.due_date}
              </p>
              <h3>{t("Closing summary", "اختتامی خلاصہ")}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {c.summary ?? t("Not recorded", "درج نہیں")}
              </p>
              <p>
                {t(
                  "Deficiencies: total / open / corrected / acknowledged / withdrawn",
                  "نقائص: کل / کھلے / درست / تسلیم / واپس",
                )}
                : {c.deficiencies.total} / {c.deficiencies.open} /{" "}
                {c.deficiencies.corrected} / {c.deficiencies.acknowledged} /{" "}
                {c.deficiencies.withdrawn}
              </p>
              <h3>{t("Sampled records", "منتخب ریکارڈ")}</h3>
              {c.items.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          t("Record / MRN", "ریکارڈ / ایم آر این"),
                          t("Department", "شعبہ"),
                          t("Reviewer", "جائزہ کنندہ"),
                          t("Status / score", "حالت / اسکور"),
                        ].map((v) => (
                          <th key={v}>{v}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.items.map((i) => (
                        <tr key={i.item_id}>
                          <td>
                            {i.record_number} · {i.mrn}
                          </td>
                          <td>
                            {i.department_name ?? t("Not recorded", "درج نہیں")}
                          </td>
                          <td>
                            {i.reviewer_name ?? t("Not assigned", "مقرر نہیں")}
                          </td>
                          <td>
                            {i.status} ·{" "}
                            {i.score_pct == null
                              ? t("Not reviewed", "جائزہ نہیں")
                              : i.score_pct + "%"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>{t("No sampled records.", "منتخب ریکارڈ نہیں۔")}</p>
              )}
            </article>
          );
        })()}
    </Modal>
  );
}
