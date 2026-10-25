import { tr } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { api, call } from "../bridge";
import { Details, ErrorBox, Field, LoadState, useLoad } from "../components";
import type {
  SettingsSectionsOut,
  SettingOut,
  AdminChangeRequestOut,
} from "../generated/settings";
import { ChangePassword } from "./Login";
import { ITConsole } from "./ITConsole";
import { hasUnsavedChanges } from "../unsaved";
import {
  writeAttempt,
  canRetryWrite,
  definiteWriteRefusal,
  type WriteAttempt,
} from "../write-attempt";
export function Settings({
  user,
  prefs,
  onPrefs,
  onFacility,
  connected,
  revision = 0,
}: {
  user: any;
  prefs: any;
  onPrefs: () => void;
  onFacility: () => void;
  connected: boolean;
  revision?: number;
}) {
  const result = useLoad(
    () => api<SettingsSectionsOut>("GET", "/settings/sections"),
    [user?.user_id, user?.permissions?.join(","), revision],
  );
  const [section, setSection] = useState("preferences"),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  async function save(value: any) {
    setBusy(true);
    setError(undefined);
    try {
      await call("prefs", value);
      onPrefs();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const chosen = user
    ? section
    : ["connection", "terminal_identity", "login_display"].includes(section)
      ? section
      : "connection";
  return (
    <>
      <LoadState {...result} retry={result.reload} />
      <div className="settings-layout">
        <aside className="settings-nav">
          {result.data?.tiers.map((t) => (
            <div key={t.tier}>
              <h3>{tr(t.label)}</h3>
              {t.sections.map((s) => (
                <button
                  data-help="settings.sections"
                  key={s.key}
                  className={chosen === s.key ? "selected" : ""}
                  onClick={() => {
                    if (document.querySelector('[data-write-pending="true"]')) {
                      setError(
                        new Error(tr("Wait for the pending action to finish.")),
                      );
                      return;
                    }
                    if (
                      chosen !== s.key &&
                      hasUnsavedChanges() &&
                      !window.confirm(
                        tr("Discard unsaved input and change section?"),
                      )
                    )
                      return;
                    s.screen === "facility_profile"
                      ? onFacility()
                      : setSection(s.key);
                  }}
                >
                  {tr(s.label)}
                  {s.danger ? " ⚠" : ""}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <section className="card">
          <ErrorBox error={error} />
          {["preferences", "login_display"].includes(chosen) && (
            <>
              <h2>{tr(user ? "Your display preferences" : "Login display")}</h2>
              <p className="muted">
                {tr(
                  user
                    ? "Saved with your account on the hospital server."
                    : "Saved only on this terminal. Signing in loads your own preferences.",
                )}
              </p>
              {user && <button data-help="settings.display" disabled={busy || !connected} onClick={async()=>{
                setBusy(true);setError(undefined);
                try {await call("prefs-refresh");onPrefs();} catch(cause){setError(cause);} finally {setBusy(false);}
              }}>{tr("Reload preferences")}</button>}
              <Field label={tr("Language")}>
                <select
                  data-help="settings.display"
                  value={prefs.language}
                  disabled={busy}
                  onChange={(e) => save({ language: e.target.value })}
                >
                  <option value="en">{tr("English")}</option>
                  <option value="ur">اردو — زیرِ جائزہ</option>
                </select>
              </Field>
              <Field label={tr("Theme")}>
                <select
                  data-help="settings.display"
                  value={prefs.theme}
                  disabled={busy}
                  onChange={(e) => save({ theme: e.target.value })}
                >
                  <option value="Light">{tr("Light")}</option>
                  <option value="DarkHighContrast">
                    {tr("Dark · high contrast")}
                  </option>
                </select>
              </Field>
              <Field
                label={`${tr("Display size")} · ${prefs.ui_scale_pct}%`}
                hint={tr("Ctrl/Cmd +, − and 0 use this same setting.")}
              >
                <input
                  data-help="settings.zoom"
                  aria-label={tr("Display size")}
                  type="range"
                  min="100"
                  max="250"
                  step="10"
                  value={prefs.ui_scale_pct}
                  disabled={busy || (!!user && !connected)}
                  onChange={(e) =>
                    save({ ui_scale_pct: Number(e.target.value) })
                  }
                />
              </Field>
              <button
                data-help="settings.zoom"
                onClick={() => save({ ui_scale_pct: 100 })}
                disabled={busy}
              >
                {tr("Reset to 100%")}
              </button>
              {user && (
                <Field label={tr("Download a set of documents")}>
                  <select
                    data-help="settings.downloads"
                    value={prefs.pdf_download}
                    disabled={busy}
                    onChange={(e) => save({ pdf_download: e.target.value })}
                  >
                    <option value="Separate">
                      {tr("Separate PDFs, one per click")}
                    </option>
                    <option value="Combined">{tr("One combined PDF")}</option>
                  </select>
                </Field>
              )}
            </>
          )}
          {chosen === "password" && (
            <ChangePassword settings onDone={onPrefs} />
          )}{" "}
          {chosen === "connection" && <Diagnostics />}
          {chosen === "terminal_identity" && <><TerminalIdentity />{__BUILD_IS_DEV__ && <ReviewCode />}</>}
          {chosen === "policy" && <Policy revision={revision} />}
          {user &&
            result.data?.tiers.some(
              (t) =>
                t.tier === "system" &&
                t.sections.some(
                  (s) => s.key === chosen && s.screen === "it_console",
                ),
            ) && (
              <ITConsole
                key={chosen}
                section={chosen}
                permissions={user.permissions}
                userId={user.user_id}
                revision={revision}
              />
            )}
        </section>
      </div>
    </>
  );
}
export function Diagnostics() {
  const r = useLoad(async () => {
    const [health, info, license] = await Promise.all([
      api("GET", "/health"),
      api("GET", "/meta/server-info"),
      api("GET", "/meta/license"),
    ]);
    return { health, info, license };
  });
  return (
    <>
      <h2>{tr("Server connection")}</h2>
      <p className="muted">
        {tr(
          "Check server health, addresses, certificate identity and licence.",
        )}
      </p>
      <button
        data-help="settings.diagnostics"
        onClick={r.reload}
        disabled={r.loading}
      >
        {tr("Test connection")}
      </button>
      <LoadState {...r} retry={r.reload} />
      {r.data && <Details value={r.data} />}
    </>
  );
}
export function TerminalIdentity() {
  const r = useLoad(() => api("GET", "/terminals/whoami"));
  return (
    <>
      <h2>{tr("This terminal")}</h2>
      <LoadState {...r} retry={r.reload} />
      {r.data && <Details value={r.data} />}
    </>
  );
}
function ReviewCode() {
  const [code, setCode] = useState(""), [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const [saved, setSaved] = useState("");
  const flight = useRef(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const value = await call<{ code: string }>("dev-review");
        if (active && !flight.current) { setCode(value.code); setSaved(value.code); setReady(true); }
      } catch (cause) { if (active) setError(cause); }
    }
    void load();
    const unsubscribe = window.terminal.subscribe(event => {
      if (event.type === "dev-review-changed") void load();
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  async function save() {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(undefined);
    try {
      const value = await call<{ code: string }>("dev-review", { code });
      setCode(value.code); setSaved(value.code);
    } catch (cause) { setError(cause); }
    finally { flight.current = false; setBusy(false); }
  }
  return <div data-unsaved={code !== saved} data-write-pending={busy}>
    <Field label={tr("Review code")} hint={tr("DEV only. Enter the code when you start a review on the portal. It applies across all roles and windows until cleared or the app closes.")}>
      <input data-help="settings.review-code" aria-label={tr("Review code")} dir="ltr" autoComplete="off" spellCheck={false}
        disabled={!ready || busy} value={code} onChange={event => setCode(event.target.value)} />
    </Field>
    <button data-help="settings.review-code" disabled={!ready || busy || code === saved} onClick={save}>{tr("Apply review code")}</button>
    <p role="status">{tr(saved ? "Review code is active. Clear the field and apply when your review ends." : "No review code is active.")}</p>
    <ErrorBox error={error} />
  </div>;
}
function Policy({ revision }: { revision: number }) {
  const r = useLoad(
    async () => ({
      settings: await api<SettingOut[]>("GET", "/admin/settings"),
      requests: await api<AdminChangeRequestOut[]>(
        "GET",
        "/admin/change-requests",
      ),
    }),
    [revision],
  );
  const [selected, setSelected] = useState<SettingOut>(),
    [value, setValue] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  type PolicyWrite = { method: "POST" | "PUT"; path: string; payload: unknown };
  const [pending, setPending] = useState<WriteAttempt<PolicyWrite>>(),
    [requestDetail, setRequestDetail] = useState<AdminChangeRequestOut>();
  const flight = useRef(false),
    detailGeneration = useRef(0);
  async function submitPolicy(attempt: WriteAttempt<PolicyWrite>) {
    if (flight.current || !canRetryWrite(attempt)) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setPending(attempt);
    try {
      const result = await api<any>(
        attempt.body.method,
        attempt.body.path,
        attempt.body.payload,
        { key: attempt.key },
      );
      setPending(undefined);
      setSelected(undefined);
      setMessage(
        result.change_request_id
          ? `${result.status === "Pending" ? tr("Waiting for an Owner") : result.status} · ${result.change_request_id}`
          : tr("Policy saved."),
      );
      if (result.change_request_id) {
        try {
          setRequestDetail(
            await api(
              "GET",
              `/admin/change-requests/${result.change_request_id}`,
            ),
          );
        } catch (cause) {
          setError(cause);
        }
      }
      await r.reload();
    } catch (cause) {
      setError(cause);
      if (definiteWriteRefusal(cause)) setPending(undefined);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <div
      data-unsaved={
        !!selected && (value !== JSON.stringify(selected.value) || !!reason)
      }
      data-write-pending={busy || !!pending}
    >
      <h2>{tr("Hospital policy")}</h2>
      <p className="muted">
        {tr(
          "Control settings require owner approval. The server decides whether to apply or queue the request.",
        )}
      </p>
      <LoadState {...r} retry={r.reload} />
      <ErrorBox error={error} />
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="policy-list">
        {r.data?.settings.map((s) => (
          <button
            data-help="settings.policy"
            className="list-row"
            disabled={busy || !!pending}
            key={s.key}
            onClick={() => {
              if (
                selected &&
                (value !== JSON.stringify(selected.value) || !!reason) &&
                !window.confirm(tr("Discard unsaved input and change section?"))
              )
                return;
              setSelected(s);
              setValue(JSON.stringify(s.value));
              setReason("");
            }}
          >
            <strong>{s.key.replaceAll("_", " ")}</strong>
            <span>{JSON.stringify(s.value)}</span>
            {s.is_control && <small>{tr("Owner approval")}</small>}
          </button>
        ))}
      </div>
      {selected && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (flight.current || pending) return;
            setError(undefined);
            try {
              const parsed = JSON.parse(value);
              if (
                typeof parsed !== typeof selected.value ||
                Array.isArray(parsed) !== Array.isArray(selected.value)
              )
                throw new Error(
                  "Keep the same value type as the current setting.",
                );
              if (selected.is_control) {
                await submitPolicy(
                  writeAttempt({
                    method: "POST",
                    path: "/admin/change-requests",
                    payload: {
                      kind: "Setting",
                      setting_key: selected.key,
                      requested_value: parsed,
                      reason,
                    },
                  }),
                );
              } else {
                await submitPolicy(
                  writeAttempt({
                    method: "PUT",
                    path: "/admin/settings/" + encodeURIComponent(selected.key),
                    payload: { value: parsed },
                  }),
                );
              }
            } catch (err) {
              setError(err);
            }
          }}
        >
          <h3>{selected.key.replaceAll("_", " ")}</h3>
          <p>{selected.description}</p>
          <Field
            label={tr("New value")}
            hint={tr(
              "Use the same format as the current value: text in quotes, a number, true/false, or a list.",
            )}
          >
            <textarea
              data-help="settings.policy"
              required
              disabled={busy || !!pending}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          {selected.is_control && (
            <Field label={tr("Reason")}>
              <textarea
                data-help="settings.policy"
                required
                disabled={busy || !!pending}
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          )}
          <div className="actions">
            <button
              data-help="settings.policy"
              type="button"
              disabled={busy || !!pending}
              onClick={() => setSelected(undefined)}
            >
              {tr("Cancel")}
            </button>
            <button
              data-help="settings.policy"
              className="primary"
              disabled={busy || !!pending}
            >
              {tr("Save policy")}
            </button>
          </div>
        </form>
      )}
      {pending && !busy && (
        <section className="notice" role="status">
          <h3>{tr("Policy outcome needs checking")}</h3>
          <p>
            {tr(
              "The original value and request identity are held in this window. Check recent requests and current policy before retrying. A confirmed request must not be replaced just because its follow-up read failed.",
            )}
          </p>
          <button data-help="settings.recovery" onClick={() => void r.reload()}>
            {tr("Check policy and requests")}
          </button>
          <button
            data-help="settings.recovery"
            disabled={!canRetryWrite(pending)}
            onClick={() => void submitPolicy(pending)}
          >
            {tr("Retry original request")}
          </button>
          <button
            data-help="settings.recovery"
            onClick={() => {
              if (
                window.confirm(
                  tr(
                    "Only clear this hold after the responsible supervisor has reconciled the original request. This does not report success or undo anything. Continue?",
                  ),
                )
              )
                setPending(undefined);
            }}
          >
            {tr("Close reviewed attempt")}
          </button>
        </section>
      )}
      <h3>{tr("Recent change requests")}</h3>
      {r.data?.requests.map((q) => (
        <details key={q.change_request_id}>
          <summary data-help="settings.requests">
            {q.setting_key || q.kind} · {q.status}
          </summary>
          <Details value={q} />
          <button
            data-help="settings.requests"
            onClick={async () => {
              const generation = ++detailGeneration.current;
              try {
                const detail = await api<AdminChangeRequestOut>(
                  "GET",
                  `/admin/change-requests/${q.change_request_id}`,
                );
                if (generation === detailGeneration.current)
                  setRequestDetail(detail);
              } catch (cause) {
                if (generation === detailGeneration.current) setError(cause);
              }
            }}
          >
            {tr("Open request")} {q.change_request_id}
          </button>
        </details>
      ))}
      {requestDetail && <Details value={requestDetail} />}
    </div>
  );
}
