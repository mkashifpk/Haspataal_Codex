import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { bilingual as t } from "../i18n";
import { ErrorBox, Field } from "../components";
import { ApiError, call } from "../bridge";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import * as contract from "../generated/compliance_register_ops";
import {
  listEquipment,
  type EquipmentOut,
} from "../generated/equipment_maintenance";
import {
  departments,
  type DepartmentOut,
} from "../generated/compliance_register_ops";
import {
  categories,
  kinds,
  states,
  complianceAccess,
  documentDraft,
  createDocumentPayload,
  editDocumentPayload,
  renewalPayload,
  validateDocument,
  groupedDocuments,
  type Draft,
} from "../compliance-register-policy";
import type { EstablishmentOut } from "../generated/facility_profile";

const captions: Record<string, [string, string]> = {
  Licence: ["Licence", "لائسنس"],
  Registration: ["Registration", "رجسٹریشن"],
  Certificate: ["Certificate", "سرٹیفکیٹ"],
  Plan: ["Written plan", "تحریری منصوبہ"],
  Law: ["Law", "قانون"],
  Hospital: ["Hospital", "ہسپتال"],
  Radiation: ["Radiation", "تابکاری"],
  Building: ["Building", "عمارت"],
  Fire: ["Fire", "آگ"],
  Lift: ["Lift", "لفٹ"],
  Boiler: ["Boiler", "بوائلر"],
  Power: ["Power", "بجلی"],
  BloodTransfusion: ["Blood transfusion", "خون کی منتقلی"],
  Food: ["Food", "خوراک"],
  Waste: ["Waste", "فضلہ"],
  Pharmacy: ["Pharmacy", "فارمیسی"],
  Laboratory: ["Laboratory", "لیبارٹری"],
  Water: ["Water", "پانی"],
  Environment: ["Environment", "ماحول"],
  Emergency: ["Emergency", "ایمرجنسی"],
  Equipment: ["Equipment", "آلات"],
  Staff: ["Staff", "عملہ"],
  Other: ["Other", "دیگر"],
  Expired: ["Expired", "میعاد ختم"],
  DueForRenewal: ["Due for renewal", "تجدید کا وقت"],
  Valid: ["Valid", "کارآمد"],
  NoExpiry: ["No expiry", "بغیر میعاد"],
  Renewed: ["Renewed", "تجدید شدہ"],
  Withdrawn: ["Withdrawn", "واپس لیا گیا"],
  Current: ["Current entry", "موجودہ اندراج"],
};
const caption = (value: string) =>
  captions[value] ? t(...captions[value]) : value;
const date = (value: string | null) => {
  if (!value) return t("Not recorded", "درج نہیں");
  const [year, month, day] = value.split("-");
  return `${day}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(month)-1]}-${year}`;
};
type Editor = {
  mode: "create" | "edit" | "renew" | "withdraw";
  original?: contract.ComplianceDocumentDetailOut;
};
export function ComplianceRegister({
  user,
  establishment,
  connected,
  onOpenHelp,
}: {
  user: ClinicalUser;
  establishment?: EstablishmentOut | null;
  connected: boolean;
  onOpenHelp: () => void;
}) {
  const access = complianceAccess(user.permissions, establishment);
  const [rows, setRows] = useState<contract.ComplianceDocumentOut[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>();
  const [kind, setKind] = useState(""),
    [category, setCategory] = useState(""),
    [state, setState] = useState(""),
    [closed, setClosed] = useState(false),
    [official, setOfficial] = useState(""),
    [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number>(),
    [detail, setDetail] = useState<contract.ComplianceDocumentDetailOut>(),
    [detailLoading, setDetailLoading] = useState(false),
    [detailError, setDetailError] = useState<unknown>();
  const [staff, setStaff] = useState<contract.FacilityStaffOut[]>([]),
    [equipment, setEquipment] = useState<EquipmentOut[]>([]),
    [depts, setDepts] = useState<DepartmentOut[]>([]),
    [lookupError, setLookupError] = useState<unknown>();
  const [editor, setEditor] = useState<Editor>(),
    [draft, setDraft] = useState<Draft>(documentDraft()),
    [reason, setReason] = useState(""),
    [validation, setValidation] = useState(""),
    [file, setFile] = useState<File>(),
    [fileBusy, setFileBusy] = useState(false),
    [fileError, setFileError] = useState<unknown>(),
    [fileNotice, setFileNotice] = useState("");
  const listSequence = useRef(0),
    detailSequence = useRef(0),
    formRef = useRef<HTMLFormElement>(null);
  const [staffQuery, setStaffQuery] = useState("");
  async function findOfficials() {
    if (!access.canManage || blocked) return;
    setLookupError(undefined);
    try {
      const found = await contract.staffFacility({q:staffQuery.trim()||undefined,limit:500});
      setStaff(previous => {
        const selected = previous.find(s=>String(s.user_id)===draft.responsible_user_id);
        return selected && !found.some(s=>s.user_id===selected.user_id) ? [selected,...found] : found;
      });
    } catch(e) {setLookupError(e);}
  }
  const refresh = useCallback(async () => {
    if (!access.canView) return;
    const seq = ++listSequence.current;
    setLoading(true);
    setError(undefined);
    try {
      const next = await contract.listDocumentsFacilityCompliance({
        kind: (kind || undefined) as
          contract.ComplianceDocumentOut["kind"] | undefined,
        category: (category || undefined) as
          contract.ComplianceDocumentOut["category"] | undefined,
        state: (state || undefined) as
          "Expired" | "DueForRenewal" | "Valid" | "NoExpiry" | undefined,
        include_closed: closed,
        responsible_user_id: official ? Number(official) : undefined,
      });
      if (seq === listSequence.current) setRows(next);
    } catch (e) {
      if (seq === listSequence.current) setError(e);
    } finally {
      if (seq === listSequence.current) setLoading(false);
    }
  }, [access.canView, kind, category, state, closed, official]);
  useEffect(() => {
    void refresh();
    return () => {
      listSequence.current++;
    };
  }, [refresh]);
  const readDetail = useCallback(async (id: number) => {
    const seq = ++detailSequence.current;
    setDetailLoading(true);
    setDetailError(undefined);
    try {
      const row = await contract.getDocument(id);
      if (seq === detailSequence.current) setDetail(row);
    } catch (e) {
      if (seq === detailSequence.current) setDetailError(e);
    } finally {
      if (seq === detailSequence.current) setDetailLoading(false);
    }
  }, []);
  useEffect(() => {
    setDetail(undefined);
    if (selected && access.canView) void readDetail(selected);
    return () => {
      detailSequence.current++;
    };
  }, [selected, access.canView, readDetail]);
  const loadLookups = useCallback(async () => {
    if (!access.canManage) return;
    setLookupError(undefined);
    const result = await Promise.allSettled([
      contract.staffFacility({ limit: 500 }),
      listEquipment({ medical_only: false, include_disposed: true }),
      departments(),
    ]);
    if (result[0].status === "fulfilled") setStaff(result[0].value);
    else setLookupError(result[0].reason);
    if (result[1].status === "fulfilled") setEquipment(result[1].value);
    else setLookupError(result[1].reason);
    if (result[2].status === "fulfilled") setDepts(result[2].value.filter(row=>row.is_active));
    else setLookupError(result[2].reason);
  }, [access.canManage]);
  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);
  const write = useClinicalWrite(
    user,
    "compliance_register_ops",
    async (value: contract.ComplianceDocumentDetailOut) => {
      detailSequence.current++;
      setSelected(value.document_id);
      setDetail(value);
      setEditor(undefined);
      setFile(undefined);
      setReason("");
      setValidation("");
      await refresh();
    },
  );
  const blocked = write.blocked || fileBusy;
  useEffect(() => {
    if (editor)
      formRef.current
        ?.querySelector<HTMLElement>("input,select,textarea")
        ?.focus();
  }, [editor]);
  const conflict =
    write.error instanceof ApiError &&
    write.error.response.error?.code === "VERSION_CONFLICT";
  const choose = (id: number) => {
    if (blocked || editor) return;
    setSelected(id);
    setFile(undefined);
    setFileError(undefined);
    setFileNotice("");
  };
  const open = (mode: Editor["mode"]) => {
    if (blocked || editor || !access.canManage || !connected) return;
    write.clearError();
    setEditor({ mode, original: mode === "create" ? undefined : detail });
    const next = documentDraft(mode === "create" ? undefined : detail);
    if (mode === "renew") {
      next.issued_on = "";
      next.valid_until = "";
    }
    setDraft(next);
    setReason("");
    setValidation("");
  };
  const update = (key: keyof Draft, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editor || blocked || !access.canManage || !connected) return;
    const original = editor.original;
    if (editor.mode === "withdraw") {
      if (reason.trim().length < 5 || reason.length > 1000) {
        setValidation(
          t("Enter a reason of5–1000 characters.", "وجہ5سے1000حروف میں لکھیں۔"),
        );
        return;
      }
      write.start({
        method: "POST",
        path: `/facility/compliance-documents/${original!.document_id}/withdraw`,
        body: { reason: reason.trim() },
        permission: "facility.compliance.manage",
        protection: "idempotent",
        reconcilePath: `/facility/compliance-documents/${original!.document_id}`,
        label: t("Withdraw this entry", "یہ اندراج واپس لیں"),
      });
      return;
    }
    const errors = validateDocument(draft, editor.mode);
    if (editor.mode === "renew" && original?.valid_until && !draft.valid_until)
      errors.push("valid_until");
    if (errors.length) {
      setValidation(
        t(
          "Check the title, kind, category, required dates, date order and field limits.",
          "عنوان، قسم، زمرہ، لازمی تاریخیں، تاریخوں کی ترتیب اور خانوں کی حد چیک کریں۔",
        ),
      );
      return;
    }
    const editing = editor.mode === "edit";
    const body = editing
      ? editDocumentPayload(draft, original!)
      : editor.mode === "renew"
        ? renewalPayload(draft)
        : createDocumentPayload(draft);
    if (editing && Object.keys(body).length === 1) {
      setValidation(
        t(
          "Change a field before saving.",
          "محفوظ کرنے سے پہلے کوئی خانہ بدلیں۔",
        ),
      );
      return;
    }
    write.start({
      method: editing ? "PUT" : "POST",
      path:
        editor.mode === "create"
          ? "/facility/compliance-documents"
          : `/facility/compliance-documents/${original!.document_id}${editor.mode === "renew" ? "/renew" : ""}`,
      body,
      permission: "facility.compliance.manage",
      protection: editing ? "reconcile" : "idempotent",
      reconcilePath:
        editor.mode === "create"
          ? "/facility/compliance-documents?include_closed=true"
          : `/facility/compliance-documents/${original!.document_id}`,
      label:
        editor.mode === "create"
          ? t("Add register entry", "رجسٹر میں اندراج")
          : editing
            ? t("Correct entry", "اندراج درست کریں")
            : t("Record renewal", "تجدید درج کریں"),
    });
  }
  async function upload() {
    if (
      !file ||
      !detail ||
      blocked ||
      !access.canManage ||
      detail.status !== "Current" ||
      !connected
    )
      return;
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
      file.size === 0
    ) {
      setFileError(
        new Error(
          t(
            "Choose a nonempty PDF, PNG or JPEG.",
            "پی ڈی ایف، پی این جی یا جے پی جی کی غیر خالی فائل منتخب کریں۔",
          ),
        ),
      );
      return;
    }
    setFileBusy(true);
    setFileError(undefined);
    const target = detail.document_id;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      flushSync(() => setFileBusy(false));
      write.start({
        method: "POST",
        path: `/facility/compliance-documents/${target}/scan`,
        body: {
          __multipart: [
            { name: "file", filename: file.name, type: file.type, bytes },
          ],
        },
        permission: "facility.compliance.manage",
        protection: "idempotent",
        reconcilePath: `/facility/compliance-documents/${target}`,
        label: t(
          "Attach scan to existing entry",
          "موجودہ اندراج سے اسکین منسلک کریں",
        ),
      });
    } catch (e) {
      setFileError(e);
    } finally {
      setFileBusy(false);
    }
  }
  async function documentFile(
    action: "preview" | "save" | "scan-preview" | "scan-save",
  ) {
    if (blocked) return;
    setFileBusy(true);
    setFileError(undefined);
    setFileNotice("");
    try {
      const result = action.startsWith("scan")
        ? await call("compliance-scan", {
            documentId: detail!.document_id,
            save: action === "scan-save",
          })
        : action === "save"
          ? await call("download", {
              path: "/facility/compliance-documents/register/pdf",
            })
          : await call("clinical-pdf", {
              path: "/facility/compliance-documents/register/pdf",
              preview: true,
            });
      setFileNotice(
        result.saved === false ? 'cancelled' : result.saved ? 'saved' : 'opened',
      );
    } catch (e) {
      setFileError(e);
    } finally {
      setFileBusy(false);
    }
  }
  const groups = groupedDocuments(rows, search);
  const officials = new Map<number, string>();
  for (const r of rows)
    if (r.responsible_user_id)
      officials.set(
        r.responsible_user_id,
        r.responsible_name || String(r.responsible_user_id),
      );
  for (const s of staff) if (s.user_id) officials.set(s.user_id, s.full_name);
  if (!access.canView)
    return (
      <section className="card">
        <h2>{t("Register unavailable", "رجسٹر دستیاب نہیں")}</h2>
        <p>
          {t(
            "Your permissions or the current facility view do not permit this screen.",
            "آپ کی اجازت یا سہولت کا موجودہ منظر اس اسکرین کی اجازت نہیں دیتا۔",
          )}
        </p>
      </section>
    );
  return (
    <section
      className="compliance-register"
      data-screen="compliance_register_ops"
      data-write-pending={blocked ? "true" : undefined}
      data-unsaved={editor || file ? "true" : "false"}
    >
      <header className="cr-heading">
        <div>
          <h2>
            {t(
              "Licences, certificates and plans",
              "لائسنس، سرٹیفکیٹ اور منصوبے",
            )}
          </h2>
          <p>
            {t(
              "Keep each official document current, with its responsible official, renewal history and scan.",
              "ہر سرکاری دستاویز، ذمہ دار عہدیدار، تجدید کی تاریخ اور اسکین کو تازہ رکھیں۔",
            )}
          </p>
        </div>
        <div className="actions">
          <button data-help="cr.help" onClick={onOpenHelp}>
            {t("Help · F1", "مدد · F1")}
          </button>
          <button
            data-help="cr.pdf"
            disabled={blocked || !connected}
            onClick={() => void documentFile("preview")}
          >
            {t("View / print register", "رجسٹر دیکھیں / پرنٹ کریں")}
          </button>
          <button
            data-help="cr.pdf"
            disabled={blocked || !connected}
            onClick={() => void documentFile("save")}
          >
            {t("Save register PDF", "رجسٹر پی ڈی ایف محفوظ کریں")}
          </button>
          {access.canManage && (
            <button
              className="primary"
              data-help="cr.add"
              disabled={blocked || !!editor || !connected}
              onClick={() => open("create")}
            >
              {t("Add entry", "نیا اندراج")}
            </button>
          )}
        </div>
      </header>
      <p className="muted">
        {t(
          "Urdu wording is a draft awaiting language review.",
          "اردو متن زبان کے جائزے کا منتظر مسودہ ہے۔",
        )}
      </p>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected. Reconnect before saving or reading documents.",
            "رابطہ منقطع ہے۔ محفوظ کرنے یا دستاویز پڑھنے سے پہلے دوبارہ رابطہ کریں۔",
          )}
        </p>
      )}
      {access.view === "records" && (
        <p className="notice">
          {t(
            "Records view: this register is read-only.",
            "ریکارڈ منظر: یہ رجسٹر صرف پڑھنے کے لیے ہے۔",
          )}
        </p>
      )}
      <ClinicalWriteFeedback
        write={{...write,notice:write.notice ? t("Confirmed on the server. A later read or print failure does not undo this action.","سرور نے تصدیق کی۔ بعد کی پڑھائی یا پرنٹ کی خرابی اس عمل کو واپس نہیں کرتی۔") : ""}}
        onReviewed={() => {
          setEditor(undefined);
          setFile(undefined);
          if (selected) void readDetail(selected);
          void refresh();
        }}
      />
      <ErrorBox error={fileError} verbatim />
      {fileNotice && <p role="status">{fileNotice==='cancelled' ? t("File save cancelled. No register entry was changed.","فائل محفوظ کرنا منسوخ۔ رجسٹر میں کوئی اندراج نہیں بدلا۔") : fileNotice==='saved' ? t("File saved.","فائل محفوظ ہوئی۔") : t("Document opened. Close the viewer to return here.","دستاویز کھل گئی۔ واپس آنے کے لیے ونڈو بند کریں۔")}</p>}
      <fieldset
        disabled={blocked || !!editor}
        className="cr-filters"
        data-unsaved="false"
      >
        <Field label={t("Kind", "قسم")}>
          <select
            data-help="cr.filters"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">{t("All kinds", "تمام اقسام")}</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {caption(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Category", "زمرہ")}>
          <select
            data-help="cr.filters"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t("All categories", "تمام زمرے")}</option>
            {categories.map((k) => (
              <option key={k} value={k}>
                {caption(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("State", "حالت")}>
          <select
            data-help="cr.filters"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">{t("All states", "تمام حالتیں")}</option>
            {states.slice(0, 4).map((k) => (
              <option key={k} value={k}>
                {caption(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Responsible official", "ذمہ دار عہدیدار")}>
          <select
            data-help="cr.filters"
            value={official}
            onChange={(e) => setOfficial(e.target.value)}
          >
            <option value="">{t("All officials", "تمام عہدیدار")}</option>
            {[...officials].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t(
            "Search title, reference or official",
            "عنوان، حوالہ یا عہدیدار تلاش کریں",
          )}
        >
          <input
            data-help="cr.search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            data-help="cr.filters"
            checked={closed}
            onChange={(e) => setClosed(e.target.checked)}
          />
          {t("Include renewed / withdrawn", "تجدید شدہ / واپس لیے گئے بھی")}
        </label>
        <button
          data-help="cr.refresh"
          onClick={() => {
            void refresh();
            if (selected) void readDetail(selected);
            if (access.canManage) void loadLookups();
          }}
        >
          {t("Refresh", "تازہ کریں")}
        </button>
      </fieldset>
      <ErrorBox error={error} verbatim />
      {loading && (
        <p role="status">
          {t("Reading the register…", "رجسٹر پڑھا جا رہا ہے…")}
        </p>
      )}
      {!loading && !error && !groups.some((g) => g.rows.length) && (
        <p className="notice">
          {t(
            "No entries match these filters. Clear the filters or add the actual document; this is not proof of facility compliance.",
            "ان فلٹروں سے کوئی اندراج نہیں ملا۔ فلٹر ہٹائیں یا اصل دستاویز درج کریں؛ یہ سہولت کی تعمیل کا ثبوت نہیں۔",
          )}
        </p>
      )}
      <div className="cr-columns">
        <div
          className="cr-list"
          aria-label={t("Register entries", "رجسٹر کے اندراجات")}
        >
          {groups.map(
            (g) =>
              g.rows.length > 0 && (
                <section key={g.state}>
                  <h3
                    className={
                      g.state === "Expired"
                        ? "cr-expired"
                        : g.state === "DueForRenewal"
                          ? "cr-due"
                          : ""
                    }
                  >
                    {caption(g.state)} · {g.rows.length}
                  </h3>
                  {g.rows.map((r) => (
                    <button
                      className="cr-row"
                      key={r.document_id}
                      data-help="cr.select"
                      aria-pressed={selected === r.document_id}
                      disabled={blocked || !!editor}
                      onClick={() => choose(r.document_id)}
                    >
                      <strong>{r.title}</strong>
                      <span>
                        {caption(r.kind)} · {caption(r.category)} ·{" "}
                        <bdi>{r.reference_no || "—"}</bdi>
                      </span>
                      <span>
                        {caption(r.state)}
                        {r.days_left !== null
                          ? ` · ${r.days_left} ${t("days", "دن")}`
                          : ""}{" "}
                        · {date(r.valid_until)}
                      </span>
                      {r.renewal_applied_on && (
                        <span>
                          {t("Renewal applied", "تجدید کی درخواست")} ·{" "}
                          {date(r.renewal_applied_on)} ·{" "}
                          <bdi>{r.renewal_reference}</bdi>
                        </span>
                      )}
                      <span>
                        {r.responsible_name ||
                          t("Official not recorded", "عہدیدار درج نہیں")}{" "}
                        ·{" "}
                        {r.has_scan
                          ? t("Scan attached", "اسکین منسلک")
                          : t("No scan", "اسکین نہیں")}
                      </span>
                    </button>
                  ))}
                </section>
              ),
          )}
        </div>
        <div className="card cr-detail">
          {detailLoading && (
            <p role="status">
              {t("Reading selected entry…", "منتخب اندراج پڑھا جا رہا ہے…")}
            </p>
          )}
          <ErrorBox error={detailError} verbatim />
          {!selected && !editor && (
            <p>
              {t(
                "Select an entry to inspect its dates, scan and renewal chain.",
                "تاریخیں، اسکین اور تجدید کا سلسلہ دیکھنے کے لیے اندراج منتخب کریں۔",
              )}
            </p>
          )}
          {detail && !detailLoading && !detailError && (
            <>
              <h3>{detail.title}</h3>
              <p>
                <bdi>#{detail.document_id}</bdi> · {caption(detail.kind)} ·{" "}
                {caption(detail.category)} ·{" "}
                <strong>{caption(detail.state)}</strong>
              </p>
              <dl className="cr-facts">
                {[
                  [t("Authority", "ادارہ"), detail.authority],
                  [t("Reference", "حوالہ"), detail.reference_no],
                  [t("Issued on", "اجرا کی تاریخ"), date(detail.issued_on)],
                  [
                    t("Expiry / plan review", "میعاد / منصوبے کا جائزہ"),
                    date(detail.valid_until),
                  ],
                  [
                    t("Renewal lead days", "تجدید سے پہلے دن"),
                    String(detail.renewal_lead_days),
                  ],
                  [
                    t("Responsible official", "ذمہ دار عہدیدار"),
                    detail.responsible_name,
                  ],
                  [
                    t("Equipment", "آلہ"),
                    [detail.asset_tag, detail.asset_name]
                      .filter(Boolean)
                      .join(" · "),
                  ],
                  [t("Department", "شعبہ"), detail.department_name],
                  [
                    t("Renewal applied on", "تجدید کی درخواست کی تاریخ"),
                    date(detail.renewal_applied_on),
                  ],
                  [
                    t("Renewal receipt reference", "تجدید کی رسید کا حوالہ"),
                    detail.renewal_reference,
                  ],
                  [t("Note", "نوٹ"), detail.note],
                  [
                    t("Withdrawal reason", "واپسی کی وجہ"),
                    detail.withdrawn_reason,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd dir="auto">{value || t("Not recorded", "درج نہیں")}</dd>
                  </div>
                ))}
              </dl>
              <div className="actions">
                <button
                  data-help="cr.detail"
                  disabled={blocked}
                  onClick={() => void readDetail(detail.document_id)}
                >
                  {t("Read latest entry", "تازہ اندراج پڑھیں")}
                </button>
                {detail.renewed_by_id && (
                  <button
                    data-help="cr.history"
                    disabled={blocked || !!editor}
                    onClick={() => choose(detail.renewed_by_id!)}
                  >
                    {t("Open replacement", "متبادل اندراج کھولیں")} #
                    {detail.renewed_by_id}
                  </button>
                )}
                {access.canManage && detail.status === "Current" && (
                  <>
                    <button
                      data-help="cr.edit"
                      disabled={blocked || !!editor || !connected}
                      onClick={() => open("edit")}
                    >
                      {t(
                        "Correct / renewal applied",
                        "درستگی / تجدید کی درخواست",
                      )}
                    </button>
                    <button
                      data-help="cr.renew"
                      disabled={blocked || !!editor || !connected}
                      onClick={() => open("renew")}
                    >
                      {t("Record renewal", "تجدید درج کریں")}
                    </button>
                    <button
                      data-help="cr.withdraw"
                      disabled={blocked || !!editor || !connected}
                      onClick={() => open("withdraw")}
                    >
                      {t("Withdraw entry", "اندراج واپس لیں")}
                    </button>
                  </>
                )}
              </div>
              {detail.status !== "Current" && (
                <p className="notice">
                  {t(
                    "Closed entry: its history and scan stay readable. Correct or attach scans to the current replacement.",
                    "بند اندراج: تاریخ اور اسکین پڑھے جا سکتے ہیں۔ درستگی یا اسکین موجودہ متبادل اندراج پر کریں۔",
                  )}
                </p>
              )}
              <section>
                <h4>{t("Scan", "اسکین")}</h4>
                <p>
                  {detail.has_scan
                    ? `${detail.content_type} · ${detail.size_bytes} ${t("bytes", "بائٹس")}`
                    : t(
                        "No scan attached. Registration is already separate from attachment.",
                        "اسکین منسلک نہیں۔ اندراج اور فائل منسلک کرنا الگ مراحل ہیں۔",
                      )}
                </p>
                {detail.has_scan && (
                  <div className="actions">
                    <button
                      data-help="cr.scan-read"
                      disabled={blocked}
                      onClick={() => void documentFile("scan-preview")}
                    >
                      {t("View scan", "اسکین دیکھیں")}
                    </button>
                    <button
                      data-help="cr.scan-read"
                      disabled={blocked}
                      onClick={() => void documentFile("scan-save")}
                    >
                      {t("Save scan", "اسکین محفوظ کریں")}
                    </button>
                  </div>
                )}
                {access.canManage && detail.status === "Current" && !editor && (
                  <fieldset disabled={blocked || !connected}>
                    <Field
                      label={t(
                        "PDF, PNG or JPEG scan",
                        "پی ڈی ایف، پی این جی یا جے پی جی اسکین",
                      )}
                      hint={t(
                        "A new upload replaces this entry’s previous scan. Keep the renewal receipt here until the renewed document exists.",
                        "نیا اسکین پچھلی فائل کی جگہ لے گا۔ تجدید شدہ دستاویز ملنے تک درخواست کی رسید یہاں رکھیں۔",
                      )}
                    >
                      <input
                        key={detail.document_id + ":" + detail.row_version}
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        data-help="cr.scan-upload"
                        onChange={(e) => {
                          setFile(e.target.files?.[0]);
                          setFileError(undefined);
                        }}
                      />
                    </Field>
                    <button
                      data-help="cr.scan-upload"
                      disabled={!file}
                      onClick={() => void upload()}
                    >
                      {t("Attach / replace scan", "اسکین منسلک / تبدیل کریں")}
                    </button>
                    {file && (
                      <button
                        data-help="cr.cancel"
                        onClick={() => {
                          setFile(undefined);
                          const input =
                            document.querySelector<HTMLInputElement>(
                              '[data-help="cr.scan-upload"][type="file"]',
                            );
                          if (input) input.value = "";
                        }}
                      >
                        {t("Clear file selection", "فائل کا انتخاب ہٹائیں")}
                      </button>
                    )}
                  </fieldset>
                )}
              </section>
              {detail.history.length > 0 && (
                <section>
                  <h4>
                    {t(
                      "Earlier entries (newest first)",
                      "پہلے اندراجات (تازہ ترین پہلے)",
                    )}
                  </h4>
                  {detail.history.map((h) => (
                    <button
                      className="cr-row"
                      key={h.document_id}
                      data-help="cr.history"
                      disabled={blocked || !!editor}
                      onClick={() => choose(h.document_id)}
                    >
                      #{h.document_id} · <bdi>{h.reference_no || "—"}</bdi> ·{" "}
                      {date(h.issued_on)} → {date(h.valid_until)} ·{" "}
                      {caption(h.status)}
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
          {editor && (
            <form
              ref={formRef}
              onSubmit={submit}
              className="cr-editor"
              data-unsaved="true"
            >
              <h3>
                {editor.mode === "create"
                  ? t("Add entry", "نیا اندراج")
                  : editor.mode === "edit"
                    ? t(
                        "Correct / renewal applied",
                        "درستگی / تجدید کی درخواست",
                      )
                    : editor.mode === "renew"
                      ? t("Record renewal", "تجدید درج کریں")
                      : t("Withdraw entry", "اندراج واپس لیں")}
              </h3>
              {editor.original && (
                <p>
                  {t("Editing original version", "اصل نسخے میں ترمیم")}{" "}
                  <bdi>{editor.original.row_version}</bdi> · #
                  {editor.original.document_id}
                </p>
              )}
              {conflict && (
                <p role="alert">
                  {t(
                    "Another terminal changed this entry. Your draft is retained. Read latest entry above to compare; Cancel and reopen to deliberately apply changes against its new version.",
                    "دوسرے ٹرمینل نے اندراج بدل دیا۔ مسودہ برقرار ہے۔ اوپر تازہ اندراج پڑھ کر موازنہ کریں؛ منسوخ کر کے دوبارہ کھولیں اور نئے نسخے پر تبدیلی کریں۔",
                  )}
                </p>
              )}
              <ErrorBox error={lookupError} verbatim />
              {validation && (
                <p className="error" role="alert">
                  {validation}
                </p>
              )}
              <fieldset disabled={blocked || !access.canManage || !connected}>
                {editor.mode === "withdraw" ? (
                  <Field label={t("Reason for withdrawal", "واپسی کی وجہ")}>
                    <textarea
                      data-help="cr.withdraw-reason"
                      minLength={5}
                      maxLength={1000}
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                ) : (
                  <>
                    {editor.mode === "create" && (
                      <div className="cr-form-grid">
                        <Field label={t("Kind", "قسم")}>
                          <select
                            required
                            data-help="cr.kind"
                            value={draft.kind}
                            onChange={(e) => update("kind", e.target.value)}
                          >
                            <option value="">
                              {t("Choose kind", "قسم منتخب کریں")}
                            </option>
                            {kinds.map((k) => (
                              <option key={k} value={k}>
                                {caption(k)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={t("Category", "زمرہ")}>
                          <select
                            required
                            data-help="cr.category"
                            value={draft.category}
                            onChange={(e) => update("category", e.target.value)}
                          >
                            <option value="">
                              {t("Choose category", "زمرہ منتخب کریں")}
                            </option>
                            {categories.map((k) => (
                              <option key={k} value={k}>
                                {caption(k)}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    )}
                    <Field label={t("Title", "عنوان")}>
                      <input
                        data-help="cr.title"
                        minLength={3}
                        maxLength={300}
                        required
                        value={draft.title}
                        onChange={(e) => update("title", e.target.value)}
                      />
                    </Field>
                    {editor.mode !== "renew" && (
                      <Field
                        label={t("Issuing authority", "جاری کرنے والا ادارہ")}
                      >
                        <input
                          data-help="cr.authority"
                          maxLength={200}
                          value={draft.authority}
                          onChange={(e) => update("authority", e.target.value)}
                        />
                      </Field>
                    )}
                    <Field label={t("Reference number", "حوالہ نمبر")}>
                      <input
                        data-help="cr.reference"
                        maxLength={100}
                        value={draft.reference_no}
                        onChange={(e) => update("reference_no", e.target.value)}
                      />
                    </Field>
                    <div className="cr-form-grid">
                      <Field label={t("Issued on", "اجرا کی تاریخ")}>
                        <input
                          type="date"
                          data-help="cr.dates"
                          required={editor.mode === "renew"}
                          value={draft.issued_on}
                          onChange={(e) => update("issued_on", e.target.value)}
                        />
                      </Field>
                      <Field
                        label={t(
                          draft.kind === "Plan"
                            ? "Next plan review"
                            : "Valid until",
                          "میعاد / اگلا جائزہ",
                        )}
                      >
                        <input
                          type="date"
                          data-help="cr.dates"
                          required={
                            ["Licence", "Plan"].includes(draft.kind) ||
                            (editor.mode === "renew" &&
                              !!editor.original?.valid_until)
                          }
                          value={draft.valid_until}
                          onChange={(e) =>
                            update("valid_until", e.target.value)
                          }
                        />
                      </Field>
                    </div>
                    {editor.mode !== "renew" && (
                      <>
                        <Field
                          label={t(
                            "Renewal lead days (blank = server default)",
                            "تجدید سے پہلے دن (خالی = سرور کی ترتیب)",
                          )}
                        >
                          <input
                            type="number"
                            data-help="cr.lead"
                            min={0}
                            max={365}
                            step={1}
                            value={draft.renewal_lead_days}
                            onChange={(e) =>
                              update("renewal_lead_days", e.target.value)
                            }
                          />
                        </Field>
                        <Field label={t('Find official by name or badge','عہدیدار نام یا بیج سے تلاش کریں')}>
                          <input data-help="cr.official" maxLength={100} value={staffQuery} onChange={e=>setStaffQuery(e.target.value)}/>
                        </Field>
                        <button type="button" data-help="cr.official" onClick={()=>void findOfficials()}>{t('Find officials','عہدیدار تلاش کریں')}</button>
                        <Field
                          label={t(
                            "Responsible official (login required)",
                            "ذمہ دار عہدیدار (لاگ ان لازم)",
                          )}
                          hint={t(
                            "People without a login cannot be selected; this uses their user ID, not employee ID.",
                            "لاگ ان کے بغیر فرد منتخب نہیں ہو سکتا؛ صارف نمبر استعمال ہوتا ہے، ملازم نمبر نہیں۔",
                          )}
                        >
                          <select
                            data-help="cr.official"
                            value={draft.responsible_user_id}
                            onChange={(e) =>
                              update("responsible_user_id", e.target.value)
                            }
                          >
                            <option value="">
                              {t("Not assigned", "مقرر نہیں")}
                            </option>
                            {staff
                              .filter((s) => s.user_id !== null)
                              .map((s) => (
                                <option key={s.user_id} value={s.user_id!}>
                                  {s.full_name} · {s.designation}
                                </option>
                              ))}
                            {draft.responsible_user_id &&
                              !staff.some(
                                (s) =>
                                  String(s.user_id) ===
                                  draft.responsible_user_id,
                              ) && (
                                <option value={draft.responsible_user_id}>
                                  {editor.original?.responsible_name ||
                                    draft.responsible_user_id}
                                </option>
                              )}
                          </select>
                        </Field>
                        <Field label={t("Equipment covered", "متعلقہ آلہ")}>
                          <select
                            data-help="cr.asset"
                            value={draft.asset_id}
                            onChange={(e) => update("asset_id", e.target.value)}
                          >
                            <option value="">
                              {t("No equipment link", "آلے سے ربط نہیں")}
                            </option>
                            {equipment.map((a) => (
                              <option key={a.asset_id} value={a.asset_id}>
                                {a.asset_tag} · {a.name}
                              </option>
                            ))}
                            {draft.asset_id &&
                              !equipment.some(
                                (a) => String(a.asset_id) === draft.asset_id,
                              ) && (
                                <option value={draft.asset_id}>
                                  {editor.original?.asset_tag || draft.asset_id}{" "}
                                  · {editor.original?.asset_name}
                                </option>
                              )}
                          </select>
                        </Field>
                        <Field label={t("Department", "شعبہ")}>
                          <select
                            data-help="cr.department"
                            value={draft.department_id}
                            onChange={(e) =>
                              update("department_id", e.target.value)
                            }
                          >
                            <option value="">
                              {t("No department link", "شعبے سے ربط نہیں")}
                            </option>
                            {depts.map((d) => (
                              <option
                                key={d.department_id}
                                value={d.department_id}
                              >
                                {d.name}
                                {!d.is_active
                                  ? ` · ${t("inactive", "غیر فعال")}`
                                  : ""}
                              </option>
                            ))}
                            {draft.department_id &&
                              !depts.some(
                                (d) =>
                                  String(d.department_id) ===
                                  draft.department_id,
                              ) && (
                                <option value={draft.department_id}>
                                  {editor.original?.department_name ||
                                    draft.department_id}
                                </option>
                              )}
                          </select>
                        </Field>
                      </>
                    )}
                    {editor.mode === "edit" && (
                      <div className="cr-form-grid">
                        <Field
                          label={t(
                            "Renewal applied on",
                            "تجدید کی درخواست کی تاریخ",
                          )}
                        >
                          <input
                            type="date"
                            data-help="cr.application"
                            value={draft.renewal_applied_on}
                            onChange={(e) =>
                              update("renewal_applied_on", e.target.value)
                            }
                          />
                        </Field>
                        <Field
                          label={t(
                            "Renewal receipt reference",
                            "تجدید کی رسید کا حوالہ",
                          )}
                        >
                          <input
                            data-help="cr.application"
                            maxLength={200}
                            value={draft.renewal_reference}
                            onChange={(e) =>
                              update("renewal_reference", e.target.value)
                            }
                          />
                        </Field>
                      </div>
                    )}
                    <Field label={t("Note", "نوٹ")}>
                      <textarea
                        data-help="cr.note"
                        maxLength={2000}
                        value={draft.note}
                        onChange={(e) => update("note", e.target.value)}
                      />
                    </Field>
                  </>
                )}
                {editor.mode === "renew" && (
                  <p>
                    {t(
                      "This creates a new entry and closes the old one. Attach the new scan only after the replacement ID is confirmed.",
                      "اس سے نیا اندراج بنتا اور پرانا بند ہوتا ہے۔ متبادل نمبر کی تصدیق کے بعد ہی نیا اسکین منسلک کریں۔",
                    )}
                  </p>
                )}
                <div className="actions">
                  <button
                    type="button"
                    data-help="cr.cancel"
                    onClick={() => {
                      setEditor(undefined);
                      setValidation("");
                    }}
                  >
                    {t("Cancel draft", "مسودہ منسوخ")}
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    data-help="cr.submit"
                  >
                    {t("Save to register", "رجسٹر میں محفوظ کریں")}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
