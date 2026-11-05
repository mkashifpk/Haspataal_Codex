import { useEffect, useRef, useState } from "react";
import { api } from "../bridge";
import { Field, ErrorBox } from "../components";
import { bilingual as t } from "../i18n";
import { canRetryWrite, definiteWriteRefusal } from "../write-attempt";
import type { PatientDocumentUploadOut } from "../generated/consents_admissions";
import type { PatientDocumentOut } from "../generated/registration";
export function ConsentScanUpload({
  patientId,
  consentNumber,
  disabled,
  onPending,
  onUploaded,
  docType = 'Consent',
}: {
  patientId: number;
  consentNumber: string;
  disabled: boolean;
  onPending: (v: boolean) => void;
  onUploaded: (v: PatientDocumentUploadOut) => void;
  docType?: 'Consent'|'Prescription'|'MedicoLegalReport'|'AutopsyReport';
}) {
  const [file, setFile] = useState<File>(),
    [attempt, setAttempt] = useState<{
      key: string;
      createdAt: number;
      file: File;
      patientId: number;
      title: string;
      docType: 'Consent'|'Prescription'|'MedicoLegalReport'|'AutopsyReport';
    }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [observed, setObserved] = useState<PatientDocumentOut[]>(),
    [saved, setSaved] = useState<number>();
  const flight = useRef(false),
    current = useRef(attempt);
  current.current = attempt;
  useEffect(() => onPending(busy || !!attempt), [busy, attempt]);
  async function send() {
    if (flight.current || (!file && !attempt)) return;
    const a = attempt || {
      key: crypto.randomUUID(),
      createdAt: Date.now(),
      file: file!,
      patientId,
      title: consentNumber,
      docType,
    };
    if (!canRetryWrite({ ...a, body: null })) {
      setError(
        Error(
          t(
            "Original upload is outside retention. Ask IT to reconcile it.",
            "اصل اپ لوڈ کی مدت ختم۔ آئی ٹی سے نتیجہ چیک کرائیں۔",
          ),
        ),
      );
      return;
    }
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(a.file.type) ||
      !a.file.size
    ) {
      setError(
        Error(
          t(
            "Choose a nonempty PDF, JPEG or PNG scan.",
            "پی ڈی ایف، جے پیگ یا پی این جی کی غیر خالی اسکین چنیں۔",
          ),
        ),
      );
      return;
    }
    flight.current = true;
    setBusy(true);
    setAttempt(a);
    setError(undefined);
    setObserved(undefined);
    try {
      const body = new FormData();
      body.append("file", a.file);
      body.append("doc_type", a.docType);
      body.append("title", a.title);
      body.append("is_outside", "false");
      const r = await api<PatientDocumentUploadOut>(
        "POST",
        `/patients/${a.patientId}/documents`,
        body,
        { key: a.key },
      );
      if (r.patient_id !== a.patientId || r.doc_type !== a.docType)
        throw Error(
          "The uploaded document identity differs. Reconcile before attaching.",
        );
      setSaved(r.document_id);
      setAttempt(undefined);
      setFile(undefined);
      onUploaded(r);
    } catch (e) {
      setError(e);
      if (definiteWriteRefusal(e)) setAttempt(undefined);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function inspect() {
    if (!attempt || flight.current) return;
    setBusy(true);
    try {
      setObserved(
        await api<PatientDocumentOut[]>(
          "GET",
          `/patients/${attempt.patientId}/documents`,
        ),
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      data-write-pending={busy || attempt ? "true" : "false"}
      data-unsaved={!!file && !saved}
    >
      <h3>
        {t("Upload the signed paper separately", "دستخط شدہ کاغذ الگ اپ لوڈ")}
      </h3>
      <ErrorBox error={error} />
      <Field label={t("Patient scan file", "مریض کی اسکین فائل")}>
        <input
          data-help={docType==='Prescription'?'rx.handover':docType==='MedicoLegalReport'?'mlc_cases.input_mlr_note':docType==='AutopsyReport'?'death_record.input_autopsy_findings':'consents.upload'}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          disabled={disabled || busy || !!attempt}
          onChange={(e) => {
            setFile(e.target.files?.[0]);
            setSaved(undefined);
          }}
        />
      </Field>
      {!attempt && (
        <button type="button"
          data-help={docType==='Prescription'?'rx.handover':docType==='MedicoLegalReport'?'mlc_cases.input_mlr_note':docType==='AutopsyReport'?'death_record.input_autopsy_findings':'consents.upload'}
          disabled={disabled || busy || !file}
          onClick={() => void send()}
        >
          {t("Upload this scan", "یہ اسکین اپ لوڈ کریں")}
        </button>
      )}
      {saved && (
        <p role="status">
          {t(
            "Upload saved. Select this document and review the separate attachment; do not upload it again.",
            "اپ لوڈ محفوظ۔ یہی دستاویز چن کر الگ ربط کا جائزہ؛ دوبارہ اپ لوڈ نہیں۔",
          )}{" "}
          #{saved}
        </p>
      )}
      {attempt && !busy && (
        <div className="notice" role="alert">
          <p>
            {t(
              "Upload result unknown. Keep the original file and key; never repeat the main record to repair an upload.",
              "اپ لوڈ کا نتیجہ نامعلوم۔ اصل فائل و کلید رکھیں؛ اپ لوڈ درست کرنے کو اصل اندراج نہ دہرائیں۔",
            )}
          </p>
          <button type="button" data-help={docType==='Prescription'?'rx.handover':docType==='MedicoLegalReport'?'mlc_cases.input_mlr_note':docType==='AutopsyReport'?'death_record.input_autopsy_findings':'consents.recovery'} onClick={() => void inspect()}>
            {t(
              "Read original patient documents",
              "اصل مریض کی دستاویزات پڑھیں",
            )}
          </button>
          {canRetryWrite({ ...attempt, body: null }) && (
            <button type="button" data-help={docType==='Prescription'?'rx.handover':docType==='MedicoLegalReport'?'mlc_cases.input_mlr_note':docType==='AutopsyReport'?'death_record.input_autopsy_findings':'consents.recovery'} onClick={() => void send()}>
              {t("Retry original scan upload", "اصل اسکین اپ لوڈ دوبارہ")}
            </button>
          )}
          {observed && (
            <>
              <p>
                {t(
                  "Compare the actual document and time; a new row alone does not prove this upload.",
                  "اصل دستاویز و وقت ملائیں؛ نئی سطر اکیلے اس اپ لوڈ کا ثبوت نہیں۔",
                )}
              </p>
              {observed
                .filter((d) => d.doc_type === attempt.docType)
                .map((d) => (
                  <p key={d.document_id}>
                    #{d.document_id} · {d.title} · {d.uploaded_at}
                  </p>
                ))}
              <button type="button"
                data-help={docType==='Prescription'?'rx.handover':docType==='MedicoLegalReport'?'mlc_cases.input_mlr_note':docType==='AutopsyReport'?'death_record.input_autopsy_findings':'consents.recovery'}
                onClick={() => {
                  setAttempt(undefined);
                  setObserved(undefined);
                }}
              >
                {t(
                  "Upload result reviewed; return to file",
                  "اپ لوڈ نتیجہ دیکھا؛ فائل پر واپس",
                )}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
