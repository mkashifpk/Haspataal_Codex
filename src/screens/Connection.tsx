import { tr } from "../i18n";
import { useRef, useState } from "react";
import { call } from "../bridge";
import { ErrorBox, Field } from "../components";
export function Connection({ onConnected }: { onConnected: () => void }) {
  const [url, setUrl] = useState(""),
    [fingerprint, setFingerprint] = useState(""),
    [expected, setExpected] = useState(""),
    [found, setFound] = useState<any[]>([]),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [searched, setSearched] = useState(false);
  const running = useRef(false);
  async function run(fn: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="connection card"
      data-unsaved={!!url || !!expected}
      data-write-pending={busy}
    >
      <span className="eyebrow">{tr("FIRST CONNECTION")}</span>
      <h1>{tr("Your hospital, connected.")}</h1>
      <p className="muted">
        {tr(
          "Find your hospital on this network, then confirm its identity with IT.",
        )}
      </p>
      <ErrorBox error={error} />
      {busy && <p role="status">{tr("Checking hospital connection…")}</p>}
      <button
        data-help="connection.discover"
        disabled={busy}
        onClick={() =>
          run(async () => {
            setFound(await call("discover"));
            setSearched(true);
          })
        }
      >
        {tr("Find servers on this network")}
      </button>
      {searched && !found.length && (
        <p>
          {tr(
            "No server found. Ask IT for the server address or provisioning file.",
          )}
        </p>
      )}
      {found.map((s) => (
        <button
          data-help="connection.discover"
          className="server-choice"
          key={s.server_name + "|" + s.ca_fingerprint_sha256}
          disabled={busy}
          onClick={() => {
            setUrl(s.urls[0]);
            setFingerprint("");
            setExpected("");
          }}
        >
          {s.hospital_name} — {s.server_name} · {s.version}
          <span className="fingerprint" dir="ltr">
            {s.ca_fingerprint_sha256}
          </span>
        </button>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const d = await call("inspect-server", { url });
            setFingerprint(d.fingerprint);
          });
        }}
      >
        <Field label={tr("Hospital server address")}>
          <input
            data-help="connection.trust"
            type="url"
            required
            disabled={busy}
            value={url}
            placeholder={tr("https://HMS-SERVER")}
            onChange={(e) => {
              setUrl(e.target.value);
              setFingerprint("");
              setExpected("");
            }}
          />
        </Field>
        <button
          data-help="connection.trust"
          className="primary"
          disabled={busy || !url}
        >
          {tr("Check server identity")}
        </button>
      </form>
      {fingerprint && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await call("trust-server", { fingerprint: expected });
              onConnected();
            });
          }}
        >
          <h3>{tr("Confirm with IT")}</h3>
          <p>
            {tr(
              "Compare this fingerprint with the Control Center’s “Connect terminals” card.",
            )}
          </p>
          <code className="fingerprint" dir="ltr">
            {fingerprint}
          </code>
          <Field label={tr("Fingerprint supplied by IT")}>
            <input
              data-help="connection.trust"
              required
              disabled={busy}
              dir="ltr"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <button
            data-help="connection.trust"
            className="primary"
            disabled={
              busy ||
              expected.replaceAll(":", "").toUpperCase() !==
                fingerprint.replaceAll(":", "")
            }
          >
            {tr("They match — connect")}
          </button>
        </form>
      )}
    </section>
  );
}
