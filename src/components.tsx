import { tr } from "./i18n";
import {
  useEffect,
  useRef,
  useState,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { ApiError } from "./bridge";
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const r = error instanceof ApiError ? error.response : undefined;
  return (
    <div className="error" role="alert">
      <strong>
        {tr(error instanceof Error ? error.message : String(error))}
      </strong>
      {r && (
        <small>
          {r.error?.code}
          {r.request_id && ` · Reference ${r.request_id}`}
        </small>
      )}
      {r?.error?.details && <Details value={r.error.details} />}
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
