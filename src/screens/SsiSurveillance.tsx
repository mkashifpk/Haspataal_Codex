import { useState, type FormEvent } from "react";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { Field, LoadState, Modal, useLoad } from "../components";
import * as ssi from "../generated/ssi_surveillance";
import { getPatient } from "../generated/patient_search";
import { bilingual as t } from "../i18n";
import { currentMonth, QualityHeading, QualityPeriod } from "./QualityRegister";
import {
  ConfirmEntry,
  formText,
  permission,
  percent,
  ReportTable,
  ServiceNotice,
  type P9cProps,
} from "./P9cShared";
import { depths, PatientIdentity } from "./InfectionCases";

export type WoundTarget = Pick<
  ssi.SurveillanceOut,
  | "booking_id"
  | "booking_number"
  | "patient_id"
  | "mrn"
  | "patient_name"
  | "procedure_name"
>;
const methods = {
  Ward: "وارڈ",
  OPD: "بیرونی مریض",
  Telephone: "فون",
  HomeVisit: "گھر دورہ",
} as const;
const findings = {
  Healed: "مندمل",
  Healing: "مندمل ہو رہا ہے",
  SignsOfInfection: "انفیکشن علامات",
  NotAssessed: "جانچ نہیں ہوئی",
} as const;
const states = {
  Overdue: "تاخیر",
  Due: "مقرر",
  InWindow: "مدت میں",
  Complete: "مکمل",
} as const;
function options(values: Record<string, string>) {
  return Object.entries(values).map(([code, ur]) => (
    <option key={code} value={code}>
      {t(code, ur)}
    </option>
  ));
}

export function WoundCheck({
  user,
  connected,
  revision,
  timeZone,
  target,
  scope,
  close,
  after,
}: P9cProps & {
  target: WoundTarget;
  scope: string;
  close: () => void;
  after: () => void | Promise<void>;
}) {
  const [wound, setWound] = useState<ssi.SsiCheckIn["wound"]>("Healing");
  const [answer, setAnswer] = useState<ssi.SurveillanceDetailOut>();
  const identity = useLoad(
    () => getPatient(target.patient_id),
    [target.patient_id, revision],
  );
  const patient =
    !identity.loading &&
    !identity.error &&
    identity.data?.patient_id === target.patient_id
      ? identity.data
      : undefined;
  const authority = permission(
    user,
    "infection.control.manage",
    "infection.case.report",
  );
  const write = useClinicalWrite(user, scope, async (value) => {
    setAnswer(value);
    await after();
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !authority ||
      !connected ||
      !patient ||
      patient.is_deceased ||
      patient.merged_into_id ||
      write.blocked ||
      answer
    )
      return;
    const f = new FormData(e.currentTarget);
    const note = formText(f, "note");
    const depth = formText(f, "depth") as ssi.SsiCheckIn["ssi_depth"];
    if (wound === "SignsOfInfection" && (!note || !depth)) return;
    const body: ssi.SsiCheckIn = {
      checked_on: formText(f, "date") || undefined,
      method: formText(f, "method") as ssi.SsiCheckIn["method"],
      wound,
      note: note || undefined,
      ssi_depth: wound === "SignsOfInfection" ? depth : undefined,
    };
    write.start({
      method: "POST",
      path: "/ot/bookings/" + target.booking_id + "/ssi-checks",
      permission: authority,
      body,
      protection: "idempotent",
      label: t("Record wound check", "زخم جانچ درج کریں"),
    });
  }
  return (
    <Modal
      title={t("Record wound check", "زخم جانچ درج کریں")}
      closable={!write.blocked}
      onClose={close}
    >
      <div data-write-pending={write.blocked}>
      <p>
        {target.booking_number} · {target.procedure_name} ·{" "}
        {target.patient_name} · <bdi>{target.mrn}</bdi>
      </p>
      <LoadState {...identity} retry={identity.reload} />
      {patient && <PatientIdentity patient={patient} />}
      {answer ? (
        <ReportTable
          title={t("Server recorded checks", "سرور کی درج جانچ")}
          columns={[
            t("Date and method", "تاریخ اور طریقہ"),
            t("Wound", "زخم"),
            t("Checked by", "جانچ کنندہ"),
          ]}
          rows={answer.check_list.map((x) => ({
            key: x.check_id,
            cells: [
              x.checked_on + " · " + t(x.method, methods[x.method]),
              t(x.wound, findings[x.wound]) + " · " + (x.note ?? "—"),
              x.checked_by_name,
            ],
          }))}
        />
      ) : (
        <form className="form" onSubmit={submit}>
          <fieldset disabled={write.blocked}>
            <Field label={t("Check date", "جانچ تاریخ")}>
              <input
                data-help="ipc.wound"
                name="date"
                type="date"
                max={currentMonth(timeZone).date_to}
              />
            </Field>
            <Field label={t("Method", "طریقہ")}>
              <select data-help="ipc.wound" name="method">
                {options(methods)}
              </select>
            </Field>
            <Field label={t("Wound finding", "زخم نتیجہ")}>
              <select
                data-help="ipc.wound"
                value={wound}
                onChange={(e) => setWound(e.target.value as typeof wound)}
              >
                {options(findings)}
              </select>
            </Field>
            {wound === "SignsOfInfection" && (
              <>
                <p>
                  {t(
                    "Signs of infection open a suspected case automatically.",
                    "انفیکشن علامات پر مشتبہ کیس خود کھلے گا۔",
                  )}
                </p>
                <Field label={t("Suspected depth", "مشتبہ گہرائی")}>
                  <select data-help="ipc.wound" name="depth" required>
                    <option value="">—</option>
                    {options(depths)}
                  </select>
                </Field>
              </>
            )}
            <Field label={t("Check note", "جانچ نوٹ")}>
              <textarea
                data-help="ipc.wound"
                name="note"
                required={wound === "SignsOfInfection"}
                maxLength={2000}
              />
            </Field>
            <ConfirmEntry />
          </fieldset>
          <button
            className="primary"
            data-help="p9c.write"
            disabled={
              !connected ||
              !patient ||
              patient.is_deceased ||
              !!patient.merged_into_id ||
              write.blocked
            }
          >
            {t("Confirm wound check", "زخم جانچ کی تصدیق")}
          </button>
        </form>
      )}
      <ClinicalWriteFeedback write={write} />
      </div>
    </Modal>
  );
}

export function SsiSurveillance(props: P9cProps) {
  const { user, connected, revision, timeZone, view, onOpenHelp } = props;
  const allowed = !!permission(
    user,
    "infection.control.manage",
    "infection.statistics.view",
  );
  const writable =
    connected &&
    view !== "records" &&
    !!permission(user, "infection.control.manage", "infection.case.report");
  const [range, setRange] = useState(() => currentMonth(timeZone));
  const [state, setState] = useState<keyof typeof states | "">("");
  const [surgeon, setSurgeon] = useState<number>();
  const [target, setTarget] = useState<WoundTarget>();
  const roster = useLoad(
    () => (allowed ? ssi.ssiSurveillance({ limit: 500 }) : Promise.resolve([])),
    [allowed, revision],
  );
  const filtered = useLoad(
    () =>
      allowed && (state || surgeon)
        ? ssi.ssiSurveillance({
            state: state || undefined,
            surgeon_id: surgeon,
            limit: 500,
          })
        : Promise.resolve([]),
    [allowed, state, surgeon, revision],
  );
  const list = state || surgeon ? filtered : roster;
  const rates = useLoad(
    () =>
      allowed && range.date_from
        ? ssi.ssiRates(range)
        : Promise.resolve(undefined),
    [allowed, range, revision],
  );
  const surgeons = new Map(
    (roster.data ?? []).map((x) => [x.primary_surgeon_id, x.surgeon_name]),
  );
  const order = Object.keys(states);
  return (
    <section data-screen="ssi_surveillance" data-unsaved={!!target}>
      <QualityHeading
        title={t("Wound surveillance", "زخم نگرانی")}
        text={t(
          "Follow operated patients, with overdue and due checks first.",
          "آپریشن شدہ مریضوں کی پیروی کریں۔ تاخیر اور مقررہ جانچ پہلے۔",
        )}
        onHelp={onOpenHelp}
      />
      <ServiceNotice view={view} />
      <div className="toolbar">
        <Field label={t("Follow-up state", "پیروی حالت")}>
          <select
            data-help="ipc.wound"
            value={state}
            onChange={(e) => setState(e.target.value as typeof state)}
          >
            <option value="">{t("All states", "تمام حالتیں")}</option>
            {options(states)}
          </select>
        </Field>
        <Field label={t("Surgeon", "سرجن")}>
          <select
            data-help="ipc.wound"
            value={surgeon ?? ""}
            onChange={(e) =>
              setSurgeon(
                [...surgeons.keys()].find(
                  (id) => String(id) === e.target.value,
                ),
              )
            }
          >
            <option value="">{t("All surgeons", "تمام سرجن")}</option>
            {[...surgeons].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <LoadState {...list} retry={list.reload} />
      {!list.loading && !list.error && (
        <ReportTable
          title={t("Postoperative follow-up", "آپریشن کے بعد پیروی")}
          columns={[
            t("Operation and patient", "آپریشن اور مریض"),
            t("Surgeon and wound", "سرجن اور زخم"),
            t("Follow-up", "پیروی"),
            t("Action", "عمل"),
          ]}
          rows={[...(list.data ?? [])]
            .sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state))
            .map((x) => ({
              key: x.booking_id,
              cells: [
                <>
                  {x.booking_number} · {x.procedure_name}
                  <br />
                  {x.patient_name} · <bdi>{x.mrn}</bdi>
                </>,
                <>
                  {x.surgeon_name} · {x.ot_name} · {x.wound_class ?? "—"}{" "}
                  {x.implant_left && t("Implant", "امپلانٹ")}
                  <br />
                  {x.operated_on}
                </>,
                <>
                  {t(x.state, states[x.state])} · {x.day}/{x.window_days} ·{" "}
                  {x.checks} {t("checks", "جانچ")}
                  <br />
                  {x.last_check ?? "—"} · {x.infection ?? "—"}
                </>,
                writable && (
                  <button
                    type="button"
                    data-help="ipc.wound"
                    onClick={() => setTarget(x)}
                  >
                    {t("Record wound check", "زخم جانچ درج کریں")}
                  </button>
                ),
              ],
            }))}
        />
      )}
      <QualityPeriod range={range} apply={setRange} />
      <LoadState {...rates} retry={rates.reload} />
      {rates.data && !rates.error && !rates.loading && (
        <div className="card">
          <h2>{t("Surgical site infection rate", "جراحی مقام انفیکشن شرح")}</h2>
          <p>
            {rates.data.infections} / {rates.data.operations} ·{" "}
            {percent(rates.data.rate_pct)} ·{" "}
            {t("Surveillance complete", "نگرانی مکمل")}{" "}
            {percent(rates.data.surveillance_complete_pct)}
          </p>
        </div>
      )}
      {target && (
        <WoundCheck
          {...props}
          scope="ssi_surveillance"
          target={target}
          close={() => setTarget(undefined)}
          after={async () => {
            await Promise.all([
              roster.reload(),
              filtered.reload(),
              rates.reload(),
            ]);
          }}
        />
      )}
    </section>
  );
}
