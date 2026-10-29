import { useEffect, useState, type ReactNode } from "react";
import { api } from "./bridge";
import { Details, Empty, Field, LoadState, useLoad } from "./components";
import {
  mayChangeClinicalContext,
  type ClinicalUser,
} from "./clinical-context";
import type { PatientContext } from "./clinical-patient";
import type { EstablishmentOut } from "./generated/facility_profile";
import {
  getAdmission,
  listAdmissions,
  type AdmissionDetailOut,
} from "./generated/doctor_inpatients";
import { myBeds } from "./generated/my_beds";
import { getPatient } from "./generated/patient_search";
import { bilingual as t } from "./i18n";
export type WardContext = PatientContext & {
  revision: number;
  admission: AdmissionDetailOut;
  view: string;
  preflight: (permission: string, allowRecordsCorrection?: boolean) => Promise<void>;
};
export type WardProps = {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  timeZone?: string;
  initialAdmissionId?: number;
  onBack?: (admissionId: number) => void;
};
export function WardAdmission({
  user,
  establishment,
  screenId,
  initialAdmissionId,
  onBack,
  children,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  screenId: string;
  initialAdmissionId?: number;
  onBack?: WardProps["onBack"];
  children: (ctx: WardContext) => ReactNode;
}) {
  const view =
      establishment.views.screens.find((s) => s.screen_id === screenId)?.view ||
      "hidden",
    readable =
      ["full", "open_work", "records"].includes(view) &&
      user.permissions.includes("ipd.admission.view") &&
      user.permissions.includes("patient.view");
  const [id, setId] = useState(initialAdmissionId),
    [tick, setTick] = useState(0),
    [q, setQ] = useState("");
  const beds = useLoad(
    () =>
      readable && user.permissions.includes("ipd.flowsheet.record")
        ? myBeds()
        : Promise.resolve([]),
    [readable, tick],
  );
  const rows = useLoad(
    () => (readable ? listAdmissions() : Promise.resolve([])),
    [readable, tick],
  );
  const row = useLoad(
    () => (readable && id ? getAdmission(id) : Promise.resolve(undefined)),
    [id, tick, readable],
  );
  const admission = row.data?.admission_id === id ? row.data : undefined;
  const profile = useLoad(
    () =>
      admission ? getPatient(admission.patient_id) : Promise.resolve(undefined),
    [admission?.patient_id, tick],
  );
  const patient =
    profile.data?.patient_id === admission?.patient_id
      ? profile.data
      : undefined;
  const ready =
    !!admission &&
    !!patient &&
    !row.loading &&
    !row.error &&
    !profile.loading &&
    !profile.error &&
    !patient.merged_into_id &&
    patient.mrn === admission.mrn;
  const select = (next: number) => {
    if (!mayChangeClinicalContext()) return;
    setId(next);
    setTick((n) => n + 1);
  };
  useEffect(() => {
    if (initialAdmissionId) select(initialAdmissionId);
  }, [initialAdmissionId]);
  useEffect(
    () =>
      window.terminal.subscribe((v) => {
        if (
          (v.type === "event" &&
            [
              "patient.merged",
              "death.recorded",
              "admission.discharge.stage_changed",
              "bed.state_changed",
              "roster.changed",
            ].includes(v.event_type || "")) ||
          (v.type === "stream" && v.status === "Live" && v.resync)
        )
          setTick((n) => n + 1);
      }),
    [],
  );
  if (!readable)
    return (
      <Empty>
        {t(
          "Ward patient records are unavailable to this account or service view.",
          "اس اکاؤنٹ یا خدمت میں وارڈ مریض ریکارڈ دستیاب نہیں۔",
        )}
      </Empty>
    );
  async function preflight(permission: string, allowRecordsCorrection=false) {
    if (!admission || !patient) throw Error("Read patient identity first");
    const [a, p, actor, est] = await Promise.all([
      getAdmission(admission.admission_id),
      getPatient(patient.patient_id),
      api<ClinicalUser>("GET", "/auth/me"),
      api<EstablishmentOut>("GET", "/establishment"),
    ]);
    const current = est.views.screens.find(
      (s) => s.screen_id === screenId,
    )?.view;
    if (
      a.patient_id !== patient.patient_id ||
      a.mrn !== patient.mrn ||
      p.merged_into_id ||
      p.patient_id !== patient.patient_id ||
      actor.user_id !== user.user_id ||
      !actor.permissions.includes(permission) ||
      !["full", "open_work", ...(allowRecordsCorrection?['records']:[])].includes(current || "")
    )
      throw Error(
        t(
          "Patient, permission or service changed. Keep the draft and read current records.",
          "مریض، اجازت یا خدمت بدلی۔ مسودہ رکھ کر تازہ ریکارڈ پڑھیں۔",
        ),
      );
  }
  return (
    <section className="ward-patient">
      <div className="actions">
        <button
          data-help="ward.context"
          disabled={!!document.querySelector('[data-write-pending="true"]')}
          onClick={() => setTick((n) => n + 1)}
        >
          {t("Refresh ward patient", "وارڈ مریض تازہ کریں")}
        </button>
        {onBack && admission && (
          <button
            data-help="ward.context"
            onClick={() => {
              if (mayChangeClinicalContext()) onBack(admission.admission_id);
            }}
          >
            {t("Return to my beds", "میرے بستروں پر واپس")}
          </button>
        )}
      </div>
      <details open={!id}>
        <summary data-help="ward.context">
          {t("Choose a ward patient", "وارڈ مریض چنیں")}
        </summary>
        <LoadState {...beds} retry={beds.reload} />
        {beds.data
          ?.filter((b) => b.admission_id)
          .map((b) => (
            <button
              data-help="ward.context"
              key={b.roster_id + ":" + b.bed_id}
              onClick={() => select(b.admission_id!)}
            >
              {b.ward_name} · {b.bed_label} · {b.patient_name} ·{" "}
              <bdi>{b.mrn}</bdi> · {b.shift_name}
            </button>
          ))}
        <details>
          <summary data-help="ward.context">
            {t("Other permitted live admissions", "دیگر مجاز جاری داخلے")}
          </summary>
          <Field label={t("Find permitted admission", "مجاز داخلہ تلاش")}>
            <input
              data-help="ward.context"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </Field>
          <LoadState {...rows} retry={rows.reload} />
          {rows.data
            ?.filter((r) =>
              [r.patient_name, r.mrn, r.admission_number, r.bed_label]
                .join(" ")
                .toLowerCase()
                .includes(q.toLowerCase()),
            )
            .map((r) => (
              <button
                data-help="ward.context"
                key={r.admission_id}
                onClick={() => select(r.admission_id)}
              >
                {r.patient_name} · <bdi>{r.mrn}</bdi> · {r.ward_name}{" "}
                {r.bed_label} · {r.status}
              </button>
            ))}
          {!rows.loading && !rows.error && !rows.data?.length && (
            <p>
              {t(
                "No live admissions returned. Ask Admissions to check the recorded admission.",
                "کوئی جاری داخلہ نہیں۔ داخلہ ڈیسک سے اصل ریکارڈ چیک کرائیں۔",
              )}
            </p>
          )}
        </details>
      </details>
      <LoadState {...row} retry={row.reload} />
      <LoadState {...profile} retry={profile.reload} />
      {admission && patient && (
        <>
          <section className="card">
            <h2>
              {patient.full_name} · <bdi>{patient.mrn}</bdi>
            </h2>
            <p>
              {admission.admission_number} · {admission.status} ·{" "}
              {admission.ward_name} {admission.bed_label}
            </p>
            <p>
              {t("Age / date of birth", "عمر / تاریخ پیدائش")}:{" "}
              {patient.dob ??
                patient.age_years ??
                t("Not recorded", "درج نہیں")}{" "}
              · {patient.gender} ·{" "}
              {patient.blood_group ||
                t("Blood group not recorded", "خون گروپ درج نہیں")}
            </p>
            <p>
              {t("Allergies", "الرجی")}:{" "}
              {patient.allergies || t("Not recorded", "درج نہیں")}
            </p>
            {patient.is_deceased && (
              <p className="error">
                {t(
                  "Deceased patient: no new orders. Hand over to the responsible clinician.",
                  "وفات: نئے احکامات نہیں۔ ذمہ دار معالج کو دیں۔",
                )}
              </p>
            )}
            {patient.temp_identifier && (
              <p>
                {t("Temporary identity", "عارضی شناخت")}:{" "}
                {patient.temp_identifier}
              </p>
            )}
            {patient.mlc_numbers.length > 0 && (
              <p>MEDICO-LEGAL: {patient.mlc_numbers.join(", ")}</p>
            )}
            {patient.merged_into_id && (
              <p className="error">
                {t(
                  "Merged identity: read the master record before writing.",
                  "ضم شناخت: لکھنے سے پہلے اصل ریکارڈ پڑھیں۔",
                )}
              </p>
            )}
            <details>
              <summary data-help="ward.context">
                {t(
                  "Outstanding dues and linked identity",
                  "بقایا و متعلقہ شناخت",
                )}
              </summary>
              <Details value={patient.outstanding} />
              {patient.merged_profiles.map((p) => (
                <p key={p.patient_id}>{p.mrn}</p>
              ))}
            </details>
            {view !== "full" && (
              <p className="notice">
                {view === "records"
                  ? t(
                      "Records only; only permitted corrections remain available.",
                      "صرف ریکارڈ؛ صرف مجاز تصحیح دستیاب ہے۔",
                    )
                  : t(
                      "No new admissions from now on. Continue existing ward work.",
                      "اب نئے داخلے نہیں۔ موجودہ وارڈ کام جاری رکھیں۔",
                    )}
              </p>
            )}
          </section>
          <div key={admission.admission_id}>
            {children({
              revision: tick,
              admission,
              patient,
              ready,
              view,
              reload: async () => {
                setTick((n) => n + 1);
              },
              preflight,
            })}
          </div>
        </>
      )}
    </section>
  );
}
