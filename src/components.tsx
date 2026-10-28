import { tr, bilingual as t } from "./i18n";
import {
  useEffect,
  useRef,
  useState,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
  useId,
} from "react";
import { validationFields } from './validation-fields';
import { ApiError } from "./bridge";
import { foundationErrors } from "./foundation-errors";
import refusalGuidance from "./refusal-guidance.json";
import { isStateRefusal } from "./refusal-recovery";
function recoverySummary(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(recoverySummary);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const keys = ["patient_name", "full_name", "mrn", "order_number", "admission_number", "status", "current_state", "stage", "cleared_by_name", "cleared_at", "blocked_on", "roster_id", "roster_date", "shift_name", "ward_name", "bed_ids", "entries", "stages"];
  const selected = Object.fromEntries(keys.filter(k => k in record).map(k => [k, ["entries", "stages"].includes(k) ? recoverySummary(record[k]) : record[k]]));
  return Object.keys(selected).length ? selected : value;
}
export function ErrorBox({ error, verbatim = false }: { error: unknown; verbatim?: boolean }) {
  const anchor=useRef<HTMLDivElement>(null),fieldErrorId=useId();
  useEffect(()=>{
    const response=error instanceof ApiError?error.response:undefined;
    const fields=validationFields(response?.error);
    const main=anchor.current?.closest('main');
    const scope=anchor.current?.closest('dialog')||main?.querySelector('dialog[open]')||main||anchor.current?.parentElement;
    if(!scope||!fields.length)return;
    const cleanup:(()=>void)[]=[];
    for(const field of fields){
      const leaf=field.field.split('.').at(-1)!;
      const controls=Array.from(scope.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea')).filter(c=>[c.name,c.id,...(c.dataset.field||'').split(' '),c.dataset.help?.split('.').at(-1)].some(name=>name===field.field||name===leaf));
      for(const [i,control]of controls.entries()){
        if(control.dataset.validationOwner)continue;
        const label=control.closest('label')||control.parentElement;if(!label)continue;
        const note=document.createElement('small');note.className='field-error';note.id=fieldErrorId+'-'+field.field+'-'+i;note.textContent=field.message;label.append(note);
        const invalid=control.getAttribute('aria-invalid'),described=control.getAttribute('aria-describedby');control.setAttribute('aria-invalid','true');control.setAttribute('aria-describedby',[described,note.id].filter(Boolean).join(' '));
        control.dataset.validationOwner=fieldErrorId;
        cleanup.push(()=>{note.remove();delete control.dataset.validationOwner;invalid===null?control.removeAttribute('aria-invalid'):control.setAttribute('aria-invalid',invalid);described===null?control.removeAttribute('aria-describedby'):control.setAttribute('aria-describedby',described);});
      }
    }
    return()=>cleanup.forEach(fn=>fn());
  },[error,fieldErrorId]);
  if (!error) return null;
  const r = error instanceof ApiError ? error.response : undefined;
  return (
    <div ref={anchor} className="error" role="alert">
      <strong>
        {verbatim || r?.error?.code === "MAINTENANCE" ? (error instanceof Error ? error.message : String(error)) : tr(error instanceof Error ? error.message : String(error))}
      </strong>
      {r && (
        <small>
          {r.error?.code}
          {r.request_id && ` · Reference ${r.request_id}`}
        </small>
      )}
      {r?.error?.details && <Details value={r.error.details} />}
      {r?.error?.code==='TOKEN_EXPIRED'&&r.error.details?.session_refreshed===true&&<p>{t('Your session was renewed. The refused action was not repeated; keep the draft and review it before submitting again.','آپ کی نشست تازہ ہو گئی۔ رکا ہوا عمل نہیں دہرایا گیا؛ مسودہ رکھ کر دوبارہ ارسال سے پہلے جائزہ لیں۔')}</p>}
      {r?.error?.code === 'BED_NO_LONGER_AVAILABLE' && r.error.details?.in_service === false && <p>{t('The ward was closed. The matrix has been refreshed; keep your choices and select an open ward and bed.', 'وارڈ بند کیا گیا۔ فہرست تازہ ہے؛ اپنا انتخاب محفوظ رکھ کر کھلا وارڈ اور بستر چنیں۔')}</p>}
      {r?.error?.code === 'WARD_IN_USE' && <p>{t('Nothing changed. The ward has beds in use or patients waiting; inspect the bed labels and waitlist count above.', 'کوئی تبدیلی نہیں ہوئی۔ وارڈ کے بستر زیر استعمال یا مریض منتظر ہیں؛ اوپر بستر نام اور انتظار کی تعداد دیکھیں۔')}</p>}
      {r?.error?.code && foundationErrors[r.error.code] && (
        <p>{t(...foundationErrors[r.error.code])}</p>
      )}
      {r?.error?.code && !foundationErrors[r.error.code] && r.error.code in refusalGuidance && (
        <p>{isStateRefusal(r.error.code)
          ? t("The record's state changed. Keep your draft and compare the current server record before another reviewed action. This write will not retry automatically.", "ریکارڈ کی حالت بدلی۔ مسودہ رکھ کر نئے جائزے سے پہلے سرور کے تازہ ریکارڈ سے موازنہ کریں۔ خودکار ارسال نہیں ہوگا۔")
          : t("The server refused this action. Keep your draft, check the code and details, and correct the cause before reviewing again. No write is retried automatically.", "سرور نے عمل روکا۔ مسودہ رکھیں، کوڈ و تفصیل دیکھ کر وجہ درست کریں، پھر جائزہ لیں۔ کوئی ارسال خودکار نہیں دہرایا جاتا۔")}</p>
      )}
      {r?.recovery && (
        <section>
          <strong>{t("Current server record", "سرور کا تازہ ریکارڈ")}</strong>
          {r.recovery.error ? <p>{r.recovery.error}</p> : <Details value={recoverySummary(r.recovery.data)} />}
        </section>
      )}
    </div>
  );
}
export function Details({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="muted">{tr("Not recorded")}</span>;
  if (Array.isArray(value))
    return (
      <div className="details-list">
        {value.map((v, i) => (
          <div key={i}>
            <Details value={v} />
          </div>
        ))}
      </div>
    );
  if (typeof value === "object")
    return (
      <dl className="details">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt>{k.replaceAll("_", " ")}</dt>
            <dd>
              <Details value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <span dir="auto">
      {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  closable = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closable?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => old?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        {closable && (
          <button
            data-help="common.close"
            onClick={onClose}
            aria-label={tr("Close")}
          >
            ×
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  // An enclosing label also contains a select's option text. Give the native
  // control its exact visible label so assistive tools identify it reliably.
  const control =
    isValidElement(children) &&
    typeof children.type === "string" &&
    ["input", "select", "textarea"].includes(children.type)
      ? cloneElement(children as ReactElement<{ "aria-label"?: string }>, {
          "aria-label":
            (children.props as { "aria-label"?: string })["aria-label"] ||
            label,
        })
      : children;
  return (
    <label className="field">
      <span>{label}</span>
      {control}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <span aria-hidden="true">○</span>
      <p>{children}</p>
    </div>
  );
}
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  async function reload() {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    try {
      const d = await loader();
      if (n === generation.current) setData(d);
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
    return () => {
      generation.current++;
    };
  }, deps);
  return { data, error, loading, reload, setData };
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: unknown;
  retry: () => void;
}) {
  return (
    <>
      {loading && (
        <p role="status" className="muted">
          {tr("Loading from the hospital server…")}
        </p>
      )}
      <ErrorBox error={error} />
      {!!error && (
        <button data-help="common.retry" onClick={retry}>
          {tr("Try again")}
        </button>
      )}
    </>
  );
}
