import { useCallback, useEffect, useRef, useState } from "react";
import { api, call } from "../bridge";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t, tr } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as w from "../generated/wristbands_admissions";
import * as admissions from "../generated/pending_admissions";
import * as details from "../generated/admission_detail";
import * as er from "../generated/clinical_er";
import * as patients from "../generated/patient_search";
import { useClinicalWrite } from "../clinical-write";
import { canRetryWrite } from "../write-attempt";
import {
  bandAccess,
  bandBody,
  bandHistoryKey,
  bandPersonKey,
  bandScope,
  bandScanCode,
  type BandStay,
} from "../wristband-policy";
import { formatHospitalTime } from "../hospital-time";
type Context = {
  stay: BandStay;
  person: patients.PatientDetailOut;
  bands: w.WristbandOut[];
};
type Review = { body: w.WristbandIn; context: Context };
const stayKey = (s: BandStay) =>
  `${s.kind}:${s.id}:${s.patient_id}:${s.mrn}:${s.status}:${s.ward}:${s.bed}`;
export function Wristbands({
  user,
  establishment,
  connected,
  stream,
  timeZone,
  screenId = "wristbands_admissions",
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  timeZone?: string;
  screenId?: string;
}) {
  const can = (p: string) => user.permissions.includes(p),
    view = establishment.views.screens.find(
      (s) => s.screen_id === screenId,
    )?.view,
    access = bandAccess(view, user.permissions),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [mode, setMode] = useState<"admission" | "er">(screenId === "wristbands_er" ? "er" : "admission"),
    [find, setFind] = useState(""),
    [known, setKnown] = useState(""),
    [ctx, setCtx] = useState<Context>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    [review, setReview] = useState<Review>(),
    [preview, setPreview] = useState<w.PrintOut_WristbandFieldsOut_>(),
    [scan, setScan] = useState(""),
    [verified, setVerified] = useState<w.IdentityVerifyOut>(),
    [notice, setNotice] = useState("");
  const root = useRef<HTMLElement>(null),
    generation = useRef(0),
    flight = useRef(false),
    selected = useRef(ctx),
    lastStay = useRef<BandStay | undefined>(undefined),
    [refreshing, setRefreshing] = useState(false);
  selected.current = ctx;
  const list = useLoad(
    async () =>
      !access.read
        ? []
        : mode === "admission" && can("ipd.admission.view")
          ? (await admissions.listAdmissions()).map((r) => ({
              kind: "admission" as const,
              id: r.admission_id,
              patient_id: r.patient_id,
              name: r.patient_name,
              mrn: r.mrn,
              number: r.admission_number,
              status: r.status,
              ward: r.ward_name,
              bed: r.bed_label,
            }))
          : mode === "er" && can("er.visit.view")
            ? (await er.listVisitsEr({ open_only: true, limit: 1000 })).map(
                (r) => ({
                  kind: "er" as const,
                  id: r.er_visit_id,
                  patient_id: r.patient_id,
                  name: r.patient_name,
                  mrn: r.mrn,
                  number: r.er_number,
                  status: r.stage,
                  ward: r.ward_name,
                  bed: null,
                }),
              )
            : [],
    [mode, revision, access.read, user.user_id],
  );
  const work = useLoad(
    () => (access.worklist ? w.safetyWorklist() : Promise.resolve([])),
    [access.worklist, revision],
  );
  async function readContext(s: BandStay): Promise<Context> {
    let stay: BandStay;
    if (s.kind === "admission") {
      const r = await details.getAdmission(s.id);
      stay = {
        kind: "admission",
        id: r.admission_id,
        patient_id: r.patient_id,
        name: r.patient_name,
        mrn: r.mrn,
        number: r.admission_number,
        status: r.status,
        ward: r.ward_name,
        bed: r.bed_label,
      };
    } else {
      const r = (
        await er.listVisitsEr({ patient_id: s.patient_id, limit: 1000 })
      ).find((r) => r.er_visit_id === s.id);
      if (!r)
        throw Error(
          t(
            "The original emergency visit is unavailable. Read its current record before continuing.",
            "اصل ایمرجنسی ریکارڈ دستیاب نہیں۔ آگے تازہ ریکارڈ پڑھیں۔",
          ),
        );
      stay = {
        kind: "er",
        id: r.er_visit_id,
        patient_id: r.patient_id,
        name: r.patient_name,
        mrn: r.mrn,
        number: r.er_number,
        status: r.stage,
        ward: r.ward_name,
      };
    }
    const [person, bands] = await Promise.all([
      patients.getPatient(stay.patient_id),
      w.listWristbands({ patient_id: stay.patient_id }),
    ]);
    if (person.is_deceased)
      throw Error(
        t(
          "Patient is deceased. Wristbands cannot be issued for deceased patients.",
          "مریض کا انتقال ہو چکا ہے۔ متوفی مریضوں کو کلائی بینڈ جاری نہیں ہو سکتے۔",
        ),
      );
    return { stay, person, bands };
  }
  const write = useClinicalWrite(user, "wristbands", async (value, command) => {
    const r = value as w.WristbandIssuedOut,
      body = command.body as w.WristbandIn;
    if (
      r.wristband.admission_id !== (body.admission_id ?? null) ||
      r.wristband.er_visit_id !== (body.er_visit_id ?? null) ||
      r.print.fields.wristband_id !== r.wristband.wristband_id ||
      r.print.fields.mrn !== r.wristband.mrn
    )
      throw Error(
        t(
          "The returned band does not match the original stay. Ask IT to reconcile it.",
          "واپس پٹی اصل داخلے سے مختلف۔ آئی ٹی سے چیک کرائیں۔",
        ),
      );
    setPreview(r.print);
    setReview(undefined);
    setReason("");
    setAck(false);
    setVerified(undefined);
    setNotice(
      t(
        "Band issued on the server. Printing is a separate step; check and print this same band.",
        "پٹی سرور پر جاری۔ پرنٹ الگ مرحلہ؛ اسی پٹی کو چیک و پرنٹ کریں۔",
      ),
    );
    const c = selected.current;
    if (c) {
      const next = await readContext(c.stay);
      setCtx(next);
    }
    setRevision((n) => n + 1);
  });
  const locked = write.blocked || busy;
  useEffect(() => {
    if (write.attempt && !write.busy) setReview(undefined);
  }, [write.attempt, write.busy]);
  async function choose(s: BandStay, keepReason = false) {
    if (locked || flight.current) return;
    if (
      !keepReason &&
      (reason || ack) &&
      !window.confirm(
        t(
          "Discard this unsaved wristband draft?",
          "شناختی پٹی کا غیر محفوظ مسودہ چھوڑ دیں؟",
        ),
      )
    )
      return;
    flight.current = true;
    lastStay.current = s;
    const n = ++generation.current;
    setBusy(true);
    setError(undefined);
    setCtx(undefined);
    setPreview(undefined);
    setVerified(undefined);
    setReview(undefined);
    setAck(false);
    if (!keepReason) {
      setReason("");
      setScan("");
    }
    try {
      const c = await readContext(s);
      if (n === generation.current) setCtx(c);
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const refresh = useCallback(() => {
    setRevision((n) => n + 1);
    setVerified(undefined);
    setReview(undefined);
    setAck(false);
    setPreview(undefined);
    const stay = selected.current?.stay || lastStay.current;
    if (!stay) return;
    const n = ++generation.current;
    setRefreshing(true);
    void readContext(stay)
      .then((v) => {
        if (n === generation.current) {
          setCtx(v);
          setError(undefined);
        }
      })
      .catch((e) => {
        if (n === generation.current) {
          setCtx(undefined);
          setError(e);
        }
      })
      .finally(() => {
        if (n === generation.current) setRefreshing(false);
      });
  }, [user.user_id]);
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (e.type === "stream" && e.status === "Live" && e.resync) refresh();
        if (e.type === "event" && e.event_type === "patient.merged") refresh();
      }),
    [refresh],
  );
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (!locked) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [locked]);
  async function knownAdmission() {
    if (!/^\d+$/.test(known) || Number(known) < 1) {
      setError(
        Error(
          t(
            "Enter the known admission reference from its record.",
            "ریکارڈ سے اصل داخلہ حوالہ درج کریں۔",
          ),
        ),
      );
      return;
    }
    await choose({
      kind: "admission",
      id: Number(known),
      patient_id: 0,
      name: "",
      mrn: "",
      number: "",
      status: "",
    });
  }
  function makeReview() {
    if (!ctx || locked || refreshing) return;
    try {
      const body = bandBody(ctx.stay, ctx.bands, reason, ack);
      setReview({ body, context: structuredClone(ctx) });
      setError(undefined);
    } catch (e) {
      setError(e);
    }
  }
  function submit() {
    const r = review;
    if (!r || locked || !live || !access.issue || refreshing) return;
    write.start(
      {
        method: "POST",
        path: "/wristbands",
        body: r.body,
        permission: "patient.wristband.print",
        protection: "idempotent",
        reconcilePath: "/wristbands?patient_id=" + r.context.person.patient_id,
        label: r.context.person.full_name + " · " + r.context.person.mrn,
      },
      async () => {
        const [me, est, c] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
          readContext(r.context.stay),
        ]);
        const permitted = bandAccess(
          est.views.screens.find((s) => s.screen_id === screenId)
            ?.view,
          me.permissions,
        ).issue;
        if (me.user_id !== user.user_id || !permitted)
          throw Error(
            t(
              "The actor, permission or service view changed. Read again.",
              "صارف، اجازت یا خدمت بدلی۔ دوبارہ پڑھیں۔",
            ),
          );
        if (
          bandHistoryKey(c.bands) !== bandHistoryKey(r.context.bands) ||
          bandPersonKey(c.person) !== bandPersonKey(r.context.person) ||
          stayKey(c.stay) !== stayKey(r.context.stay)
        ) {
          setCtx(c);
          setPreview(undefined);
          setReview(undefined);
          setAck(false);
          throw Error(
            t(
              "Patient, stay or band changed. Your reason is kept; compare the current record and review again.",
              "مریض، داخلہ یا پٹی بدلی۔ وجہ محفوظ؛ تازہ ریکارڈ دیکھ کر پھر جائزہ لیں۔",
            ),
          );
        }
      },
    );
  }
  async function verify() {
    if (!ctx || locked || flight.current || refreshing) return;
    flight.current = true;
    setBusy(true);
    setVerified(undefined);
    setError(undefined);
    const n = generation.current;
    try {
      const r = await w.verifyWristband({
        code: bandScanCode(scan),
        ...bandScope(ctx.stay),
      });
      if (n === generation.current) setVerified(r);
    } catch (e) {
      setError(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function preparePrint(b: w.WristbandOut) {
    if (locked || flight.current || !access.print || !ctx) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setPreview(undefined);
    try {
      const c = await readContext(ctx.stay);
      setCtx(c);
      const actual = c.bands.find((r) => r.wristband_id === b.wristband_id);
      if (!actual?.is_current)
        throw Error(
          t(
            "This band has been replaced. Select the current band; do not print the old one.",
            "یہ پٹی بدل چکی۔ موجودہ چنیں؛ پرانی پرنٹ نہ کریں۔",
          ),
        );
      const p = await w.wristbandPrint(b.wristband_id);
      if (
        p.fields.wristband_id !== b.wristband_id ||
        p.fields.mrn !== c.person.mrn
      )
        throw Error(
          t(
            "Print identity changed. Read again.",
            "پرنٹ کی شناخت بدلی۔ دوبارہ پڑھیں۔",
          ),
        );
      setPreview(p);
    } catch (e) {
      setError(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function printBand(pdf: boolean) {
    if (!preview || !ctx || locked || flight.current || !access.print || !live)
      return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      const r = await call("print-wristband", {
        wristbandId: preview.fields.wristband_id,
        patientId: ctx.person.patient_id,
        mrn: preview.fields.mrn,
        pdf,
      });
      setNotice(
        r.saved
          ? t(
              "Band PDF saved. No new band was issued.",
              "پٹی پی ڈی ایف محفوظ؛ نئی پٹی جاری نہیں۔",
            )
          : r.printed
            ? t(
                "Band sent to the label printer. Check the physical band before fitting it.",
                "پٹی لیبل پرنٹر کو بھیج دی۔ پہناتے وقت اصل پٹی چیک کریں۔",
              )
            : t(
                "Save cancelled. The issued band remains; do not issue it again.",
                "محفوظ منسوخ؛ جاری پٹی موجود، دوبارہ جاری نہ کریں۔",
              ),
      );
    } catch (e) {
      setError(e);
      setNotice(
        t(
          "The band record is unchanged. Check the printer, then reprint this same band.",
          "پٹی ریکارڈ برقرار۔ پرنٹر چیک کرکے اسی پٹی کو دوبارہ پرنٹ کریں۔",
        ),
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const rows = (list.data || []).filter((s) =>
    (s.name + " " + s.mrn + " " + s.number)
      .toLowerCase()
      .includes(find.trim().toLowerCase()),
  );
  const time = (s: string) => (timeZone ? formatHospitalTime(s, timeZone) : s);
  if (!access.read)
    return (
      <Empty>
        {t(
          "This wristband records view is unavailable for your permissions or service.",
          "اجازت یا خدمت میں شناختی پٹی ریکارڈ دستیاب نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      ref={root}
      data-unsaved={!!reason || ack}
      data-write-pending={locked ? "true" : "false"}
    >
      <div className="bed-board-heading">
        <div>
          <h1>{t("Identity wristbands", "شناختی پٹیاں")}</h1>
          <p>
            {t(
              "Check the patient and stay, issue once, then print or reprint the same band.",
              "مریض و داخلہ چیک، ایک بار جاری، پھر اسی پٹی کا پرنٹ۔",
            )}
          </p>
        </div>
        <button
          data-help="bands.refresh"
          disabled={locked || refreshing}
          onClick={refresh}
        >
          {t("Refresh wristbands", "شناختی پٹیاں تازہ کریں")}
        </button>
      </div>
      <ErrorBox error={error} />
      <ErrorBox error={write.error} />
      {notice && <p role="status">{tr(notice)}</p>}
      {!live && (
        <p className="notice">
          {t(
            "Connection is not live. Issuing and printing are unavailable; reconnect and read again.",
            "رابطہ تازہ نہیں۔ اجرا و پرنٹ بند؛ بحال کرکے دوبارہ پڑھیں۔",
          )}
        </p>
      )}
      {view === "records" && (
        <p className="notice">
          {t(
            "Records only: read, verify and reprint; no new band or replacement.",
            "صرف ریکارڈ: پڑھیں، تصدیق و دوبارہ پرنٹ؛ نئی یا متبادل پٹی نہیں۔",
          )}
        </p>
      )}
      {view === "open_work" && (
        <p className="notice">
          {t(
            "No new inpatient admissions from now on. Bands for existing stays continue while the service retires.",
            "اب نئے داخلے نہیں۔ موجودہ داخلوں کی پٹیاں خدمت ختم ہوتے جاری۔",
          )}
        </p>
      )}
      {write.attempt && !write.busy && (
        <div className="notice" role="alert" data-help="bands.recovery">
          <p>
            {t(
              "The issue result is unknown. Keep this original request; do not create another band.",
              "اجرا کا نتیجہ نامعلوم۔ اصل درخواست رکھیں؛ نئی پٹی نہ بنائیں۔",
            )}
          </p>
          <p>{write.attempt.body.label}</p>
          {canRetryWrite(write.attempt) && (
            <button data-help="bands.recovery" onClick={write.retry}>
              {t("Retry original band request", "اصل پٹی درخواست دوبارہ")}
            </button>
          )}
          <button
            data-help="bands.recovery"
            onClick={() => void write.inspect()}
          >
            {t("Read original patient bands", "اصل مریض کی پٹیاں پڑھیں")}
          </button>
          {write.checked && Array.isArray(write.observed) && (
            <>
              <p>
                {t(
                  "Current server bands (a new row alone does not prove who issued it):",
                  "سرور کی موجودہ پٹیاں؛ نئی سطر اکیلے اجرا کا ثبوت نہیں:",
                )}
              </p>
              {(write.observed as w.WristbandOut[]).map((b) => (
                <p key={b.wristband_id}>
                  {b.patient_name} · <bdi>{b.mrn}</bdi> · #{b.wristband_id} ·{" "}
                  {b.is_current
                    ? t("Current", "موجودہ")
                    : t("Replaced", "بدلی ہوئی")}{" "}
                  · {time(b.issued_at)}
                </p>
              ))}
              <button
                data-help="bands.recovery"
                onClick={() => {
                  write.release();
                  setReview(undefined);
                  setAck(false);
                  refresh();
                }}
              >
                {t(
                  "Bands reviewed; return to draft",
                  "پٹیاں دیکھ لیں؛ مسودے پر واپس",
                )}
              </button>
            </>
          )}
        </div>
      )}
      <div className="wristband-layout">
        <section className="card">
          <h2>{t("Choose the stay", "داخلہ منتخب کریں")}</h2>
          <div className="toolbar">
            {can("ipd.admission.view") && (
              <button
                data-help="bands.stay"
                disabled={locked}
                aria-pressed={mode === "admission"}
                onClick={() => setMode("admission")}
              >
                {t("Admissions", "داخلے")}
              </button>
            )}
            {can("er.visit.view") && (
              <button
                data-help="bands.stay"
                disabled={locked}
                aria-pressed={mode === "er"}
                onClick={() => setMode("er")}
              >
                {t("Emergency visits", "ایمرجنسی آمد")}
              </button>
            )}
          </div>
          <Field label={t("Find a stay", "داخلہ تلاش کریں")}>
            <input
              data-help="bands.stay"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              disabled={locked}
            />
          </Field>
          {can("ipd.admission.view") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void knownAdmission();
              }}
            >
              <Field
                label={t("Known admission reference", "معلوم داخلہ حوالہ")}
              >
                <input
                  data-help="bands.stay"
                  inputMode="numeric"
                  value={known}
                  onChange={(e) => setKnown(e.target.value)}
                  disabled={locked}
                />
              </Field>
              <button data-help="bands.stay" disabled={locked}>
                {t("Read this admission", "یہ داخلہ پڑھیں")}
              </button>
            </form>
          )}
          <LoadState {...list} retry={list.reload} />
          {!list.loading && !list.error && !rows.length && (
            <Empty>
              {t(
                "No matching stays. Refresh or read a known admission; never guess its reference.",
                "داخلہ نہیں ملا۔ تازہ یا معلوم حوالہ پڑھیں؛ اندازہ نہیں۔",
              )}
            </Empty>
          )}
          <div className="wristband-stays">
            {!list.error &&
              rows.map((s) => (
                <button
                  key={s.kind + s.id}
                  data-help="bands.stay"
                  disabled={locked}
                  aria-pressed={
                    ctx?.stay.kind === s.kind && ctx.stay.id === s.id
                  }
                  onClick={() => void choose(s)}
                >
                  <strong>{s.name}</strong>
                  <bdi>
                    {s.mrn} · {s.number}
                  </bdi>
                  <small>
                    {tr(s.status)} · {s.ward} {s.bed}
                  </small>
                </button>
              ))}
          </div>
          {access.worklist && (
            <section>
              <h3>
                {t("Patients without a wristband", "شناختی پٹی کے بغیر مریض")}
              </h3>
              <LoadState {...work} retry={work.reload} />
              {!work.loading &&
                !work.error &&
                !(work.data || []).some((r) => r.kind === "NoWristband") && (
                  <p>
                    {t(
                      "No missing bands returned.",
                      "کوئی گم پٹی واپس نہیں آئی۔",
                    )}
                  </p>
                )}
              {!work.error &&
                (work.data || [])
                  .filter((r) => r.kind === "NoWristband")
                  .map((r, i) => (
                    <div className="error" key={i}>
                      <strong>
                        {r.patient_name} · <bdi>{r.mrn}</bdi>
                      </strong>
                      <p>
                        {r.title} {r.ward_name} {r.bed_label}
                      </p>
                      <button
                        data-help="bands.worklist"
                        disabled={
                          locked ||
                          !r.patient_id ||
                          (!r.admission_id && !r.er_visit_id) ||
                          (r.admission_id
                            ? !can("ipd.admission.view")
                            : !can("er.visit.view"))
                        }
                        onClick={() =>
                          void choose({
                            kind: r.admission_id ? "admission" : "er",
                            id: r.admission_id || r.er_visit_id!,
                            patient_id: r.patient_id!,
                            name: r.patient_name || "",
                            mrn: r.mrn || "",
                            number: "",
                            status: "",
                          })
                        }
                      >
                        {t("Read missing-band stay", "گم پٹی کا داخلہ پڑھیں")}
                      </button>
                    </div>
                  ))}
            </section>
          )}
          {!access.worklist && (
            <p className="muted">
              {t(
                "The missing-band worklist needs wristband or medication-safety permission. Choose an admission here.",
                "گم پٹی فہرست کے لیے پٹی یا دوا حفاظت کی اجازت لازم۔ یہاں داخلہ منتخب کریں۔",
              )}
            </p>
          )}
        </section>
        <section className="card">
          <h2>{t("Patient and band", "مریض اور پٹی")}</h2>
          {(busy || refreshing) && (
            <p role="status">
              {t(
                "Reading or sending; keep this patient selected…",
                "پڑھنا یا ارسال جاری؛ یہی مریض منتخب رکھیں…",
              )}
            </p>
          )}
          {!ctx && (
            <Empty>
              {t(
                "Choose a stay to read its patient and current band.",
                "داخلہ چن کر مریض و موجودہ پٹی پڑھیں۔",
              )}
            </Empty>
          )}
          {ctx && (
            <>
              <div className="patient-banner">
                <strong>{ctx.person.full_name}</strong>
                <p>
                  <bdi>{ctx.person.mrn}</bdi> ·{" "}
                  {ctx.person.dob ||
                    t("Birth date not recorded", "تاریخ پیدائش درج نہیں")}{" "}
                  · {tr(ctx.person.gender || "Not recorded")}
                </p>
                <p>
                  <bdi>{ctx.stay.number}</bdi> · {tr(ctx.stay.status)} ·{" "}
                  {ctx.stay.ward} {ctx.stay.bed}
                </p>
              </div>
              <p className={ctx.person.allergies ? "error" : "notice"}>
                <strong>{t("Allergies", "حساسیت")}: </strong>
                {ctx.person.allergies ||
                  t(
                    "Not recorded — confirm with the patient.",
                    "درج نہیں؛ مریض سے تصدیق کریں۔",
                  )}
              </p>
              <h3>{t("Band history", "پٹی کی تاریخ")}</h3>
              {!ctx.bands.length && (
                <p className="error">
                  {t(
                    "No wristband recorded for this patient.",
                    "اس مریض کی شناختی پٹی درج نہیں۔",
                  )}
                </p>
              )}
              {ctx.bands
                .filter((b) => b.is_current)
                .map((b) => (
                  <div key={b.wristband_id} className="wristband-history">
                    <strong>
                      {b.is_current
                        ? t("Current band", "موجودہ پٹی")
                        : t("Replaced band", "بدلی پٹی")}{" "}
                      #{b.wristband_id}
                    </strong>
                    <p>
                      {b.admission_number || b.er_number} · {b.issued_by_name} ·{" "}
                      {time(b.issued_at)}
                    </p>
                    {b.replacement_reason && <p>{b.replacement_reason}</p>}
                    {b.replaced_at && (
                      <p>
                        {t("Replaced at", "تبدیلی کا وقت")}:{" "}
                        {time(b.replaced_at)}
                      </p>
                    )}
                    {b.is_current && access.print && (
                      <button
                        data-help="bands.reprint"
                        disabled={locked || refreshing}
                        onClick={() => void preparePrint(b)}
                      >
                        {t(
                          "Read this band for reprint",
                          "دوبارہ پرنٹ کے لیے پٹی پڑھیں",
                        )}
                      </button>
                    )}
                  </div>
                ))}
              {ctx.bands.some((b) => !b.is_current) && (
                <details>
                  <summary data-help="bands.reprint">
                    {t("Earlier bands", "پہلی پٹیوں کی تاریخ")} (
                    {ctx.bands.filter((b) => !b.is_current).length})
                  </summary>
                  {ctx.bands
                    .filter((b) => !b.is_current)
                    .map((b) => (
                      <div key={b.wristband_id} className="wristband-history">
                        <strong>
                          {b.is_current
                            ? t("Current band", "موجودہ پٹی")
                            : t("Replaced band", "بدلی پٹی")}{" "}
                          #{b.wristband_id}
                        </strong>
                        <p>
                          {b.admission_number || b.er_number} ·{" "}
                          {b.issued_by_name} · {time(b.issued_at)}
                        </p>
                        {b.replacement_reason && <p>{b.replacement_reason}</p>}
                        {b.replaced_at && (
                          <p>
                            {t("Replaced at", "تبدیلی کا وقت")}:{" "}
                            {time(b.replaced_at)}
                          </p>
                        )}
                        {b.is_current && access.print && (
                          <button
                            data-help="bands.reprint"
                            disabled={locked || refreshing}
                            onClick={() => void preparePrint(b)}
                          >
                            {t(
                              "Read this band for reprint",
                              "دوبارہ پرنٹ کے لیے پٹی پڑھیں",
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                </details>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void verify();
                }}
              >
                <h3>
                  {t(
                    "Verify the band at the patient",
                    "مریض کے پاس پٹی کی تصدیق",
                  )}
                </h3>
                <Field
                  label={t(
                    "Scan patient wristband",
                    "مریض کی شناختی پٹی اسکین",
                  )}
                >
                  <input
                    data-help="bands.scan"
                    dir="ltr"
                    value={scan}
                    onChange={(e) => {
                      setScan(e.target.value);
                      setVerified(undefined);
                    }}
                    maxLength={80}
                    disabled={locked || refreshing}
                  />
                </Field>
                <button
                  data-help="bands.scan"
                  disabled={locked || !live || refreshing}
                >
                  {t("Verify against this stay", "اس داخلے سے تصدیق")}
                </button>
              </form>
              {verified && (
                <div
                  className={verified.match ? "notice" : "error"}
                  role={verified.match ? "status" : "alert"}
                >
                  <strong>
                    {verified.match
                      ? t("Band matches this patient.", "پٹی اسی مریض کی ہے۔")
                      : t(
                          "STOP — band does not match. Do not proceed with care using this band.",
                          "رکیں — پٹی مختلف مریض کی۔ اس پٹی پر نگہداشت آگے نہ کریں۔",
                        )}
                  </strong>
                  <p>
                    {t("Expected", "متوقع")}:{" "}
                    {verified.expected_patient.full_name} ·{" "}
                    <bdi>{verified.expected_patient.mrn}</bdi>
                  </p>
                  <p>
                    {t("Scanned band belongs to", "اسکین پٹی کا مریض")}:{" "}
                    {verified.scanned_patient?.full_name ||
                      t("No patient found", "مریض نہیں ملا")}{" "}
                    · <bdi>{verified.scanned_mrn}</bdi>
                  </p>
                </div>
              )}
              {access.issue && (
                <div>
                  <h3>
                    {ctx.bands.some((b) => b.is_current)
                      ? t("Replace a band", "پٹی بدلیں")
                      : t("Issue a band", "پٹی جاری کریں")}
                  </h3>
                  <p>
                    {t(
                      "For a jammed printer, reprint the current band above. Replacement creates a new band record.",
                      "پرنٹر جام پر اوپر موجودہ پٹی دوبارہ پرنٹ۔ متبادل نئی پٹی کا ریکارڈ بناتا ہے۔",
                    )}
                  </p>
                  <Field label={t("Replacement reason", "پٹی بدلنے کی وجہ")}>
                    <textarea data-field="reason"
                      data-help="bands.reason"
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        setReview(undefined);
                      }}
                      maxLength={300}
                      disabled={locked}
                    />
                  </Field>
                  <label>
                    <input
                      data-help="bands.confirm"
                      type="checkbox"
                      checked={ack}
                      disabled={locked}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    {t(
                      "I checked this patient and stay using two identifiers.",
                      "میں نے دو شناختوں سے یہی مریض و داخلہ چیک کیا۔",
                    )}
                  </label>
                  <button
                    data-help="bands.review"
                    disabled={
                      locked || !live || refreshing || verified?.match === false
                    }
                    onClick={makeReview}
                  >
                    {t("Review wristband issue", "پٹی کے اجرا کا جائزہ")}
                  </button>
                </div>
              )}
            </>
          )}
          {preview && (
            <section className="wristband-preview" data-help="bands.print">
              <h3>{t("Band ready to print", "پٹی پرنٹ کے لیے تیار")}</h3>
              <strong>{preview.fields.hospital_name}</strong>
              <h3>{preview.fields.patient_name}</h3>
              <bdi>{preview.fields.mrn}</bdi>
              <p>
                {preview.fields.gender} · {preview.fields.age} ·{" "}
                {preview.fields.admission_number || preview.fields.er_number}
              </p>
              <p>
                {preview.fields.ward_name} {preview.fields.bed_label}
              </p>
              {preview.fields.allergies && (
                <p className="error">
                  <strong>
                    {t("ALLERGIES", "حساسیت")}: {preview.fields.allergies}
                  </strong>
                </p>
              )}
              {preview.barcode_svg && (
                <img
                  alt={t("Server MRN barcode", "سرور کا ایم آر این بارکوڈ")}
                  src={
                    "data:image/svg+xml;base64," +
                    btoa(unescape(encodeURIComponent(preview.barcode_svg)))
                  }
                />
              )}{" "}
              {preview.qr_svg && (
                <img
                  alt={t("Server patient QR code", "سرور کا مریض کیو آر")}
                  src={
                    "data:image/svg+xml;base64," +
                    btoa(unescape(encodeURIComponent(preview.qr_svg)))
                  }
                />
              )}
              <p>
                {t(
                  "Only the label printer or a PDF is used. Issuing does not prove a band was printed or fitted.",
                  "صرف لیبل پرنٹر یا پی ڈی ایف۔ اجرا سے پرنٹ یا پہننا ثابت نہیں۔",
                )}
              </p>
              <button
                data-help="bands.print"
                disabled={locked || !live || refreshing}
                onClick={() => void printBand(false)}
              >
                {t("Print this same wristband", "اسی شناختی پٹی کا پرنٹ")}
              </button>
              <button
                data-help="bands.print"
                disabled={locked || !live || refreshing}
                onClick={() => void printBand(true)}
              >
                {t("Save wristband PDF", "شناختی پٹی پی ڈی ایف محفوظ")}
              </button>
            </section>
          )}
        </section>
      </div>
      {review && (
        <Modal
          title={t("Review wristband issue", "پٹی کے اجرا کا جائزہ")}
          closable={!write.blocked}
          onClose={() => setReview(undefined)}
        >
          <strong>
            {review.context.person.full_name} ·{" "}
            <bdi>{review.context.person.mrn}</bdi>
          </strong>
          <p>
            {review.context.stay.number} · {review.context.stay.ward}{" "}
            {review.context.stay.bed}
          </p>
          <p>
            {review.body.replacement_reason ||
              t("First band for this patient", "اس مریض کی پہلی پٹی")}
          </p>
          <p>
            {t(
              "Confirm issues a record once. Printing happens afterwards.",
              "تصدیق ایک بار ریکارڈ جاری؛ پرنٹ اس کے بعد۔",
            )}
          </p>
          <button
            data-help="bands.confirm"
            disabled={
              locked || !live || refreshing || verified?.match === false
            }
            onClick={submit}
          >
            {t("Confirm band issue", "پٹی کا اجرا تصدیق")}
          </button>
          <button
            data-help="bands.review"
            disabled={locked}
            onClick={() => setReview(undefined)}
          >
            {t("Back to band draft", "پٹی مسودے پر واپس")}
          </button>
          <ErrorBox error={write.error} />
        </Modal>
      )}
    </section>
  );
}
