import { useEffect, useState, type ReactNode } from "react";
import {
  ClinicalVisit,
  mayChangeClinicalContext,
  type ClinicalUser,
  type VisitContext,
} from "./clinical-context";
import { bilingual as t, tr } from "./i18n";
import { Details, Empty, Field, LoadState, useLoad } from "./components";
import * as patients from "./generated/patient_search";
import { PatientSearchMatch } from "./patient-search-match";
export type PatientContext = {
  patient: patients.PatientDetailOut;
  ready: boolean;
  ticket?: VisitContext["ticket"];
  reload: () => Promise<void>;
};
export function ClinicalPatient({
  user,
  revision,
  initialTicket,
  initialPatient,
  children,
}: {
  user: ClinicalUser;
  revision: number;
  initialTicket?: number;
  initialPatient?: number;
  children: (ctx: PatientContext) => ReactNode;
}) {
  const [mode, setMode] = useState<"visit" | "patient">(
    initialTicket && !initialPatient ? "visit" : "patient",
  );
  const choose = (next: typeof mode) => {
    if (next !== mode && mayChangeClinicalContext()) setMode(next);
  };
  return (
    <section>
      <div className="toolbar">
        <button data-help="clinical.patient" onClick={() => choose("visit")}>
          {t("Choose by OPD slip / queue", "پرچی یا قطار سے انتخاب")}
        </button>
        {user.permissions.includes("patient.search") && (
          <button
            data-help="clinical.patient"
            onClick={() => choose("patient")}
          >
            {t(
              "Find patient without an OPD slip",
              "پرچی کے بغیر مریض تلاش کریں",
            )}
          </button>
        )}
      </div>
      {mode === "visit" ? (
        <ClinicalVisit
          user={user}
          revision={revision}
          initialTicket={initialTicket}
        >
          {(ctx) => children(ctx)}
        </ClinicalVisit>
      ) : (
        <PatientLookup user={user} revision={revision} initialPatient={initialPatient}>
          {children}
        </PatientLookup>
      )}
    </section>
  );
}
function PatientLookup({
  user,
  revision,
  initialPatient,
  children,
}: {
  user: ClinicalUser;
  revision: number;
  initialPatient?:number;
  children: (ctx: PatientContext) => ReactNode;
}) {
  const [q, setQ] = useState(""),
    [query, setQuery] = useState(""),
    [id, setId] = useState<number | undefined>(initialPatient);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  const found = useLoad(
    () =>
      user.permissions.includes("patient.search") && query.length >= 2
        ? patients.searchPatients({ q: query, limit: 30 })
        : Promise.resolve([]),
    [query, revision],
  );
  const record = useLoad(
    () =>
      id && user.permissions.includes("patient.view")
        ? patients.getPatient(id)
        : Promise.resolve(undefined),
    [id, revision],
  );
  const patient = record.data,
    ready =
      !!patient &&
      !record.loading &&
      !record.error &&
      patient.patient_id === id &&
      !patient.merged_into_id;
  const change = (next: number) => {
    if (mayChangeClinicalContext()) setId(next);
  };
  return (
    <section>
      <Field label={t("Find clinical patient", "طبی مریض تلاش کریں")}>
        <input
          data-help="clinical.patient"
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.target.value)}
        />
      </Field>
      <p>
        {t(
          "Enter at least 2 characters of name, MRN or permitted patient search identifier. Verify the actual result; do not guess record IDs.",
          "نام، ایم آر این یا مجاز شناخت کے کم از کم2حروف لکھیں۔ اصل نتیجہ چیک کریں؛ فرضی نمبر نہ لکھیں۔",
        )}
      </p>
      <LoadState {...found} retry={found.reload} />
      {q.trim() === query &&
        !found.loading &&
        !found.error &&
        found.data?.map((p) => (
          <p key={p.patient_id}>
            <button
              data-help="clinical.patient"
              disabled={!!document.querySelector('[data-write-pending="true"]')}
              onClick={() => change(p.patient_id)}
            >
              {p.full_name} · <bdi>{p.mrn}</bdi>
              <PatientSearchMatch hit={p} />
            </button>
          </p>
        ))}
      {query.length >= 2 &&
        !found.loading &&
        !found.error &&
        !found.data?.length && (
          <Empty>
            {t(
              "No patient matches. Check the identifier with reception.",
              "مریض نہیں ملا۔ استقبالیہ سے شناخت چیک کریں۔",
            )}
          </Empty>
        )}
      <LoadState {...record} retry={record.reload} />
      {patient && (
        <>
          <section className="card">
            <h2>
              {patient.full_name} · <bdi>{patient.mrn}</bdi>
            </h2>
            <p>
              {t("Age / date of birth", "عمر / تاریخ پیدائش")}:{" "}
              <bdi>
                {(patient.dob || patient.age_years) ?? t("Not recorded", "درج نہیں")}
              </bdi>{" "}
              · {tr(patient.gender || "unknown")} ·{" "}
              {t("Blood group", "خون کا گروپ")}:{" "}
              {patient.blood_group || t("Not recorded", "درج نہیں")}
            </p>
            <p>
              {t("Allergies", "الرجی")}:{" "}
              {patient.allergies || t("Not recorded", "درج نہیں")}
            </p>
            {patient.is_deceased && (
              <p className="error" role="alert">
                {t(
                  "Deceased patient: no new orders.",
                  "مریض وفات پا چکا ہے؛ نئے احکامات نہیں۔",
                )}
              </p>
            )}
            {patient.mlc_numbers.length > 0 && (
              <p>
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
              <summary data-help="clinical.patient">
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
            {patient.patient_id !== id && (
              <p className="notice">
                {t(
                  "The patient was merged. Reconcile any draft, then deliberately select the master record.",
                  "مریض ضم ہوا ہے۔ مسودہ چیک کرکے اصل مریض خود چنیں۔",
                )}
                <button
                  data-help="clinical.patient"
                  onClick={() => change(patient.patient_id)}
                >
                  {t(
                    "Select returned master patient",
                    "واپس آیا اصل مریض چنیں",
                  )}
                </button>
              </p>
            )}
            {!ready && (
              <p role="status">
                {t(
                  "Current identity is being checked; actions are paused.",
                  "موجودہ شناخت چیک ہو رہی ہے؛ عمل رکے ہیں۔",
                )}
              </p>
            )}
          </section>
          <div key={id}>
            {children({ patient, ready, reload: record.reload })}
          </div>
        </>
      )}
    </section>
  );
}
