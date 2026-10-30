import { useEffect, useState } from "react";
import * as a from "../generated/doctor_inpatients";
import { api, ApiError } from "../bridge";
import { Field, LoadState, ErrorBox, Details, useLoad } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import { bilingual as t } from "../i18n";

export function TreatingDoctor({
  record,
  user,
  view,
  live,
  locked,
  revision,
  onChanged,
  onBusy,
}: {
  record: a.AdmissionDetailOut;
  user: ClinicalUser;
  view?: string;
  live: boolean;
  locked: boolean;
  revision: number;
  onChanged: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [query, setQuery] = useState(""),
    [target, setTarget] = useState(""),
    [reason, setReason] = useState(""),
    [editing, setEditing] = useState(false),
    [review, setReview] = useState<a.TreatingDoctorIn>(),
    [error, setError] = useState<unknown>();
  const history = useLoad(
    () => a.getTreatingDoctor(record.admission_id),
    [record.admission_id, revision],
  );
  const doctors = useLoad(
    () =>
      editing && query.trim().length >= 2
        ? a.lookupStaff({ q: query.trim(), license_type: "PMDC", limit: 20 })
        : Promise.resolve([]),
    [editing, query, revision],
  );
  const write = useClinicalWrite(
    user,
    "treating-doctor:" + record.admission_id,
    async (value) => {
      if (
        value.admission_id !== record.admission_id ||
        value.patient_id !== record.patient_id
      )
        throw Error(
          "Treating doctor response identity differs. Read current records.",
        );
      setEditing(false);
      setReview(undefined);
      setReason("");
      onChanged();
    },
  );
  const waiting = record.primary_doctor_id === null,
    mine = record.primary_doctor_id === user.employee_id;
  const allowed =
    ["full", "open_work"].includes(view || "") &&
    !["Discharged", "Cancelled"].includes(record.status) &&
    user.permissions.includes("ipd.admission.request") &&
    (waiting || mine);
  useEffect(() => {
    onBusy(write.blocked);
    return () => onBusy(false);
  }, [write.blocked]);
  useEffect(() => {
    setReview(undefined);
  }, [revision, record.primary_doctor_id]);
  useEffect(() => {
    if (
      write.error instanceof ApiError &&
      ["TREATING_DOCTOR_ONLY", "NOT_FOUND"].includes(
        write.error.response.error?.code || "",
      )
    ) {
      setReview(undefined);
      onChanged();
    }
  }, [write.error]);
  function send() {
    if (!review || !live || locked || write.blocked || !allowed) return;
    const expected = record.primary_doctor_id;
    write.start(
      {
        method: "POST",
        path: `/admissions/${record.admission_id}/treating-doctor`,
        body: review,
        permission: "ipd.admission.request",
        protection: "idempotent",
        label: t("Change treating doctor", "معالج بدلیں"),
      },
      async () => {
        const [fresh, actor, est] = await Promise.all([
          a.getTreatingDoctor(record.admission_id),
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
        ]);
        const currentView = est.views.screens.find(
          (s) => s.screen_id === "doctor_inpatients",
        )?.view;
        if (
          !["full", "open_work"].includes(currentView || "") ||
          ["Discharged", "Cancelled"].includes(fresh.status) ||
          actor.user_id !== user.user_id ||
          fresh.primary_doctor_id !== expected ||
          !(
            fresh.primary_doctor_id === null ||
            fresh.primary_doctor_id === actor.employee_id
          )
        )
          throw Error(
            t(
              "The treating doctor or service changed. Read the history and review again.",
              "معالج یا خدمت بدلی۔ تاریخ پڑھ کر دوبارہ جائزہ لیں۔",
            ),
          );
      },
    );
  }
  return (
    <section
      className="card"
      data-unsaved={editing}
      data-write-pending={write.blocked}
    >
      <h3>{t("Treating doctor and handover", "معالج اور حوالگی")}</h3>
      <p>
        {waiting
          ? t("Doctor: waiting", "ڈاکٹر: منتظر")
          : record.primary_doctor_name}
      </p>
      <LoadState {...history} retry={history.reload} />
      {!history.loading &&
        !history.error &&
        history.data?.changes.map((c) => (
          <p key={c.change_id}>
            {c.kind} · {c.from_doctor_name || t("Waiting", "منتظر")} →{" "}
            {c.to_doctor_name} · {c.reason} · {c.changed_by_name} ·{" "}
            {c.changed_at}
          </p>
        ))}
      {allowed && !editing && (
        <button
          data-help="inpatients.details"
          disabled={!live || locked}
          onClick={() => {
            setEditing(true);
            setTarget(waiting ? String(user.employee_id || "") : "");
            setReview(undefined);
          }}
        >
          {waiting
            ? t("Take this patient", "اس مریض کی ذمہ داری لیں")
            : t("Hand over to another doctor", "دوسرے ڈاکٹر کو حوالہ دیں")}
        </button>
      )}
      {!allowed && !waiting && !mine && (
        <p>
          {t(
            "This patient is another doctor’s. A Hospital Admin or Director can reassign while the doctor is away.",
            "یہ مریض دوسرے ڈاکٹر کا ہے۔ غیر موجودگی میں ہسپتال ایڈمن یا ڈائریکٹر معالج بدل سکتے ہیں۔",
          )}
        </p>
      )}
      {editing && (
        <fieldset disabled={write.blocked || locked}>
          {!waiting && (
            <>
              <Field label={t("Find PMDC doctor", "پی ایم ڈی سی ڈاکٹر تلاش")}>
                <input
                  data-help="inpatients.details"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setTarget("");
                    setReview(undefined);
                  }}
                />
              </Field>
              <LoadState {...doctors} retry={doctors.reload} />
              <Field label={t("Receiving doctor", "ذمہ داری لینے والا ڈاکٹر")}>
                <select
                  data-help="inpatients.details"
                  data-field="doctor_id"
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setReview(undefined);
                  }}
                >
                  <option value="">{t("Choose doctor", "ڈاکٹر چنیں")}</option>
                  {doctors.data
                    ?.filter((d) => d.employee_id !== record.primary_doctor_id)
                    .map((d) => (
                      <option key={d.employee_id} value={d.employee_id}>
                        {d.full_name} · {d.registration} · {d.department_name}
                      </option>
                    ))}
                </select>
              </Field>
            </>
          )}
          <Field
            label={t(
              "Reason for taking over / handover",
              "ذمہ داری لینے یا حوالگی کی وجہ",
            )}
          >
            <textarea
              data-help="inpatients.details"
              data-field="reason"
              value={reason}
              maxLength={500}
              onChange={(e) => {
                setReason(e.target.value);
                setReview(undefined);
              }}
            />
          </Field>
          <button
            data-help="inpatients.review"
            disabled={!live || reason.trim().length < 3 || !target}
            onClick={() => {
              setError(undefined);
              if (
                !waiting &&
                !doctors.data?.some((d) => String(d.employee_id) === target)
              ) {
                setError(Error("Select a returned PMDC doctor."));
                return;
              }
              setReview({ doctor_id: Number(target), reason: reason.trim() });
            }}
          >
            {t("Review handover", "حوالگی کا جائزہ")}
          </button>
          {review && (
            <>
              <p>
                {t(
                  "Takes effect immediately; the receiving doctor does not accept separately.",
                  "فوراً نافذ ہوگا؛ دوسرے ڈاکٹر کی الگ منظوری نہیں۔",
                )}
              </p>
              <Details value={review} />
              <button
                data-help="inpatients.confirm"
                disabled={!live}
                onClick={send}
              >
                {t("Confirm treating doctor", "معالج کی تصدیق")}
              </button>
            </>
          )}
          <button
            data-help="inpatients.review"
            onClick={() => {
              setEditing(false);
              setReview(undefined);
            }}
          >
            {t("Close handover", "حوالگی بند کریں")}
          </button>
        </fieldset>
      )}
      <ErrorBox error={error} />
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          setReview(undefined);
          onChanged();
        }}
      />
    </section>
  );
}
