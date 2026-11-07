import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../generated/my_investigations";
import { call, ApiError } from "../bridge";
import { ErrorBox, Field } from "../components";
import { DirectoryPicker, canReadDirectory } from "../DirectoryPicker";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";

const factors: NonNullable<api.AnalysisIn["contributing_factors"]> = [
  "Patient",
  "Individual",
  "Task",
  "Team",
  "Communication",
  "Training",
  "Supervision",
  "Staffing",
  "Equipment",
  "Environment",
  "Medicine",
  "Policy",
  "Organisation",
];
const factorUr = [
  "مریض",
  "فرد",
  "کام",
  "ٹیم",
  "رابطہ",
  "تربیت",
  "نگرانی",
  "عملے کی تعداد",
  "آلات",
  "ماحول",
  "دوا",
  "پالیسی",
  "ادارہ",
];
function draftFrom(r: api.IncidentDetailOut): api.AnalysisIn {
  return {
    analysis_method: r.analysis_method,
    chronology: r.chronology,
    root_causes: r.root_causes,
    contributing_factors: r.contributing_factors as typeof factors,
    lessons: r.lessons,
    disclosure: r.disclosure,
    disclosure_note: r.disclosure_note,
    external_reference: r.external_reference,
    expected_version: r.row_version,
  };
}
const actionBlank = () => ({
  action_type: "Corrective" as api.QualityActionIn["action_type"],
  description: "",
  owner_user_id: "",
  department_id: "",
  due_date: "",
});

export function MyInvestigations({
  user,
  revision,
  connected,
  readOnly,
  timeZone,
  onOpenHelp,
  recordId,
  parentScreen = "incident_register",
  onEditingChange,
  onChanged,
}: {
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
  recordId?: number;
  parentScreen?: "incident_register" | "incident_register_owner";
  onEditingChange?: (editing: boolean) => void;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<api.IncidentOut[]>([]),
    [detail, setDetail] = useState<api.IncidentDetailOut>(),
    [error, setError] = useState<unknown>(),
    [loading, setLoading] = useState(false),
    [draft, setDraft] = useState<api.AnalysisIn>(),
    [mode, setMode] = useState<"analysis" | "sign" | "action">(),
    [action, setAction] = useState(actionBlank),
    [reviewed, setReviewed] = useState(false),
    [pdfBusy, setPdfBusy] = useState(false),
    [pdfError, setPdfError] = useState<unknown>(),
    [pdfNotice, setPdfNotice] = useState("");
  const selected = useRef<number | undefined>(recordId),
    request = useRef(0);
  const permission = user.permissions.find((p) =>
    ["incident.report", "incident.manage"].includes(p),
  );
  const refresh = useCallback(async () => {
    const generation = ++request.current;
    setLoading(true);
    setError(undefined);
    try {
      const list = recordId
        ? []
        : await api.listIncidents({
            mine: true,
            status: "UnderReview",
            limit: 500,
          });
      const id = selected.current;
      const current = id ? await api.getIncident(id) : undefined;
      if (generation === request.current) {
        setRows(list.filter((r) => r.investigator_user_id === user.user_id));
        setDetail(current);
      }
    } catch (e) {
      if (generation === request.current) setError(e);
    } finally {
      if (generation === request.current) setLoading(false);
    }
  }, [user.user_id, recordId]);
  useEffect(() => {
    void refresh();
    return () => {
      request.current++;
    };
  }, [refresh, revision]);
  const write = useClinicalWrite(
    user,
    recordId ? parentScreen : "my_investigations",
    async () => {
      setMode(undefined);
      setDraft(undefined);
      setReviewed(false);
      setAction(actionBlank());
      await refresh();
      onChanged?.();
    },
  );
  const blocked = write.blocked || pdfBusy,
    editable = !!permission && !readOnly && connected && !loading && !error;
  useEffect(() => {
    onEditingChange?.(!!mode || blocked);
    return () => onEditingChange?.(false);
  }, [mode, blocked, onEditingChange]);
  useEffect(() => {
    setReviewed(false);
  }, [detail?.row_version]);
  // Embedded manager work needs a new review after action-only refreshes too.
  useEffect(() => { if (recordId) setReviewed(false); }, [detail, recordId]);
  const changed =
    draft && detail && draft.expected_version !== detail.row_version;
  async function open(r: api.IncidentOut) {
    if (blocked) return;
    if (
      mode &&
      !window.confirm(
        t(
          "Discard this unsent investigation draft?",
          "یہ غیر ارسال تحقیق مسودہ چھوڑ دیں؟",
        ),
      )
    )
      return;
    const generation = ++request.current;
    setLoading(true);
    setError(undefined);
    try {
      const d = await api.getIncident(r.incident_id);
      if (generation === request.current) {
        selected.current = r.incident_id;
        setDetail(d);
        setMode(undefined);
        setDraft(undefined);
        setReviewed(false);
        setPdfNotice("");
        setPdfError(undefined);
      }
    } catch (e) {
      if (generation === request.current) setError(e);
    } finally {
      if (generation === request.current) setLoading(false);
    }
  }
  async function pdf(preview: boolean) {
    if (!detail || blocked) return;
    setPdfBusy(true);
    setPdfError(undefined);
    setPdfNotice("");
    try {
      const r = await call("clinical-pdf", {
        path: `/incidents/${detail.incident_id}/pdf`,
        preview,
      });
      setPdfNotice(
        preview
          ? t("Report opened.", "رپورٹ کھل گئی۔")
          : r.saved
            ? t("PDF saved.", "پی ڈی ایف محفوظ۔")
            : t("PDF save cancelled.", "پی ڈی ایف محفوظ کرنا منسوخ۔"),
      );
    } catch (e) {
      setPdfError(e);
    } finally {
      setPdfBusy(false);
    }
  }
  function begin(which: "analysis" | "sign" | "action") {
    if (!detail || blocked) return;
    setMode(which);
    setReviewed(false);
    setDraft(which === "analysis" ? draftFrom(detail) : undefined);
    setAction(actionBlank());
  }
  const send = (kind: "analysis" | "sign" | "action") => {
    if (
      !detail ||
      !permission ||
      !editable ||
      !reviewed ||
      (kind === "action" ? !detail.can_add_action : !detail.can_analyse)
    )
      return;
    const path = `/incidents/${detail.incident_id}`;
    const body =
      kind === "analysis"
        ? draft
        : kind === "sign"
          ? { expected_version: detail.row_version }
          : {
              action_type: action.action_type,
              description: action.description.trim(),
              owner_user_id: Number(action.owner_user_id),
              department_id: action.department_id
                ? Number(action.department_id)
                : null,
              due_date: action.due_date,
            };
    write.start({
      method: kind === "analysis" ? "PUT" : "POST",
      path:
        path +
        (kind === "analysis"
          ? "/analysis"
          : kind === "sign"
            ? "/analysis/sign"
            : "/actions"),
      body,
      permission: recordId
        ? {
            recordPath: path,
            capability: kind === "action" ? "can_add_action" : "can_analyse",
          }
        : permission,
      protection: kind === "action" ? "idempotent" : "reconcile",
      reconcilePath: path,
      label:
        kind === "analysis"
          ? t("Save investigation draft", "تحقیق مسودہ محفوظ کریں")
          : kind === "sign"
            ? t("Sign final analysis", "حتمی تجزیہ دستخط کریں")
            : t("Record action", "عمل درج کریں"),
    });
  };
  const fields: [keyof api.AnalysisIn, string, string, number][] = [
    ["chronology", "What happened, in order", "کیا ہوا، ترتیب سے", 12000],
    ["root_causes", "Causes in the system", "نظام میں اسباب", 8000],
    ["lessons", "Lessons and recommendations", "سبق اور سفارشات", 8000],
    [
      "disclosure_note",
      "Who told the patient/family, when and what",
      "مریض یا خاندان کو کس نے، کب اور کیا بتایا",
      2000,
    ],
    [
      "external_reference",
      "External report reference (DRAP / PHC / police)",
      "بیرونی رپورٹ حوالہ (ڈریپ / پی ایچ سی / پولیس)",
      300,
    ],
  ];
  const Heading=recordId?'h3':'h1';
  return (
    <section
      data-screen={recordId ? undefined : "my_investigations"}
      data-help-screen={recordId ? parentScreen : undefined}
      data-write-pending={blocked}
      data-unsaved={!!mode}
    >
      <div className="section-heading">
        <div>
          <Heading>
            {recordId
              ? t("Investigation and actions", "تحقیق اور اعمال")
              : t("Incidents I investigate", "جن واقعات کی میں تحقیق کرتا ہوں")}
          </Heading>
          <p>
            {t(
              "Explain what happened without blame, identify causes in the system, then assign corrective and preventive work.",
              "الزام کے بغیر واقعہ واضح کریں، نظام کے اسباب ڈھونڈیں، پھر اصلاحی اور احتیاطی کام سونپیں۔",
            )}
          </p>
        </div>
        <div className="actions">
          <button
            data-help={recordId ? "irw.refresh" : "mi.refresh"}
            disabled={blocked || loading}
            onClick={() => void refresh()}
          >
            {t("Refresh investigations", "تحقیقات تازہ کریں")}
          </button>
          <button
            data-help={recordId ? "irw.help" : "mi.help"}
            onClick={onOpenHelp}
          >
            F1 · {t("Help", "مدد")}
          </button>
        </div>
      </div>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected: keep the draft open. Writes and downloads require a connection.",
            "رابطہ نہیں: مسودہ کھلا رکھیں۔ اندراج اور ڈاؤن لوڈ کے لیے رابطہ لازم ہے۔",
          )}
        </p>
      )}
      {readOnly && (
        <p>
          {t(
            "Records only: no analysis changes, signing or new actions.",
            "صرف ریکارڈ: تجزیہ بدلنا، دستخط یا نیا عمل ممکن نہیں۔",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          void refresh();
          if (recordId) onChanged?.();
        }}
      />
      {loading && (
        <p role="status">
          {t(
            "Reading current investigations…",
            "تازہ تحقیقات پڑھی جا رہی ہیں…",
          )}
        </p>
      )}
      {!recordId && !loading && !error && !rows.length && (
        <p>
          {t(
            "No incidents are currently assigned to you for analysis. Quality names the investigator; a notification brings new work here.",
            "فی الحال تجزیے کے لیے کوئی واقعہ آپ کے ذمے نہیں۔ کوالٹی تحقیق کار مقرر کرتا ہے؛ اطلاع نیا کام یہاں لاتی ہے۔",
          )}
        </p>
      )}
      {rows.length === 500 && (
        <p role="alert">
          {t(
            "The list reached500. Ask Quality to reconcile outstanding assignments; this is not a complete hospital register.",
            "فہرست پانچ سو کی حد پر ہے۔ کوالٹی سے باقی ذمہ داریاں چیک کرائیں؛ یہ ہسپتال کا مکمل رجسٹر نہیں۔",
          )}
        </p>
      )}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  t("Incident", "واقعہ"),
                  t("Patient / location", "مریض / مقام"),
                  t("Due", "آخری تاریخ"),
                  t("Action", "عمل"),
                ].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.incident_id}>
                  <td>
                    <bdi>{r.incident_number}</bdi> · {r.type_name}
                    {r.is_sentinel && (
                      <strong> · {t("Sentinel", "سنگین واقعہ")}</strong>
                    )}
                  </td>
                  <td>
                    {[
                      r.patient_name,
                      r.mrn,
                      r.department_name,
                      r.ward_name,
                      r.location,
                    ]
                      .filter(Boolean)
                      .join(" · ") || t("Not recorded", "درج نہیں")}
                  </td>
                  <td className={r.analysis_overdue ? "error" : ""}>
                    {r.analysis_due ?? t("Not recorded", "درج نہیں")}
                    {r.analysis_overdue && (
                      <strong> · {t("Overdue", "تاخیر")}</strong>
                    )}
                  </td>
                  <td>
                    <button
                      data-help={recordId ? "irw.open" : "mi.open"}
                      disabled={blocked}
                      onClick={() => void open(r)}
                    >
                      {t("Open investigation", "تحقیق کھولیں")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <article
          className="panel investigation-detail"
          hidden={!!recordId && (loading || !!error)}
        >
          <h2>
            <bdi>{detail.incident_number}</bdi> · {detail.type_name}
          </h2>
          <p>
            {detail.status} ·{" "}
            {detail.is_sentinel
              ? t(
                  "Sentinel event — root cause analysis required",
                  "سنگین واقعہ — بنیادی اسباب کا تجزیہ لازم",
                )
              : detail.kind}
          </p>
          <p>{detail.description}</p>
          <p>
            <strong>{t("Immediate action", "فوری اقدام")}: </strong>
            {detail.immediate_action}
          </p>
          <p>{detail.report_stamp?.text ?? detail.reported_by_name}</p>
          <p>
            {t("Investigator", "تحقیق کار")}:{" "}
            {detail.investigator_name ?? t("Not named", "مقرر نہیں")} ·{" "}
            {t("Next", "اگلا قدم")}:{" "}
            {detail.next_step ?? t("No further step", "کوئی مزید قدم نہیں")}
          </p>
          <dl>
            {[
              ["analysis_method", t("Method", "طریقہ")],
              ...fields.map(([k, en, ur]) => [k, t(en, ur)]),
              [
                "disclosure",
                t("Patient/family told", "مریض یا خاندان کو بتایا"),
              ],
            ].map(([k, label]) => (
              <div key={k}>
                <dt>{label ?? ""}</dt>
                <dd>
                  {String(
                    detail[k as keyof typeof detail] ??
                      t("Not recorded", "درج نہیں"),
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p>
            {detail.contributing_factors.join(" · ") ||
              t("No contributing factors recorded", "معاون اسباب درج نہیں")}
          </p>
          {detail.analysis_stamp && <p>{detail.analysis_stamp.text}</p>}
          <div className="actions">
            <button
              data-help={recordId ? "irw.analysis" : "mi.analysis"}
              disabled={blocked || !editable || !detail.can_analyse || !!mode}
              onClick={() => begin("analysis")}
            >
              {t("Edit analysis draft", "تجزیہ مسودہ بدلیں")}
            </button>
            <button
              data-help={recordId ? "irw.sign" : "mi.sign"}
              disabled={blocked || !editable || !detail.can_analyse || !!mode}
              onClick={() => begin("sign")}
            >
              {t("Review and sign analysis", "تجزیہ دیکھیں اور دستخط کریں")}
            </button>
            <button
              data-help={recordId ? "irw.action" : "mi.action"}
              disabled={
                blocked || !editable || !detail.can_add_action || !!mode
              }
              onClick={() => begin("action")}
            >
              {t(
                "Add corrective / preventive action",
                "اصلاحی / احتیاطی عمل شامل کریں",
              )}
            </button>
            <button
              data-help={recordId ? "irw.pdf" : "mi.pdf"}
              disabled={blocked || !connected}
              onClick={() => void pdf(true)}
            >
              {t("View / print report", "رپورٹ دیکھیں / پرنٹ کریں")}
            </button>
            <button
              data-help={recordId ? "irw.pdf" : "mi.pdf"}
              disabled={blocked || !connected}
              onClick={() => void pdf(false)}
            >
              {t("Save report PDF", "رپورٹ پی ڈی ایف محفوظ کریں")}
            </button>
          </div>
          <ErrorBox error={pdfError} />
          {pdfNotice && <p role="status">{pdfNotice}</p>}
          <h3>
            {t(
              "Corrective and preventive actions",
              "اصلاحی اور احتیاطی اقدامات",
            )}
          </h3>
          {!detail.actions.length && (
            <p>{t("No actions recorded.", "کوئی عمل درج نہیں۔")}</p>
          )}
          {detail.actions.map((a) => (
            <div key={a.action_id}>
              <bdi>{a.action_number}</bdi> · {a.action_type} · {a.description}
              <p>
                {a.owner_name} · {a.due_date} · {a.status}
                {a.is_overdue && (
                  <strong className="error"> · {t("Overdue", "تاخیر")}</strong>
                )}
              </p>
            </div>
          ))}
          {mode && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(mode);
              }}
            >
              <fieldset disabled={blocked || !editable}>
                <h3>
                  {mode === "analysis"
                    ? t("Save as you investigate", "تحقیق کے دوران محفوظ کریں")
                    : mode === "sign"
                      ? t(
                          "Sign the saved analysis — final",
                          "محفوظ تجزیہ دستخط کریں — حتمی",
                        )
                      : t("Assign an action", "عمل سونپیں")}
                </h3>
                {mode === "analysis" && draft && (
                  <>
                    <Field label={t("Analysis method", "تجزیے کا طریقہ")}>
                      <select
                        data-help={recordId ? "irw.method" : "mi.method"}
                        value={draft.analysis_method ?? ""}
                        onChange={(e) => {
                          setReviewed(false);
                          setDraft({
                            ...draft,
                            analysis_method: (e.target.value ||
                              null) as api.AnalysisIn["analysis_method"],
                          });
                        }}
                      >
                        <option value="">
                          {t("Choose method", "طریقہ چنیں")}
                        </option>
                        <option value="Review">{t("Review", "جائزہ")}</option>
                        <option value="RootCauseAnalysis">
                          {t("Root cause analysis", "بنیادی اسباب کا تجزیہ")}
                        </option>
                      </select>
                    </Field>
                    {fields.map(([key, en, ur, max]) => (
                      <Field key={key} label={t(en, ur)}>
                        <textarea
                          data-help={
                            recordId ? "irw.narrative" : "mi.narrative"
                          }
                          name={key}
                          maxLength={max}
                          value={String(draft[key] ?? "")}
                          onChange={(e) => {
                            setReviewed(false);
                            setDraft({
                              ...draft,
                              [key]: e.target.value || null,
                            });
                          }}
                        />
                      </Field>
                    ))}
                    <fieldset>
                      <legend>
                        {t("Contributing factors", "معاون اسباب")}
                      </legend>
                      {recordId && detail.is_sentinel && <p>{t('A sentinel analysis needs at least one factor of the system, not only a person or the patient.','سنگین واقعے کے تجزیے میں نظام کا کم از کم ایک عامل لازم ہے، صرف فرد یا مریض کافی نہیں۔')}</p>}
                      {factors.map((f, i) => (
                        <label key={f}>
                          <input
                            data-help={recordId ? "irw.factors" : "mi.factors"}
                            type="checkbox"
                            checked={
                              draft.contributing_factors?.includes(f) ?? false
                            }
                            onChange={(e) => {
                              setReviewed(false);
                              setDraft({
                                ...draft,
                                contributing_factors: e.target.checked
                                  ? [...(draft.contributing_factors ?? []), f]
                                  : (draft.contributing_factors ?? []).filter(
                                      (v) => v !== f,
                                    ),
                              });
                            }}
                          />
                          {t(f, factorUr[i])}
                        </label>
                      ))}
                    </fieldset>
                    <Field
                      label={t(
                        "Patient or family disclosure",
                        "مریض یا خاندان کو اطلاع",
                      )}
                    >
                      <select
                        data-help={
                          recordId ? "irw.disclosure" : "mi.disclosure"
                        }
                        value={draft.disclosure ?? ""}
                        onChange={(e) => {
                          setReviewed(false);
                          setDraft({
                            ...draft,
                            disclosure: (e.target.value ||
                              null) as api.AnalysisIn["disclosure"],
                          });
                        }}
                      >
                        <option value="">
                          {t("Not recorded", "درج نہیں")}
                        </option>
                        <option value="Disclosed">
                          {t("Disclosed", "بتا دیا")}
                        </option>
                        <option value="NotYet">
                          {t("Not yet", "ابھی نہیں")}
                        </option>
                        <option value="NotApplicable">
                          {t("Not applicable", "لاگو نہیں")}
                        </option>
                      </select>
                    </Field>
                    {changed && (
                      <p role="alert">
                        {t(
                          "The server record changed. Compare the current saved analysis above with your retained draft.",
                          "سرور ریکارڈ بدل گیا۔ اوپر تازہ محفوظ تجزیہ اپنے محفوظ مسودے سے ملائیں۔",
                        )}
                        <button
                          type="button"
                          data-help={recordId ? "irw.compare" : "mi.compare"}
                          onClick={() => {
                            if (
                              window.confirm(
                                t(
                                  "I compared the latest analysis. Use its version and keep my draft?",
                                  "تازہ تجزیہ ملا لیا۔ نیا ورژن لے کر میرا مسودہ رکھیں؟",
                                ),
                              )
                            ) {
                              setDraft({
                                ...draft,
                                expected_version: detail.row_version,
                              });
                              setReviewed(false);
                            }
                          }}
                        >
                          {t(
                            "Use latest version; keep my draft",
                            "نیا ورژن لیں؛ میرا مسودہ رکھیں",
                          )}
                        </button>
                      </p>
                    )}
                  </>
                )}
                {mode === "sign" && (
                  <p>
                    {t(
                      "Check the saved analysis above. Signing is final. A sentinel event requires RootCauseAnalysis and at least one system factor beyond Patient or Individual. An incomplete analysis returns the exact missing items. Saving is separate from signing.",
                      "اوپر محفوظ تجزیہ دیکھیں۔ دستخط حتمی ہیں۔ سنگین واقعے میں بنیادی اسباب اور مریض یا فرد کے علاوہ نظام کا ایک سبب لازم ہے۔ نامکمل تجزیے پر غائب حصے آئیں گے۔ محفوظ کرنا اور دستخط الگ ہیں۔",
                    )}
                  </p>
                )}
                {mode === "action" && (
                  <>
                    <Field label={t("Action type", "عمل کی قسم")}>
                      <select
                        data-help={
                          recordId ? "irw.action-type" : "mi.action-type"
                        }
                        value={action.action_type}
                        onChange={(e) => {
                          setReviewed(false);
                          setAction({
                            ...action,
                            action_type: e.target
                              .value as typeof action.action_type,
                          });
                        }}
                      >
                        <option value="Corrective">
                          {t("Corrective", "اصلاحی")}
                        </option>
                        <option value="Preventive">
                          {t("Preventive", "احتیاطی")}
                        </option>
                      </select>
                    </Field>
                    <Field label={t("Action description", "عمل کی تفصیل")}>
                      <textarea
                        data-help={
                          recordId
                            ? "irw.action-description"
                            : "mi.action-description"
                        }
                        required
                        minLength={5}
                        maxLength={1000}
                        value={action.description}
                        onChange={(e) => {
                          setReviewed(false);
                          setAction({ ...action, description: e.target.value });
                        }}
                      />
                    </Field>
                    <Field
                      label={t(
                        "Responsible person with a login",
                        "لاگ ان والا ذمہ دار فرد",
                      )}
                    >
                      {canReadDirectory(
                        "/quality/record-review/people",
                        user.permissions,
                      ) ? (
                        <DirectoryPicker
                          path="/quality/record-review/people"
                          idField="user_id"
                          value={action.owner_user_id}
                          onChange={(e) => {
                            setReviewed(false);
                            setAction({
                              ...action,
                              owner_user_id: e.target.value,
                            });
                          }}
                          data-help={recordId ? "irw.owner" : "mi.owner"}
                        />
                      ) : (
                        <DirectoryPicker
                          path="/staff/lookup"
                          idField="user_id"
                          search
                          userId
                          value={action.owner_user_id}
                          onChange={(e) => {
                            setReviewed(false);
                            setAction({
                              ...action,
                              owner_user_id: e.target.value,
                            });
                          }}
                          data-help={recordId ? "irw.owner" : "mi.owner"}
                        />
                      )}
                    </Field>
                    <Field label={t("Department (optional)", "شعبہ (اختیاری)")}>
                      <DirectoryPicker
                        path="/admin/departments"
                        idField="department_id"
                        value={action.department_id}
                        onChange={(e) => {
                          setReviewed(false);
                          setAction({
                            ...action,
                            department_id: e.target.value,
                          });
                        }}
                        data-help={
                          recordId ? "irw.department" : "mi.department"
                        }
                      />
                    </Field>
                    <Field label={t("Due date", "آخری تاریخ")}>
                      <input
                        data-help={recordId ? "irw.due" : "mi.due"}
                        required
                        type="date"
                        value={action.due_date}
                        onChange={(e) => {
                          setReviewed(false);
                          setAction({ ...action, due_date: e.target.value });
                        }}
                      />
                    </Field>
                  </>
                )}
                <label>
                  <input
                    data-help={recordId ? "irw.confirm" : "mi.confirm"}
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  {t(
                    "I checked this incident and the exact action above",
                    "میں نے یہ واقعہ اور اوپر کا عین عمل چیک کیا",
                  )}
                </label>
                <div className="actions">
                  <button
                    type="button"
                    data-help={recordId ? "irw.cancel" : "mi.cancel"}
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            "Discard this unsent draft?",
                            "غیر ارسال مسودہ چھوڑ دیں؟",
                          ),
                        )
                      ) {
                        setMode(undefined);
                        setDraft(undefined);
                      }
                    }}
                  >
                    {t("Cancel unsent draft", "غیر ارسال مسودہ منسوخ")}
                  </button>
                  <button
                    data-help={recordId ? "irw.submit" : "mi.submit"}
                    disabled={
                      !reviewed ||
                      !!changed ||
                      (mode === "action"
                        ? !detail.can_add_action
                        : !detail.can_analyse) ||
                      (mode === "action" &&
                        (!action.owner_user_id ||
                          !action.due_date ||
                          action.description.trim().length < 5))
                    }
                  >
                    {mode === "analysis"
                      ? t("Save analysis draft", "تجزیہ مسودہ محفوظ کریں")
                      : mode === "sign"
                        ? t("Sign final analysis", "حتمی تجزیہ دستخط کریں")
                        : t("Record action once", "عمل ایک بار درج کریں")}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {write.error instanceof ApiError &&
            write.error.response.error?.code === "VERSION_CONFLICT" && (
              <p>
                {t(
                  "Refresh, compare the new analysis above and deliberately retain or discard your draft. There is no automatic overwrite.",
                  "تازہ کریں، اوپر نئے تجزیے سے ملائیں اور خود مسودہ رکھیں یا چھوڑیں۔ خودکار تبدیلی نہیں۔",
                )}
              </p>
            )}
        </article>
      )}
    </section>
  );
}
