import { useState } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { ErrorBox, LoadState, useLoad } from "../components";
import { QualityPaper } from "./QualityPaper";
import {
  summaryFacility,
  listEquipment,
  getEquipment,
  dispose,
  FacilitySummaryOut,
  EquipmentOut,
  EquipmentDetailOut,
  DisposeIn,
} from "../generated/equipment_write_off";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
};

const disposeMethods: Record<DisposeIn["method"], [string, string]> = {
  Scrapped: ["Scrapped", "اسکریپ"],
  Sold: ["Sold", "فروخت"],
  Donated: ["Donated", "عطیہ"],
  ReturnedToSupplier: ["Returned to supplier", "سپلائر کو واپسی"],
  Transferred: ["Transferred", "منتقلی"],
};

export function EquipmentWriteOff({ revision, user, onOpenHelp, connected }: Props) {
  const summary = useLoad(() => summaryFacility(), [revision]);
  const equipment = useLoad(() => listEquipment({ include_disposed: true }), [revision]);

  const [selectedAsset, setSelectedAsset] = useState<EquipmentOut | null>(null);
  const [assetDetail, setAssetDetail] = useState<EquipmentDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Write-off form state (rule:129f9cf3d6)
  const [disposingAsset, setDisposingAsset] = useState<EquipmentOut | null>(null);
  const [disposedOn, setDisposedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<DisposeIn["method"]>("Scrapped");
  const [reason, setReason] = useState("");
  const [savingDispose, setSavingDispose] = useState(false);
  const [disposeError, setDisposeError] = useState<unknown>();

  // Filter
  const [filterDept, setFilterDept] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  async function openDetail(item: EquipmentOut) {
    if (selectedAsset?.asset_id === item.asset_id) {
      setSelectedAsset(null);
      setAssetDetail(null);
      return;
    }
    setSelectedAsset(item);
    setLoadingDetail(true);
    try {
      const d = await getEquipment(item.asset_id);
      setAssetDetail(d);
    } catch {
      setAssetDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function startDispose(item: EquipmentOut) {
    setDisposingAsset(item);
    setDisposedOn(new Date().toISOString().slice(0, 10));
    setMethod("Scrapped");
    setReason("");
    setDisposeError(undefined);
  }

  async function submitDispose(e: React.FormEvent) {
    e.preventDefault();
    if (!disposingAsset || savingDispose || !reason.trim()) return;
    setSavingDispose(true);
    setDisposeError(undefined);
    try {
      await dispose(disposingAsset.asset_id, {
        disposed_on: disposedOn,
        method,
        reason: reason.trim(),
      });
      setDisposingAsset(null);
      await equipment.reload();
      await summary.reload();
      if (selectedAsset?.asset_id === disposingAsset.asset_id) {
        await openDetail(disposingAsset);
      }
    } catch (err) {
      setDisposeError(err);
    } finally {
      setSavingDispose(false);
    }
  }

  const sData: FacilitySummaryOut | undefined = summary.data;
  const items: EquipmentOut[] = equipment.data || [];

  const filteredItems = items.filter((item) => {
    if (showOnlyActive && item.status === "Disposed") return false;
    if (filterDept && !item.department_name?.toLowerCase().includes(filterDept.toLowerCase())) return false;
    return true;
  });

  return (
    <section data-screen="equipment_write_off" data-unsaved={!!disposingAsset}>
      <header className="toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{t("Facility: licences, equipment and drills", "سہولت: لائسنس، آلات اور مشقیں")}</h1>
        <button type="button" data-help="equipment_write_off.help" onClick={onOpenHelp}>
          {t("Help", "مدد")}
        </button>
      </header>

      <LoadState {...summary} retry={summary.reload} />

      {/* Summary Tiles (rule:a525a9b1a5) */}
      {sData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          {/* Compliance Card */}
          <article className="card">
            <h3>{t("Licences & Compliance", "لائسنس اور قانونی تعمیل")}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
              <div>
                <strong>{t("Expired", "ختم شدہ")}: </strong>
                <span className={sData.compliance.expired > 0 ? "badge badge-danger" : ""}>
                  {sData.compliance.expired}
                </span>
              </div>
              <div>
                <strong>{t("Due for renewal", "تجدید باقی")}: </strong>
                <span className={sData.compliance.due_for_renewal > 0 ? "badge badge-warning" : ""}>
                  {sData.compliance.due_for_renewal}
                </span>
              </div>
              <div>
                <strong>{t("Without scan", "بغیر اسکین")}: </strong>
                {sData.compliance.without_scan}
              </div>
              <div>
                <strong>{t("Without official", "بغیر عہدیدار")}: </strong>
                {sData.compliance.without_official}
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <QualityPaper
                disabled={!connected}
                documents={[{
                  label: t("Compliance Register (PDF)", "قانونی رجسٹر پی ڈی ایف"),
                  path: "/facility/compliance-documents/register/pdf",
                }]}
              />
            </div>
          </article>

          {/* Maintenance Card */}
          <article className="card">
            <h3>{t("Equipment Maintenance (MSDS FMS 125)", "آلات کی دیکھ بھال")}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
              <div>
                <strong>{t("On-time visits", "بروقت وزٹ")}: </strong>
                <span style={{ fontWeight: "bold" }}>
                  {sData.maintenance.on_time_pct !== null ? `${sData.maintenance.on_time_pct}%` : "—"}
                </span>
              </div>
              <div>
                <strong>{t("Overdue plans", "تاخیر شدہ منصوبے")}: </strong>
                <span className={sData.maintenance.overdue_plans > 0 ? "badge badge-danger" : ""}>
                  {sData.maintenance.overdue_plans}
                </span>
              </div>
              <div>
                <strong>{t("Breakdowns", "خرابیاں")}: </strong>
                {sData.maintenance.breakdowns}
              </div>
              <div>
                <strong>{t("Calibrations", "کیلیبریشن")}: </strong>
                {sData.maintenance.calibrations}
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <QualityPaper
                disabled={!connected}
                documents={[{
                  label: t("Equipment Plan (PDF)", "آلات کا منصوبہ پی ڈی ایف"),
                  path: "/facility/equipment/plan/pdf",
                }]}
              />
            </div>
          </article>

          {/* Drills Coverage Card */}
          <article className="card">
            <h3>{t("Mock Drills Coverage", "فرضی مشقوں کی کوریج")}</h3>
            <p><strong>{t("Total drills held", "کل مشقیں")}:</strong> {sData.drills.drills}</p>
            {sData.drills.departments_not_drilled.length > 0 ? (
              <div>
                <strong style={{ color: "var(--color-danger, #d9534f)" }}>
                  {t("Departments not drilled", "جن شعبوں کی مشق نہیں ہوئی")}:
                </strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                  {sData.drills.departments_not_drilled.map((d) => (
                    <span key={d} className="badge badge-danger" style={{ padding: "2px 8px" }}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-success" style={{ color: "green" }}>
                {t("All departments drilled.", "تمام شعبوں کی مشق مکمل ہے۔")}
              </p>
            )}
          </article>
        </div>
      )}

      {/* Equipment Inventory & Write-off (rule:129f9cf3d6) */}
      <article className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
          <h2>{t("Equipment inventory & write-off", "آلات کی فہرست اور رائٹ آف")}</h2>
          <div className="toolbar" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="search"
              data-help="equipment_write_off.filter"
              placeholder={t("Filter by department...", "شعبہ کے لحاظ سے تلاش کریں...")}
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            />
            <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="checkbox"
                data-help="equipment_write_off.filter"
                checked={showOnlyActive}
                onChange={(e) => setShowOnlyActive(e.target.checked)}
              />
              {t("Exclude disposed", "ختم شدہ خارج کریں")}
            </label>
          </div>
        </div>

        <LoadState {...equipment} retry={equipment.reload} />

        {/* Write-Off Form Modal (rule:129f9cf3d6) */}
        {disposingAsset && (
          <form className="card" onSubmit={submitDispose} style={{ marginBottom: "16px", borderColor: "var(--color-danger, #d9534f)" }}>
            <h3>
              {t("Approve Equipment Write-Off", "آلات رائٹ آف کی منظوری")} · {disposingAsset.asset_tag} ({disposingAsset.name})
            </h3>
            <p>
              {t(
                "Recording write-off marks this asset permanently as Disposed in the facility register with the specified disposal method and documented justification.",
                "رائٹ آف درج کرنے سے یہ آلہ ہسپتال کے رجسٹر میں مستقل طور پر ختم شدہ نشان زد ہو جائے گا۔"
              )}
            </p>

            <ErrorBox error={disposeError} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div className="form-group">
                <label htmlFor="dispose-date">
                  <strong>{t("Disposal date", "تاریخ تنسیخ")}</strong>
                </label>
                <input
                  id="dispose-date"
                  type="date"
                  data-help="equipment_write_off.dispose"
                  value={disposedOn}
                  onChange={(e) => setDisposedOn(e.target.value)}
                  required
                  disabled={savingDispose || !connected}
                />
              </div>

              <div className="form-group">
                <label htmlFor="dispose-method">
                  <strong>{t("Disposal method", "طریقہ تنسیخ")}</strong>
                </label>
                <select
                  id="dispose-method"
                  data-help="equipment_write_off.dispose"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as DisposeIn["method"])}
                  disabled={savingDispose || !connected}
                >
                  {(Object.keys(disposeMethods) as DisposeIn["method"][]).map((m) => (
                    <option key={m} value={m}>
                      {t(disposeMethods[m][0], disposeMethods[m][1])}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label htmlFor="dispose-reason">
                <strong>{t("Write-off reason & justification", "رائٹ آف کی وجہ اور جواز")}</strong>
              </label>
              <textarea
                id="dispose-reason"
                rows={3}
                data-help="equipment_write_off.dispose"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("Provide formal justification for disposal...", "تنسیخ کا باضابطہ جواز درج کریں...")}
                required
                disabled={savingDispose || !connected}
              />
            </div>

            <div className="toolbar" style={{ display: "flex", gap: "8px" }}>
              <button
                type="submit"
                className="button-danger"
                data-help="equipment_write_off.dispose"
                disabled={savingDispose || !connected || !reason.trim()}
              >
                {savingDispose ? t("Approving...", "منظوری جاری...") : t("Approve write-off", "رائٹ آف منظور کریں")}
              </button>
              <button
                type="button"
                data-help="equipment_write_off.dispose"
                onClick={() => setDisposingAsset(null)}
                disabled={savingDispose}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </form>
        )}

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>{t("Asset tag", "اثاثہ ٹیگ")}</th>
                <th>{t("Name", "نام")}</th>
                <th>{t("Category", "زمرہ")}</th>
                <th>{t("Department", "شعبہ")}</th>
                <th>{t("Status", "حالت")}</th>
                <th>{t("Actions", "اقدامات")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.asset_id} className={selectedAsset?.asset_id === item.asset_id ? "selected" : ""}>
                  <td><strong>{item.asset_tag}</strong></td>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.department_name || item.location || "—"}</td>
                  <td>
                    <span className={`badge badge-${item.status === "Active" ? "success" : item.status === "Disposed" ? "secondary" : "warning"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      data-help="equipment_write_off.view"
                      onClick={() => openDetail(item)}
                    >
                      {selectedAsset?.asset_id === item.asset_id ? t("Hide", "چھپائیں") : t("Details", "تفصیل")}
                    </button>
                    {item.status !== "Disposed" && (
                      <button
                        type="button"
                        className="button-warning"
                        data-help="equipment_write_off.dispose"
                        onClick={() => startDispose(item)}
                      >
                        {t("Write-off", "رائٹ آف")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Selected Equipment Detail View */}
        {selectedAsset && (
          <div className="card" style={{ marginTop: "16px", background: "var(--color-bg-secondary, #fafafa)", padding: "12px" }}>
            <h3>{selectedAsset.asset_tag} · {selectedAsset.name}</h3>
            {loadingDetail && <p>{t("Loading equipment details...", "آلے کی تفصیلات لوڈ ہو رہی ہیں...")}</p>}
            {assetDetail && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "12px" }}>
                  <div><strong>{t("Manufacturer", "سازندہ")}:</strong> {assetDetail.manufacturer || "—"}</div>
                  <div><strong>{t("Model", "ماڈل")}:</strong> {assetDetail.model || "—"}</div>
                  <div><strong>{t("Serial number", "سیریل نمبر")}:</strong> {assetDetail.serial_no || "—"}</div>
                  <div><strong>{t("Supplier", "فراہم کنندہ")}:</strong> {assetDetail.supplier_name || "—"}</div>
                  <div><strong>{t("Commissioned on", "کمیشننگ کی تاریخ")}:</strong> {assetDetail.commissioned_on || "—"}</div>
                  <div><strong>{t("Warranty until", "وارنٹی تا")}:</strong> {assetDetail.warranty_until || "—"}</div>
                </div>

                {assetDetail.disposed_on && (
                  <div style={{ padding: "8px", background: "#f8d7da", borderRadius: "4px", marginBottom: "12px" }}>
                    <p><strong>{t("Disposed on", "تنسیخ کی تاریخ")}:</strong> {assetDetail.disposed_on} ({assetDetail.disposal_method})</p>
                    <p><strong>{t("Disposal reason", "وجہ تنسیخ")}:</strong> {assetDetail.disposal_reason}</p>
                  </div>
                )}

                {/* Maintenance Visits */}
                <h4>{t("Recent maintenance visits", "حالیہ وزٹ")}</h4>
                {assetDetail.records.length === 0 ? (
                  <p>{t("No maintenance visits recorded.", "کوئی وزٹ ریکارڈ نہیں ہے۔")}</p>
                ) : (
                  <div className="table-responsive">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("Date", "تاریخ")}</th>
                          <th>{t("Kind", "قسم")}</th>
                          <th>{t("Vendor / Person", "ٹھیکیدار / ملازم")}</th>
                          <th>{t("Findings", "نتائج")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetDetail.records.map((v) => (
                          <tr key={v.record_id}>
                            <td>{v.performed_on}</td>
                            <td>{v.kind}</td>
                            <td>{v.vendor_name || v.employee_name || v.technician || "—"}</td>
                            <td>{v.findings}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
