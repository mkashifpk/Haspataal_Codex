import { useEffect, useRef, useState } from "react";
import {
  pharmacyCashShift,
  otherPharmacyCashCounter,
} from "../pharmacy-workflow-policy";
import { api, call, ApiError } from "../bridge";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t, tr } from "../i18n";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as otc from "../generated/otc";
import {
  makeOtcSale,
  requireOtcDrug,
  otcDrugIdentity,
  otcReadable,
  otcWritable,
  prescriptionRequired,
  type OtcBasketLine,
} from "../otc-policy";
type Review = { body: otc.OtcIn; lines: OtcBasketLine[] };
type Shift = {
  user_id: number;
  node: string;
  status: string;
  shift_id: number;
};
export function OTCMode({
  user,
  connected,
  stream,
  establishment,
  currency,
  onCashShift,
}: {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  currency?: string;
  onCashShift?: () => void;
}) {
  const can = (p: string) => user.permissions.includes(p),
    view =
      establishment.views.screens.find((s) => s.screen_id === "otc")?.view ||
      "hidden",
    visible = otcReadable(view),
    canRead = visible && can("pharmacy.formulary.view"),
    canReceipt =
      visible && (can("pharmacy.otc.sell") || can("pharmacy.dispense"));
  const writable = otcWritable(user.permissions, view, establishment.active),
    live = connected && stream === "Live";
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState<string>(),
    [limit, setLimit] = useState("30"),
    [appliedLimit, setAppliedLimit] = useState(30),
    [barcode, setBarcode] = useState(""),
    [scanBusy, setScanBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const [basket, setBasket] = useState<OtcBasketLine[]>([]),
    [method, setMethod] = useState<"Cash" | "Card">("Cash"),
    [reference, setReference] = useState(""),
    [name, setName] = useState(""),
    [mobile, setMobile] = useState("");
  const [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [review, setReview] = useState<Review>(),
    [saved, setSaved] = useState<otc.DispensationResultOut>(),
    [receiptId, setReceiptId] = useState(0),
    [lookup, setLookup] = useState(""),
    [printBusy, setPrintBusy] = useState(false),
    [printNotice, setPrintNotice] = useState("");
  const [requiredCashNode, setRequiredCashNode] =
    useState<string>("PharmacyCounter");
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const scanner = useRef<HTMLInputElement>(null),
    scanFlight = useRef(false),
    scanGeneration = useRef(0),
    restoreScannerFocus = useRef(false);
  const write = useClinicalWrite(user, "otc", async (result) => {
    setSaved(result);
    setReceiptId(result.dispensation.dispensation_id);
    setLookup(String(result.dispensation.dispensation_id));
    setReview(undefined);
    setBasket([]);
    setName("");
    setMobile("");
    setReference("");
    setBarcode("");
    setNotice("");
    setPrintNotice("");
    setRevision((n) => n + 1);
  });
  const blocked = write.blocked || printBusy || scanBusy;
  useEffect(() => {
    if (
      write.error instanceof ApiError &&
      write.error.response.error?.code === "SHIFT_NOT_OPEN"
    ) {
      const node = write.error.response.error.details?.node;
      if (typeof node === "string" && node.trim()) setRequiredCashNode(node);
    }
  }, [write.error]);
  const drugs = useLoad(
    () =>
      canRead && query !== undefined
        ? otc.searchDrugs({ q: query, limit: appliedLimit })
        : Promise.resolve([]),
    [canRead, query, appliedLimit, revision],
  );
  const readDrug = async (line: OtcBasketLine) => {
    const rows = await otc.searchDrugs({
      q: line.barcode || line.drug.code,
      limit: 100,
    });
    const d = rows.find((d) => d.drug_id === line.drug.drug_id);
    if (!d)
      throw new Error(
        t(
          "A basket medicine is no longer returned by the formulary. Remove it or ask Pharmacy Admin.",
          "ٹوکری کی دوا فہرست میں نہیں مل رہی۔ ہٹائیں یا فارمیسی منتظم سے رابطہ کریں۔",
        ),
      );
    return d;
  };
  const basketKey = basket
    .map((l) => `${l.drug.drug_id}:${l.barcode || l.drug.code}`)
    .join("|");
  const stock = useLoad(
    () => (canRead ? Promise.all(basket.map(readDrug)) : Promise.resolve([])),
    [canRead, basketKey, revision],
  );
  const current = basket.map((l) => ({
    ...l,
    drug: stock.data?.find((d) => d.drug_id === l.drug.drug_id) || l.drug,
  }));
  const stockReady =
    !stock.loading && !stock.error && current.length === stock.data?.length;
  const drawer = useLoad(async () => {
    if (!visible || !can("finance.shift.operate")) return null;
    const [shift, terminal] = await Promise.all([
      api<Shift | null>(
        "GET",
        "/finance/cash-shifts/mine?node=PharmacyCounter",
      ),
      api<{ cash_node: string | null }>("GET", "/terminals/whoami"),
    ]);
    return { shift, terminal };
  }, [visible, can("finance.shift.operate"), revision]);
  const ownDrawer =
    !drawer.loading &&
    !drawer.error &&
    pharmacyCashShift(drawer.data?.shift, user.user_id);
  const cashCounterMismatch =
    !!requiredCashNode && drawer.data?.terminal.cash_node !== requiredCashNode;
  const receipt = useLoad(async () => {
    if (!receiptId || !canReceipt) return undefined;
    const r = await api<otc.PrintOut_PharmacyReceiptFieldsOut_>(
      "GET",
      `/dispensations/${receiptId}/receipt-payload`,
    );
    if (
      r.document_type !== "pharmacy_receipt" ||
      r.fields.dispensation.dispensation_id !== receiptId ||
      !r.fields.dispensation.is_otc_sale
    )
      throw new Error(
        t(
          "This number is not an OTC receipt. Check the confirmed dispensation ID.",
          "یہ نمبر او ٹی سی رسید نہیں۔ تصدیق شدہ فراہمی نمبر چیک کریں۔",
        ),
      );
    return r;
  }, [canReceipt, receiptId, revision]);
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (e.type === "event" && e.event_type === "pharmacy.stock.updated")
          setRevision((n) => n + 1);
        if (e.type === "stream" && e.status === "Live" && e.resync)
          setRevision((n) => n + 1);
      }),
    [],
  );
  useEffect(() => {
    if (!write.blocked) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [write.blocked]);
  useEffect(
    () => () => {
      scanGeneration.current++;
    },
    [],
  );
  useEffect(() => {
    if (!scanBusy && restoreScannerFocus.current) {
      restoreScannerFocus.current = false;
      scanner.current?.focus();
    }
  }, [scanBusy]);
  function add(drug: otc.DrugStockOut, scanned?: string) {
    requireOtcDrug(drug);
    if (drug.qty_available <= 0)
      throw new Error(
        t(
          "No available stock. Refresh or ask Pharmacy Admin.",
          "دستیاب اسٹاک نہیں۔ تازہ کریں یا منتظم سے کہیں۔",
        ),
      );
    if (basket.some((l) => l.drug.drug_id === drug.drug_id))
      throw new Error(
        t(
          "This medicine is already in the basket. Edit its quantity.",
          "یہ دوا ٹوکری میں موجود ہے۔ اسی کی مقدار بدلیں۔",
        ),
      );
    if (basket.length >= 50)
      throw new Error(
        t(
          "A sale may contain at most 50 different medicines.",
          "فروخت میں زیادہ سے زیادہ50مختلف دوائیں ہو سکتی ہیں۔",
        ),
      );
    setBasket((b) => [...b, { drug, barcode: scanned, qty: "1" }]);
    setNotice(
      t(
        "Added to the basket. Review the quantity before confirming.",
        "ٹوکری میں شامل۔ تصدیق سے پہلے مقدار چیک کریں۔",
      ),
    );
  }
  async function scan() {
    if (blocked || !canRead || !writable || !live || scanFlight.current) return;
    const code = barcode.trim();
    setError(undefined);
    setNotice("");
    if (!code || code.length > 100) {
      setError(
        new Error(
          t(
            "Enter a product barcode of up to 100 characters.",
            "زیادہ سے زیادہ100حروف کا اصل بارکوڈ درج کریں۔",
          ),
        ),
      );
      return;
    }
    const generation = ++scanGeneration.current;
    scanFlight.current = true;
    setScanBusy(true);
    try {
      const rows = await otc.searchDrugs({ q: code, limit: 100 });
      if (generation !== scanGeneration.current) return;
      const matches = rows.filter((d) => d.barcode === code);
      if (matches.length !== 1)
        throw new Error(
          t(
            "No unique exact barcode match. Search the formulary or ask Pharmacy Admin; nothing was added.",
            "بارکوڈ کا ایک عین نتیجہ نہیں ملا۔ فہرست تلاش یا منتظم سے رابطہ؛ کچھ شامل نہیں ہوا۔",
          ),
        );
      add(matches[0], code);
      setBarcode("");
    } catch (e) {
      setError(e);
    } finally {
      scanFlight.current = false;
      restoreScannerFocus.current = true;
      setScanBusy(false);
    }
  }
  function prepare() {
    setError(undefined);
    if (!writable || !live || blocked || !stockReady) return;
    try {
      if (method === "Cash" && (!ownDrawer || cashCounterMismatch))
        throw new Error(
          t(
            "Open your own Pharmacy Counter cash shift before collecting cash.",
            "نقد وصولی سے پہلے فارمیسی کاؤنٹر پر اپنی کیش شفٹ کھولیں۔",
          ),
        );
      const body = makeOtcSale(current, method, reference, name, mobile);
      setReviewAttempted(false);
      setReview({ body, lines: structuredClone(current) });
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!review || blocked) return;
    setReviewAttempted(true);
    write.start(
      {
        method: "POST",
        path: "/otc-sales",
        body: review.body,
        permission: "pharmacy.otc.sell",
        protection: "idempotent",
        label: t("Confirm OTC sale", "او ٹی سی فروخت کی تصدیق"),
      },
      async () => {
        const [me, est] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
        ]);
        if (
          me.user_id !== user.user_id ||
          !live ||
          !otcWritable(
            me.permissions,
            est.views.screens.find((s) => s.screen_id === "otc")?.view ||
              "hidden",
            est.active,
          )
        )
          throw new Error(
            t(
              "Permission, connection or dispensing service changed. Close and refresh before continuing.",
              "اجازت، رابطہ یا فراہمی خدمت بدل گئی۔ بند کرکے تازہ کریں۔",
            ),
          );
        const fresh = await Promise.all(
          review.lines.map(async (l) => {
            const d = await readDrug(l);
            if (otcDrugIdentity(d) !== otcDrugIdentity(l.drug))
              throw new Error(
                t(
                  "A medicine changed during review. Close, refresh and review again.",
                  "جائزے کے دوران دوا بدل گئی۔ بند، تازہ اور دوبارہ جائزہ لیں۔",
                ),
              );
            return { ...l, drug: d };
          }),
        );
        makeOtcSale(
          fresh,
          review.body.method || "Cash",
          review.body.reference_no || "",
          review.body.customer_name || "",
          review.body.customer_mobile || "",
        );
        if (review.body.method === "Cash") {
          const [shift, terminal] = await Promise.all([
            api<Shift | null>(
              "GET",
              "/finance/cash-shifts/mine?node=PharmacyCounter",
            ),
            api<{ cash_node: string | null }>("GET", "/terminals/whoami"),
          ]);
          if (!pharmacyCashShift(shift, user.user_id))
            throw new Error(
              t(
                "Open your own Pharmacy Counter cash shift before collecting cash.",
                "نقد وصولی سے پہلے فارمیسی کاؤنٹر پر اپنی کیش شفٹ کھولیں۔",
              ),
            );
        }
      },
    );
  }
  async function print(pdf: boolean) {
    if (blocked || !receipt.data || receipt.loading || receipt.error) return;
    setPrintBusy(true);
    setError(undefined);
    setPrintNotice("");
    try {
      const r = await call("print-pharmacy", {
        dispensationId: receiptId,
        labels: false,
        pdf,
      });
      setPrintNotice(
        pdf
          ? r.saved
            ? t("PDF saved.", "پی ڈی ایف محفوظ ہو گئی۔")
            : t("Save cancelled.", "محفوظ کرنا منسوخ۔")
          : t("Printing completed.", "پرنٹ مکمل ہو گیا۔"),
      );
    } catch (e) {
      setError(e);
    } finally {
      setPrintBusy(false);
    }
  }
  if (!visible)
    return (
      <Empty>
        {t(
          "OTC mode is unavailable for this service.",
          "اس خدمت میں او ٹی سی فروخت دستیاب نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      data-help-screen="otc"
      data-write-pending={blocked}
      data-unsaved={
        !!(
          basket.length ||
          barcode.trim() ||
          name.trim() ||
          mobile.trim() ||
          reference.trim()
        )
      }
    >
      <div className="section-heading">
        <div>
          <h1>{t("OTC mode", "بغیر نسخہ فروخت")}</h1>
          <p>
            {t(
              "Walk-in sales of permitted OTC medicines. Verify each product and quantity before confirming.",
              "مجاز بغیر نسخہ دواؤں کی فروخت۔ تصدیق سے پہلے ہر دوا اور مقدار چیک کریں۔",
            )}
          </p>
        </div>
        <button
          data-help="otc.refresh"
          disabled={blocked}
          onClick={() => {
            setError(undefined);
            setNotice("");
            setRevision((n) => n + 1);
          }}
        >
          {t("Refresh OTC stock", "او ٹی سی اسٹاک تازہ کریں")}
        </button>
      </div>
      <p role="status">
        {tr(connected ? stream : "Offline")} ·{" "}
        {view === "open_work"
          ? t(
              "No new OTC sales from now on. Existing receipts remain readable.",
              "اب نئی او ٹی سی فروخت نہیں۔ پرانی رسید پڑھی جا سکتی ہے۔",
            )
          : view === "records"
            ? t("Records only — no new sales.", "صرف ریکارڈ — نئی فروخت نہیں۔")
            : t("Dispensing service active", "فراہمی خدمت فعال")}
      </p>
      {currency && (
        <p>
          {t("Currency", "کرنسی")}: <bdi>{currency}</bdi>
        </p>
      )}
      {!live && (
        <p className="notice">
          {t(
            "Wait for live reconnection before a new sale. No offline submissions.",
            "نئی فروخت سے پہلے براہ راست رابطہ بحال ہونے دیں۔ آف لائن ارسال نہیں۔",
          )}
        </p>
      )}
      <ErrorBox
        error={error}
        verbatim={
          error instanceof Error && error.message === prescriptionRequired
        }
      />
      {cashCounterMismatch && (
        <p className="notice" role="status">
          {t(
            "The server requires this cash counter:",
            "سرور کو اس نقد کاؤنٹر کی ضرورت ہے:",
          )}{" "}
          <bdi>{requiredCashNode}</bdi>.{" "}
          {t("This terminal is mapped to:", "یہ ٹرمینل مقرر ہے:")}{" "}
          <bdi>{drawer.data?.terminal.cash_node || "—"}</bdi>.{" "}
          {t(
            "This PC is not set up for pharmacy cash. Ask IT to map it to the Pharmacy Counter. Card remains available.",
            "یہ کمپیوٹر فارمیسی نقد کے لیے مقرر نہیں۔ آئی ٹی سے فارمیسی کاؤنٹر مقرر کرائیں۔ کارڈ دستیاب ہے۔",
          )}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {otherPharmacyCashCounter(write.error) && (
        <p className="notice">
          {t(
            "Your drawer is open at another counter:",
            "آپ کی دراز دوسرے کاؤنٹر پر کھلی ہے:",
          )}{" "}
          <bdi>{otherPharmacyCashCounter(write.error)}</bdi>.{" "}
          {t(
            "Pharmacy cash requires your own Pharmacy Counter shift.",
            "فارمیسی نقد کے لیے فارمیسی کاؤنٹر پر اپنی شفٹ لازم ہے۔",
          )}
        </p>
      )}
      {writable && (
        <>
          <section className="card">
            <h2>
              {t(
                "Counter and payment prerequisites",
                "کاؤنٹر اور ادائیگی کی شرائط",
              )}
            </h2>
            <LoadState {...drawer} retry={drawer.reload} />
            <p>
              {ownDrawer
                ? t(
                    "Your own Pharmacy Counter cash shift is open.",
                    "فارمیسی کاؤنٹر پر آپ کی اپنی کیش شفٹ کھلی ہے۔",
                  )
                : t(
                    "Cash needs your own open Pharmacy Counter shift. Card does not require a cash shift.",
                    "نقد کے لیے فارمیسی کاؤنٹر پر اپنی کھلی شفٹ لازم۔ کارڈ کو نقد شفٹ درکار نہیں۔",
                  )}
              {ownDrawer &&
                ` #${drawer.data!.shift!.shift_id} · ${drawer.data!.shift!.node}`}
            </p>
            {onCashShift && (
              <button
                data-help="otc.shift"
                disabled={blocked}
                onClick={onCashShift}
              >
                {t("Open My cash shift", "میری کیش شفٹ کھولیں")}
              </button>
            )}
            {!onCashShift && (
              <p className="notice">
                {t(
                  "Cash-shift controls are unavailable in this workspace. Ask IT for access before taking cash. Card remains available.",
                  "اس کام کی جگہ میں کیش شفٹ کے بٹن دستیاب نہیں۔ نقد لینے سے پہلے آئی ٹی سے رسائی لیں۔ کارڈ دستیاب ہے۔",
                )}
              </p>
            )}
          </section>
        </>
      )}
      {canRead ? (
        <fieldset disabled={blocked}>
          <section className="card">
            <h2>{t("Find a medicine", "دوا تلاش کریں")}</h2>
            {writable && (
              <form
                className="actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  void scan();
                }}
              >
                <Field
                  label={t("Scan product barcode", "دوا کا بارکوڈ اسکین کریں")}
                >
                  <input
                    ref={scanner}
                    data-help="otc.scan"
                    value={barcode}
                    maxLength={100}
                    onChange={(e) => setBarcode(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <button data-help="otc.scan" disabled={!live}>
                  {t("Find barcode and add", "بارکوڈ تلاش اور شامل کریں")}
                </button>
              </form>
            )}
            <form
              className="actions"
              onSubmit={(e) => {
                e.preventDefault();
                setError(undefined);
                const n = Number(limit);
                if (!Number.isInteger(n) || n < 1 || n > 100) {
                  setError(
                    new Error(
                      t(
                        "Use a search limit from 1 to 100.",
                        "تلاش کی حد1سے100تک رکھیں۔",
                      ),
                    ),
                  );
                  return;
                }
                setQuery(search.trim());
                setAppliedLimit(n);
                setRevision((n) => n + 1);
              }}
            >
              <Field
                label={t(
                  "Medicine name, code or barcode",
                  "دوا کا نام، کوڈ یا بارکوڈ",
                )}
              >
                <input
                  data-help="otc.search"
                  value={search}
                  maxLength={100}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Field>
              <Field label={t("Medicine search limit", "دوا تلاش کی حد")}>
                <input
                  data-help="otc.search"
                  type="number"
                  min={1}
                  max={100}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </Field>
              <button data-help="otc.search">
                {t("Search medicines", "دوائیں تلاش کریں")}
              </button>
            </form>
            <LoadState {...drugs} retry={drugs.reload} />
            {query === undefined ? (
              <p>
                {t(
                  "Scan a product or search to begin.",
                  "شروع کرنے کے لیے اسکین یا تلاش کریں۔",
                )}
              </p>
            ) : (
              !drugs.loading &&
              !drugs.error &&
              !drugs.data?.length && (
                <Empty>
                  {t(
                    "No medicines match. Check the barcode or name; nothing was added.",
                    "کوئی دوا نہیں ملی۔ بارکوڈ یا نام چیک؛ کچھ شامل نہیں ہوا۔",
                  )}
                </Empty>
              )
            )}
            {!drugs.loading &&
              !drugs.error &&
              drugs.data?.length === appliedLimit && (
                <p className="notice">
                  {t(
                    "Search limit reached. Narrow the search; no older-page cursor is available.",
                    "تلاش کی حد پوری۔ تلاش محدود کریں؛ اگلا صفحہ کرسر نہیں۔",
                  )}
                </p>
              )}
            {!drugs.loading &&
              !drugs.error &&
              drugs.data?.map((d) => {
                const eligible =
                  d.is_active &&
                  d.is_otc_allowed &&
                  d.schedule === "OTC" &&
                  !d.high_alert_category &&
                  !d.is_restricted;
                return (
                  <article
                    className={
                      d.stock_status === "OutOfStock" ? "card muted" : "card"
                    }
                    key={d.drug_id}
                    data-testid="otc-drug"
                  >
                    <h3>
                      <bdi>
                        {d.name} · {d.strength} · {tr(d.form)}
                      </bdi>
                    </h3>
                    <p>
                      <bdi>
                        {d.code} · {d.barcode}
                      </bdi>{" "}
                      ·{" "}
                      <span className={`stock-${d.stock_status}`}>
                        {tr(d.stock_status)} · {t("Available", "دستیاب")}:{" "}
                        {d.qty_available} {d.unit}
                      </span>{" "}
                      · {t("Next expiry", "قریب میعاد")}: {d.next_expiry || "—"}
                    </p>
                    {!eligible && (
                      <p className="notice">
                        {d.is_active
                          ? prescriptionRequired
                          : t("Inactive medicine", "غیر فعال دوا")}
                      </p>
                    )}
                    {d.high_alert_category && (
                      <p className="error" role="note">
                        {t("High-alert medicine", "زیادہ خطرے کی دوا")}:{" "}
                        {d.high_alert_category}
                      </p>
                    )}
                    {!!d.lasa_with.length && (
                      <p>
                        {t("Looks or sounds like", "ملتی جلتی دوا")}:{" "}
                        <bdi>{d.lasa_with.join(", ")}</bdi>
                      </p>
                    )}
                    {writable && (
                      <button
                        data-help="otc.add"
                        disabled={!live || !eligible || d.qty_available <= 0}
                        onClick={() => {
                          setError(undefined);
                          try {
                            add(d);
                          } catch (e) {
                            setError(e);
                          }
                        }}
                      >
                        {t("Add medicine", "دوا شامل کریں")} #{d.drug_id}
                      </button>
                    )}
                  </article>
                );
              })}
          </section>
        </fieldset>
      ) : (
        <Empty>
          {t(
            "Formulary permission is required to identify products before selling. Ask IT.",
            "فروخت سے پہلے شناخت کے لیے دوا فہرست کی اجازت لازم۔ آئی ٹی سے کہیں۔",
          )}
        </Empty>
      )}
      {writable && canRead && (
        <fieldset disabled={blocked}>
          <section className="card">
            <h2>{t("OTC basket", "بغیر نسخہ فروخت کی ٹوکری")}</h2>
            <LoadState {...stock} retry={stock.reload} />
            {!basket.length && (
              <Empty>
                {t(
                  "No medicines selected. Scan or search above.",
                  "کوئی دوا منتخب نہیں۔ اوپر اسکین یا تلاش کریں۔",
                )}
              </Empty>
            )}
            {current.map((l) => (
              <article
                className="card"
                data-testid="otc-basket-line"
                key={l.drug.drug_id}
              >
                <h3>
                  <bdi>
                    {l.drug.name} · {l.drug.code}
                  </bdi>
                </h3>
                <p>
                  {t("Available / unit", "دستیاب / اکائی")}:{" "}
                  {stockReady ? l.drug.qty_available : "—"} / {l.drug.unit} ·{" "}
                  {l.barcode
                    ? t("Scanned barcode", "اسکین بارکوڈ")
                    : t("Formulary selection", "فہرست کا انتخاب")}{" "}
                  <bdi>{l.barcode}</bdi>
                </p>
                <Field
                  label={
                    t("Sale quantity", "فروخت کی مقدار") + ` #${l.drug.drug_id}`
                  }
                >
                  <input
                    data-help="otc.quantity"
                    inputMode="decimal"
                    value={l.qty}
                    onChange={(e) =>
                      setBasket((b) =>
                        b.map((v) =>
                          v.drug.drug_id === l.drug.drug_id
                            ? { ...v, qty: e.target.value }
                            : v,
                        ),
                      )
                    }
                  />
                </Field>
                <button
                  data-help="otc.remove"
                  onClick={() =>
                    setBasket((b) =>
                      b.filter((v) => v.drug.drug_id !== l.drug.drug_id),
                    )
                  }
                >
                  {t("Remove medicine", "دوا ہٹائیں")} #{l.drug.drug_id}
                </button>
              </article>
            ))}
            <div className="form-grid">
              <Field
                label={t("Customer name (optional)", "گاہک کا نام (اختیاری)")}
              >
                <input
                  data-help="otc.customer"
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field
                label={t(
                  "Customer mobile (optional)",
                  "گاہک کا موبائل (اختیاری)",
                )}
              >
                <input
                  data-help="otc.customer"
                  maxLength={30}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </Field>
              <Field
                label={t("OTC payment method", "او ٹی سی ادائیگی کا طریقہ")}
              >
                <select
                  data-help="otc.payment"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as "Cash" | "Card")}
                >
                  <option value="Cash" disabled={!ownDrawer}>
                    {tr("Cash")}
                  </option>
                  <option value="Card">{tr("Card")}</option>
                </select>
              </Field>
              {method === "Card" && (
                <Field
                  label={t("Card reference (optional)", "کارڈ حوالہ (اختیاری)")}
                >
                  <input
                    data-help="otc.payment"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </Field>
              )}
            </div>
            <p>
              {t(
                "The server calculates final prices, batches and the total when the sale is confirmed. No local price or batch selection.",
                "تصدیق پر سرور حتمی قیمت، بیچ اور کل رقم دے گا۔ مقامی قیمت یا بیچ انتخاب نہیں۔",
              )}
            </p>
            <button
              data-help="otc.review"
              disabled={
                !live ||
                !stockReady ||
                (method === "Cash" && (!ownDrawer || cashCounterMismatch))
              }
              onClick={prepare}
            >
              {t("Review OTC sale", "او ٹی سی فروخت کا جائزہ")}
            </button>
          </section>
        </fieldset>
      )}
      {saved && (
        <section className="card" data-testid="otc-confirmed">
          <h2>
            {t("Last confirmed OTC sale", "آخری تصدیق شدہ او ٹی سی فروخت")}
          </h2>
          <p>
            D-{saved.dispensation.dispensation_id} ·{" "}
            <bdi>{saved.invoice.invoice_no}</bdi> · {tr(saved.invoice.status)}
          </p>
          <p>
            {t("Total / paid / balance due", "کل / ادا / واجب الادا")}:{" "}
            {saved.dispensation.total_amount} / {saved.invoice.amount_paid} /{" "}
            {saved.invoice.balance_due}
          </p>
          <p>
            <bdi>
              {saved.dispensation.walkin_customer_name ||
                t("Walk-in customer", "بغیر اندراج گاہک")}{" "}
              · {saved.dispensation.walkin_customer_mobile}
            </bdi>{" "}
            · {tr(saved.dispensation.payment_mode)} ·{" "}
            {saved.payment?.receipt_no || "—"}
          </p>
          {saved.invoice.lines.map((l) => (
            <p key={l.invoice_item_id}>
              <bdi>{l.description}</bdi> · {l.qty} × {l.unit_price} ={" "}
              {l.line_total}
            </p>
          ))}
          <p>
            {t(
              "This sale is already recorded. Printing or a later read never submits it again. The basket above is a separate new sale.",
              "یہ فروخت درج ہے۔ پرنٹ یا بعد کی پڑھائی اسے نہیں دہراتی۔ اوپر ٹوکری الگ نئی فروخت ہے۔",
            )}
          </p>
        </section>
      )}
      {canReceipt && (
        <fieldset disabled={blocked}>
          <section className="card">
            <h2>
              {t("OTC receipt and reprint", "او ٹی سی رسید اور دوبارہ پرنٹ")}
            </h2>
            <form
              className="actions"
              onSubmit={(e) => {
                e.preventDefault();
                setError(undefined);
                setPrintNotice("");
                if (
                  !/^[1-9]\d*$/.test(lookup) ||
                  !Number.isSafeInteger(Number(lookup))
                ) {
                  setError(
                    new Error(
                      t(
                        "Enter a confirmed positive OTC dispensation ID.",
                        "تصدیق شدہ مثبت او ٹی سی فراہمی نمبر درج کریں۔",
                      ),
                    ),
                  );
                  return;
                }
                setReceiptId(Number(lookup));
                setRevision((n) => n + 1);
              }}
            >
              <Field
                label={t("OTC dispensation ID", "او ٹی سی فراہمی شناختی نمبر")}
              >
                <input
                  data-help="otc.receipt"
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                  inputMode="numeric"
                />
              </Field>
              <button data-help="otc.receipt">
                {t("Read OTC receipt", "او ٹی سی رسید پڑھیں")}
              </button>
            </form>
            <LoadState {...receipt} retry={receipt.reload} />
            {!receipt.loading && !receipt.error && receipt.data && (
              <>
                <p>
                  {t("Receipt for", "رسید برائے")} D-{receiptId} ·{" "}
                  {receipt.data.fields.dispensation.walkin_customer_name ||
                    t("Walk-in customer", "بغیر اندراج گاہک")}
                </p>
                <pre>{receipt.data.text}</pre>
                <button data-help="otc.print" onClick={() => void print(false)}>
                  {t("Print OTC receipt", "او ٹی سی رسید پرنٹ کریں")}
                </button>
                <button data-help="otc.print" onClick={() => void print(true)}>
                  {t(
                    "Save OTC receipt PDF",
                    "او ٹی سی رسید پی ڈی ایف محفوظ کریں",
                  )}
                </button>
              </>
            )}
            {printNotice && <p role="status">{printNotice}</p>}
            <p>
              {t(
                "Use the confirmed D-number to retrieve the receipt later. A printer/read failure never requires another sale. No sale-edit/delete/undo route is supplied here; ask an authorised finance officer about corrections.",
                "بعد میں تصدیق شدہ ڈی نمبر سے رسید پڑھیں۔ پرنٹر/پڑھائی کی خرابی پر فروخت نہ دہرائیں۔ یہاں ترمیم/حذف/واپسی راستہ نہیں؛ تصحیح کے لیے مجاز مالی افسر سے کہیں۔",
              )}
            </p>
          </section>
        </fieldset>
      )}
      {review && (
        <Modal
          title={t("Confirm OTC sale", "او ٹی سی فروخت کی تصدیق")}
          closable={!write.blocked}
          onClose={() => {
            if (!write.blocked) setReview(undefined);
          }}
        >
          {reviewAttempted && <ClinicalWriteFeedback write={write} />}
          {cashCounterMismatch && review.body.method === "Cash" && (
            <p className="notice">
              {t(
                "The server requires this cash counter:",
                "سرور کو اس نقد کاؤنٹر کی ضرورت ہے:",
              )}{" "}
              <bdi>{requiredCashNode}</bdi>.{" "}
              {t(
                "Close this review and ask IT to resolve the counter mapping. The refused sale was not recorded; do not open another person’s drawer.",
                "یہ جائزہ بند کرکے آئی ٹی سے کاؤنٹر نقشہ درست کرائیں۔ مسترد فروخت درج نہیں؛ دوسرے کی دراز نہ کھولیں۔",
              )}
            </p>
          )}
          <p>
            {t(
              "Review products, quantities, customer and payment. Confirm once; stock and payment are recorded together.",
              "دوائیں، مقدار، گاہک و طریقہ چیک۔ ایک بار تصدیق؛ اسٹاک و ادائیگی ساتھ درج ہوں گے۔",
            )}
          </p>
          {review.lines.map((l) => (
            <p key={l.drug.drug_id}>
              <bdi>
                {l.drug.name} · {l.barcode || l.drug.code}
              </bdi>{" "}
              · {l.qty} {l.drug.unit}
            </p>
          ))}
          <p>
            <bdi>
              {review.body.customer_name ||
                t("Walk-in customer", "بغیر اندراج گاہک")}{" "}
              · {review.body.customer_mobile}
            </bdi>{" "}
            · {tr(review.body.method || "Cash")} ·{" "}
            <bdi>{review.body.reference_no}</bdi>
          </p>
          <p>
            {t(
              "Final prices and total are returned by the server after confirmation. Do not repeat a sale to recover its receipt.",
              "حتمی قیمت و رقم تصدیق کے بعد سرور دے گا۔ رسید کے لیے فروخت نہ دہرائیں۔",
            )}
          </p>
          <button
            data-help="otc.confirm"
            disabled={
              write.blocked ||
              (review.body.method === "Cash" &&
                (!ownDrawer || cashCounterMismatch))
            }
            onClick={confirm}
          >
            {t("Confirm OTC sale", "او ٹی سی فروخت کی تصدیق")}
          </button>
        </Modal>
      )}
    </section>
  );
}
