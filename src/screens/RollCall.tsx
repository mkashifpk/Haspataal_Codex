import { useEffect, useRef, useState } from "react";
import { api, getWithClock } from "../bridge";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { formatHospitalTime, hospitalTimeInput } from "../hospital-time";
import { canRetryWrite } from "../write-attempt";
import type {
  RollCallEntryOut,
  RollCallSheetOut,
  RollCallIn,
  RollCallOut,
} from "../generated/roll_call";
import {
  dutyWindow,
  rollCallBody,
  rollCallEditable,
  sameRollCallDuty,
} from "../roll-call-policy";

type Review = {
  rows: RollCallEntryOut[];
  body: RollCallIn;
  times: Record<number, string>;
};
export function RollCall({
  user,
  connected,
  stream,
  timeZone,
}: {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  timeZone?: string;
}) {
  const allowed = user.permissions.includes("attendance.roll_call"),
    hr = user.permissions.includes("roster.manage.all");
  const [date, setDate] = useState(""),
    [dateInput, setDateInput] = useState(""),
    [revision, setRevision] = useState(0);
  const [dutyDate, setDutyDate] = useState(""),
    [ward, setWard] = useState(""),
    [shift, setShift] = useState(""),
    [find, setFind] = useState("");
  const [times, setTimes] = useState<Record<number, string>>({}),
    [selected, setSelected] = useState<number[]>([]);
  const [review, setReview] = useState<Review>(),
    [ack, setAck] = useState(false),
    [error, setError] = useState<unknown>(),
    [last, setLast] = useState<{
      rows: RollCallEntryOut[];
      value: RollCallOut;
    }>();
  const [observed, setObserved] = useState<RollCallSheetOut>(),
    [reading, setReading] = useState(false);
  const [preparing, setPreparing] = useState(false),
    reviewFlight = useRef(false);
  const live = connected && stream === "Live",
    active = useRef({ live, user });
  active.current = { live, user };
  const query = date ? "?roster_date=" + encodeURIComponent(date) : "";
  const clock = useLoad(
    () => getWithClock<ClinicalUser>("/auth/me"),
    [user.user_id, revision],
  );
  const sheet = useLoad(
    () =>
      allowed
        ? api<RollCallSheetOut>("GET", "/rosters/roll-call" + query)
        : Promise.resolve(undefined),
    [allowed, query, revision],
  );
  const data = !sheet.loading && !sheet.error ? sheet.data : undefined;
  const rows = data?.entries || [],
    dates = [...new Set(rows.map((r) => r.roster_date))].sort();
  const chosenDate = dutyDate || dates[0] || "",
    currentRows = rows.filter((r) => r.roster_date === chosenDate);
  const visible = currentRows.filter(
    (r) =>
      (!ward || String(r.ward_id) === ward) &&
      (!shift || String(r.shift_pattern_id) === shift) &&
      (!find ||
        (r.full_name + " " + r.emp_number + " " + r.designation)
          .toLowerCase()
          .includes(find.toLowerCase())),
  );
  const write = useClinicalWrite(user, "roll_call", async (value, command) => {
    const saved = command.body as RollCallIn;
    setLast({ rows: review?.rows || [], value: value as RollCallOut });
    setSelected([]);
    setTimes({});
    setReview(undefined);
    setAck(false);
    setObserved(undefined);
    setRevision((v) => v + 1);
    if (saved.roster_date) setDutyDate(saved.roster_date);
  });
  const locked = write.blocked || !!review || preparing,
    dirty = selected.length > 0;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const off = window.terminal.subscribe((e) => {
      if (
        (e.type === "event" && e.event_type === "roster.changed") ||
        (e.type === "stream" && e.status === "Live" && e.resync)
      ) {
        clearTimeout(timer);
        timer = setTimeout(() => setRevision((v) => v + 1), 250);
      }
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, []);
  function eligible(row: RollCallEntryOut) {
    try {
      return (
        !!timeZone &&
        !!clock.data?.now &&
        rollCallEditable(row, clock.data.now, timeZone, hr)
      );
    } catch {
      return false;
    }
  }
  function changeScope(fn: () => void) {
    if (locked) return;
    if (
      dirty &&
      !window.confirm(
        t(
          "Discard the unsent arrival selection?",
          "غیر ارسال حاضری کا انتخاب ختم کریں؟",
        ),
      )
    )
      return;
    setSelected([]);
    setTimes({});
    setError(undefined);
    setLast(undefined);
    fn();
  }
  async function openReview() {
    if (reviewFlight.current) return;
    reviewFlight.current = true;
    setPreparing(true);
    try {
      if (
        !live ||
        !data ||
        !timeZone ||
        !clock.data?.now ||
        clock.error ||
        clock.loading
      )
        throw new Error(
          t(
            "Refresh the live sheet and hospital clock before recording attendance.",
            "حاضری سے پہلے اصل فہرست اور ہسپتال کا وقت تازہ کریں۔",
          ),
        );
      const picked = selected.map((id) => {
        const r = rows.find((r) => r.roster_id === id);
        if (!r)
          throw new Error(
            t(
              "A selected duty changed. Refresh and select again.",
              "منتخب ڈیوٹی بدل گئی۔ تازہ کرکے دوبارہ چنیں۔",
            ),
          );
        return r;
      });
      const freshClock = await getWithClock<ClinicalUser>("/auth/me");
      const body = rollCallBody(picked, times, freshClock.now, timeZone, hr);
      setReview({ rows: structuredClone(picked), body, times: { ...times } });
      setAck(false);
      setError(undefined);
    } catch (e) {
      setError(e);
    } finally {
      reviewFlight.current = false;
      setPreparing(false);
    }
  }
  function submit() {
    if (!review || !ack || !live || write.blocked) return;
    const frozen = review;
    write.start(
      {
        method: "POST",
        path: "/rosters/roll-call",
        body: frozen.body,
        permission: "attendance.roll_call",
        protection: "idempotent",
        reconcilePath:
          "/rosters/roll-call?roster_date=" + frozen.body.roster_date,
        label: t("Record actual arrivals", "اصل حاضری درج کریں"),
      },
      async () => {
        if (!active.current.live)
          throw new Error(
            t(
              "Reconnect before recording attendance.",
              "حاضری سے پہلے رابطہ بحال کریں۔",
            ),
          );
        const freshClock = await getWithClock<ClinicalUser>("/auth/me");
        if (!freshClock.data.permissions.includes("attendance.roll_call"))
          throw new Error(
            t(
              "Attendance permission changed. Sign in again.",
              "حاضری کی اجازت بدل گئی۔ دوبارہ داخل ہوں۔",
            ),
          );
        const fresh = await api<RollCallSheetOut>(
          "GET",
          "/rosters/roll-call?roster_date=" + frozen.body.roster_date,
        );
        for (const r of frozen.rows) {
          const actual = fresh.entries.find((a) => a.roster_id === r.roster_id);
          if (!actual || !sameRollCallDuty(r, actual)) {
            setRevision((v) => v + 1);
            throw new Error(
              t(
                "A duty or arrival changed. Close this review, refresh and compare before selecting again.",
                "ڈیوٹی یا حاضری بدل گئی۔ جائزہ بند، تازہ اور موازنہ کرکے دوبارہ چنیں۔",
              ),
            );
          }
        }
        rollCallBody(
          frozen.rows,
          frozen.times,
          freshClock.now,
          timeZone!,
          freshClock.data.permissions.includes("roster.manage.all"),
        );
      },
    );
  }
  const stamp = (s: string) => {
    try {
      return timeZone ? formatHospitalTime(s, timeZone) : s;
    } catch {
      return s;
    }
  };
  const source = (s: string | null) =>
    s === "Badge"
      ? t("Badge", "بیج")
      : s === "RollCall"
        ? t("Roll call", "حاضری")
        : s === "Manual"
          ? t("HR correction", "ایچ آر تصحیح")
          : t("Not arrived", "نہیں پہنچے");
  return (
    <section
      className="roll-call"
      data-unsaved={dirty ? "true" : undefined}
      data-write-pending={write.blocked ? "true" : undefined}
    >
      <header className="page-title">
        <div>
          <h1>{t("Roll call", "حاضری کی فہرست")}</h1>
          <p>
            {t(
              "Confirm who has actually arrived for their rostered shift.",
              "ڈیوٹی کی شفٹ میں واقعی پہنچنے والوں کی تصدیق کریں۔",
            )}
          </p>
        </div>
      </header>
      {!allowed ? (
        <p role="alert">
          {t(
            "You do not have permission to record roll call.",
            "آپ کو حاضری درج کرنے کی اجازت نہیں۔",
          )}
        </p>
      ) : (
        <>
          <p className="notice">
            {t(
              "Tick only staff you have seen arrive. Arrivals are permanent attendance records; ask HR for a correction. No badge scan or print is needed here.",
              "صرف واقعی پہنچے عملے کو چنیں۔ حاضری مستقل ریکارڈ ہے؛ تصحیح کے لیے ایچ آر سے کہیں۔ یہاں بیج اسکین یا پرنٹ ضروری نہیں۔",
            )}
          </p>
          <div className="toolbar">
            <button
              data-help="rollcall.refresh"
              disabled={write.busy}
              onClick={() => setRevision((v) => v + 1)}
            >
              {t("Refresh sheet", "فہرست تازہ کریں")}
            </button>
            <button
              data-help="rollcall.period"
              disabled={locked}
              onClick={() =>
                changeScope(() => {
                  setDate("");
                  setDateInput("");
                  setDutyDate("");
                  setWard("");
                  setShift("");
                })
              }
            >
              {t("Today and running night shift", "آج اور جاری رات کی شفٹ")}
            </button>
            <Field label={t("Read a roster date", "روسٹر تاریخ پڑھیں")}>
              <input
                data-help="rollcall.period"
                type="date"
                value={dateInput}
                disabled={locked}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </Field>
            <button
              data-help="rollcall.period"
              disabled={locked || !dateInput}
              onClick={() =>
                changeScope(() => {
                  setDate(dateInput);
                  setDutyDate("");
                  setWard("");
                  setShift("");
                })
              }
            >
              {t("Open date", "تاریخ کھولیں")}
            </button>
          </div>
          <p>
            {t("Hospital timezone", "ہسپتال کا وقت")}:{" "}
            <bdi>{timeZone || t("Unavailable", "دستیاب نہیں")}</bdi> ·{" "}
            {live
              ? t("Live", "براہ راست")
              : t(
                  "Reconnecting — recording unavailable",
                  "دوبارہ رابطہ — اندراج دستیاب نہیں",
                )}
          </p>
          <LoadState
            loading={sheet.loading || clock.loading}
            error={sheet.error || clock.error}
            retry={() => setRevision((v) => v + 1)}
          />
          <ErrorBox error={error} />
          {data && (
            <>
              <div className="toolbar">
                <Field
                  label={t("Duty date to record", "اندراج کی ڈیوٹی تاریخ")}
                >
                  <select
                    data-help="rollcall.duty-date"
                    disabled={locked}
                    value={chosenDate}
                    onChange={(e) =>
                      changeScope(() => {
                        setDutyDate(e.target.value);
                        setWard("");
                        setShift("");
                      })
                    }
                  >
                    {dates.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Ward filter", "وارڈ فلٹر")}>
                  <select
                    data-help="rollcall.filter"
                    disabled={locked}
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                  >
                    <option value="">{t("All wards", "تمام وارڈ")}</option>
                    {[
                      ...new Map(
                        currentRows
                          .filter((r) => r.ward_id)
                          .map((r) => [r.ward_id, r.ward_name]),
                      ).entries(),
                    ].map(([id, name]) => (
                      <option key={id} value={id!}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Shift filter", "شفٹ فلٹر")}>
                  <select
                    data-help="rollcall.filter"
                    disabled={locked}
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                  >
                    <option value="">{t("All shifts", "تمام شفٹیں")}</option>
                    {[
                      ...new Map(
                        currentRows.map((r) => [
                          r.shift_pattern_id,
                          r.shift_name,
                        ]),
                      ).entries(),
                    ].map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Find rostered staff", "ڈیوٹی عملہ تلاش کریں")}>
                  <input
                    data-help="rollcall.filter"
                    disabled={locked}
                    value={find}
                    onChange={(e) => setFind(e.target.value)}
                  />
                </Field>
              </div>
              <p>
                {t(
                  "An overnight duty belongs to the day it started. Confirm one duty date at a time. Filters do not clear your selection.",
                  "رات کی ڈیوٹی آغاز کے دن کی ہے۔ ایک وقت میں ایک ڈیوٹی تاریخ کی تصدیق کریں۔ فلٹر انتخاب ختم نہیں کرتے۔",
                )}
              </p>
              {!rows.length ? (
                <Empty>
                  {t(
                    "No rostered staff in this sheet. Ask the roster manager to check the duties.",
                    "فہرست میں عملہ نہیں۔ روسٹر منتظم سے ڈیوٹیاں چیک کرائیں۔",
                  )}
                </Empty>
              ) : !visible.length ? (
                <Empty>
                  {t(
                    "No staff match these filters.",
                    "ان فلٹر سے کوئی عملہ نہیں ملا۔",
                  )}
                </Empty>
              ) : (
                <div className="roll-call-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("Present", "حاضر")}</th>
                        <th>{t("Staff and duty", "عملہ اور ڈیوٹی")}</th>
                        <th>{t("Place", "جگہ")}</th>
                        <th>{t("Arrival", "آمد")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => {
                        const picked = selected.includes(r.roster_id),
                          can = eligible(r);
                        let bounds;
                        try {
                          bounds = timeZone
                            ? dutyWindow(r, timeZone)
                            : undefined;
                        } catch {}
                        return (
                          <tr key={r.roster_id} data-roster-id={r.roster_id}>
                            <td>
                              <input
                                data-help="rollcall.present"
                                aria-label={
                                  t("Present: ", "حاضر: ") +
                                  r.full_name +
                                  " " +
                                  r.emp_number +
                                  " " +
                                  r.roster_date +
                                  " " +
                                  r.shift_name
                                }
                                type="checkbox"
                                checked={picked}
                                disabled={locked || !live || !can}
                                onChange={(e) => {
                                  setSelected((old) =>
                                    e.target.checked
                                      ? [...old, r.roster_id]
                                      : old.filter((id) => id !== r.roster_id),
                                  );
                                  setError(undefined);
                                }}
                              />
                            </td>
                            <td>
                              <strong dir="auto">{r.full_name}</strong>
                              <br />
                              <bdi>{r.emp_number}</bdi> · {r.designation}
                              <br />
                              <bdi>
                                {r.roster_date} · {r.shift_name} ·{" "}
                                {r.start_time.slice(0, 5)}–
                                {r.end_time.slice(0, 5)}
                              </bdi>
                              {r.end_time <= r.start_time && (
                                <small>
                                  {t("Ends next day", "اختتام اگلے دن")}
                                </small>
                              )}
                              {r.is_on_call && (
                                <small>{t("On call", "آن کال")}</small>
                              )}
                            </td>
                            <td>
                              {r.ward_name || r.department_name || r.duty_area}
                              <br />
                              {r.zone_label}
                              {r.notes && <p dir="auto">{r.notes}</p>}
                            </td>
                            <td>
                              {r.first_in ? (
                                <>
                                  <strong>
                                    {t("Already arrived", "آمد درج ہے")}
                                  </strong>
                                  <br />
                                  <bdi>{stamp(r.first_in)}</bdi>
                                  <br />
                                  {source(r.first_source)}
                                </>
                              ) : (
                                <>
                                  {!can && (
                                    <p>
                                      {t(
                                        "This duty is unavailable for roll call. Earlier closed shifts require HR; future duties cannot be marked present.",
                                        "یہ ڈیوٹی حاضری کے لیے دستیاب نہیں۔ بند گزشتہ شفٹ ایچ آر کے لیے؛ آئندہ ڈیوٹی حاضر نہیں ہو سکتی۔",
                                      )}
                                    </p>
                                  )}
                                  {picked && (
                                    <Field
                                      label={t(
                                        "Actual arrival time",
                                        "آمد کا اصل وقت",
                                      )}
                                    >
                                      <input
                                        data-help="rollcall.arrival"
                                        type="datetime-local"
                                        step="1"
                                        value={times[r.roster_id] || ""}
                                        min={
                                          bounds && timeZone
                                            ? hospitalTimeInput(
                                                bounds.start,
                                                timeZone,
                                              )
                                            : undefined
                                        }
                                        disabled={locked}
                                        onChange={(e) =>
                                          setTimes((old) => ({
                                            ...old,
                                            [r.roster_id]: e.target.value,
                                          }))
                                        }
                                      />
                                    </Field>
                                  )}
                                  {!picked && source(null)}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          <p role="status">
            {t("Selected (including hidden rows)", "منتخب (چھپی سطروں سمیت)")}:{" "}
            {selected.length}
          </p>
          <div className="toolbar">
            <button
              data-help="rollcall.review"
              disabled={
                locked ||
                !live ||
                !data ||
                !selected.length ||
                clock.loading ||
                !!clock.error ||
                !timeZone
              }
              onClick={openReview}
            >
              {t("Review arrivals", "آمد کا جائزہ")}
            </button>
            <button
              data-help="rollcall.clear"
              disabled={locked || !dirty}
              onClick={() => changeScope(() => {})}
            >
              {t("Clear unsent selection", "غیر ارسال انتخاب ختم")}
            </button>
          </div>
          {(dirty || review || write.attempt) && <ErrorBox error={write.error} verbatim />}
          {write.notice && <p role="status">{write.notice}</p>}
          {write.busy && (
            <p role="status">
              {t(
                "Recording arrivals — keep this screen open.",
                "آمد درج ہو رہی — صفحہ کھلا رکھیں۔",
              )}
            </p>
          )}
          {write.attempt && !write.busy && (
            <aside className="notice" role="alert">
              <p>
                {t(
                  "The result is unknown. Keep this original request; do not enter replacement attendance. Reading the sheet cannot prove who recorded a punch.",
                  "نتیجہ نامعلوم ہے۔ اصل درخواست رکھیں؛ متبادل حاضری نہ درج کریں۔ فہرست سے اصل ارسال کرنے والا ثابت نہیں ہوتا۔",
                )}
              </p>
              <code>{write.attempt.key}</code>
              {canRetryWrite(write.attempt) && (
                <button data-help="rollcall.recovery" onClick={write.retry}>
                  {t("Retry original request", "اصل درخواست کی دوبارہ کوشش")}
                </button>
              )}
              <button
                data-help="rollcall.recovery"
                disabled={reading}
                onClick={async () => {
                  setReading(true);
                  try {
                    const body = write.attempt!.body.body as RollCallIn;
                    setObserved(
                      await api(
                        "GET",
                        "/rosters/roll-call?roster_date=" + body.roster_date,
                      ),
                    );
                  } catch (e) {
                    setError(e);
                  } finally {
                    setReading(false);
                  }
                }}
              >
                {t("Read original duty date", "اصل ڈیوٹی تاریخ پڑھیں")}
              </button>
              {observed && <Details value={observed} />}
              <p>
                {t(
                  "Outside the 24-hour retry window, ask HR/IT to reconcile the original request before any replacement.",
                  "24گھنٹے کی کوشش مدت کے بعد متبادل سے پہلے ایچ آر/آئی ٹی سے اصل درخواست چیک کرائیں۔",
                )}
              </p>
            </aside>
          )}
          {last && (
            <section className="notice">
              <h2>{t("Server-confirmed arrivals", "سرور سے تصدیق شدہ آمد")}</h2>
              <p>
                {t("Duty date", "ڈیوٹی تاریخ")}:{" "}
                <bdi>{last.value.roster_date}</bdi>
              </p>
              {last.value.recorded.map((r) => (
                <p key={r.attendance_log_id}>
                  <strong>
                    {last.rows.find((x) => x.employee_id === r.employee_id)
                      ?.full_name || r.employee_id}
                  </strong>{" "}
                  · {stamp(r.punch_time)} · {source(r.source)} ·{" "}
                  {t("Attendance record", "حاضری ریکارڈ")}{" "}
                  <bdi>{r.attendance_log_id}</bdi>
                </p>
              ))}
              {last.value.skipped.map((r) => (
                <p key={r.employee_id}>
                  {r.full_name}:{" "}
                  {t("Skipped — already arrived", "چھوڑا — آمد پہلے درج")} ·{" "}
                  {r.reason}
                </p>
              ))}
              <p>
                {t(
                  "HR can review attendance and late flags. This page cannot edit or delete a punch.",
                  "ایچ آر حاضری اور تاخیر دیکھ سکتا ہے۔ یہاں حاضری ترمیم یا حذف نہیں ہوتی۔",
                )}
              </p>
            </section>
          )}
          {review && !write.attempt && (
            <Modal
              title={t("Confirm actual arrivals", "اصل آمد کی تصدیق")}
              onClose={() => !write.busy && setReview(undefined)}
              closable={!write.busy}
            >
              <p>
                {t(
                  "Only confirm people who actually arrived. This records attendance; it cannot be undone here.",
                  "صرف واقعی پہنچے افراد کی تصدیق۔ حاضری درج ہوگی؛ یہاں واپس نہیں ہو سکتی۔",
                )}
              </p>
              <p>
                {t("Duty date", "ڈیوٹی تاریخ")}:{" "}
                <bdi>{review.body.roster_date}</bdi>
              </p>
              {review.rows.map((r) => (
                <p key={r.roster_id}>
                  <strong>{r.full_name}</strong> · <bdi>{r.emp_number}</bdi> ·{" "}
                  {r.shift_name} ·{" "}
                  {r.ward_name || r.department_name || r.duty_area} ·{" "}
                  {stamp(
                    review.body.present.find(
                      (p) => p.employee_id === r.employee_id,
                    )!.at!,
                  )}
                </p>
              ))}
              <label>
                <input
                  data-help="rollcall.confirm"
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  disabled={write.busy}
                />
                {t(
                  "I checked these people, duty dates and actual arrival times.",
                  "افراد، ڈیوٹی تاریخ اور آمد کا اصل وقت چیک کیا۔",
                )}
              </label>
              <ErrorBox error={write.error} verbatim />
              <button
                data-help="rollcall.confirm"
                disabled={!ack || write.busy || !live}
                onClick={submit}
              >
                {write.busy
                  ? t("Recording arrivals…", "آمد درج ہو رہی…")
                  : t("Confirm arrivals", "آمد کی تصدیق")}
              </button>
            </Modal>
          )}
        </>
      )}
    </section>
  );
}
