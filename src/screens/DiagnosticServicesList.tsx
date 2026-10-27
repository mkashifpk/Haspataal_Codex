import { useEffect, useRef, useState } from "react";
import { call } from "../bridge";
import { Empty, ErrorBox, Field, LoadState, useLoad } from "../components";
import { listTests } from "../generated/lab_only_walkin";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";

export function DiagnosticServicesList({
  user,
  connected,
  stream,
}: {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
}) {
  const canRead = user.permissions.some((p) =>
    [
      "diagnostics.quality.view",
      "lab.requisition.create",
      "imaging.order.create",
      "lab.requisition.view",
    ].includes(p),
  );
  const canReadTests = user.permissions.some((p) =>
    [
      "lab.requisition.create",
      "lab.test.manage",
      "lab.requisition.view",
    ].includes(p),
  );
  const [revision, setRevision] = useState(0),
    [query, setQuery] = useState("");
  const [kind, setKind] = useState("all"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState<
    "saved" | "cancelled" | "opened" | "closed" | ""
  >("");
  const flight = useRef(false);
  useEffect(() => {
    if (connected && stream === "Live") {
      setRevision((v) => v + 1);
      setNotice("");
    }
  }, [connected, stream]);
  const tests = useLoad(
    () =>
      canRead && canReadTests && connected ? listTests() : Promise.resolve([]),
    [canRead, canReadTests, connected, revision],
  );
  const data =
    connected && !tests.loading && !tests.error ? tests.data : undefined;
  const rows =
    data?.filter(
      (row) =>
        (kind === "all" || row.availability === kind) &&
        `${row.code} ${row.name} ${row.section} ${row.send_out_partner_name || ""}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    ) || [];
  async function document(preview: boolean) {
    if (flight.current || !connected || !canRead) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      const result = await call<{
        saved?: boolean;
        opened?: boolean;
        cancelled?: boolean;
      }>("clinical-pdf", { path: "/diagnostics/services/pdf", preview });
      setNotice(
        preview
          ? result.opened
            ? "opened"
            : "closed"
          : result.saved
            ? "saved"
            : "cancelled",
      );
    } catch (cause) {
      setError(cause);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  if (!canRead)
    return (
      <Empty>
        {t(
          "You do not have permission to read the diagnostic services list.",
          "تشخیصی خدمات کی فہرست پڑھنے کی اجازت نہیں۔",
        )}
      </Empty>
    );
  return (
    <section data-help-screen="diagnostic_services_list">
      <h1>{t("Diagnostic services list", "تشخیصی خدمات کی فہرست")}</h1>
      <p>
        {t(
          "At reception, explain where a test is performed and obtain the current official list to display for patients.",
          "استقبالیہ پر بتائیں ٹیسٹ کہاں ہوتا ہے اور مریضوں کے لیے موجودہ سرکاری فہرست حاصل کریں۔",
        )}
      </p>
      <section className="card">
        <h2>
          {t("Official list for patient display", "مریضوں کے لیے سرکاری فہرست")}
        </h2>
        <p>
          {t(
            "The server PDF lists in-house and round-the-clock laboratory services, send-out tests, imaging and referral centres. Each preview or save fetches a new copy.",
            "سرور پی ڈی ایف میں اندرونی و چوبیس گھنٹے لیب خدمات، بیرونی ٹیسٹ، عکس نگاری اور حوالہ مراکز ہیں۔ ہر پیش منظر یا محفوظ عمل نئی نقل لاتا ہے۔",
          )}
        </p>
        <div className="actions">
          <button
            data-help="diagnostic-list.preview"
            disabled={!connected || busy}
            onClick={() => void document(true)}
          >
            {t("Preview official PDF", "سرکاری پی ڈی ایف کا پیش منظر")}
          </button>
          <button
            data-help="diagnostic-list.save"
            disabled={!connected || busy}
            onClick={() => void document(false)}
          >
            {t("Save PDF to print", "پرنٹ کے لیے پی ڈی ایف محفوظ کریں")}
          </button>
        </div>
        {busy && (
          <p role="status">
            {t(
              "Fetching the official PDF…",
              "سرکاری پی ڈی ایف حاصل ہو رہی ہے…",
            )}
          </p>
        )}
        {!connected && (
          <p role="status">
            {t(
              "Reconnect to read the current list or obtain a PDF. Previously displayed tests are hidden.",
              "موجودہ فہرست یا پی ڈی ایف کے لیے رابطہ بحال کریں۔ پرانے دکھائے ٹیسٹ پوشیدہ ہیں۔",
            )}
          </p>
        )}
        <ErrorBox error={error} />
        {notice && (
          <p role="status">
            {notice === "saved"
              ? t(
                  "Official PDF saved. Open it in your PDF reader to print and replace the displayed copy.",
                  "سرکاری پی ڈی ایف محفوظ۔ ریڈر میں کھول کر پرنٹ کریں اور آویزاں نقل بدلیں۔",
                )
              : notice === "opened"
                ? t(
                    "Official PDF preview opened. Close the preview to return; save a copy to print from your PDF reader.",
                    "سرکاری پیش منظر کھل گیا۔ واپس آنے کے لیے بند کریں؛ ریڈر سے پرنٹ کے لیے نقل محفوظ کریں۔",
                  )
                : notice === "cancelled"
                  ? t(
                      "Save cancelled. No file was saved.",
                      "محفوظ کرنا منسوخ۔ فائل محفوظ نہیں ہوئی۔",
                    )
                  : t(
                      "Preview closed before opening. Save the PDF if the viewer is unavailable.",
                      "کھلنے سے پہلے پیش منظر بند۔ ویور دستیاب نہ ہو تو پی ڈی ایف محفوظ کریں۔",
                    )}
          </p>
        )}
        <p className="notice">
          {t(
            "After the lab catalogue or partners change, obtain and print a fresh PDF and replace old display copies. There is no automatic catalogue-change notification on this screen.",
            "لیب فہرست یا شریک بدلنے کے بعد نئی پی ڈی ایف لے کر پرنٹ اور پرانی آویزاں نقول تبدیل کریں۔ اس صفحے پر فہرست تبدیلی کی خودکار اطلاع نہیں۔",
          )}
        </p>
        <p className="muted">
          {t(
            "The search below does not change the official PDF. A failed preview, cancelled save or printer problem changes no test, order, patient or payment. Retry the document only.",
            "نیچے تلاش سرکاری پی ڈی ایف نہیں بدلتی۔ پیش منظر خطا، محفوظ منسوخی یا پرنٹر مسئلہ ٹیسٹ، آرڈر، مریض یا ادائیگی نہیں بدلتا۔ صرف دستاویز دوبارہ لیں۔",
          )}
        </p>
      </section>
      {canReadTests ? (
        <section className="card">
          <h2>{t("Explain a laboratory test", "لیبارٹری ٹیسٹ کی وضاحت")}</h2>
          <p>
            {t(
              "Tell the patient when a test is sent out and name the partner shown here. For imaging and referral centres, use the official PDF.",
              "مریض کو بیرونی ٹیسٹ اور یہاں درج شریک کا نام بتائیں۔ عکس نگاری اور حوالہ مراکز کے لیے سرکاری پی ڈی ایف دیکھیں۔",
            )}
          </p>
          <div className="actions">
            <button
              data-help="diagnostic-list.refresh"
              disabled={!connected || tests.loading}
              onClick={() => {
                setNotice("");
                setRevision((v) => v + 1);
              }}
            >
              {t("Refresh laboratory list", "لیب فہرست تازہ کریں")}
            </button>
          </div>
          <div className="form-grid">
            <Field label={t("Find test or partner", "ٹیسٹ یا شریک تلاش کریں")}>
              <input
                data-help="diagnostic-list.find"
                value={query}
                maxLength={200}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <Field label={t("Where performed", "کہاں انجام ہوتا ہے")}>
              <select
                data-help="diagnostic-list.filter"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="all">
                  {t("All laboratory tests", "تمام لیب ٹیسٹ")}
                </option>
                <option value="InHouse">
                  {t("In-house", "ہسپتال کے اندر")}
                </option>
                <option value="SendOut">
                  {t("Sent to partner", "شریک کو بھیجا جاتا ہے")}
                </option>
              </select>
            </Field>
          </div>
          <button
            data-help="diagnostic-list.find"
            onClick={() => {
              setQuery("");
              setKind("all");
            }}
          >
            {t("Show all laboratory tests", "تمام لیب ٹیسٹ دکھائیں")}
          </button>
          {connected && <LoadState {...tests} retry={tests.reload} />}
          {data &&
            (!rows.length ? (
              <Empty>
                {data.length
                  ? t(
                      "No tests match these filters. Show all tests or refresh the list.",
                      "ان شرائط پر ٹیسٹ نہیں۔ تمام دکھائیں یا فہرست تازہ کریں۔",
                    )
                  : t(
                      "No laboratory tests were returned. Ask Lab Admin to check the catalogue; use the official PDF for the full service scope.",
                      "لیب ٹیسٹ موصول نہیں۔ لیب ایڈمن سے فہرست چیک کرائیں؛ مکمل خدمات سرکاری پی ڈی ایف میں دیکھیں۔",
                    )}
              </Empty>
            ) : (
              <div className="table-wrap">
                <table aria-label={t("Laboratory services", "لیب خدمات")}>
                  <thead>
                    <tr>
                      <th>{t("Test / code", "ٹیسٹ / کوڈ")}</th>
                      <th>{t("Section / sample", "شعبہ / نمونہ")}</th>
                      <th>{t("Where performed", "کہاں انجام ہوتا ہے")}</th>
                      <th>{t("Round the clock", "چوبیس گھنٹے")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.test_id}
                        data-testid="diagnostic-service-row"
                      >
                        <td>
                          <span dir="auto">{row.name}</span>
                          <br />
                          <bdi>{row.code}</bdi>
                          {!row.is_active && <p>{t("Inactive", "غیر فعال")}</p>}
                        </td>
                        <td>
                          <span dir="auto">{row.section}</span>
                          <br />
                          <span dir="auto">{row.sample_type}</span>
                        </td>
                        <td>
                          {row.availability === "SendOut" ? (
                            <>
                              <strong>
                                {t("Sent to partner", "شریک کو بھیجا جاتا ہے")}
                              </strong>
                              <p dir="auto">
                                {row.send_out_partner_name ||
                                  t(
                                    "Partner not recorded — check with Lab Admin before advising the patient.",
                                    "شریک درج نہیں — مریض کو بتانے سے پہلے لیب ایڈمن سے چیک کریں۔",
                                  )}
                              </p>
                            </>
                          ) : (
                            t("In-house", "ہسپتال کے اندر")
                          )}
                        </td>
                        <td>
                          {row.available_24h
                            ? t("Yes", "ہاں")
                            : t(
                                "No — confirm working hours with the department",
                                "نہیں — شعبے سے اوقات معلوم کریں",
                              )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </section>
      ) : (
        <p>
          {t(
            "Your account can obtain the official PDF but cannot read the separate laboratory test catalogue. Use the PDF to explain the services.",
            "آپ کا اکاؤنٹ سرکاری پی ڈی ایف لے سکتا ہے مگر الگ لیب فہرست نہیں پڑھ سکتا۔ خدمات کی وضاحت پی ڈی ایف سے کریں۔",
          )}
        </p>
      )}
    </section>
  );
}
