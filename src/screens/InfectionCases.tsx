import { useState, type FormEvent } from "react";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { Empty, Field, LoadState, Modal, useLoad } from "../components";
import * as inf from "../generated/infection_cases";
import { getPatient } from "../generated/patient_search";
import { listAdmissions } from "../generated/doctor_inpatients";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading, QualityPeriod } from "./QualityRegister";
import {
  ConfirmEntry,
  formText,
  permission,
  ReportTable,
  ServiceNotice,
  type P9cProps,
} from "./P9cShared";
import { WoundCheck, type WoundTarget } from "./SsiSurveillance";

const kinds = {
  SurgicalSite: "جراحی زخم",
  CatheterUrinary: "پیشاب کی نالی کیتھیٹر",
  CentralLineBloodstream: "سنٹرل لائن خون",
  VentilatorPneumonia: "وینٹی لیٹر نمونیا",
  HospitalPneumonia: "ہسپتال نمونیا",
  Gastrointestinal: "معدہ اور آنت",
  SkinSoftTissue: "جلد اور نرم بافت",
  Other: "دیگر",
} as const;
const statuses = {
  Suspected: "مشتبہ",
  Confirmed: "تصدیق",
  Excluded: "خارج",
} as const;
const locations = {
  DuringStay: "قیام کے دوران",
  Readmission: "دوبارہ داخلہ",
  OpdFollowUp: "بیرونی پیروی",
  Telephone: "فون",
  Other: "دیگر",
} as const;
export const depths = {
  Superficial: "سطحی",
  Deep: "گہرا",
  OrganSpace: "عضو کی جگہ",
} as const;
type Id =
  "report_infection_doctor" | "report_infection_ward" | "infection_cases";

function options(values: Record<string, string>) {
  return Object.entries(values).map(([key, ur]) => (
    <option key={key} value={key}>
      {t(key, ur)}
    </option>
  ));
}
export function InfectionCases({
  screenId,
  user,
  connected,
  timeZone,
  revision,
  view,
  onOpenHelp,
  onIncident,
}: P9cProps & { screenId: Id; onIncident?: () => void }) {
  const manager = screenId === "infection_cases";
  const writePermission = permission(
    user,
    "infection.control.manage",
    "infection.case.report",
  );
  const canDecide =
    manager && user.permissions.includes("infection.control.manage");
  const canSearch = user.permissions.includes("patient.search");
  const canReadAdmissions = user.permissions.includes("ipd.admission.view");
  const canPickOperation = !!permission(
    user,
    "infection.control.manage",
    "infection.statistics.view",
    "infection.case.report",
  );
  const canRead = !!permission(
    user,
    "infection.case.report",
    "infection.control.manage",
    "infection.statistics.view",
  );
  const [range, setRange] = useState(() => currentMonth(timeZone));
  const [status, setStatus] = useState<inf.InfectionCaseOut["status"] | "">("");
  const [filter, setFilter] = useState<inf.InfectionCaseIn["kind"] | "">("");
  const [draft, setDraft] = useState<"report" | "decision" | "wound">();
  const [row, setRow] = useState<inf.InfectionCaseOut>();
  const [kind, setKind] =
    useState<inf.InfectionCaseIn["kind"]>("CatheterUrinary");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [patient, setPatient] = useState<inf.PatientSearchHitOut>();
  const [booking, setBooking] = useState<inf.SurveillanceOut>();
  const [wound, setWound] = useState<WoundTarget>();
  const canStart = screenId !== "report_infection_ward" || view === "full";
  const rows = useLoad(
    () =>
      canRead
        ? inf.listCasesInfection({
            ...(range.date_from ? range : {}),
            status: status || undefined,
            kind: filter || undefined,
            limit: 100,
          })
        : Promise.resolve([]),
    [canRead, range, status, filter, revision],
  );
  const pickingOperation = draft === "wound" || (draft === "report" && kind === "SurgicalSite");
  const operations = useLoad(
    () =>
      pickingOperation && canPickOperation && patient
        ? inf.ssiSurveillance({ patient_id: patient.patient_id, limit: 200 })
        : Promise.resolve([]),
    [pickingOperation, patient, canPickOperation, revision],
  );
  const patientOperations = operations.data?.filter(x => x.patient_id === patient?.patient_id) ?? [];
  const selectedOperation = !operations.loading && !operations.error
    ? patientOperations.find(x => x.booking_id === booking?.booking_id)
    : undefined;
  const hits = useLoad(
    () =>
      (draft === "report" || draft === "wound") && term && canSearch
        ? inf.searchPatients({ q: term, limit: 10 })
        : Promise.resolve([]),
    [draft, term, canSearch],
  );
  const identityId =
    draft === "decision"
      ? row?.patient_id
      : patient?.patient_id;
  const identity = useLoad(
    () => (identityId ? getPatient(identityId) : Promise.resolve(undefined)),
    [identityId, revision],
  );
  const admissions = useLoad(async () => {
    if (draft !== "report" || !identityId || !canReadAdmissions) return [];
    const rows = await listAdmissions();
    return rows.filter(x => x.patient_id === identityId && ["Admitted", "DischargeInProgress", "CodeRedActive"].includes(x.status));
  }, [draft, identityId, canReadAdmissions, revision]);
  const detail =
    identity.data?.patient_id === identityId &&
    !identity.loading &&
    !identity.error
      ? identity.data
      : undefined;
  const write = useClinicalWrite(user, screenId, async () => {
    setDraft(undefined);
    await rows.reload();
  });
  const edit = connected && !write.blocked;
  function startReport(next: "report" | "wound" = "report") {
    setDraft(next);
    setKind("CatheterUrinary");
    setPatient(undefined);
    setBooking(undefined);
    setTerm("");
    setQuery("");
    write.clearError();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit || !detail || detail.merged_into_id) return;
    const f = new FormData(event.currentTarget);
    const ssi_depth = (formText(f, "depth") ||
      undefined) as inf.InfectionCaseIn["ssi_depth"];
    const organism = formText(f, "organism") || undefined;
    if (
      draft === "report" &&
      canStart &&
      writePermission &&
      !detail.is_deceased
    ) {
      const description = formText(f, "description");
      if (!description || (kind === "SurgicalSite" && (!selectedOperation || !ssi_depth)))
        return;
      const body: inf.InfectionCaseIn = {
        kind,
        patient_id: detail.patient_id,
        admission_id: !admissions.loading && !admissions.error ? admissions.data?.find(x => x.patient_id === detail.patient_id && String(x.admission_id) === formText(f,"admission"))?.admission_id : undefined,
        booking_id: kind === "SurgicalSite" ? selectedOperation?.booking_id : undefined,
        ssi_depth: kind === "SurgicalSite" ? ssi_depth : undefined,
        onset_date: formText(f, "onset"),
        found_at: formText(f, "location") as inf.InfectionCaseIn["found_at"],
        organism,
        description,
      };
      write.start({
        method: "POST",
        path: "/infection-cases",
        permission: writePermission,
        body,
        protection: "idempotent",
        label: t("Report suspected infection", "مشتبہ انفیکشن رپورٹ کریں"),
      });
    }
    if (draft === "decision" && canDecide && row?.status === "Suspected") {
      const note = formText(f, "decisionNote");
      if (!note) return;
      const body: inf.CaseDecisionIn = {
        status: formText(f, "decision") as inf.CaseDecisionIn["status"],
        note,
        organism,
        ssi_depth: row.kind === "SurgicalSite" ? ssi_depth : undefined,
      };
      write.start({
        method: "POST",
        path: "/infection-cases/" + row.case_id + "/decision",
        permission: "infection.control.manage",
        body,
        protection: "idempotent",
        label: t("Save final decision", "حتمی فیصلہ محفوظ کریں"),
      });
    }
  }
  return (
    <section
      data-screen={screenId}
      data-unsaved={!!draft || !!wound}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={
          manager
            ? t("Infection cases", "انفیکشن کیس")
            : t("Report infection", "انفیکشن رپورٹ کریں")
        }
        text={t(
          "Record suspected healthcare-associated infections and follow their outcome.",
          "مشتبہ ہسپتال سے وابستہ انفیکشن درج کریں اور نتیجہ دیکھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      <ServiceNotice view={view} />
      <QualityPeriod range={range} apply={setRange}>
        <Field label={t("Case status", "کیس حالت")}>
          <select
            data-help="p9c.read"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="">{t("All statuses", "تمام حالتیں")}</option>
            {options(statuses)}
          </select>
        </Field>
        <Field label={t("Infection kind", "انفیکشن قسم")}>
          <select
            data-help="p9c.read"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="">{t("All kinds", "تمام اقسام")}</option>
            {options(kinds)}
          </select>
        </Field>
      </QualityPeriod>
      {canStart && writePermission && (
        <button
          data-help="ipc.report"
          type="button"
          disabled={!edit || !!draft || !!wound}
          onClick={() => startReport()}
        >
          {t("Report suspected infection", "مشتبہ انفیکشن رپورٹ کریں")}
        </button>
      )}
      {!manager && canStart && writePermission && canPickOperation && view !== "records" && (
        <button type="button" data-help="ipc.wound" disabled={!edit || !!draft || !!wound}
          onClick={() => startReport("wound")}>
          {t("Record wound check", "زخم کی جانچ درج کریں")}
        </button>
      )}
      <LoadState {...rows} retry={rows.reload} />
      {!rows.loading && !rows.error && (
        <ReportTable
          title={t("Infection case register", "انفیکشن کیس رجسٹر")}
          columns={[
            t("Case and patient", "کیس اور مریض"),
            t("Infection and onset", "انفیکشن اور آغاز"),
            t("Evidence and decision", "شواہد اور فیصلہ"),
            t("Action", "عمل"),
          ]}
          rows={(rows.data ?? []).map((x) => ({
            key: x.case_id,
            cells: [
              <>
                <bdi>
                  {x.case_number} · {x.mrn}
                </bdi>{" "}
                · {x.patient_name}
                <br />
                {x.admission_number} {x.ward_name} {x.booking_number}{" "}
                {x.procedure_name}
              </>,
              <>
                {t(x.kind, kinds[x.kind])} · {x.onset_date} ·{" "}
                {t(x.found_at, locations[x.found_at])}
                <br />
                {x.ssi_depth && t(x.ssi_depth, depths[x.ssi_depth])}{" "}
                {x.organism}
              </>,
              <>
                {t(x.status, statuses[x.status])} · {x.description}
                <br />
                {x.report_stamp.text}
                {x.decision_note && (
                  <>
                    <br />
                    {x.decision_note} · {x.decision_stamp?.text}
                  </>
                )}
              </>,
              canDecide && x.status === "Suspected" ? (
                <button
                  data-help="ipc.decision"
                  disabled={!edit || !!draft}
                  onClick={() => {
                    setRow(x);
                    setDraft("decision");
                    write.clearError();
                  }}
                >
                  {t("Decide case", "کیس کا فیصلہ")}
                </button>
              ) : null,
            ],
          }))}
        />
      )}
      {!draft && <ClinicalWriteFeedback write={write} />}
      {draft && (
        <Modal
          title={
            draft === "report"
              ? t("New suspected infection", "نیا مشتبہ انفیکشن")
              : draft === "wound" ? t("Choose operation for wound check", "زخم کی جانچ کے لیے آپریشن منتخب کریں")
              : t("Confirm or exclude infection", "انفیکشن کی تصدیق یا اخراج")
          }
          closable={!write.blocked}
          onClose={() => {
            if (!write.blocked) setDraft(undefined);
          }}
        >
          {(draft === "report" || draft === "wound") && (
            <>
              {draft === "report" && <Field label={t("Infection kind", "انفیکشن قسم")}>
                <select
                  data-help="ipc.report"
                  disabled={write.blocked}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                >
                  {options(kinds)}
                </select>
              </Field>}
              {canSearch ? (
                <form
                  className="toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPatient(undefined);
                    setBooking(undefined);
                    setTerm(query.trim());
                  }}
                >
                  <Field
                    label={t("Patient name or MRN", "مریض نام یا ایم آر این")}
                  >
                    <input
                      data-help="ipc.report"
                      disabled={write.blocked}
                      required
                      minLength={2}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </Field>
                  <button data-help="ipc.report" disabled={write.blocked}>
                    {t("Find patient", "مریض تلاش کریں")}
                  </button>
                </form>
              ) : (
                <Empty>
                  {t(
                    "Patient search permission is required.",
                    "مریض تلاش کی اجازت درکار ہے۔",
                  )}
                </Empty>
              )}
              {term && (
                <>
                  <LoadState {...hits} retry={hits.reload} />
                  {!hits.loading &&
                    !hits.error &&
                    (hits.data?.length ? (
                      hits.data.map((x) => (
                        <button
                          type="button"
                          key={x.patient_id}
                          data-help="ipc.report"
                          disabled={write.blocked}
                          onClick={() => { setPatient(x); setBooking(undefined); }}
                        >
                          {x.full_name} · <bdi>{x.mrn}</bdi> ·{" "}
                          {x.dob ?? x.age_years}
                        </button>
                      ))
                    ) : (
                      <Empty>
                        {t("No matching patient.", "کوئی مماثل مریض نہیں۔")}
                      </Empty>
                    ))}
                </>
              )}
            </>
          )}
          {identityId && <LoadState {...identity} retry={identity.reload} />}
          {detail && <PatientIdentity patient={detail} />}
          {pickingOperation && detail && (
            <>
              <LoadState {...operations} retry={operations.reload} />
              {!operations.loading && !operations.error && (patientOperations.length ? (
                <Field label={t("Operation", "آپریشن")}>
                  <select data-help={draft === "wound" ? "ipc.wound" : "ipc.report"}
                    disabled={write.blocked} value={booking?.booking_id ?? ""}
                    onChange={e => setBooking(patientOperations.find(x => String(x.booking_id) === e.target.value))}>
                    <option value="">{t("Choose an operation", "آپریشن منتخب کریں")}</option>
                    {patientOperations.map(x => <option key={x.booking_id} value={x.booking_id}>
                      {x.booking_number} · {x.procedure_name} · {x.operated_on} · {t("Day", "دن")} {x.day}/{x.window_days}
                      {" · "}{t("Last check", "آخری جانچ")} {x.last_check ?? "—"} · {x.state}
                    </option>)}
                  </select>
                </Field>
              ) : <Empty>{t("This patient has no operation in the surveillance window.", "نگرانی کی مدت میں اس مریض کا کوئی آپریشن نہیں ہے۔")}</Empty>)}
            </>
          )}
          {draft === "wound" ? (
            <button type="button" data-help="ipc.wound"
              disabled={!edit || !detail || !selectedOperation}
              onClick={() => { if (selectedOperation) { setWound(selectedOperation); setDraft(undefined); } }}>
              {t("Continue to wound check", "زخم کی جانچ جاری رکھیں")}
            </button>
          ) : <form className="form" onSubmit={submit}>
            <fieldset disabled={write.blocked}>
              {draft==="report" && detail && canReadAdmissions && <>
                <LoadState {...admissions} retry={admissions.reload}/>
                {!!admissions.data?.length && !admissions.loading && !admissions.error &&
                  <Field label={t("Related live admission","متعلقہ جاری داخلہ")}>
                    <select key={detail.patient_id} data-help="ipc.report" name="admission">
                      <option value="">{t("No admission selected","کوئی داخلہ منتخب نہیں")}</option>
                      {admissions.data.map(x=><option key={x.admission_id} value={x.admission_id}>{x.admission_number} · {x.ward_name}</option>)}
                    </select>
                  </Field>}
              </>}
              {draft === "report" ? (
                <>
                  <Field label={t("Onset date", "آغاز تاریخ")}>
                    <input
                      data-help="ipc.report"
                      name="onset"
                      type="date"
                      max={currentMonth(timeZone).date_to}
                      defaultValue={currentMonth(timeZone).date_to}
                      required
                    />
                  </Field>
                  <Field label={t("Where found", "کہاں ملا")}>
                    <select data-help="ipc.report" name="location">
                      {options(locations)}
                    </select>
                  </Field>
                  <Field
                    label={t("Signs and criteria met", "علامات اور معیار")}
                  >
                    <textarea
                      data-help="ipc.report"
                      name="description"
                      required
                      maxLength={2000}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <p>
                    {row?.case_number} · {row?.description} ·{" "}
                    {row?.report_stamp.text}
                  </p>
                  <Field label={t("Final outcome", "حتمی نتیجہ")}>
                    <select data-help="ipc.decision" name="decision">
                      <option value="Confirmed">
                        {t("Confirmed", "تصدیق")}
                      </option>
                      <option value="Excluded">{t("Excluded", "خارج")}</option>
                    </select>
                  </Field>
                  <Field
                    label={t(
                      "Criteria or exclusion reason",
                      "معیار یا خارج کرنے کی وجہ",
                    )}
                  >
                    <textarea
                      data-help="ipc.decision"
                      name="decisionNote"
                      required
                      maxLength={2000}
                    />
                  </Field>
                </>
              )}
              {(draft === "report" ? kind : row?.kind) === "SurgicalSite" && (
                <Field label={t("Wound depth", "زخم گہرائی")}>
                  <select
                    data-help="ipc.report"
                    name="depth"
                    defaultValue={
                      draft === "decision" ? (row?.ssi_depth ?? "") : ""
                    }
                    required={draft === "report"}
                  >
                    <option value="">{t("Choose depth", "گہرائی چنیں")}</option>
                    {options(depths)}
                  </select>
                </Field>
              )}
              <Field label={t("Organism if known", "جرثومہ اگر معلوم ہے")}>
                <input
                  data-help="ipc.report"
                  name="organism"
                  defaultValue={
                    draft === "decision" ? (row?.organism ?? "") : ""
                  }
                  maxLength={160}
                />
              </Field>
              <ConfirmEntry />
            </fieldset>
            <ClinicalWriteFeedback write={write} />
            <button
              data-help="p9c.write"
              className="primary"
              disabled={
                !edit ||
                !detail ||
                !!detail.merged_into_id ||
                (draft === "report" && (detail.is_deceased || (kind === "SurgicalSite" && !selectedOperation)))
              }
            >
              {t("Confirm submission", "ارسال کی تصدیق")}
            </button>
          </form>}
        </Modal>
      )}
      {wound && writePermission && (
        <WoundCheck
          {...{ user, connected, timeZone, revision, view, onOpenHelp }}
          scope={screenId}
          target={wound}
          close={() => setWound(undefined)}
          after={rows.reload}
        />
      )}
    </section>
  );
}

export function PatientIdentity({
  patient: p,
}: {
  patient: Awaited<ReturnType<typeof getPatient>>;
}) {
  return (
    <div className="notice">
      <strong>
        {p.full_name} · <bdi>{p.mrn}</bdi> · {p.dob ?? p.age_years ?? "—"}
      </strong>
      <p>
        {t("Allergies", "الرجی")} ·{" "}
        {p.allergies || t("Not recorded", "درج نہیں")} · {p.blood_group ?? "—"}
      </p>
      <p>
        {p.is_deceased && t("Deceased", "وفات")}{" "}
        {p.mlc_numbers?.length
          ? "MEDICO-LEGAL · " + p.mlc_numbers.join(", ")
          : null}{" "}
        {p.temp_identifier} {p.outstanding?.banner_text}
      </p>
      {p.merged_into_id && (
        <p>
          {t(
            "Merged record. Select the patient's master record before writing.",
            "ضم شدہ ریکارڈ۔ لکھنے سے پہلے اصل ریکارڈ منتخب کریں۔",
          )}
        </p>
      )}
    </div>
  );
}
