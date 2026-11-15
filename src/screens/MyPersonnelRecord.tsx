import { useState } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { ErrorBox, LoadState, useLoad } from "../components";
import { QualityPaper } from "./QualityPaper";
import {
  mePersonnel,
  getAppraisal,
  acknowledgeAppraisal,
  MyPersonnelRecordOut,
  AppraisalOut,
  EmployeeJobDescriptionOut,
  AppraisalDetailOut,
} from "../generated/my_personnel_record";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
};

const overallRatingLabels: Record<string, [string, string]> = {
  Outstanding: ["Outstanding", "شاندار"],
  Good: ["Good", "اچھا"],
  Satisfactory: ["Satisfactory", "اطمینان بخش"],
  NeedsImprovement: ["Needs Improvement", "بہتری درکار"],
  Unsatisfactory: ["Unsatisfactory", "غیر اطمینان بخش"],
};

export function MyPersonnelRecord({ revision, user, onOpenHelp, connected }: Props) {
  const record = useLoad(() => mePersonnel(), [revision]);
  const [selectedJd, setSelectedJd] = useState<EmployeeJobDescriptionOut | null>(null);
  const [selectedAppraisal, setSelectedAppraisal] = useState<AppraisalOut | null>(null);
  const [appraisalDetail, setAppraisalDetail] = useState<AppraisalDetailOut | null>(null);
  const [loadingAppraisal, setLoadingAppraisal] = useState(false);

  // Acknowledging state (rule:e31714fa44)
  const [ackAppraisal, setAckAppraisal] = useState<AppraisalOut | null>(null);
  const [ackDate, setAckDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ackComments, setAckComments] = useState("");
  const [savingAck, setSavingAck] = useState(false);
  const [ackError, setAckError] = useState<unknown>();

  async function openAppraisal(a: AppraisalOut) {
    setSelectedAppraisal(a);
    setLoadingAppraisal(true);
    try {
      const detail = await getAppraisal(a.appraisal_id);
      setAppraisalDetail(detail);
    } catch {
      setAppraisalDetail(null);
    } finally {
      setLoadingAppraisal(false);
    }
  }

  function startAcknowledge(a: AppraisalOut) {
    setAckAppraisal(a);
    setAckDate(new Date().toISOString().slice(0, 10));
    setAckComments(a.employee_comments || "");
    setAckError(undefined);
    openAppraisal(a);
  }

  async function submitAcknowledge(e: React.FormEvent) {
    e.preventDefault();
    if (!ackAppraisal || savingAck) return;
    setSavingAck(true);
    setAckError(undefined);
    try {
      await acknowledgeAppraisal(ackAppraisal.appraisal_id, {
        acknowledged_on: ackDate,
        employee_comments: ackComments.trim() || null,
      });
      setAckAppraisal(null);
      await record.reload();
      if (selectedAppraisal?.appraisal_id === ackAppraisal.appraisal_id) {
        await openAppraisal(ackAppraisal);
      }
    } catch (err) {
      setAckError(err);
    } finally {
      setSavingAck(false);
    }
  }

  const data: MyPersonnelRecordOut | undefined = record.data;

  return (
    <section data-screen="my_personnel_record" data-unsaved={!!ackAppraisal}>
      <header className="toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{t("My personnel record", "میری ذاتی فائل")}</h1>
        <button type="button" data-help="my_personnel.help" onClick={onOpenHelp}>
          {t("Help", "مدد")}
        </button>
      </header>

      <LoadState {...record} retry={record.reload} />

      {data && (
        <>
          <article className="card" style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2>{data.full_name} ({data.emp_number})</h2>
                <p><strong>{t("Designation", "عہدہ")}:</strong> {data.designation}</p>
              </div>
              <div>
                <QualityPaper
                  disabled={!connected}
                  documents={[{
                    label: t("Appraisal Policy (PDF)", "کارکردگی جائزہ پالیسی پی ڈی ایف"),
                    path: "/personnel/appraisal-policy/pdf",
                  }]}
                />
              </div>
            </div>
          </article>

          {/* Orientation Section */}
          <article className="card" style={{ marginBottom: "16px" }}>
            <h2>{t("Orientation status (MSDS HRM 131)", "تعارفی تربیت کی کیفیت")}</h2>
            {data.orientation.length === 0 ? (
              <p>{t("No orientation record found.", "تعارفی تربیت کا کوئی ریکارڈ نہیں ملا۔")}</p>
            ) : (
              data.orientation.map((o) => (
                <div key={o.employee_id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                  <div>
                    <strong>{t("Status", "کیفیت")}: </strong>
                    {o.complete ? (
                      <span className="badge badge-success">{t("Complete", "مکمل")}</span>
                    ) : (
                      <span className="badge badge-warning">{t("In progress", "جاری")}</span>
                    )}
                    {o.overdue && (
                      <span className="badge badge-danger" style={{ marginInlineStart: "8px", color: "red" }}>
                        {t("Overdue", "تاخیر شدہ")}
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>{t("Progress", "پیش رفت")}: </strong>
                    {o.done} / {o.topics} {t("topics", "موضوعات")}
                  </div>
                  <div>
                    <strong>{t("Patients' rights (HRM 133)", "مریضوں کے حقوق")}: </strong>
                    {o.patient_rights ? (
                      <span className="badge badge-success">{t("Informed", "آگاہ کیا گیا")}</span>
                    ) : (
                      <span className="badge badge-warning">{t("Pending", "باقی")}</span>
                    )}
                  </div>
                  <div>
                    <strong>{t("Joined on", "شمولیت")}: </strong>{o.joined_on || "—"}
                  </div>
                  <div>
                    <strong>{t("Due on", "آخری تاریخ")}: </strong>{o.due_on || "—"}
                  </div>
                  {o.missing.length > 0 && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <strong>{t("Missing topics", "باقی موضوعات")}: </strong>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                        {o.missing.map((topic) => (
                          <span key={topic} className="badge badge-secondary" style={{ padding: "2px 8px", background: "#f0f0f0", borderRadius: "4px" }}>
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </article>

          {/* Job Descriptions Section */}
          <article className="card" style={{ marginBottom: "16px" }}>
            <h2>{t("Job descriptions (MSDS HRM 132)", "ملازمت کی تفصیلات")}</h2>
            {data.job_descriptions.length === 0 ? (
              <p>{t("No job description issued.", "کوئی ملازمت کی تفصیل جاری نہیں کی گئی۔")}</p>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Title", "عنوان")}</th>
                      <th>{t("Issued on", "تاریخ اجرا")}</th>
                      <th>{t("Issued by", "جاری کنندہ")}</th>
                      <th>{t("In-charge", "انچارج")}</th>
                      <th>{t("Status", "کیفیت")}</th>
                      <th>{t("Actions", "اقدامات")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.job_descriptions.map((jd) => (
                      <tr key={jd.assignment_id} className={selectedJd?.assignment_id === jd.assignment_id ? "selected" : ""}>
                        <td><strong>{jd.content.title}</strong></td>
                        <td>{jd.issued_on}</td>
                        <td>{jd.issued_by_name}</td>
                        <td>{jd.incharge_name || "—"}</td>
                        <td>
                          <span className={`badge badge-${jd.status === "Signed" ? "success" : jd.status === "Issued" ? "warning" : "secondary"}`}>
                            {jd.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            data-help="my_personnel.record"
                            onClick={() => setSelectedJd(selectedJd?.assignment_id === jd.assignment_id ? null : jd)}
                          >
                            {selectedJd?.assignment_id === jd.assignment_id ? t("Hide", "چھپائیں") : t("View", "دیکھیں")}
                          </button>
                          <QualityPaper
                            disabled={!connected}
                            documents={[{
                              label: t("Job Description PDF", "ملازمت تفصیل پی ڈی ایف"),
                              path: `/personnel/employee-job-descriptions/${jd.assignment_id}/pdf`,
                            }]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedJd && (
              <div className="card" style={{ marginTop: "12px", background: "var(--color-bg-secondary, #fafafa)", padding: "12px" }}>
                <h3>{selectedJd.content.title}</h3>
                {selectedJd.content.department_name && <p><strong>{t("Department", "شعبہ")}:</strong> {selectedJd.content.department_name}</p>}
                <p><strong>{t("Purpose", "مقصد")}:</strong> {selectedJd.content.purpose}</p>
                <p><strong>{t("Responsibilities", "ذمہ داریاں")}:</strong> {selectedJd.content.responsibilities}</p>
                {selectedJd.content.reports_to && <p><strong>{t("Reports to", "رپورٹ برائے")}:</strong> {selectedJd.content.reports_to}</p>}
                {selectedJd.content.qualifications && <p><strong>{t("Qualifications", "قابلیت")}:</strong> {selectedJd.content.qualifications}</p>}
                <p><strong>{t("Appraisal criteria", "کارکردگی معیار")}:</strong> {selectedJd.content.appraisal_criteria}</p>
                <p><strong>{t("Staff rights (HRM 132 ii)", "عملے کے حقوق")}:</strong> {selectedJd.content.staff_rights}</p>
              </div>
            )}
          </article>

          {/* Appraisals Section */}
          <article className="card" style={{ marginBottom: "16px" }}>
            <h2>{t("Performance appraisals (MSDS HRM 135)", "کارکردگی کے جائزے")}</h2>
            {data.appraisals.length === 0 ? (
              <p>{t("No appraisal records found.", "کارکردگی جائزے کا کوئی ریکارڈ نہیں ملا۔")}</p>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Appraisal #", "جائزہ نمبر")}</th>
                      <th>{t("Period", "مدت")}</th>
                      <th>{t("Kind", "قسم")}</th>
                      <th>{t("Appraiser", "جائزہ کنندہ")}</th>
                      <th>{t("Overall rating", "مجموعی درجہ")}</th>
                      <th>{t("Status", "کیفیت")}</th>
                      <th>{t("Actions", "اقدامات")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.appraisals.map((a) => (
                      <tr key={a.appraisal_id} className={selectedAppraisal?.appraisal_id === a.appraisal_id ? "selected" : ""}>
                        <td><strong>{a.appraisal_number}</strong></td>
                        <td>{a.period_from} – {a.period_to}</td>
                        <td>{a.kind}</td>
                        <td>{a.appraiser_name}</td>
                        <td>
                          {a.overall_rating ? (
                            <span>{overallRatingLabels[a.overall_rating] ? t(overallRatingLabels[a.overall_rating][0], overallRatingLabels[a.overall_rating][1]) : a.overall_rating}</span>
                          ) : "—"}
                        </td>
                        <td>
                          <span className={`badge badge-${a.status === "Acknowledged" ? "success" : a.status === "Signed" ? "warning" : "secondary"}`}>
                            {a.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            data-help="my_personnel.record"
                            onClick={() => openAppraisal(a)}
                          >
                            {selectedAppraisal?.appraisal_id === a.appraisal_id ? t("Hide", "چھپائیں") : t("View", "دیکھیں")}
                          </button>
                          {/* rule:e31714fa44: A signed appraisal not yet acknowledged shows a button */}
                          {a.status === "Signed" && (
                            <button
                              type="button"
                              className="button-primary"
                              data-help="my_personnel.acknowledge"
                              onClick={() => startAcknowledge(a)}
                            >
                              {t("Read & Acknowledge", "پڑھیں اور تسلیم کریں")}
                            </button>
                          )}
                          <QualityPaper
                            disabled={!connected}
                            documents={[{
                              label: t("Appraisal PDF", "کارکردگی جائزہ پی ڈی ایف"),
                              path: `/personnel/appraisals/${a.appraisal_id}/pdf`,
                            }]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Acknowledge Form (rule:e31714fa44) */}
            {ackAppraisal && (
              <form className="card" onSubmit={submitAcknowledge} style={{ marginTop: "16px", borderColor: "var(--color-primary, #007bff)" }}>
                <h3>{t("Acknowledge Appraisal", "کارکردگی جائزہ تسلیم کریں")} · {ackAppraisal.appraisal_number}</h3>
                <p>
                  {t(
                    "Please review the appraisal details below, add your comments or feedback if desired, and confirm your formal acknowledgement.",
                    "برائے مہربانی نیچے دیے گئے جائزے کا بغور مطالعہ کریں، اپنے تاثرات درج کریں اور باضابطہ طور پر جائزہ تسلیم کریں۔"
                  )}
                </p>

                <ErrorBox error={ackError} />

                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label htmlFor="ack-date">
                    <strong>{t("Acknowledgement date", "تسلیم کرنے کی تاریخ")}</strong>
                  </label>
                  <input
                    id="ack-date"
                    type="date"
                    data-help="my_personnel.acknowledge"
                    value={ackDate}
                    onChange={(e) => setAckDate(e.target.value)}
                    required
                    disabled={savingAck || !connected}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label htmlFor="ack-comments">
                    <strong>{t("Employee comments (optional, max 4000 characters)", "ملازم کے تاثرات (اختیاری)")}</strong>
                  </label>
                  <textarea
                    id="ack-comments"
                    rows={4}
                    maxLength={4000}
                    data-help="my_personnel.acknowledge"
                    value={ackComments}
                    onChange={(e) => setAckComments(e.target.value)}
                    placeholder={t("Write any comments or feedback regarding this appraisal...", "اس جائزے کے بارے میں اپنے تاثرات درج کریں...")}
                    disabled={savingAck || !connected}
                  />
                </div>

                <div className="toolbar" style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="submit"
                    className="button-primary"
                    data-help="my_personnel.acknowledge"
                    disabled={savingAck || !connected || !ackDate}
                  >
                    {savingAck ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Confirm acknowledgement", "تسلیم کرنے کی تصدیق کریں")}
                  </button>
                  <button
                    type="button"
                    data-help="my_personnel.acknowledge"
                    onClick={() => setAckAppraisal(null)}
                    disabled={savingAck}
                  >
                    {t("Cancel", "منسوخ")}
                  </button>
                </div>
              </form>
            )}

            {/* Appraisal Detail View */}
            {selectedAppraisal && (
              <div className="card" style={{ marginTop: "16px", background: "var(--color-bg-secondary, #fafafa)", padding: "12px" }}>
                <h3>{selectedAppraisal.appraisal_number} · {selectedAppraisal.period_from} – {selectedAppraisal.period_to}</h3>
                {loadingAppraisal && <p>{t("Loading appraisal details...", "جائزے کی تفصیلات لوڈ ہو رہی ہیں...")}</p>}
                
                {appraisalDetail && (
                  <>
                    <p><strong>{t("Appraiser", "جائزہ کنندہ")}:</strong> {appraisalDetail.appraiser_name}</p>
                    {appraisalDetail.overall_rating && (
                      <p>
                        <strong>{t("Overall rating", "مجموعی درجہ")}:</strong>{" "}
                        {overallRatingLabels[appraisalDetail.overall_rating]
                          ? t(overallRatingLabels[appraisalDetail.overall_rating][0], overallRatingLabels[appraisalDetail.overall_rating][1])
                          : appraisalDetail.overall_rating}
                      </p>
                    )}
                    {appraisalDetail.targets && <p><strong>{t("Targets", "اہداف")}:</strong> {appraisalDetail.targets}</p>}
                    {appraisalDetail.strengths && <p><strong>{t("Strengths", "خوبیاں")}:</strong> {appraisalDetail.strengths}</p>}
                    {appraisalDetail.development_needs && <p><strong>{t("Development needs", "بہتری کے تقاضے")}:</strong> {appraisalDetail.development_needs}</p>}
                    {appraisalDetail.development_plan && <p><strong>{t("Development plan", "تربیتی منصوبہ")}:</strong> {appraisalDetail.development_plan}</p>}

                    {/* Criteria ratings table */}
                    {appraisalDetail.ratings && appraisalDetail.ratings.length > 0 && (
                      <div className="table-responsive" style={{ marginTop: "12px" }}>
                        <table>
                          <thead>
                            <tr>
                              <th>{t("Criterion", "معیار")}</th>
                              <th>{t("Type", "قسم")}</th>
                              <th>{t("Rating", "درجہ")}</th>
                              <th>{t("Comment", "تبصرہ")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {appraisalDetail.ratings.map((r, idx) => (
                              <tr key={idx}>
                                <td>{r.criterion}</td>
                                <td>{r.kind}</td>
                                <td><strong>{r.rating} / 5</strong></td>
                                <td>{r.comment || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {appraisalDetail.sign_stamp && (
                      <p style={{ marginTop: "12px", fontStyle: "italic" }}>
                        <strong>{t("Signed by appraiser", "دستخط کنندہ")}:</strong> {appraisalDetail.sign_stamp.text}
                      </p>
                    )}

                    {appraisalDetail.acknowledged_on && (
                      <div style={{ marginTop: "12px", padding: "8px", background: "#e8f5e9", borderRadius: "4px" }}>
                        <p><strong>{t("Acknowledged on", "تسلیم کرنے کی تاریخ")}:</strong> {appraisalDetail.acknowledged_on}</p>
                        {appraisalDetail.employee_comments && (
                          <p><strong>{t("Employee comments", "ملازم کے تاثرات")}:</strong> {appraisalDetail.employee_comments}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </article>

          {/* Trainings Section */}
          <article className="card">
            <h2>{t("Training records (MSDS HRM 136)", "تربیت کا ریکارڈ")}</h2>
            {data.trainings.length === 0 ? (
              <p>{t("No training records found.", "تربیت کا کوئی ریکارڈ نہیں ملا۔")}</p>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Title", "عنوان")}</th>
                      <th>{t("Category", "شعبہ")}</th>
                      <th>{t("Source", "ذریعہ")}</th>
                      <th>{t("Completed on", "تاریخ تکمیل")}</th>
                      <th>{t("Hours", "گھنٹے")}</th>
                      <th>{t("Provider", "فراہم کنندہ")}</th>
                      <th>{t("Result", "نتیجہ")}</th>
                      <th>{t("Certificate", "سند")}</th>
                      <th>{t("Valid until", "قابل استعمال تا")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trainings.map((tr) => (
                      <tr key={tr.id}>
                        <td><strong>{tr.title}</strong></td>
                        <td>{tr.category}</td>
                        <td>{tr.source}</td>
                        <td>{tr.completed_on}</td>
                        <td>{tr.hours !== null ? tr.hours : "—"}</td>
                        <td>{tr.provider || "—"}</td>
                        <td>
                          {tr.passed !== null ? (
                            <span className={`badge badge-${tr.passed ? "success" : "danger"}`}>
                              {tr.passed ? t("Passed", "کامیاب") : t("Failed", "ناکام")}
                            </span>
                          ) : "—"}
                        </td>
                        <td>{tr.certificate_no || "—"}</td>
                        <td>{tr.valid_until || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}
