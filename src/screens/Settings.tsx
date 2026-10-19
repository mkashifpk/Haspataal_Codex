import { tr } from "../i18n";
import { useState } from "react";
import { api, call } from "../bridge";
import { Details, ErrorBox, Field, LoadState, useLoad } from "../components";
import type {
  SettingsSectionsOut,
  SettingOut,
  AdminChangeRequestOut,
} from "../generated/settings";
import { ChangePassword } from "./Login";
export function Settings({
  user,
  prefs,
  onPrefs,
  onFacility,
  connected,
}: {
  user: any;
  prefs: any;
  onPrefs: () => void;
  onFacility: () => void;
  connected: boolean;
}) {
  const result = useLoad(
    () => api<SettingsSectionsOut>("GET", "/settings/sections"),
    [user?.user_id],
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
              <h3>{t.label}</h3>
              {t.sections.map((s) => (
                <button
                  key={s.key}
                  className={chosen === s.key ? "selected" : ""}
                  onClick={() =>
                    s.screen === "facility_profile"
                      ? onFacility()
                      : setSection(s.key)
                  }
                >
                  {s.label}
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
              <h2>{user ? "Your display preferences" : "Login display"}</h2>
              <p className="muted">
                {user
                  ? "Saved with your account on the hospital server."
                  : "Saved only on this terminal. Signing in loads your own preferences."}
              </p>
              <Field label={tr("Language")}>
                <select
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
                label={`Display size · ${prefs.ui_scale_pct}%`}
                hint={tr("Ctrl/Cmd +, − and 0 use this same setting.")}
              >
                <input
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
                onClick={() => save({ ui_scale_pct: 100 })}
                disabled={busy}
              >
                {tr("Reset to 100%")}
              </button>
              {user && (
                <Field label={tr("Download a set of documents")}>
                  <select
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
          {chosen === "password" && <ChangePassword onDone={onPrefs} />}{" "}
          {chosen === "connection" && <Diagnostics />}
          {chosen === "terminal_identity" && <TerminalIdentity />}
          {chosen === "policy" && <Policy />}
          {![
            "preferences",
            "login_display",
            "password",
            "connection",
            "terminal_identity",
            "policy",
          ].includes(chosen) && (
            <p>
              {tr(
                "This system section belongs to the IT workspace, outside this foundation build.",
              )}
            </p>
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
      <button onClick={r.reload} disabled={r.loading}>
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
function Policy() {
  const r = useLoad(async () => ({
    settings: await api<SettingOut[]>("GET", "/admin/settings"),
    requests: await api<AdminChangeRequestOut[]>(
      "GET",
      "/admin/change-requests",
    ),
  }));
  const [selected, setSelected] = useState<SettingOut>(),
    [value, setValue] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <>
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
            className="list-row"
            key={s.key}
            onClick={() => {
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
            setBusy(true);
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
                const d = await api<AdminChangeRequestOut>(
                  "POST",
                  "/admin/change-requests",
                  {
                    kind: "Setting",
                    setting_key: selected.key,
                    requested_value: parsed,
                    reason,
                  },
                );
                setMessage(
                  d.status === "Pending"
                    ? "Waiting for an Owner"
                    : `Change ${d.status}`,
                );
              } else {
                await api(
                  "PUT",
                  "/admin/settings/" + encodeURIComponent(selected.key),
                  { value: parsed },
                );
                setMessage("Policy saved.");
              }
              setSelected(undefined);
              await r.reload();
            } catch (err) {
              setError(err);
            } finally {
              setBusy(false);
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
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          {selected.is_control && (
            <Field label={tr("Reason")}>
              <textarea
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          )}
          <div className="actions">
            <button type="button" onClick={() => setSelected(undefined)}>
              {tr("Cancel")}
            </button>
            <button className="primary" disabled={busy}>
              {tr("Save policy")}
            </button>
          </div>
        </form>
      )}
      <h3>{tr("Recent change requests")}</h3>
      {r.data?.requests.map((q) => (
        <details key={q.change_request_id}>
          <summary>
            {q.setting_key || q.kind} · {q.status}
          </summary>
          <Details value={q} />
        </details>
      ))}
    </>
  );
}
