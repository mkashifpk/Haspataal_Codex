import { useEffect, useState } from "react";
import { api, ApiError, call } from "../bridge";
import { bilingual as t, tr } from "../i18n";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import {
  ClinicalVisit,
  type ClinicalUser,
  type VisitContext,
} from "../clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { hospitalTimeToUtc } from "../hospital-time";
import * as rx from "../generated/eprescription";
import * as emr from "../generated/consultation";
type Props = {
  user: ClinicalUser;
  revision: number;
  initialTicket?: number;
  readOnly: boolean;
  connected: boolean;
  active: string[];
  timeZone?: string;
};
type Line = {
  id: string;
  drug?: rx.DrugStockOut;
  external: boolean;
  name: string;
  strength: string;
  form: string;
  qty: string;
  dose: string;
  route: string;
  frequency: string;
  interval: string;
  days: string;
  instructions: string;
  start: string;
  end: string;
  self: boolean;
  safety: string;
};
const newLine = (drug?: rx.DrugStockOut): Line => ({
  id: crypto.randomUUID(),
  drug,
  external: !drug,
  name: "",
  strength: "",
  form: "",
  qty: "",
  dose: "",
  route: "",
  frequency: "",
  interval: "",
  days: "",
  instructions: "",
  start: "",
  end: "",
  self: false,
  safety: "",
});
const safety = (d: rx.DrugStockOut) =>
  JSON.stringify([
    d.drug_id,
    d.strength,
    d.form,
    d.high_alert_category,
    d.is_restricted,
    d.lasa_with,
  ]);
const routes = [
  "Oral",
  "IV",
  "IM",
  "SC",
  "Topical",
  "Inhaled",
  "PR",
  "SL",
  "Ophthalmic",
  "Otic",
  "Nasal",
  "Other",
] as const;
const frequencies = [
  "OD",
  "BD",
  "TDS",
  "QID",
  "Q4H",
  "Q6H",
  "Q8H",
  "Q12H",
  "HS",
  "STAT",
  "PRN",
  "Other",
] as const;
export function EPrescription(props: Props) {
  return (
    <section>
      <h1>{t("E-prescription builder", "دوائی کا نسخہ")}</h1>
      <ClinicalVisit
        user={props.user}
        revision={props.revision}
        initialTicket={props.initialTicket}
      >
        {(ctx) => <PrescriptionEditor {...props} ctx={ctx} />}
      </ClinicalVisit>
    </section>
  );
}
function Stock({
  drug,
}: {
  drug: {
    stock_status: string | null;
    qty_available: number | null;
    high_alert_category: string | null;
    is_restricted: boolean | null;
    lasa_with: string[];
  };
}) {
  return (
    <>
      <span className={`stock-${drug.stock_status}`}>
        <strong>{tr(drug.stock_status || "Unknown")}</strong> ·{" "}
        {t("Available", "دستیاب")}:{" "}
        {drug.qty_available ?? t("Unknown", "نامعلوم")}
      </span>
      {drug.high_alert_category && (
        <p className="error" role="note">
          {t("High-alert medicine", "زیادہ خطرے والی دوائی")}:{" "}
          {drug.high_alert_category}
        </p>
      )}
      {drug.is_restricted && (
        <p className="notice">
          {t(
            "Restricted: a current RestrictedPrescribing privilege is required; the server verifies it.",
            "محدود دوائی: موجودہ خصوصی اجازت لازم ہے؛ سرور تصدیق کرتا ہے۔",
          )}
        </p>
      )}
      {drug.lasa_with.length > 0 && (
        <p className="error">
          {t("Looks or sounds like", "نام یا شکل ملتی ہے")}:{" "}
          {drug.lasa_with.join(" · ")}
        </p>
      )}
    </>
  );
}
function PrescriptionEditor({
  ctx,
  user,
  revision,
  readOnly,
  connected,
  active,
  timeZone,
}: Props & { ctx: VisitContext }) {
  const can = (p: string) => user.permissions.includes(p),
    [local, setLocal] = useState(0);
  const summary = useLoad(
    () =>
      can("patient.emr.view")
        ? emr.masterSummary(ctx.patient.patient_id)
        : Promise.resolve(undefined),
    [ctx.patient.patient_id, revision, local],
  );
  const notes = useLoad(
    () =>
      can("clinical.encounter.view")
        ? emr.forTicket(ctx.ticket.ticket_id)
        : Promise.resolve([]),
    [ctx.ticket.ticket_id, revision, local],
  );
  const docs = useLoad(
    () =>
      can("patient.document.view")
        ? emr.listDocumentsPatients(ctx.patient.patient_id)
        : Promise.resolve([]),
    [ctx.patient.patient_id, revision, local],
  );
  const [selected, setSelected] = useState<number>(),
    [lines, setLines] = useState<Line[]>([]),
    [dirty, setDirty] = useState(false),
    [q, setQ] = useState(""),
    [query, setQuery] = useState(""),
    [destination, setDestination] = useState<
      "" | "HospitalPharmacy" | "ExternalMarket"
    >(""),
    [source, setSource] = useState<"OPD" | "ER" | "IPD" | "CodeRed">("OPD"),
    [admission, setAdmission] = useState(""),
    [encounter, setEncounter] = useState(""),
    [note, setNote] = useState(""),
    [preview, setPreview] = useState<number>(),
    [own, setOwn] = useState<rx.PrescriptionDetailOut[]>([]),
    [error, setError] = useState<unknown>(),
    [printNotice, setPrintNotice] = useState("");
  const [action, setAction] = useState<"cancel" | "handover">(),
    [reason, setReason] = useState(""),
    [handed, setHanded] = useState<"" | "Patient" | "Attendant">(""),
    [attendant, setAttendant] = useState(""),
    [copy, setCopy] = useState<"" | "Electronic" | "CarbonCopy" | "Scan">(""),
    [documentId, setDocumentId] = useState(""),
    [physicalConfirmed, setPhysicalConfirmed] = useState(false),
    [actionDirty, setActionDirty] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  const found = useLoad(
    () =>
      can("pharmacy.formulary.view") && query.length >= 2
        ? rx.searchDrugs({ q: query, limit: 30 })
        : Promise.resolve([]),
    [query, revision, local],
  );
  const stock = useLoad(
    () => (preview ? rx.stockStatus(preview) : Promise.resolve(undefined)),
    [preview, revision, local],
  );
  const selectedDrugIds = [...new Set(lines.flatMap(l => l.drug ? [l.drug.drug_id] : []))].sort((a,b) => a-b).join(",");
  const lineStock = useLoad(
    () => selectedDrugIds
      ? Promise.all(selectedDrugIds.split(",").map(id => rx.stockStatus(Number(id))))
      : Promise.resolve([]),
    [selectedDrugIds, revision, local],
  );
  useEffect(() => {
    if (lineStock.loading || lineStock.error || !lineStock.data) return;
    const current = new Map(lineStock.data.map(drug => [drug.drug_id, drug]));
    setLines(previous => previous.map(line => {
      const fresh = line.drug && current.get(line.drug.drug_id);
      if (!fresh) return line;
      return {...line, drug:fresh, safety:safety(fresh) === safety(line.drug!) ? line.safety : ""};
    }));
  }, [lineStock.data, lineStock.loading, lineStock.error]);
  const record = useLoad(
    () =>
      selected
        ? api<rx.PrescriptionDetailOut>("GET", `/prescriptions/${selected}`)
        : Promise.resolve(undefined),
    [selected, revision, local],
  );
  const write = useClinicalWrite(
    user,
    `${ctx.ticket.ticket_id}:${ctx.patient.patient_id}`,
    async (result, command) => {
      const value = result as rx.PrescriptionDetailOut;
      setOwn((prev) => [
        value,
        ...prev.filter((r) => r.prescription_id !== value.prescription_id),
      ]);
      setSelected(value.prescription_id);
      if (command.path === "/prescriptions") {
        setLines([]);
        setDirty(false);
        setNote("");
      }
      setAction(undefined);
      setActionDirty(false);
      setLocal((n) => n + 1);
      await ctx.reload();
    },
  );
  const disabled =
    readOnly ||
    !connected ||
    !ctx.ready ||
    ctx.patient.is_deceased ||
    !!ctx.patient.merged_into_id ||
    ctx.ticket.is_clinical_locked ||
    ctx.ticket.approval_lock !== "None" ||
    write.blocked;
  const current =
    record.data &&
    !record.loading &&
    !record.error &&
    record.data.patient_id === ctx.patient.patient_id
      ? record.data
      : undefined;
  const validAdmissions = (summary.data?.admissions || []).filter(
    (a) =>
      a.patient_id === ctx.patient.patient_id &&
      [
        "Admitted",
        "CodeRedActive",
        "DischargeInProgress",
        "AdmissionPending",
        "Waitlisted",
        "BedReserved",
      ].includes(a.status),
  );
  const inpatient = source === "IPD" || source === "CodeRed";
  const input = (id: string, changes: Partial<Line>) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...changes } : l)),
    );
    setDirty(true);
  };
  const discard = () =>
    !dirty ||
    window.confirm(
      t("Discard the unsent prescription?", "غیر ارسال نسخہ چھوڑ دیں؟"),
    );
  async function preflight() {
    const [ticket, patient, me, est] = await Promise.all([
      api<emr.OpdTicketDetailOut>(
        "GET",
        `/opd-tickets/${ctx.ticket.ticket_id}`,
      ),
      api<any>("GET", `/patients/${ctx.patient.patient_id}`),
      api<any>("GET", "/auth/me"),
      api<any>("GET", "/establishment"),
    ]);
    if (
      readOnly ||
      !connected ||
      ticket.patient_id !== ctx.patient.patient_id ||
      patient.patient_id !== ctx.patient.patient_id ||
      patient.merged_into_id ||
      patient.is_deceased ||
      ticket.is_clinical_locked ||
      ticket.approval_lock !== "None" ||
      me.user_id !== user.user_id
    )
      throw new Error(
        t(
          "The current patient or visit is unavailable for this action. Refresh and review.",
          "موجودہ مریض یا ملاقات پر یہ عمل دستیاب نہیں۔ تازہ کرکے چیک کریں۔",
        ),
      );
    return { ticket, me, est };
  }
  function prescribe() {
    setError(undefined);
    try {
      if (disabled || !can("prescription.create")) return;
      if (!destination || !lines.length || lines.length > 100)
        throw new Error(
          t(
            "Choose the destination and add 1–100 medicine lines.",
            "منزل چنیں اور1تا100دوائیاں شامل کریں۔",
          ),
        );
      if (destination === "HospitalPharmacy" && !active.includes("dispensing"))
        throw new Error(
          t(
            "Hospital dispensing is not active. External market remains available.",
            "ہسپتال کی دوائی فراہمی فعال نہیں۔ بیرونی بازار دستیاب ہے۔",
          ),
        );
      if (
        inpatient &&
        !validAdmissions.some((a) => a.admission_id === Number(admission))
      )
        throw new Error(
          t(
            "Choose an actual admission of this patient.",
            "اسی مریض کا اصل داخلہ چنیں۔",
          ),
        );
      const items: rx.RxItemIn[] = lines.map((l, i) => {
        const fail = (message: string): never => {
          throw new Error(`${t("Line", "دوائی")} ${i + 1}: ${message}`);
        };
        if (!/^\d+(\.\d{1,3})?$/.test(l.qty) || Number(l.qty) <= 0)
          fail(
            t(
              "Enter a positive quantity without exponent notation.",
              "مثبت مقدار لکھیں؛ اس کی طاقت والی شکل نہیں۔",
            ),
          );
        if (!l.dose.trim() || !l.route || !l.frequency)
          fail(
            t(
              "Dose, route and frequency are required.",
              "خوراک، راستہ اور وقفہ لازم ہیں۔",
            ),
          );
        if (l.external && (!l.name.trim() || destination !== "ExternalMarket"))
          fail(
            t(
              "External medicines require a name and External market destination.",
              "بیرونی دوائی کا نام اور بیرونی بازار منزل لازم ہے۔",
            ),
          );
        if (!l.external && (!l.drug || !l.drug.is_active))
          fail(
            t(
              "Choose an active formulary medicine.",
              "فعال فہرست سے دوائی چنیں۔",
            ),
          );
        if (
          l.drug &&
          (l.drug.lasa_with.length ||
            l.drug.high_alert_category ||
            l.drug.is_restricted) &&
          l.safety !== safety(l.drug)
        )
          fail(
            t(
              "Read and confirm this medicine's safety warnings.",
              "دوائی کے خطرے کے پیغامات پڑھ کر تصدیق کریں۔",
            ),
          );
        if (
          !inpatient &&
          l.frequency !== "STAT" &&
          (!/^\d+$/.test(l.days) || Number(l.days) < 1)
        )
          fail(
            t(
              "Duration in whole days is required.",
              "مدت پورے دنوں میں لازم ہے۔",
            ),
          );
        if (inpatient && !l.start)
          fail(
            t(
              "Inpatient medication needs a start time.",
              "داخل مریض کی دوائی کا آغاز لازم ہے۔",
            ),
          );
        if (
          l.frequency === "Other" &&
          (!/^\d+(\.\d+)?$/.test(l.interval) || Number(l.interval) <= 0)
        )
          fail(
            t(
              "Other frequency needs a positive interval in hours.",
              "دیگر وقفے کے لیے مثبت گھنٹے لکھیں۔",
            ),
          );
        if (
          l.self &&
          (!inpatient ||
            !["Oral", "Inhaled", "Topical"].includes(l.route) ||
            l.drug?.high_alert_category)
        )
          fail(
            t(
              "Self-administration is not allowed for this line.",
              "اس دوائی کو خود لینے کی اجازت نہیں۔",
            ),
          );
        const start = l.start
            ? hospitalTimeToUtc(l.start, timeZone || "")
            : undefined,
          end = l.end ? hospitalTimeToUtc(l.end, timeZone || "") : undefined;
        if (start && end && end <= start)
          fail(t("End must be after start.", "اختتام آغاز کے بعد ہو۔"));
        return {
          ...(l.external
            ? {
                external_drug_name: l.name.trim(),
                external_strength: l.strength || null,
                external_form: l.form || null,
              }
            : { drug_id: l.drug!.drug_id }),
          qty_prescribed: l.qty,
          dose_text: l.dose.trim(),
          route: l.route as rx.RxItemIn["route"],
          frequency_code: l.frequency as rx.RxItemIn["frequency_code"],
          interval_hours: l.interval ? Number(l.interval) : null,
          duration_days: l.days ? Number(l.days) : null,
          instructions: l.instructions || null,
          start_at: start,
          end_at: end,
          is_stat: l.frequency === "STAT",
          is_prn: l.frequency === "PRN",
          self_administration: l.self,
        };
      });
      const linked = encounter
        ? notes.data?.find(
            (n) =>
              n.encounter_id === Number(encounter) &&
              n.patient_id === ctx.patient.patient_id,
          )
        : undefined;
      if (encounter && !linked)
        throw new Error(
          t(
            "Reload and select an encounter from this visit.",
            "تازہ کرکے اسی ملاقات کا نوٹ چنیں۔",
          ),
        );
      const body: rx.PrescriptionIn = {
        patient_id: ctx.patient.patient_id,
        ticket_id: ctx.ticket.ticket_id,
        source,
        destination,
        admission_id: inpatient ? Number(admission) : null,
        encounter_id: linked?.encounter_id || null,
        notes: note || null,
        items,
      };
      write.start(
        {
          method: "POST",
          path: "/prescriptions",
          body,
          permission: "prescription.create",
          protection: "idempotent",
          label: t("Create prescription", "نسخہ بنائیں"),
          reconcilePath: `/patients/${ctx.patient.patient_id}/master-summary`,
        },
        async () => {
          const { me, est } = await preflight();
          if (
            !me.permissions.includes("prescription.create") ||
            (destination === "HospitalPharmacy" &&
              !est.active.includes("dispensing"))
          )
            throw new Error(
              t(
                "Prescribing permission or pharmacy availability changed.",
                "نسخے کی اجازت یا فارمیسی کی دستیابی بدل گئی۔",
              ),
            );
          for (const l of lines.filter((l) => l.drug)) {
            const fresh = await rx.stockStatus(l.drug!.drug_id);
            if (!fresh.is_active || safety(fresh) !== safety(l.drug!))
              throw new Error(
                t(
                  "Medicine safety information changed. Remove and reselect it, then review the warnings.",
                  "دوائی کی حفاظتی معلومات بدل گئی ہیں۔ دوبارہ چن کر خطرات پڑھیں۔",
                ),
              );
          }
        },
      );
    } catch (e) {
      setError(e);
    }
  }
  const lineErrors = write.error instanceof ApiError
    ? write.error.response.error?.details?.lines : undefined;
  const missing = (index: number, field: string) => Array.isArray(lineErrors) &&
    lineErrors.some((line: {line?:number;missing?:unknown}) =>
      line.line === index + 1 && Array.isArray(line.missing) && line.missing.includes(field));
  function closeAction() {
    if (write.blocked) return;
    if (
      actionDirty &&
      !window.confirm(
        t(
          "Discard unsent handover/cancellation details?",
          "غیر ارسال حوالگی یا منسوخی چھوڑ دیں؟",
        ),
      )
    )
      return;
    setAction(undefined);
    setActionDirty(false);
  }
  function submitAction() {
    setError(undefined);
    if (!current || disabled || !action) return;
    if (action === "cancel") {
      if (reason.trim().length < 3) {
        setError(
          new Error(
            t(
              "A reason of at least 3 characters is required.",
              "کم از کم3حروف کی وجہ لازم ہے۔",
            ),
          ),
        );
        return;
      }
      write.start(
        {
          method: "POST",
          path: `/prescriptions/${current.prescription_id}/cancel`,
          body: { reason: reason.trim() },
          permission: "prescription.cancel",
          protection: "reconcile",
          label: t("Cancel prescription", "نسخہ منسوخ کریں"),
          reconcilePath: `/prescriptions/${current.prescription_id}`,
        },
        async () => {
          await preflight();
          const now = await api<rx.PrescriptionDetailOut>(
            "GET",
            `/prescriptions/${current.prescription_id}`,
          );
          if (
            now.patient_id !== ctx.patient.patient_id ||
            now.prescriber_id !== user.employee_id ||
            ["Cancelled", "Replaced", "FullyDispensed"].includes(now.status)
          )
            throw new Error(
              t(
                "This prescription cannot be cancelled by you in its current state.",
                "موجودہ حالت میں آپ یہ نسخہ منسوخ نہیں کر سکتے۔",
              ),
            );
        },
      );
    } else {
      if (
        !physicalConfirmed ||
        !handed ||
        !copy ||
        (handed === "Attendant" && !attendant.trim()) ||
        (copy === "Scan" &&
          !docs.data?.some(
            (d) =>
              d.document_id === Number(documentId) &&
              d.doc_type === "Prescription",
          ))
      ) {
        setError(
          new Error(
            t(
              "Confirm the actual handover, recipient and how the copy is kept. A scan must be this patient's Prescription document.",
              "اصل حوالگی، وصول کنندہ اور نقل محفوظ کرنے کی تصدیق کریں۔ اسکین اسی مریض کے نسخے کی دستاویز ہو۔",
            ),
          ),
        );
        return;
      }
      const body: rx.HandoverIn = {
        handed_to: handed,
        attendant_name: handed === "Attendant" ? attendant.trim() : null,
        copy_kept: copy,
        document_id: copy === "Scan" ? Number(documentId) : null,
      };
      write.start(
        {
          method: "POST",
          path: `/prescriptions/${current.prescription_id}/handover`,
          body,
          permission: can("prescription.create")
            ? "prescription.create"
            : "pharmacy.dispense",
          protection: "idempotent",
          label: t("Record actual handover", "اصل حوالگی درج کریں"),
          reconcilePath: `/prescriptions/${current.prescription_id}`,
        },
        async () => {
          await preflight();
          const now = await api<rx.PrescriptionDetailOut>(
            "GET",
            `/prescriptions/${current.prescription_id}`,
          );
          if (
            now.patient_id !== ctx.patient.patient_id ||
            ["Cancelled", "Replaced"].includes(now.status)
          )
            throw new Error(
              t(
                "Refresh the prescription before handover.",
                "حوالگی سے پہلے نسخہ تازہ کریں۔",
              ),
            );
        },
      );
    }
  }
  async function print(pdf: boolean) {
    if (!current) return;
    setError(undefined);
    setPrintNotice("");
    try {
      const result = await call<{ saved?: boolean; printed?: boolean }>(
        "print-prescription",
        { prescriptionId: current.prescription_id, pdf },
      );
      setPrintNotice(
        result.saved
          ? t("PDF saved.", "پی ڈی ایف محفوظ ہوگئی۔")
          : result.printed
            ? t(
                "Print sent. Record actual handover separately.",
                "پرنٹ بھیج دیا۔ اصل حوالگی الگ درج کریں۔",
              )
            : t(
                "Save cancelled; prescription remains saved.",
                "محفوظ کرنا منسوخ؛ نسخہ محفوظ ہے۔",
              ),
      );
    } catch (e) {
      setError(e);
    }
  }
  const list = [
    ...(summary.data?.prescriptions || []),
    ...own.filter(
      (o) =>
        !summary.data?.prescriptions.some(
          (s) => s.prescription_id === o.prescription_id,
        ),
    ),
  ];
  return (
    <section data-write-pending={write.blocked ? "true" : "false"}>
      <ErrorBox error={error} verbatim />
      <p role="status">{printNotice}</p>
      {!action && <ClinicalWriteFeedback write={write} />}
      {ctx.ticket.is_clinical_locked && (
        <p role="alert" className="error">
          {ctx.ticket.clinical_lock_reason}
        </p>
      )}
      <section className="card">
        <h2>{t("Patient prescriptions", "مریض کے نسخے")}</h2>
        <LoadState {...summary} retry={summary.reload} />
        <LoadState {...record} retry={record.reload} />
        {!can("patient.emr.view") && (
          <p>
            {t(
              "Your account cannot list consolidated clinical history.",
              "آپ کے اکاؤنٹ کو مجموعی طبی تاریخ دیکھنے کی اجازت نہیں۔",
            )}
          </p>
        )}
        {list.length === 0 && !summary.loading && !summary.error && (
          <Empty>
            {t(
              "No prescriptions listed for this patient.",
              "اس مریض کے نسخے درج نہیں۔",
            )}
          </Empty>
        )}
        {list.map((r) => (
          <button
            key={r.prescription_id}
            data-help="rx.history"
            disabled={write.blocked}
            onClick={() => {
              if (discard()) {
                setDirty(false);
                setLines([]);
                setSelected(r.prescription_id);
              }
            }}
          >
            <bdi>{r.prescription_number}</bdi> · {tr(r.status)} ·{" "}
            {tr(r.destination)} · {r.prescriber_name}
          </button>
        ))}
        <button
          data-help="rx.history"
          disabled={write.blocked}
          onClick={() => {
            if (discard()) {
              setSelected(undefined);
              setDirty(false);
              setLines([]);
            }
          }}
        >
          {t("New prescription", "نیا نسخہ")}
        </button>
      </section>
      {selected ? (
        current && (
          <section className="card">
            <h2>
              <bdi>{current.prescription_number}</bdi> · {tr(current.status)}
            </h2>
            <p>
              {tr(current.source)} · {tr(current.destination)} ·{" "}
              {current.prescriber_name}
            </p>
            <p>{current.notes}</p>
            {current.items.map((l) => (
              <article key={l.prescription_item_id}>
                <h3>
                  {l.external_drug_name || l.drug_name} ·{" "}
                  {l.external_strength || l.strength} ·{" "}
                  {l.external_form || l.form}
                </h3>
                <p>
                  {l.dose_text} · {tr(l.route || "")} ·{" "}
                  {tr(l.frequency_code || "")} · {l.duration_days}{" "}
                  {t("days", "دن")} · {t("Quantity", "مقدار")}:{" "}
                  {l.qty_prescribed} · {tr(l.item_status)}
                </p>
                <p>{l.instructions}</p>
                <p>
                  {l.start_at} · {l.end_at}{" "}
                  {l.self_administration &&
                    t("Self-administration allowed", "خود لینے کی اجازت")}
                </p>
                {!l.is_external && <Stock drug={l} />}
              </article>
            ))}
            <p className="notice">{current.prescriber_stamp.text}</p>
            <p>{current.cancel_reason}</p>
            {current.queries.length > 0 && (
              <>
                <h3>{t("Pharmacist queries", "فارماسسٹ کے سوالات")}</h3>
                {current.queries.map((q) => (
                  <article key={q.query_id}>
                    <strong>
                      {tr(q.status)} · {tr(q.reason)}
                    </strong>
                    <p>{q.question}</p>
                    <p>{q.answer}</p>
                    <p>{q.answer_stamp?.text}</p>
                  </article>
                ))}
              </>
            )}
            <h3>{t("Recorded handovers", "درج شدہ حوالگی")}</h3>
            {!current.handovers.length && (
              <p>
                {t(
                  "No handover recorded. Printing is not a handover.",
                  "حوالگی درج نہیں۔ پرنٹ حوالگی نہیں ہے۔",
                )}
              </p>
            )}
            {current.handovers.map((h) => (
              <p key={h.handover_id}>
                {tr(h.handed_to)} · {h.attendant_name} · {tr(h.copy_kept)} ·{" "}
                {h.handed_by_name} · <bdi>{h.handed_at}</bdi>
                {h.document_id &&
                  ` · ${t("Document", "دستاویز")} ${h.document_id}`}
              </p>
            ))}
            <button
              data-help="rx.print"
              disabled={write.blocked}
              onClick={() => void print(false)}
            >
              {t("Print prescription", "نسخہ پرنٹ کریں")}
            </button>
            <button
              data-help="rx.print"
              disabled={write.blocked}
              onClick={() => void print(true)}
            >
              {t("Save prescription PDF", "نسخہ پی ڈی ایف محفوظ کریں")}
            </button>
            {(can("prescription.create") || can("pharmacy.dispense")) &&
              !["Cancelled", "Replaced"].includes(current.status) && (
                <button
                  data-help="rx.handover"
                  disabled={disabled}
                  onClick={() => {
                    setAction("handover");
                    setHanded("");
                    setCopy("");
                    setAttendant("");
                    setDocumentId("");
                    setPhysicalConfirmed(false);
                    setActionDirty(false);
                  }}
                >
                  {t("Record handover", "حوالگی درج کریں")}
                </button>
              )}
            {can("prescription.cancel") &&
              current.prescriber_id === user.employee_id &&
              !["Cancelled", "Replaced", "FullyDispensed"].includes(
                current.status,
              ) && (
                <button
                  data-help="rx.cancel"
                  disabled={disabled}
                  onClick={() => {
                    setAction("cancel");
                    setReason("");
                    setActionDirty(false);
                  }}
                >
                  {t("Cancel prescription", "نسخہ منسوخ کریں")}
                </button>
              )}
          </section>
        )
      ) : (
        <section data-unsaved={dirty ? "true" : "false"} className="card">
          <h2>{t("New prescription", "نیا نسخہ")}</h2>
          <fieldset disabled={disabled || !can("prescription.create")}>
            <Field label={t("Prescription destination", "نسخے کی منزل")}>
              <select data-field="destination"
                data-help="rx.destination"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value as typeof destination);
                  setDirty(true);
                }}
              >
                <option value="">
                  {t("Choose deliberately", "خود انتخاب کریں")}
                </option>
                {active.includes("dispensing") && (
                  <option value="HospitalPharmacy">
                    {t("Hospital pharmacy", "ہسپتال کی فارمیسی")}
                  </option>
                )}
                <option value="ExternalMarket">
                  {t("External / local market", "بیرونی / مقامی بازار")}
                </option>
              </select>
            </Field>
            {!active.includes("dispensing") && (
              <p>
                {t(
                  "Hospital pharmacy is unavailable; an external-market prescription is still possible.",
                  "ہسپتال کی فارمیسی دستیاب نہیں؛ بیرونی بازار کا نسخہ بنایا جا سکتا ہے۔",
                )}
              </p>
            )}
            <Field label={t("Care context", "علاج کی جگہ")}>
              <select data-field="source"
                data-help="rx.context"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as typeof source);
                  setAdmission("");
                  setDirty(true);
                }}
              >
                {["OPD", "ER", "IPD", "CodeRed"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            {inpatient && (
              <Field label={t("Patient admission", "مریض کا داخلہ")}>
                <select data-field="admission_id"
                  data-help="rx.context"
                  value={admission}
                  onChange={(e) => {
                    setAdmission(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="">
                    {t("Choose actual admission", "اصل داخلہ چنیں")}
                  </option>
                  {validAdmissions.map((a) => (
                    <option key={a.admission_id} value={a.admission_id}>
                      {a.admission_number} · {tr(a.status)} · {a.ward_name}{" "}
                      {a.bed_label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <LoadState {...notes} retry={notes.reload} />
            <Field label={t("Linked consultation", "منسلک طبی نوٹ")}>
              <select
                data-help="rx.context"
                value={encounter}
                onChange={(e) => {
                  setEncounter(e.target.value);
                  setDirty(true);
                }}
              >
                <option value="">
                  {t("No linked note selected", "طبی نوٹ منتخب نہیں")}
                </option>
                {notes.data
                  ?.filter(
                    (n) =>
                      n.patient_id === ctx.patient.patient_id &&
                      (!inpatient || n.admission_id === Number(admission)),
                  )
                  .map((n) => (
                    <option key={n.encounter_id} value={n.encounter_id}>
                      {n.encounter_id} · {tr(n.status)} · {n.chief_complaint} ·{" "}
                      {n.diagnosis}
                    </option>
                  ))}
              </select>
            </Field>
            <p>
              {t(
                "Link the consultation so the printed prescription includes its complaint, findings, diagnosis, advice and VCO.",
                "طبی نوٹ منسلک کریں تاکہ پرنٹ میں شکایت، معائنہ، تشخیص، مشورہ اور رضامندی آئے۔",
              )}
            </p>
            {can("pharmacy.formulary.view") && (
              <>
                <Field label={t("Search medicines", "دوائی تلاش کریں")}>
                  <input
                    data-help="rx.search"
                    value={q}
                    maxLength={100}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </Field>
                <p>
                  {t(
                    "Enter at least 2 characters. Check strength and form before adding.",
                    "کم از کم2حروف لکھیں۔ شامل کرنے سے پہلے طاقت اور شکل چیک کریں۔",
                  )}
                </p>
                <LoadState {...found} retry={found.reload} />
                {query.length >= 2 &&
                  !found.loading &&
                  !found.error &&
                  !found.data?.length && (
                    <Empty>
                      {t(
                        "No formulary medicine matches. Review spelling or choose external market.",
                        "دوائی نہیں ملی۔ ہجے چیک یا بیرونی بازار چنیں۔",
                      )}
                    </Empty>
                  )}
                <div>
                  {!found.loading &&
                    !found.error &&
                    q.trim() === query &&
                    found.data?.map((d) => (
                      <article className="card" key={d.drug_id}>
                        <strong>
                          {d.name} · {d.strength} · {d.form}
                        </strong>
                        <p>
                          {d.code} · {d.generic_name} · {d.schedule}
                        </p>
                        <Stock drug={d} />
                        <button
                          data-help="rx.stock"
                          onClick={() => setPreview(d.drug_id)}
                        >
                          {t("Stock details", "اسٹاک کی تفصیل")}
                        </button>
                        <button
                          data-help="rx.search"
                          disabled={!d.is_active || lines.length >= 100}
                          onClick={() => {
                            setLines((prev) => [...prev, newLine(d)]);
                            setDirty(true);
                          }}
                        >
                          {t("Add medicine", "دوائی شامل کریں")}
                        </button>
                      </article>
                    ))}
                </div>
              </>
            )}
            {destination === "ExternalMarket" && (
              <button
                data-help="rx.lines"
                onClick={() => {
                  setLines((prev) => [...prev, newLine()]);
                  setDirty(true);
                }}
              >
                {t("Add external medicine", "بیرونی دوائی شامل کریں")}
              </button>
            )}
            {!lines.length && (
              <p>
                {t(
                  "No medicines added. Choose formulary or external medicine.",
                  "دوائی شامل نہیں۔ فہرست یا بیرونی دوائی چنیں۔",
                )}
              </p>
            )}
            {!!selectedDrugIds && <LoadState {...lineStock} retry={lineStock.reload} />}
            {lines.map((l, i) => (
              <section className="card" key={l.id}>
                <h3>
                  {t("Medicine", "دوائی")} {i + 1} · {l.drug?.name || l.name}
                </h3>
                {l.external ? (
                  <>
                    {(
                      [
                        [
                          "name",
                          "External medicine name",
                          "بیرونی دوائی کا نام",
                        ],
                        ["strength", "Strength", "طاقت"],
                        ["form", "Form", "شکل"],
                      ] as const
                    ).map(([k, en, ur]) => (
                      <Field key={k} label={t(en, ur)}>
                        <input
                          data-help="rx.lines"
                          value={l[k]}
                          maxLength={k === "name" ? 200 : 100}
                          onChange={(e) => input(l.id, { [k]: e.target.value })}
                        />
                      </Field>
                    ))}
                  </>
                ) : (
                  <>
                    <p>
                      {l.drug?.strength} · {l.drug?.form}
                    </p>
                    {!lineStock.loading && !lineStock.error && <Stock drug={l.drug!} />}
                    {(l.drug!.high_alert_category ||
                      l.drug!.is_restricted ||
                      l.drug!.lasa_with.length > 0) && (
                      <label>
                        <input
                          type="checkbox"
                          data-help="rx.safety"
                          checked={l.safety === safety(l.drug!)}
                          onChange={(e) =>
                            input(l.id, {
                              safety: e.target.checked ? safety(l.drug!) : "",
                            })
                          }
                        />
                        {t(
                          "I checked the name, strength, form and warnings; this is the intended medicine.",
                          "نام، طاقت، شکل اور خطرات چیک کیے؛ یہی مطلوبہ دوائی ہے۔",
                        )}
                      </label>
                    )}
                  </>
                )}
                {(
                  [
                    [
                      "qty",
                      "Quantity prescribed",
                      "تجویز کردہ مقدار",
                      "qty_prescribed",
                    ],
                    [
                      "dose",
                      "Dose (include units)",
                      "خوراک (اکائی سمیت)",
                      "dose_text",
                    ],
                  ] as const
                ).map(([k, en, ur, f]) => (
                  <Field key={k} label={t(en, ur)}>
                    <input
                      data-help="rx.lines"
                      value={l[k]}
                      maxLength={200}
                      aria-invalid={missing(i, f)}
                      onChange={(e) => input(l.id, { [k]: e.target.value })}
                    />
                  </Field>
                ))}
                <Field label={t("Route", "دینے کا راستہ")}>
                  <select data-field="route"
                    data-help="rx.directions"
                    value={l.route}
                    aria-invalid={missing(i, "route")}
                    onChange={(e) =>
                      input(l.id, { route: e.target.value, self: false })
                    }
                  >
                    <option value="">{t("Choose route", "راستہ چنیں")}</option>
                    {routes.map((r) => (
                      <option key={r} value={r}>
                        {tr(r)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Frequency", "خوراک کا وقفہ")}>
                  <select data-field="frequency_code"
                    data-help="rx.directions"
                    value={l.frequency}
                    aria-invalid={missing(i, "frequency_code")}
                    onChange={(e) => input(l.id, { frequency: e.target.value })}
                  >
                    <option value="">
                      {t("Choose frequency", "وقفہ چنیں")}
                    </option>
                    {frequencies.map((r) => (
                      <option key={r} value={r}>
                        {tr(r)}
                      </option>
                    ))}
                  </select>
                </Field>
                {(
                  [
                    [
                      "interval",
                      "Interval (hours, for Other)",
                      "دیگر کے لیے وقفہ (گھنٹے)",
                    ],
                    ["days", "Duration (days)", "مدت (دن)"],
                    ["instructions", "Additional directions", "اضافی ہدایات"],
                  ] as const
                ).map(([k, en, ur]) => (
                  <Field key={k} label={t(en, ur)}>
                    <input
                      data-help="rx.directions"
                      value={l[k]}
                      maxLength={k === "instructions" ? 1000 : 20}
                      aria-invalid={missing(
                        i,
                        k === "days" ? "duration_days" : k,
                      )}
                      onChange={(e) => input(l.id, { [k]: e.target.value })}
                    />
                  </Field>
                ))}
                {(inpatient || l.start || l.end) && (
                  <>
                    {(
                      [
                        [
                          "start",
                          "Start (hospital time)",
                          "آغاز (ہسپتال کا وقت)",
                        ],
                        [
                          "end",
                          "End (optional, hospital time)",
                          "اختتام (اختیاری، ہسپتال کا وقت)",
                        ],
                      ] as const
                    ).map(([k, en, ur]) => (
                      <Field key={k} label={t(en, ur)}>
                        <input
                          type="datetime-local"
                          data-help="rx.directions"
                          value={l[k]}
                          onChange={(e) => input(l.id, { [k]: e.target.value })}
                        />
                      </Field>
                    ))}
                  </>
                )}
                {inpatient && (
                  <label>
                    <input data-field="self_administration"
                      type="checkbox"
                      data-help="rx.safety"
                      checked={l.self}
                      disabled={
                        !["Oral", "Inhaled", "Topical"].includes(l.route) ||
                        !!l.drug?.high_alert_category
                      }
                      onChange={(e) => input(l.id, { self: e.target.checked })}
                    />
                    {t(
                      "Allow patient self-administration (non-high-alert oral, inhaled or topical only)",
                      "مریض کو خود لینے کی اجازت (صرف غیر خطرناک منہ، سانس یا جلد کی دوائی)",
                    )}
                  </label>
                )}
                <button
                  data-help="rx.lines"
                  onClick={() => {
                    setLines((prev) => prev.filter((x) => x.id !== l.id));
                    setDirty(true);
                  }}
                >
                  {t("Remove unsent line", "غیر ارسال دوائی ہٹائیں")}
                </button>
              </section>
            ))}
            <Field label={t("Prescription notes", "نسخے کے نوٹ")}>
              <textarea data-field="note notes"
                data-help="rx.lines"
                value={note}
                maxLength={4000}
                onChange={(e) => {
                  setNote(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <button
              data-help="rx.save"
              disabled={!lines.length || (!!selectedDrugIds && (lineStock.loading || !!lineStock.error))}
              onClick={prescribe}
            >
              {write.busy
                ? t("Sending…", "ارسال جاری…")
                : t("Create prescription", "نسخہ بنائیں")}
            </button>
          </fieldset>
        </section>
      )}
      {preview && (
        <Modal
          title={t("Medicine stock details", "دوائی کے اسٹاک کی تفصیل")}
          onClose={() => setPreview(undefined)}
        >
          <LoadState {...stock} retry={stock.reload} />
          {stock.data && !stock.loading && !stock.error && (
            <>
              <h3>
                {stock.data.name} · {stock.data.strength} · {stock.data.form}
              </h3>
              <Stock drug={stock.data} />
              <Details value={stock.data.batches} />
              <p>
                {t(
                  "Batches are returned in earliest-expiry order. Expired or recalled stock is not a dispensing promise.",
                  "بیچ جلد ختم ہونے کی ترتیب میں ہیں۔ زائد المیعاد یا واپس منگوایا اسٹاک فراہمی کا وعدہ نہیں۔",
                )}
              </p>
            </>
          )}
        </Modal>
      )}
      {action && current && (
        <Modal
          title={
            action === "cancel"
              ? t("Cancel prescription", "نسخہ منسوخ کریں")
              : t(
                  "Record actual prescription handover",
                  "نسخے کی اصل حوالگی درج کریں",
                )
          }
          onClose={closeAction}
          closable={!write.blocked}
        >
          <p>
            {ctx.patient.full_name} ·{" "}
            <bdi>
              {ctx.patient.mrn} · {current.prescription_number}
            </bdi>
          </p>
          <section data-unsaved={actionDirty ? "true" : "false"}>
            <fieldset disabled={disabled} onChange={() => setActionDirty(true)}>
              {action === "cancel" ? (
                <Field label={t("Cancellation reason", "منسوخی کی وجہ")}>
                  <textarea data-field="reason"
                    data-help="rx.cancel"
                    value={reason}
                    minLength={3}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              ) : (
                <>
                  <Field label={t("Handed to", "وصول کرنے والا")}>
                    <select data-field="handed_to"
                      data-help="rx.handover"
                      value={handed}
                      onChange={(e) =>
                        setHanded(e.target.value as typeof handed)
                      }
                    >
                      <option value="">
                        {t("Choose actual recipient", "اصل وصول کنندہ چنیں")}
                      </option>
                      <option value="Patient">{t("Patient", "مریض")}</option>
                      <option value="Attendant">
                        {t("Named attendant", "نام زد تیماردار")}
                      </option>
                    </select>
                  </Field>
                  {handed === "Attendant" && (
                    <Field label={t("Attendant name", "تیماردار کا نام")}>
                      <input data-field="attendant_name"
                        data-help="rx.handover"
                        value={attendant}
                        maxLength={120}
                        onChange={(e) => setAttendant(e.target.value)}
                      />
                    </Field>
                  )}
                  <Field label={t("Copy kept", "محفوظ کی گئی نقل")}>
                    <select data-field="copy_kept"
                      data-help="rx.handover"
                      value={copy}
                      onChange={(e) => setCopy(e.target.value as typeof copy)}
                    >
                      <option value="">
                        {t(
                          "Choose how the copy is kept",
                          "نقل محفوظ کرنے کا طریقہ چنیں",
                        )}
                      </option>
                      {(["Electronic", "CarbonCopy", "Scan"] as const).map(
                        (v) => (
                          <option key={v} value={v}>
                            {tr(v)}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  {copy === "Scan" && (
                    <>
                      <LoadState {...docs} retry={docs.reload} />
                      <Field
                        label={t(
                          "Signed prescription document",
                          "دستخط شدہ نسخے کی دستاویز",
                        )}
                      >
                        <select data-field="document_id"
                          data-help="rx.handover"
                          value={documentId}
                          onChange={(e) => setDocumentId(e.target.value)}
                        >
                          <option value="">
                            {t(
                              "Choose an uploaded Prescription document",
                              "اپ لوڈ شدہ نسخہ چنیں",
                            )}
                          </option>
                          {docs.data
                            ?.filter((d) => d.doc_type === "Prescription")
                            .map((d) => (
                              <option key={d.document_id} value={d.document_id}>
                                {d.document_id} · {d.document_date} · {d.title}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <p>
                        {t(
                          "Upload the signed copy separately in Patient document vault; never repeat prescribing to attach it.",
                          "دستخط شدہ نقل دستاویزات میں الگ اپ لوڈ کریں؛ منسلک کرنے کو نسخہ دوبارہ نہ بنائیں۔",
                        )}
                      </p>
                    </>
                  )}
                  <label>
                    <input
                      data-help="rx.handover"
                      type="checkbox"
                      checked={physicalConfirmed}
                      onChange={(e) => setPhysicalConfirmed(e.target.checked)}
                    />
                    {t(
                      "I have actually handed the prescription to this recipient and kept the stated copy.",
                      "میں نے نسخہ اس وصول کنندہ کو دے دیا اور بتائی ہوئی نقل محفوظ کی ہے۔",
                    )}
                  </label>
                </>
              )}
              <button
                data-help="rx.action"
                onClick={submitAction}
              >
                {t("Confirm prescription action", "نسخے کے عمل کی تصدیق کریں")}
              </button>
              <button data-help="rx.history" onClick={closeAction}>
                {t("Cancel", "منسوخ")}
              </button>
            </fieldset>
            <ErrorBox error={error} verbatim />
            <ClinicalWriteFeedback write={write} />
          </section>
        </Modal>
      )}
    </section>
  );
}
