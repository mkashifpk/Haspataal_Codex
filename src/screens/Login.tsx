import { tr } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { ApiError, call } from "../bridge";
import { ErrorBox, Field } from "../components";
import type { HealthOut } from "../generated/login";
import { definiteWriteRefusal } from "../write-attempt";
export function Login({
  onLogin,
  connected,
  hospital,
  health,
  healthError,
}: {
  onLogin: () => void;
  connected: boolean;
  hospital: string;
  health?: HealthOut;
  healthError?: unknown;
}) {
  const [error, setError] = useState<unknown>(),
    [unknownLogin, setUnknownLogin] = useState(false),
    [busy, setBusy] = useState(false),
    [until, setUntil] = useState(0),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  const submitting = useRef(false);
  return (
    <div className="login-layout">
      <section className="welcome">
        <span className="eyebrow">{tr("HASPATAAL · HOSPITAL TERMINAL")}</span>
        <h1>
          {tr("A clear start.")}
          <br />
          {tr("A calmer shift.")}
        </h1>
        <p>{tr("One place for your team’s daily work.")}</p>
        <div className="jaali" aria-hidden="true" />
        <small>{hospital || "Your hospital network"}</small>
      </section>
      <section className="login-form">
        <span className="eyebrow">{tr("WELCOME BACK")}</span>
        <h2>{tr("Sign in to your workspace")}</h2>
        <p className="muted">
          {tr("Use the account provided by your hospital.")}
        </p>
        <ErrorBox error={error} />
        {unknownLogin && (
          <p className="notice" role="status">
            {tr(
              "Sign-in could not be confirmed. It may have opened a session. No automatic retry was made. Check the connection, then sign in again deliberately if needed.",
            )}
          </p>
        )}
        <ErrorBox error={healthError} />
        <p
          role="status"
          className={health?.status === "degraded" ? "notice" : "muted"}
        >
          {healthError || !connected
            ? tr(
                "Cannot reach or check the hospital server. This is not a password error.",
              )
            : !health
              ? tr("Checking the hospital server…")
              : health.status === "degraded"
                ? tr(
                    "The server is starting or has a problem: ask IT. Its database is unavailable.",
                  )
                : health.maintenance_mode
                  ? <span style={{ whiteSpace: "pre-wrap" }}>{health.maintenance_message}</span>
                  : tr("Hospital server ready.")}
        </p>
        <form
          data-write-pending={busy}
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              submitting.current ||
              busy ||
              !connected ||
              !health ||
              healthError ||
              health.status === "degraded" ||
              seconds
            )
              return;
            submitting.current = true;
            const f = e.currentTarget,
              data = new FormData(f);
            setBusy(true);
            setError(undefined);
            setUnknownLogin(false);
            try {
              await call("login", {
                username: data.get("username"),
                password: data.get("password"),
              });
              f.reset();
              onLogin();
            } catch (err) {
              setError(err);
              setUnknownLogin(
                !definiteWriteRefusal(err) &&
                  !(
                    err instanceof ApiError &&
                    err.response.error?.code === "RATE_LIMITED"
                  ),
              );
              if (err instanceof ApiError) {
                const s =
                  err.response.error?.retry_after_seconds ??
                  err.response.error?.details?.retry_after_seconds;
                if (typeof s === "number" && Number.isFinite(s) && s > 0)
                  setUntil(Date.now() + s * 1000);
              }
              (f.elements.namedItem("password") as HTMLInputElement).value = "";
            } finally {
              submitting.current = false;
              setBusy(false);
            }
          }}
        >
          <Field label={tr("Username")}>
            <input
              data-help="login.credentials"
              name="username"
              autoComplete="username"
              required
              disabled={busy}
              minLength={3}
              maxLength={64}
              autoFocus
            />
          </Field>
          <Field label={tr("Password")}>
            <input
              data-help="login.credentials"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
              maxLength={256}
            />
          </Field>
          <button
            data-help="login.credentials"
            className="primary wide"
            disabled={
              busy ||
              !connected ||
              !health ||
              !!healthError ||
              health.status === "degraded" ||
              seconds > 0
            }
          >
            {busy
              ? tr("Signing in…")
              : seconds
                ? `${tr("Try again in")} ${seconds}s`
                : tr("Sign in →")}
          </button>
        </form>
        <p className="fine">
          {connected
            ? tr("✓ Connected to the hospital server")
            : tr("Server unreachable — check your cable or Wi-Fi.")}
        </p>
        <p className="fine">
          {tr("Need access? Contact your hospital’s IT team.")}
        </p>
      </section>
    </div>
  );
}
export function ChangePassword({
  onDone,
  settings = false,
}: {
  onDone: () => void;
  settings?: boolean;
}) {
  const [error, setError] = useState<unknown>(),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  return (
    <section className="card narrow">
      <h2>{tr("Change your password")}</h2>
      <p>{tr("Choose a new password before continuing.")}</p>
      <ErrorBox error={error} />
      <form
        data-unsaved={dirty}
        data-write-pending={busy}
        onChangeCapture={() => setDirty(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting.current) return;
          const f = e.currentTarget,
            d = new FormData(f);
          if (d.get("new") !== d.get("confirm")) {
            setError(new Error(tr("New passwords do not match")));
            return;
          }
          setBusy(true);
          submitting.current = true;
          setError(undefined);
          try {
            await call("change-password", {
              current_password: d.get("current"),
              new_password: d.get("new"),
              settings,
            });
            f.reset();
            setDirty(false);
            onDone();
          } catch (err) {
            setError(err);
            f.reset();
            setDirty(false);
          } finally {
            submitting.current = false;
            setBusy(false);
          }
        }}
      >
        <Field label={tr("Current password")}>
          <input
            data-help="login.password"
            name="current"
            type="password"
            required
            disabled={busy}
            autoComplete="current-password"
          />
        </Field>
        <Field label={tr("New password")}>
          <input
            data-help="login.password"
            name="new"
            type="password"
            required
            disabled={busy}
            minLength={8}
            maxLength={256}
            autoComplete="new-password"
          />
        </Field>
        <Field label={tr("Confirm new password")}>
          <input
            data-help="login.password"
            name="confirm"
            type="password"
            required
            disabled={busy}
            autoComplete="new-password"
          />
        </Field>
        <button data-help="login.password" className="primary" disabled={busy}>
          {tr("Change password")}
        </button>
      </form>
    </section>
  );
}
