import { useRef, useState } from "react";
import { api } from "./bridge";
import { bilingual as t } from "./i18n";
import { Details, ErrorBox } from "./components";
import {
  writeAttempt,
  canRetryWrite,
  definiteWriteRefusal,
  type WriteAttempt,
} from "./write-attempt";
import type { ClinicalUser } from "./clinical-context";
import { hasBlockingWrite } from "./independent-write";
export type ClinicalCommand = {
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  permission: string | { recordPath: string; capability: string };
  protection: "idempotent" | "reconcile";
  reconcilePath?: string;
  label: string;
  scope: string;
  actor: number;
  independentUploadPatientId?: number;
};
export function useClinicalWrite(
  user: ClinicalUser,
  scope: string,
  onSaved: (value: any, command: ClinicalCommand) => void | Promise<void>,
) {
  const [attempt, setAttempt] = useState<WriteAttempt<ClinicalCommand>>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [observed, setObserved] = useState<unknown>(),
    [checked, setChecked] = useState(false);
  const flight = useRef(false),
    attemptRef = useRef(attempt),
    live = useRef({ user, scope });
  live.current = { user, scope };
  const hold = (a: WriteAttempt<ClinicalCommand> | undefined) => {
    attemptRef.current = a;
    setAttempt(a);
  };
  async function send(
    a: WriteAttempt<ClinicalCommand>,
    prepare?: () => Promise<void>,
    retrying = false,
    transientBody?: Record<string, unknown>,
  ) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setNotice("");
    setChecked(false);
    setObserved(undefined);
    hold(a);
    let posted = false,
      confirmed = false;
    try {
      const current = live.current;
      if (
        current.user.user_id !== a.body.actor ||
        current.scope !== a.body.scope ||
        (typeof a.body.permission === 'string' && !current.user.permissions.includes(a.body.permission))
      )
        throw new Error(
          t(
            "The original actor, visit or permission changed. Ask IT to reconcile before a replacement action.",
            "اصل صارف، پرچی یا اجازت بدل گئی۔ نیا عمل کرنے سے پہلے آئی ٹی سے نتیجہ چیک کرائیں۔",
          ),
        );
      if (typeof a.body.permission !== 'string' && !retrying) {
        const {recordPath, capability} = a.body.permission;
        if (!a.body.path.startsWith(recordPath + '/') || !/^can_[a-z_]+$/.test(capability)) throw new Error('The record authority does not match this action.');
        const record = await api<Record<string, unknown>>('GET', recordPath);
        if (record[capability] !== true) throw new Error(t('The current server record does not allow this action. Refresh and review it.', 'سرور کا موجودہ ریکارڈ اس عمل کی اجازت نہیں دیتا۔ تازہ پڑھ کر جائزہ لیں۔'));
      }
      if (prepare) await prepare();
      if (
        live.current.user.user_id !== a.body.actor ||
        live.current.scope !== a.body.scope ||
        (typeof a.body.permission === 'string' && !live.current.user.permissions.includes(a.body.permission))
      )
        throw new Error(
          t(
            "The actor or visit changed before submission.",
            "ارسال سے پہلے صارف یا ملاقات بدل گئی۔",
          ),
        );
      posted = true;
      const result = await api(a.body.method, a.body.path, transientBody ? { ...(a.body.body as object), ...transientBody } : a.body.body, {
        key: a.key,
        reconcilePath: a.body.reconcilePath,
      });
      confirmed = true;
      hold(undefined);
      setNotice(
        t(
          "Confirmed on the server. A later read or print failure does not undo this action.",
          "سرور نے تصدیق کی۔ بعد کی پڑھائی یا پرنٹ کی خرابی اس عمل کو واپس نہیں کرتی۔",
        ),
      );
      await onSaved(result, a.body);
    } catch (e) {
      setError(e);
      if (confirmed || (!retrying && (!posted || definiteWriteRefusal(e))))
        hold(undefined);
    } finally {
      if (transientBody) for (const key of Object.keys(transientBody)) delete transientBody[key];
      flight.current = false;
      setBusy(false);
    }
  }
  return {
    attempt,
    busy,
    error,
    notice,
    observed,
    checked,
    clearError: () => { if (!flight.current && !attemptRef.current) setError(undefined); },
    blocked: busy || !!attempt,
    start: (
      command: Omit<ClinicalCommand, "scope" | "actor">,
      prepare?: () => Promise<void>,
      transientBody?: Record<string, unknown>,
    ) => {
      if (!flight.current && !attemptRef.current && !hasBlockingWrite(Array.from(document.querySelectorAll('[data-write-pending="true"]')).map(node => node.closest('[data-independent-upload-patient]')?.getAttribute('data-independent-upload-patient') ?? null), command.independentUploadPatientId))
        void send(
          writeAttempt({ ...command, scope, actor: user.user_id }),
          prepare,
          false,
          transientBody,
        );
    },
    retry: () => {
      const a = attemptRef.current;
      if (a && a.body.protection === "idempotent" && canRetryWrite(a))
        void send(a, undefined, true);
    },
    inspect: async () => {
      const a = attemptRef.current;
      if (!a?.body.reconcilePath || flight.current) return;
      flight.current = true;
      setBusy(true);
      setChecked(false);
      try {
        setObserved(await api("GET", a.body.reconcilePath));
        setChecked(true);
      } catch (e) {
        setError(e);
      } finally {
        flight.current = false;
        setBusy(false);
      }
    },
    release: () => {
      if (checked && !flight.current) {
        hold(undefined);
        setChecked(false);
        setObserved(undefined);
      }
    },
  };
}
export function ClinicalWriteFeedback({
  write,
  onReviewed,
}: {
  write: ReturnType<typeof useClinicalWrite>;
  onReviewed?: () => void;
}) {
  return (
    <>
      <ErrorBox error={write.error} verbatim />
      {write.notice && <p role="status">{write.notice}</p>}
      {write.attempt && !write.busy && (
        <section className="notice" role="alert">
          <p>
            {t(
              "The result is unknown. This draft and navigation stay locked; do not create a replacement.",
              "نتیجہ نامعلوم ہے۔ مسودہ اور جگہ بدلنا مقفل ہیں؛ متبادل درخواست نہ بنائیں۔",
            )}
          </p>
          <p>
            {write.attempt.body.label} · <code>{write.attempt.key}</code>
          </p>
          {write.attempt.body.protection === "idempotent" &&
          canRetryWrite(write.attempt) ? (
            <button data-help="clinical.recovery" onClick={write.retry}>
              {t("Retry original request", "اصل درخواست کی دوبارہ کوشش")}
            </button>
          ) : (
            <p>
              {t(
                "No safe automatic replay is available. Re-read and reconcile; outside retention ask IT.",
                "خودکار دوبارہ ارسال محفوظ نہیں۔ دوبارہ پڑھ کر نتیجہ چیک کریں؛ وقت گزرنے پر آئی ٹی سے کہیں۔",
              )}
            </p>
          )}
          {write.attempt.body.reconcilePath && (
            <button
              data-help="clinical.recovery"
              onClick={() => void write.inspect()}
            >
              {t("Read current result", "موجودہ نتیجہ پڑھیں")}
            </button>
          )}
          {write.checked && (
            <>
              <Details value={write.observed} />
              <button data-help="clinical.recovery" onClick={() => {
                write.release();
                onReviewed?.();
              }}>
                {t(
                  "Result reviewed; return to draft",
                  "نتیجہ چیک ہو گیا؛ مسودے پر واپس",
                )}
              </button>
            </>
          )}
        </section>
      )}
    </>
  );
}
