import { useState } from "react";
import { bilingual as t, tr } from "../i18n";
import { Empty, ErrorBox, Field, LoadState, useLoad } from "../components";
import { type ClinicalUser } from "../clinical-context";
import { ReferralRecord } from "../referral-record";
import { formatHospitalTime } from "../hospital-time";
import * as ref from "../generated/referral_register";
export function ReferralRegister({
  user,
  revision,
  connected,
  timeZone,
}: {
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  timeZone?: string;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [status, setStatus] = useState(""),
    [pending, setPending] = useState(false),
    [applied, setApplied] = useState({
      from: "",
      to: "",
      status: "",
      pending: false,
    }),
    [cursor, setCursor] = useState<number>(),
    [back, setBack] = useState<(number | undefined)[]>([]),
    [find, setFind] = useState(""),
    [selected, setSelected] = useState<number>(),
    [error, setError] = useState<unknown>();
  const allowed = user.permissions.some((p) =>
    ["referral.view", "referral.create"].includes(p),
  );
  const rows = useLoad(
    () =>
      allowed
        ? ref.registerReferrals({
            date_from: applied.from || undefined,
            date_to: applied.to || undefined,
            status: applied.status
              ? (applied.status as "Issued" | "Acknowledged" | "Cancelled")
              : undefined,
            acknowledgement_pending: applied.pending,
            limit: 50,
            before_id: cursor,
          })
        : Promise.resolve([]),
    [allowed, revision, applied, cursor],
  );
  const time = (s: string) => (timeZone ? formatHospitalTime(s, timeZone) : s);
  const visible = (rows.data || []).filter((r) =>
    `${r.referral_number} ${r.patient_name} ${r.mrn} ${r.destination_name} ${r.reason}`
      .toLowerCase()
      .includes(find.trim().toLowerCase()),
  );
  function apply() {
    setError(undefined);
    if (from && to && from > to) {
      setError(
        new Error(
          t(
            "Start date must not be after end date. The previous applied period is still shown.",
            "ابتدا اختتام کے بعد نہیں ہو سکتی۔ پچھلی لاگو مدت دکھ رہی ہے۔",
          ),
        ),
      );
      return;
    }
    setApplied({ from, to, status, pending });
    setCursor(undefined);
    setBack([]);
    setSelected(undefined);
    setFind("");
  }
  function reset() {
    setFrom("");
    setTo("");
    setStatus("");
    setPending(false);
    setApplied({ from: "", to: "", status: "", pending: false });
    setCursor(undefined);
    setBack([]);
    setSelected(undefined);
    setFind("");
    setError(undefined);
  }
  return (
    <section data-help-screen="referral_register">
      <h1>{t("Referral register", "حوالہ رجسٹر")}</h1>
      <p className="notice">
        {t(
          "Patient records: use only for this establishment’s authorized review. Access to the register and individual records is logged.",
          "مریضوں کے ریکارڈ: صرف اس ہسپتال کے مجاز جائزے کے لیے۔ رجسٹر اور ہر ریکارڈ کی رسائی درج ہوتی ہے۔",
        )}
      </p>
      <p>
        {t(
          "Default period: the last 12 months on the server. Choose dates for a different period. This register is read-only; the referring clinician records actual acknowledgements or cancellations from Refer out.",
          "عام مدت سرور کے آخری12ماہ۔ دوسری مدت کو تاریخیں چنیں۔ رجسٹر صرف پڑھنے کا ہے؛ اصل معالج بیرونی حوالے میں وصولی یا منسوخی درج کرتا ہے۔",
        )}
      </p>
      <ErrorBox error={error} />
      <form
        data-unsaved="false"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="grid">
          <Field label={t("Referral start date", "حوالہ ابتدا کی تاریخ")}>
            <input
              data-help="register.filters"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label={t("Referral end date", "حوالہ اختتام کی تاریخ")}>
            <input
              data-help="register.filters"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label={t("Referral status", "حوالے کی حالت")}>
            <select
              data-help="register.filters"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t("All statuses", "تمام حالتیں")}</option>
              {["Issued", "Acknowledged", "Cancelled"].map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label>
          <input
            data-help="register.filters"
            type="checkbox"
            checked={pending}
            onChange={(e) => setPending(e.target.checked)}
          />
          {t("Acknowledgement pending", "وصولی کی تصدیق باقی")}
        </label>
        <div className="toolbar">
          <button
            data-help="register.filters"
            type="submit"
            disabled={!allowed}
          >
            {t("Apply referral filters", "حوالہ فلٹر لاگو کریں")}
          </button>
          <button data-help="register.filters" type="button" onClick={reset}>
            {t("Reset to last 12 months", "آخری12ماہ پر واپس")}
          </button>
        </div>
      </form>
      <p role="status">
        {t("Applied period / status", "لاگو مدت / حالت")}:{" "}
        <bdi>
          {applied.from || t("Server default start", "سرور کی عام ابتدا")} —{" "}
          {applied.to || t("Server default end", "سرور کا عام اختتام")}
        </bdi>{" "}
        · {tr(applied.status || "All statuses")} ·{" "}
        {applied.pending
          ? t("Acknowledgement pending", "وصولی باقی")
          : t("All acknowledgement states", "وصولی کی تمام حالتیں")}
      </p>
      <Field
        label={t("Find in this loaded page", "اس لائے ہوئے صفحے میں تلاش")}
      >
        <input
          data-help="register.find"
          value={find}
          maxLength={200}
          onChange={(e) => setFind(e.target.value)}
        />
      </Field>
      <p>
        {t(
          "This search filters only the loaded page by name, MRN, number, destination or reason. Use dates/status and older pages for the whole register.",
          "یہ تلاش صرف موجودہ صفحے کے نام، ایم آر این، نمبر، منزل یا وجہ پر ہے۔ پورے رجسٹر کے لیے مدت، حالت اور پرانے صفحے لیں۔",
        )}
      </p>
      <LoadState {...rows} retry={rows.reload} />
      {!allowed && (
        <p>
          {t(
            "Your account is not permitted to read referrals.",
            "آپ کو حوالے پڑھنے کی اجازت نہیں۔",
          )}
        </p>
      )}
      {!rows.loading && !rows.error && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    t("Number", "نمبر"),
                    t("Date and time", "تاریخ و وقت"),
                    t("Patient / MRN", "مریض / ایم آر این"),
                    t("To", "منزل"),
                    t("Urgency", "ترجیح"),
                    t("Reason", "وجہ"),
                    t("Transport", "نقل و حمل"),
                    t("Status", "حالت"),
                    t("Review", "جائزہ"),
                  ].map((v) => (
                    <th key={v} scope="col">
                      {v}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.referral_id}>
                    <td>
                      <bdi>{r.referral_number}</bdi>
                    </td>
                    <td>
                      <bdi>{time(r.created_at)}</bdi>
                    </td>
                    <td>
                      {r.patient_name}
                      <br />
                      <bdi>{r.mrn}</bdi>
                    </td>
                    <td>
                      {r.destination_name} · {r.destination_department}
                    </td>
                    <td>{tr(r.urgency)}</td>
                    <td>{r.reason}</td>
                    <td>
                      {tr(r.transport)} · {r.escort_name}
                    </td>
                    <td>
                      {tr(r.status)}
                      {r.acknowledgement_pending && (
                        <p className="notice">
                          {t("Acknowledgement pending", "وصولی باقی")}
                        </p>
                      )}
                    </td>
                    <td>
                      <button
                        data-help="register.open"
                        onClick={() => setSelected(r.referral_id)}
                      >
                        {t("Open referral", "حوالہ کھولیں")}{" "}
                        <bdi>{r.referral_number}</bdi>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visible.length && (
            <Empty>
              {rows.data?.length
                ? t(
                    "No row matches this page search. Clear it or load another page.",
                    "اس صفحے کی تلاش سے کوئی سطر نہیں ملی۔ تلاش صاف یا دوسرا صفحہ لائیں۔",
                  )
                : t(
                    "No referrals returned for this period/filter/page. Change filters or return to a newer page.",
                    "مدت، فلٹر یا صفحے میں حوالہ نہیں آیا۔ فلٹر بدل یا نئے صفحے پر جائیں۔",
                  )}
            </Empty>
          )}
          <p>
            {t("Visible / loaded rows", "نظر آنے والی / لائی سطریں")}:{" "}
            {visible.length} / {rows.data?.length || 0}
          </p>
        </>
      )}
      <div className="toolbar">
        <button
          data-help="register.pages"
          disabled={rows.loading || !!rows.error || !rows.data?.length}
          onClick={() => {
            setBack((prev) => [...prev, cursor]);
            setCursor(rows.data!.at(-1)!.referral_id);
            setFind("");
            setSelected(undefined);
          }}
        >
          {t("Older referral page", "حوالوں کا پرانا صفحہ")}
        </button>
        <button
          data-help="register.pages"
          disabled={rows.loading || back.length === 0}
          onClick={() => {
            setCursor(back.at(-1));
            setBack((prev) => prev.slice(0, -1));
            setFind("");
            setSelected(undefined);
          }}
        >
          {t("Newer referral page", "حوالوں کا نیا صفحہ")}
        </button>
      </div>
      {selected && (
        <ReferralRecord
          key={selected}
          id={selected}
          user={user}
          revision={revision}
          readOnly={true}
          connected={connected}
          timeZone={timeZone}
          helpScreen="referral_register"
        />
      )}
    </section>
  );
}
