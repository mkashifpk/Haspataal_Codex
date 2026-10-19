import { tr } from "../i18n";
import { useEffect, useState } from "react";
import { ApiError, call } from "../bridge";
import { ErrorBox, Field } from "../components";
import type { HealthOut } from "../generated/login";
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
    [busy, setBusy] = useState(false),
    [until, setUntil] = useState(0),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
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
                  ? tr(
                      "Hospital maintenance is in progress. Sign-in restrictions are enforced by the server.",
                    )
                  : tr("Hospital server ready.")}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget,
              data = new FormData(f);
            setBusy(true);
            setError(undefined);
            try {
              await call("login", {
                username: data.get("username"),
                password: data.get("password"),
              });
              f.reset();
              onLogin();
            } catch (err) {
              setError(err);
              if (err instanceof ApiError) {
                const s =
                  err.response.error?.retry_after_seconds ??
                  err.response.error?.details?.retry_after_seconds;
                if (typeof s === "number") setUntil(Date.now() + s * 1000);
              }
              (f.elements.namedItem("password") as HTMLInputElement).value = "";
            } finally {
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
              ? "Signing in…"
              : seconds
                ? `Try again in ${seconds}s`
                : "Sign in →"}
          </button>
        </form>
        <p className="fine">
          {connected
            ? "✓ Connected to the hospital server"
            : "Server unreachable — check your cable or Wi-Fi."}
        </p>
        <p className="fine">
          {tr("Need access? Contact your hospital’s IT team.")}
        </p>
      </section>
    </div>
  );
}
export function ChangePassword({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<unknown>(),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false);
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
          const f = e.currentTarget,
            d = new FormData(f);
          if (d.get("new") !== d.get("confirm")) {
            setError(new Error("New passwords do not match"));
            return;
          }
          setBusy(true);
          try {
            await call("change-password", {
              current_password: d.get("current"),
              new_password: d.get("new"),
            });
            f.reset();
            setDirty(false);
            onDone();
          } catch (err) {
            setError(err);
            f.reset();
            setDirty(false);
          } finally {
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
            autoComplete="current-password"
          />
        </Field>
        <Field label={tr("New password")}>
          <input
            data-help="login.password"
            name="new"
            type="password"
            required
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
