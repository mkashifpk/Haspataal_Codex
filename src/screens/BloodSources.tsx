import { useEffect, useState } from "react";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  BloodSourceOut,
  BloodSourceIn,
  BloodSourcePatch,
} from "../generated/blood_sources";
import {
  listSources,
  listDocumentsFacilityCompliance,
} from "../generated/blood_sources";
import {
  bloodSourcesAccess,
  BLOOD_SOURCE_KINDS,
  validateBloodSourceIn,
  checkTransfusionReadiness,
  type BloodSourceKind,
} from "../blood-sources-policy";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";

export function BloodSources({
  user,
  establishment,
  connected,
  stream,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
}) {
  const view = establishment.views.screens.find(
    (s) => s.screen_id === "blood_sources",
  )?.view;
  const access = bloodSourcesAccess(view, user.permissions);
  const live = connected && stream === "Live";

  const [revision, setRevision] = useState(0);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<unknown>();

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<BloodSourceOut | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formKind, setFormKind] = useState<BloodSourceKind>("BloodCenter");
  const [formLicence, setFormLicence] = useState("");
  const [formDocId, setFormDocId] = useState<string>("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setFormName("");
    setFormKind("BloodCenter");
    setFormLicence("");
    setFormDocId("");
    setFormAddress("");
    setFormPhone("");
    setFormIsActive(true);
    setValidationErrors({});
    setError(undefined);
  };

  const write = useClinicalWrite(user, "blood_sources", () => {
    setIsAddOpen(false);
    setEditingSource(null);
    resetForm();
    setRevision((r) => r + 1);
  });

  // Load blood sources
  const sourcesState = useLoad(
    () =>
      access.read
        ? listSources({ include_inactive: includeInactive })
        : Promise.resolve([]),
    [revision, includeInactive, access.read],
  );

  // Load compliance documents for MOU linking
  const docsState = useLoad(
    () =>
      access.read
        ? listDocumentsFacilityCompliance({ include_closed: false })
        : Promise.resolve([]),
    [revision, access.read],
  );

  // Real-time establishment.changed updates
  useEffect(() => {
    const handleEvent = (event: Event) => {
      const custom = event as CustomEvent;
      const data = custom.detail;
      if (
        data &&
        (data.event_type === "establishment.changed" ||
          data.type === "establishment.changed")
      ) {
        setRevision((r) => r + 1);
      }
    };
    window.addEventListener("haspataal:event", handleEvent);
    return () => window.removeEventListener("haspataal:event", handleEvent);
  }, []);

  const sources = sourcesState.data || [];
  const complianceDocs = docsState.data || [];
  const readiness = checkTransfusionReadiness(sources);
  const hasOwnBloodCenter = sources.some((s) => s.kind === "OwnBloodCenter");

  // Filter sources by search term
  const filteredSources = sources.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.licence_number.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  });

  const openAddModal = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const openEditModal = (source: BloodSourceOut) => {
    setEditingSource(source);
    setFormName(source.name);
    setFormKind(source.kind);
    setFormLicence(source.licence_number);
    setFormDocId(source.agreement_document_id ? String(source.agreement_document_id) : "");
    setFormAddress(source.address || "");
    setFormPhone(source.phone || "");
    setFormIsActive(source.is_active);
    setValidationErrors({});
    setError(undefined);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!access.write || !live || write.busy) return;

    const validation = validateBloodSourceIn({
      name: formName,
      kind: formKind,
      licence_number: formLicence,
      hasOwnCenterAlready: hasOwnBloodCenter && formKind === "OwnBloodCenter",
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    const payload: BloodSourceIn = {
      name: formName.trim(),
      kind: formKind,
      licence_number: formLicence.trim(),
      agreement_document_id: formDocId ? Number(formDocId) : null,
      address: formAddress.trim() || null,
      phone: formPhone.trim() || null,
    };

    write.start({
      method: "POST",
      path: "/blood/sources",
      body: payload,
      permission: "blood.bank.manage",
      protection: "idempotent",
      reconcilePath: "/blood/sources",
      label: t("Add blood source", "بلڈ سنٹر شامل کریں"),
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSource || !access.retire || !live || write.busy) return;

    const validation = validateBloodSourceIn({
      name: formName,
      kind: formKind,
      licence_number: formLicence,
      hasOwnCenterAlready:
        hasOwnBloodCenter &&
        formKind === "OwnBloodCenter" &&
        editingSource.kind !== "OwnBloodCenter",
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    const patch: BloodSourcePatch = {
      name: formName.trim(),
      licence_number: formLicence.trim(),
      agreement_document_id: formDocId ? Number(formDocId) : null,
      address: formAddress.trim() || null,
      phone: formPhone.trim() || null,
      is_active: formIsActive,
      expected_version: editingSource.row_version,
    };

    write.start({
      method: "PATCH",
      path: `/blood/sources/${editingSource.source_id}`,
      body: patch,
      permission: "blood.bank.manage",
      protection: "reconcile",
      reconcilePath: "/blood/sources",
      label: t("Update blood source", "بلڈ سنٹر میں ترمیم"),
    });
  };

  const handleToggleActive = (source: BloodSourceOut) => {
    if (!access.retire || !live || write.busy) return;

    const patch: BloodSourcePatch = {
      is_active: !source.is_active,
      expected_version: source.row_version,
    };

    const actionLabel = source.is_active
      ? t("Stop receiving blood", "خون کی وصولی بند کریں")
      : t("Resume receiving blood", "خون کی وصولی بحال کریں");

    write.start({
      method: "PATCH",
      path: `/blood/sources/${source.source_id}`,
      body: patch,
      permission: "blood.bank.manage",
      protection: "reconcile",
      reconcilePath: "/blood/sources",
      label: actionLabel,
    });
  };

  return (
    <div className="container" data-help="blood_sources.screen">
      <div className="bed-board-heading">
        <div>
          <h1>{t("Licensed blood sources", "مجاز بلڈ سنٹرز و ذرائع")}</h1>
          <p>
            {t(
              "The blood centers and hospital blood banks the hospital receives blood from, with their PBTA licence and the MOU or contract kept in the compliance register.",
              "وہ بلڈ سنٹرز اور ہسپتال بلڈ بینکس جن سے خون حاصل کیا جاتا ہے، پی بی ٹی اے لائسنس اور کمپلائنس رجسٹر کے معاہدوں سمیت۔",
            )}
          </p>
        </div>
        <button
          data-help="blood_sources.refresh"
          onClick={() => setRevision((r) => r + 1)}
          disabled={sourcesState.loading}
        >
          {t("Refresh sources", "بلڈ سنٹرز تازہ کریں")}
        </button>
      </div>

      <ErrorBox error={error} />
      <ClinicalWriteFeedback write={write} onReviewed={() => setRevision((r) => r + 1)} />

      {!live && (
        <p className="notice">
          {t(
            "Connection is not live. Updates are paused.",
            "رابطہ تازہ نہیں ہے۔ اندراج وقتی طور پر معطل ہے۔",
          )}
        </p>
      )}

      {access.isRetiring && (
        <p className="notice">
          {t(
            "No new blood sources from now on. Active sources continue supplying blood.",
            "اب نئے بلڈ سنٹرز نہیں؛ فعال ذرائع سے فراہمی جاری رہے گی۔",
          )}
        </p>
      )}

      {access.isRecords && (
        <p className="notice">
          {t(
            "Records only: view blood source registrations and compliance contracts.",
            "صرف ریکارڈ: بلڈ سنٹرز اور معاہدات کی تفصیلات۔",
          )}
        </p>
      )}

      {access.isSetup && (
        <p className="notice">
          {t(
            "Facility setup mode: configure licensed blood sources before activating blood transfusion service.",
            "ہسپتال سیٹ اپ: انتقال خون کی سروس فعال کرنے سے قبل مجاز بلڈ سنٹرز شامل کریں۔",
          )}
        </p>
      )}

      {!readiness.hasActiveSource && !sourcesState.loading && (
        <div className="alert alert-warning" role="status">
          <strong>{t("Transfusion service readiness notice", "انتقال خون سروس کی تیاری کا نوٹس")}:</strong>{" "}
          {t(
            "The blood transfusion service requires at least one active licensed blood source before it can be switched on in Facility Settings (rule:e20cbf9517).",
            "ہسپتال ترتیبات میں انتقال خون سروس فعال کرنے سے قبل کم از کم ایک فعال مجاز بلڈ سنٹر کا اندراج لازمی ہے (اصول e20cbf9517)۔",
          )}
        </div>
      )}

      <div className="card toolbar">
        <label>
          <input
            data-help="blood_sources.filter"
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          {t("Include inactive / stopped receiving", "غیر فعال و منقطع شدہ سنٹرز شامل کریں")}
        </label>

        <Field label={t("Filter by name or licence", "نام یا لائسنس نمبر سے تلاش")}>
          <input
            data-help="blood_sources.filter"
            type="text"
            placeholder={t("Type to search...", "تلاش کے لیے لکھیں...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>

        {access.write && (
          <button
            data-help="blood_sources.create_open"
            onClick={openAddModal}
            disabled={!live}
          >
            {t("Add blood source", "نیا بلڈ سنٹر شامل کریں")}
          </button>
        )}
      </div>

      <LoadState {...sourcesState} retry={sourcesState.reload} />

      {!sourcesState.loading && filteredSources.length === 0 && (
        <Empty>
          {t(
            "No licensed blood sources found. Click 'Add blood source' to register a Regional Blood Center or partner hospital blood bank.",
            "کوئی مجاز بلڈ سنٹر نہیں ملا۔ نیا بلڈ سنٹر یا شراکت دار ہسپتال شامل کرنے کے لیے 'نیا بلڈ سنٹر شامل کریں' پر کلک کریں۔",
          )}
        </Empty>
      )}

      <div className="grid">
        {filteredSources.map((source) => (
          <div key={source.source_id} className={`card ${source.is_active ? "" : "inactive-card"}`}>
            <div className="flex-between">
              <h3>{source.name}</h3>
              <span className={`badge ${source.is_active ? "badge-success" : "badge-neutral"}`}>
                {source.is_active
                  ? t("Active / Receiving", "فعال / موصولہ")
                  : t("Stopped receiving", "وصولی منقطع")}
              </span>
            </div>

            <p>
              <strong>{t("Source Category", "قسم")}:</strong>{" "}
              {BLOOD_SOURCE_KINDS.find((k) => k.kind === source.kind)?.en || source.kind}
            </p>

            <p>
              <strong>{t("PBTA Licence", "پی بی ٹی اے لائسنس")}:</strong>{" "}
              <code>{source.licence_number}</code>
            </p>

            <p>
              <strong>{t("Compliance Contract / MOU", "معاہدہ / ایم او یو")}:</strong>{" "}
              {source.agreement_title ? (
                <span>
                  {source.agreement_title}
                  {source.agreement_valid_until && (
                    <small> ({t("Valid until", "تک مجاز")}: {source.agreement_valid_until})</small>
                  )}
                </span>
              ) : (
                <span className="text-muted">
                  {t(
                    "No MOU linked (Category II B/C requires contract with RBC/hospital)",
                    "کوئی معاہدہ منسلک نہیں (کیٹیگری II بی/سی کے لیے معاہدہ لازمی ہے)",
                  )}
                </span>
              )}
            </p>

            {source.address && (
              <p>
                <strong>{t("Address", "پتہ")}:</strong> {source.address}
              </p>
            )}

            {source.phone && (
              <p>
                <strong>{t("Phone", "فون")}:</strong> {source.phone}
              </p>
            )}

            {!source.is_active && (
              <p className="notice">
                {t(
                  "Receiving stopped: units currently in stock remain usable (rule:68fb1eda66).",
                  "خون وصولی منقطع: موجودہ اسٹاک میں موجود یونٹس بدستور قابل استعمال ہیں (اصول 68fb1eda66)۔",
                )}
              </p>
            )}

            {access.retire && (
              <div className="card-actions">
                <button
                  data-help="blood_sources.edit_open"
                  onClick={() => openEditModal(source)}
                  disabled={!live}
                >
                  {t("Edit", "ترمیم")}
                </button>
                <button
                  data-help="blood_sources.toggle_active"
                  onClick={() => handleToggleActive(source)}
                  disabled={!live}
                >
                  {source.is_active
                    ? t("Stop receiving", "وصولی بند کریں")
                    : t("Resume receiving", "وصولی بحال کریں")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Blood Source Modal */}
      {isAddOpen && (
        <Modal
          title={t("Add licensed blood source", "نیا مجاز بلڈ سنٹر شامل کریں")}
          onClose={() => setIsAddOpen(false)}
        >
          <form onSubmit={handleAddSubmit}>
            <Field
              label={t("Blood center / Hospital name", "بلڈ سنٹر یا ہسپتال کا نام")}
              hint={validationErrors.name}
            >
              <input
                data-help="blood_sources.name"
                type="text"
                maxLength={200}
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </Field>

            <Field
              label={t("Source category", "سنٹر کی قسم")}
              hint={validationErrors.kind}
            >
              <select
                data-help="blood_sources.kind"
                value={formKind}
                onChange={(e) => setFormKind(e.target.value as BloodSourceKind)}
              >
                {BLOOD_SOURCE_KINDS.map((k) => (
                  <option
                    key={k.kind}
                    value={k.kind}
                    disabled={k.kind === "OwnBloodCenter" && hasOwnBloodCenter}
                  >
                    {k.en} - {k.ur}
                    {k.kind === "OwnBloodCenter" && hasOwnBloodCenter ? " (Already configured)" : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={t("PBTA licence number", "پی بی ٹی اے لائسنس نمبر")}
              hint={validationErrors.licence_number}
            >
              <input
                data-help="blood_sources.licence"
                type="text"
                maxLength={100}
                required
                placeholder="e.g. PBTA-BC-2026-0042"
                value={formLicence}
                onChange={(e) => setFormLicence(e.target.value)}
              />
            </Field>

            <Field
              label={t("Link MOU / Contract from Compliance Register", "کمپلائنس رجسٹر سے معاہدہ / ایم او یو کا ربط")}
            >
              <select
                data-help="blood_sources.agreement"
                value={formDocId}
                onChange={(e) => setFormDocId(e.target.value)}
              >
                <option value="">{t("-- None / Select MOU document --", "-- کوئی نہیں / معاہدہ منتخب کریں --")}</option>
                {complianceDocs.map((doc) => (
                  <option key={doc.document_id} value={doc.document_id}>
                    {doc.kind}: {doc.category} ({t("ID", "آئی ڈی")}: {doc.document_id})
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("Physical address (optional)", "پتہ (اختیاری)")}>
              <input
                data-help="blood_sources.address"
                type="text"
                maxLength={300}
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />
            </Field>

            <Field label={t("Telephone / Contact (optional)", "فون نمبر (اختیاری)")}>
              <input
                data-help="blood_sources.phone"
                type="text"
                maxLength={50}
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </Field>

            <div className="modal-actions">
              <button
                type="submit"
                data-help="blood_sources.submit"
                disabled={write.busy || !live}
              >
                {t("Add blood source", "بلڈ سنٹر شامل کریں")}
              </button>
              <button
                type="button"
                data-help="blood_sources.cancel"
                onClick={() => setIsAddOpen(false)}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Blood Source Modal */}
      {editingSource && (
        <Modal
          title={t("Edit blood source", "بلڈ سنٹر میں ترمیم")}
          onClose={() => setEditingSource(null)}
        >
          <form onSubmit={handleEditSubmit}>
            <Field
              label={t("Blood center / Hospital name", "بلڈ سنٹر یا ہسپتال کا نام")}
              hint={validationErrors.name}
            >
              <input
                data-help="blood_sources.name"
                type="text"
                maxLength={200}
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </Field>

            <Field
              label={t("PBTA licence number", "پی بی ٹی اے لائسنس نمبر")}
              hint={validationErrors.licence_number}
            >
              <input
                data-help="blood_sources.licence"
                type="text"
                maxLength={100}
                required
                value={formLicence}
                onChange={(e) => setFormLicence(e.target.value)}
              />
            </Field>

            <Field
              label={t("Link MOU / Contract from Compliance Register", "کمپلائنس رجسٹر سے معاہدہ / ایم او یو کا ربط")}
            >
              <select
                data-help="blood_sources.agreement"
                value={formDocId}
                onChange={(e) => setFormDocId(e.target.value)}
              >
                <option value="">{t("-- None / Select MOU document --", "-- کوئی نہیں / معاہدہ منتخب کریں --")}</option>
                {complianceDocs.map((doc) => (
                  <option key={doc.document_id} value={doc.document_id}>
                    {doc.kind}: {doc.category} ({t("ID", "آئی ڈی")}: {doc.document_id})
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("Physical address (optional)", "پتہ (اختیاری)")}>
              <input
                data-help="blood_sources.address"
                type="text"
                maxLength={300}
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />
            </Field>

            <Field label={t("Telephone / Contact (optional)", "فون نمبر (اختیاری)")}>
              <input
                data-help="blood_sources.phone"
                type="text"
                maxLength={50}
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </Field>

            <label>
              <input
                data-help="blood_sources.toggle_active"
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
              />
              {t("Active / Receiving blood from this source", "فعال / اس سنٹر سے خون کی وصولی جاری ہے")}
            </label>

            <div className="modal-actions">
              <button
                type="submit"
                data-help="blood_sources.save"
                disabled={write.busy || !live}
              >
                {t("Save changes", "تبدیلیاں محفوظ کریں")}
              </button>
              <button
                type="button"
                data-help="blood_sources.cancel"
                onClick={() => setEditingSource(null)}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
