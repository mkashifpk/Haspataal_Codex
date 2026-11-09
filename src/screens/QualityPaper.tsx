import { useState } from "react";
import { call } from "../bridge";
import { ErrorBox } from "../components";
import { bilingual as t } from "../i18n";

export function QualityPaper({
  documents,
  disabled,
}: {
  documents: { label: string; path: string }[];
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  async function open(path: string, preview: boolean) {
    if (busy || disabled) return;
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      const result = await call("clinical-pdf", { path, preview });
      setNotice(
        preview
          ? t("PDF opened.", "پی ڈی ایف کھلی۔")
          : result.saved
            ? t("PDF saved.", "پی ڈی ایف محفوظ۔")
            : t("PDF save cancelled.", "پی ڈی ایف محفوظ کرنا منسوخ۔"),
      );
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar" aria-busy={busy}>
        {documents.map((doc) => (
          <span key={doc.path} className="toolbar">
            <button
              type="button"
              data-help="p9.pdf"
              disabled={disabled || busy}
              onClick={() => void open(doc.path, true)}
            >
              {t("Preview", "دیکھیں")} {doc.label}
            </button>
            <button
              type="button"
              data-help="p9.pdf"
              disabled={disabled || busy}
              onClick={() => void open(doc.path, false)}
            >
              {t("Save", "محفوظ")} {doc.label}
            </button>
          </span>
        ))}
      </div>
      <ErrorBox error={error} />
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
