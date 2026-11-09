import { useState, type FormEvent } from "react";
import * as blood from "../generated/blood_registers";
import { listUnits } from "../generated/blood_bank";
import { LoadState, useLoad, Field, ErrorBox } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { hospitalTimeToUtc, hospitalTimeInput } from "../hospital-time";
import {
  currentMonth,
  QualityHeading,
  QualityPeriod,
  QualityTable,
  QualityPager,
  type DateRange,
} from "./QualityRegister";
import { QualityPaper } from "./QualityPaper";

const id = "blood_registers";
const groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export function BloodRegisters({
  user,
  connected,
  revision,
  readOnly,
  timeZone,
  view,
  onOpenHelp,
}: {
  user: ClinicalUser;
  connected: boolean;
  revision: number;
  readOnly: boolean;
  noNewWork: boolean;
  timeZone?: string;
  view?: string;
  onOpenHelp: () => void;
}) {
  const [range, setRange] = useState<DateRange>(),
    [cursor, setCursor] = useState<number>();
  const [showUnits, setShowUnits] = useState(false),
    [unitId, setUnitId] = useState<number>(),
    [transfusionId, setTransfusionId] = useState<number>(),
    [showIncident, setShowIncident] = useState(false);
  const [editing, setEditing] = useState(false),
    [checked, setChecked] = useState(false);
  const [status, setStatus] =
    useState<NonNullable<Parameters<typeof listUnits>[0]>["status"]>(
      "Transfused",
    );
  const [inputError, setInputError] = useState<unknown>();
  const period = range ?? currentMonth(timeZone);
  const canRead =
    !!view &&
    ["full", "open_work", "records"].includes(view) &&
    user.permissions.includes("blood.view");
  const stats = useLoad(
    () =>
      canRead && period.date_to
        ? blood.statisticsBlood(period)
        : Promise.resolve(undefined),
    [canRead, period.date_from, period.date_to, revision],
  );
  const units = useLoad(
    () =>
      canRead && showUnits
        ? listUnits({ limit: 100, before_id: cursor, status })
        : Promise.resolve([]),
    [canRead, showUnits, cursor, status, revision],
  );
  const trace = useLoad(
    () =>
      canRead && unitId ? blood.getUnit(unitId) : Promise.resolve(undefined),
    [canRead, unitId, revision],
  );
  const transfusion = useLoad(
    () =>
      canRead && transfusionId
        ? blood.getTransfusion(transfusionId)
        : Promise.resolve(undefined),
    [canRead, transfusionId, revision],
  );
  const use =
    transfusion.data?.transfusion_id === transfusionId
      ? transfusion.data
      : undefined;
  const reaction = use?.reaction_report;
  const incident = useLoad(
    () =>
      canRead && showIncident && reaction
        ? blood.getIncident(reaction.incident_id)
        : Promise.resolve(undefined),
    [canRead, showIncident, reaction?.incident_id, revision],
  );
  const write = useClinicalWrite(user, id, async () => {
    setEditing(false);
    await transfusion.reload();
  });
  if (!canRead) return null;
  const data = !stats.loading && !stats.error ? stats.data : undefined;
  const unit =
    !trace.loading && !trace.error && trace.data?.unit_id === unitId
      ? trace.data
      : undefined;
  const rows = !units.loading && !units.error ? units.data : undefined;
  const ready =
    !!reaction &&
    !!period.date_to &&
    connected &&
    !readOnly &&
    !write.blocked &&
    !transfusion.loading &&
    !transfusion.error &&
    user.permissions.includes("blood.bank.manage");
  const updateAvailable =
    reaction &&
    (!reaction.recipient_group_recheck ||
      !reaction.donor_group_recheck ||
      !reaction.authority_informed_at);
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || !reaction || !checked) return;
    const f = new FormData(e.currentTarget),
      body: blood.RecheckIn = {};
    const recipient = f.get("recipient_group_recheck"),
      donor = f.get("donor_group_recheck"),
      at = f.get("authority_informed_at"),
      ref = String(f.get("authority_reference") ?? "").trim();
    if (!reaction.recipient_group_recheck && recipient)
      body.recipient_group_recheck =
        recipient as blood.RecheckIn["recipient_group_recheck"];
    if (!reaction.donor_group_recheck && donor)
      body.donor_group_recheck =
        donor as blood.RecheckIn["donor_group_recheck"];
    setInputError(undefined);
    if (Boolean(at) !== Boolean(ref)) {
      setInputError(
        Error(
          t(
            "The Authority notice needs both its date and reference.",
            "اتھارٹی اطلاع میں تاریخ اور حوالہ دونوں ضروری ہیں۔",
          ),
        ),
      );
      return;
    }
    if (!reaction.authority_informed_at && at && ref) {
      body.authority_informed_at = hospitalTimeToUtc(String(at), timeZone!);
      body.authority_reference = ref;
    }
    if (!Object.keys(body).length) return;
    write.start({
      method: "POST",
      path: `/blood/reactions/${reaction.reaction_id}/recheck`,
      body,
      permission: "blood.bank.manage",
      protection: "reconcile",
      reconcilePath: `/blood/transfusions/${reaction.transfusion_id}`,
      label: t(
        "Record regrouping or Authority notice",
        "دوبارہ گروپ یا اتھارٹی اطلاع درج",
      ),
    });
  }
  const percentage = (value: number | null) =>
    value === null ? "—" : `${value}%`;
  return (
    <section
      data-screen={id}
      data-unsaved={editing}
      data-write-pending={write.blocked}
    >
      <QualityHeading
        title={t(
          "Blood transfusion: registers and monitoring",
          "خون منتقلی: رجسٹر اور نگرانی",
        )}
        text={t(
          "Read the period’s activity, print the registers or follow a blood unit to its transfusions.",
          "مدت کی سرگرمی پڑھیں، رجسٹر پرنٹ یا خون یونٹ سے منتقلی دیکھیں۔",
        )}
        onHelp={onOpenHelp}
      />
      {view === "open_work" && (
        <p className="notice">
          {t("No new transfusion work from now on.", "اب نئی خون منتقلی نہیں۔")}
        </p>
      )}
      {period.date_to && (
        <QualityPeriod
          range={period}
          maxDays={366}
          apply={setRange}
          disabled={editing || write.blocked}
        />
      )}
      <LoadState {...stats} retry={() => void stats.reload()} />
      {data && (
        <article className="card">
          <h2>
            {data.date_from} – {data.date_to}
          </h2>
          <div className="metric-grid">
            {[
              [
                t("Reactions", "ردعمل"),
                `${data.reactions} / ${data.units_transfused}`,
                percentage(data.reaction_pct),
              ],
              [
                t("Wastage", "ضیاع"),
                `${data.units_discarded} / ${data.units_received}`,
                percentage(data.wastage_pct),
              ],
              [
                t("Component usage", "اجزا کا استعمال"),
                `${data.component_units_transfused} / ${data.units_transfused}`,
                percentage(data.component_usage_pct),
              ],
            ].map(([label, count, pct]) => (
              <article key={label}>
                <h3>{label}</h3>
                <strong>{pct}</strong>
                <p>{count}</p>
              </article>
            ))}
          </div>
          <p>
            {t("Returned to source", "ذریعہ کو واپس")}{" "}
            {data.units_returned_to_source} ·{" "}
            {t("Late endings", "دیر سے اختتام")} {data.transfusions_ended_late}
          </p>
          <h3>
            {t(
              "Issue turnaround by urgency",
              "فوری نوعیت کے مطابق جاری کرنے کا وقت",
            )}
          </h3>
          <QualityTable
            columns={[
              t("Urgency", "فوری نوعیت"),
              t("Issues", "جاری"),
              t("Median minutes", "درمیانی منٹ"),
              t("Longest minutes", "زیادہ سے زیادہ منٹ"),
            ]}
            rows={data.issue_turnaround.map((x) => ({
              key: x.urgency,
              cells: [
                t(
                  x.urgency,
                  { Routine: "معمول", Urgent: "فوری", Emergency: "ہنگامی" }[
                    x.urgency
                  ],
                ),
                x.issues,
                x.median_minutes,
                x.longest_minutes,
              ],
            }))}
            empty={t(
              "No units were issued in this period.",
              "مدت میں کوئی یونٹ جاری نہیں ہوا۔",
            )}
          />
          {!!data.discarded_by_reason.length && (
            <>
              <h3>{t("Discarded by reason", "ضائع کرنے کی وجہ")}</h3>
              <ul>
                {data.discarded_by_reason.map((x) => (
                  <li key={x.discard_reason}>
                    {x.discard_reason} · {x.n}
                  </li>
                ))}
              </ul>
            </>
          )}
          {!!data.transfused_by_component.length && (
            <>
              <h3>{t("Transfused by component", "اجزا کے لحاظ سے منتقلی")}</h3>
              <ul>
                {data.transfused_by_component.map((x) => (
                  <li key={x.component}>
                    {x.component} · {x.n}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p>
            {t(
              "The patient registers name patients. Each patient printed is logged as a read of their record.",
              "رجسٹر مریضوں کے نام رکھتے ہیں۔ ہر پرنٹ مریض کا ریکارڈ پڑھنا درج ہے۔",
            )}
          </p>
          <QualityPaper
            disabled={!connected || write.blocked}
            documents={[
              ["/blood/statistics/pdf", t("statistics", "اعداد")],
              [
                "/blood/registers/transfusions/pdf",
                t("transfusion register", "منتقلی رجسٹر"),
              ],
              [
                "/blood/registers/reactions/pdf",
                t("reaction register", "ردعمل رجسٹر"),
              ],
              ["/blood/storage-checks/pdf", t("storage checks", "ذخیرہ چیک")],
            ].map(([path, label]) => ({
              path: `${path}?${new URLSearchParams(period)}`,
              label,
            }))}
          />
        </article>
      )}
      <article className="card">
        <h2>{t("Follow a blood unit", "خون یونٹ کی پیروی")}</h2>
        <Field label={t("Unit status", "یونٹ حالت")}>
          <select
            data-help="br.unit"
            disabled={editing || write.blocked}
            value={status ?? ""}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setCursor(undefined);
              setUnitId(undefined);
              setTransfusionId(undefined);
            }}
          >
            {Object.entries({
              Transfused: "منتقل",
              Discarded: "ضائع",
              ReturnedToSource: "ذریعہ کو واپس",
              InStock: "اسٹاک میں",
              Reserved: "محفوظ",
              Issued: "جاری",
            }).map(([value, ur]) => (
              <option key={value} value={value}>
                {t(value, ur)}
              </option>
            ))}
          </select>
        </Field>
        <button
          data-help="br.unit"
          disabled={editing || write.blocked}
          onClick={() => {
            setShowUnits(true);
            void units.reload();
          }}
        >
          {t("Read blood units", "خون یونٹ پڑھیں")}
        </button>
        {showUnits && (
          <>
            <LoadState {...units} retry={() => void units.reload()} />
            {rows && (
              <>
                <QualityTable
                  columns={[
                    t("Unit", "یونٹ"),
                    t("Component", "جزو"),
                    t("Group", "گروپ"),
                    t("Status", "حالت"),
                  ]}
                  rows={rows.map((x) => ({
                    key: x.unit_id,
                    cells: [
                      <button
                        data-help="br.unit"
                        disabled={editing || write.blocked}
                        onClick={() => {
                          setUnitId(x.unit_id);
                          setTransfusionId(undefined);
                          setShowIncident(false);
                        }}
                      >
                        {x.unit_number}
                      </button>,
                      x.component,
                      `${x.abo} ${x.rh}`,
                      x.status,
                    ],
                  }))}
                  empty={t(
                    "No blood units are recorded.",
                    "خون یونٹ درج نہیں۔",
                  )}
                />
                <QualityPager
                  cursor={cursor}
                  next={rows.length === 100 ? rows.at(-1)?.unit_id : undefined}
                  disabled={editing || write.blocked}
                  onPage={setCursor}
                />
              </>
            )}
          </>
        )}
      </article>
      {unitId && <LoadState {...trace} retry={() => void trace.reload()} />}
      {unit && (
        <article className="card">
          <h2>{unit.unit_number}</h2>
          <p>
            {unit.component} · {unit.status}
          </p>
          <QualityTable
            columns={[
              t("Request", "درخواست"),
              t("Patient", "مریض"),
              t("Status", "حالت"),
              t("Reaction", "ردعمل"),
            ]}
            rows={unit.transfusions.map((x) => ({
              key: x.transfusion_id,
              cells: [
                <button
                  data-help="br.unit"
                  disabled={editing || write.blocked}
                  onClick={() => {
                    setTransfusionId(x.transfusion_id);
                    setShowIncident(false);
                  }}
                >
                  {x.request_number}
                </button>,
                `${x.patient_name} · ${x.mrn}`,
                x.status,
                x.reaction
                  ? t("Reported", "درج")
                  : t("Not recorded", "درج نہیں"),
              ],
            }))}
            empty={t(
              "This unit has no transfusion record.",
              "اس یونٹ کی منتقلی درج نہیں۔",
            )}
          />
        </article>
      )}
      {transfusionId && (
        <LoadState {...transfusion} retry={() => void transfusion.reload()} />
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          setEditing(false);
          void transfusion.reload();
        }}
      />
      {use && (
        <article className="card">
          <h2>
            {use.request_number} · {use.unit_number}
          </h2>
          <p>
            {use.patient_name} · {use.mrn} · {use.status}
          </p>
          {reaction && (
            <>
              <h3>{t("Transfusion reaction", "منتقلی ردعمل")}</h3>
              <p>
                {reaction.reaction_type} · {reaction.reaction_class}
              </p>
              <p>{reaction.signs}</p>
              <p>{reaction.action_taken}</p>
              <p>{reaction.reported_stamp.text}</p>
              <p>
                {t(
                  "Recipient and donor rechecks",
                  "مریض اور عطیہ دہندہ دوبارہ چیک",
                )}{" "}
                · {reaction.recipient_group_recheck ?? "—"} ·{" "}
                {reaction.donor_group_recheck ?? "—"}
              </p>
              <p>
                {t("Authority notice", "اتھارٹی اطلاع")} ·{" "}
                {reaction.authority_informed_at ?? "—"} ·{" "}
                {reaction.authority_reference ?? "—"}
              </p>
              <button
                data-help="br.incident"
                disabled={editing || write.blocked}
                onClick={() => setShowIncident(true)}
              >
                {t("Read incident", "واقعہ پڑھیں")} {reaction.incident_number}
              </button>
              {showIncident && (
                <>
                  <LoadState
                    {...incident}
                    retry={() => void incident.reload()}
                  />
                  {!incident.loading &&
                    !incident.error &&
                    incident.data?.incident_id === reaction.incident_id && (
                      <p>
                        {incident.data.incident_number} ·{" "}
                        {incident.data.type_name} · {incident.data.status}.{" "}
                        {t(
                          "Analysis and actions live in the incident register.",
                          "تجزیہ اور اقدامات واقعہ رجسٹر میں ہیں۔",
                        )}
                      </p>
                    )}
                </>
              )}
              <QualityPaper
                disabled={!connected || write.blocked}
                documents={[
                  {
                    label: t("reaction report", "ردعمل رپورٹ"),
                    path: `/blood/reactions/${reaction.reaction_id}/pdf`,
                  },
                ]}
              />
              {ready && updateAvailable && !editing && (
                <button
                  data-help="br.recheck"
                  onClick={() => {
                    setEditing(true);
                    setChecked(false);
                    write.clearError();
                  }}
                >
                  {t(
                    "Record recheck or Authority notice",
                    "دوبارہ چیک یا اتھارٹی اطلاع درج",
                  )}
                </button>
              )}
              {editing && (
                <form onSubmit={save} onChange={() => setChecked(false)}>
                  <ErrorBox error={inputError} />
                  <fieldset disabled={!ready}>
                    {[
                      [
                        "recipient_group_recheck",
                        t("Recipient group on recheck", "مریض دوبارہ گروپ"),
                      ],
                      [
                        "donor_group_recheck",
                        t("Donor group on recheck", "عطیہ دہندہ دوبارہ گروپ"),
                      ],
                    ].map(
                      ([name, label]) =>
                        !reaction[
                          name as
                            "recipient_group_recheck" | "donor_group_recheck"
                        ] && (
                          <Field key={name} label={label}>
                            <select name={name} data-help="br.recheck">
                              <option value="">
                                {t("Leave unrecorded", "غیر درج رہنے دیں")}
                              </option>
                              {groups.map((g) => (
                                <option key={g}>{g}</option>
                              ))}
                            </select>
                          </Field>
                        ),
                    )}
                    {!reaction.authority_informed_at && (
                      <>
                        <Field
                          label={t("Authority told at", "اتھارٹی اطلاع وقت")}
                        >
                          <input
                            type="datetime-local"
                            name="authority_informed_at"
                            data-help="br.recheck"
                            max={
                              timeZone
                                ? hospitalTimeInput(Date.now(), timeZone)
                                : undefined
                            }
                          />
                        </Field>
                        <Field
                          label={t("Authority reference", "اتھارٹی حوالہ")}
                        >
                          <input
                            name="authority_reference"
                            data-help="br.recheck"
                          />
                        </Field>
                      </>
                    )}
                    <label className="check">
                      <input
                        type="checkbox"
                        data-help="br.recheck"
                        checked={checked}
                        onChange={(e) => {
                          e.stopPropagation();
                          setChecked(e.target.checked);
                        }}
                      />
                      {t(
                        "These are the actual checks and notice. Each is final.",
                        "یہ اصل چیک و اطلاع ہیں۔ ہر ایک حتمی ہے۔",
                      )}
                    </label>
                    <button
                      type="submit"
                      data-help="br.recheck"
                      disabled={!checked}
                    >
                      {t("Save recorded facts", "درج حقائق محفوظ")}
                    </button>
                  </fieldset>
                  <button
                    type="button"
                    data-help="br.recheck"
                    disabled={write.blocked}
                    onClick={() => setEditing(false)}
                  >
                    {t("Cancel unsent changes", "غیر ارسال تبدیلی منسوخ")}
                  </button>
                </form>
              )}
            </>
          )}
        </article>
      )}
    </section>
  );
}
