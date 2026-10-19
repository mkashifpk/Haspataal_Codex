import { tr } from "../i18n";
import { useState } from "react";
import * as facility from "../generated/facility_profile";
import contract from "../../contracts/facility_profile.json";
import { Details, ErrorBox, Field, LoadState, useLoad } from "../components";
export function Facility({
  revision,
  onChanged,
}: {
  revision: number;
  onChanged: () => void;
}) {
  const r = useLoad(async () => {
    const [est, profiles, msds, staff, history, confirmations, documents] =
      await Promise.all([
        facility.getEstablishment(),
        facility.listProfiles(),
        facility.getProfile(),
        facility.staffingMatrix(),
        facility.listChanges(),
        facility.confirmations(),
        facility.listDocuments({ category: "Hospital" }),
      ]);
    return { est, profiles, msds, staff, history, confirmations, documents };
  }, [revision]);
  const [tab, setTab] = useState("Profile & services"),
    [editing, setEditing] = useState(false),
    [profile, setProfile] = useState<any>({}),
    [moves, setMoves] = useState<Record<string, string>>({}),
    [reason, setReason] = useState(""),
    [preview, setPreview] = useState<facility.EstablishmentPreviewOut>(),
    [snapshot, setSnapshot] = useState<facility.EstablishmentChangeIn>(),
    [acks, setAcks] = useState<string[]>([]),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState("");
  const states = contract.schemas.CapabilityMoveIn.properties.state.enum;
  const change = () => {
    setPreview(undefined);
    setSnapshot(undefined);
    setAcks([]);
  };
  async function doPreview() {
    setBusy(true);
    setError(undefined);
    try {
      const body: facility.EstablishmentChangeIn = {
        reason,
        capabilities: Object.entries(moves).map(([capability, state]) => ({
          capability,
          state,
        })) as facility.CapabilityMoveIn[],
        ...(editing ? { profile } : {}),
      };
      const p = await facility.previewChange(body);
      setSnapshot(structuredClone(body));
      setPreview(p);
      setAcks([]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!snapshot || !preview) return;
    setBusy(true);
    setError(undefined);
    try {
      const d = await facility.applyChange({
        ...snapshot,
        expected_revision: preview.revision,
        acknowledged: acks,
      });
      setSaved(`Change ${d.change_id} applied. Revision ${d.revision}.`);
      change();
      setMoves({});
      setEditing(false);
      await r.reload();
      onChanged();
    } catch (e) {
      setError(e);
      change();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>{tr("Facility profile & services")}</h1>
          <p className="muted">
            {tr(
              "The PHC licence defines the category. The server checks every service change.",
            )}
          </p>
        </div>
        <span className="badge">
          {tr("Revision")}
          {r.data?.est.revision ?? "—"}
        </span>
      </div>
      <div className="tabs">
        {["Profile & services", "Staff & duties", "History"].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <LoadState {...r} retry={r.reload} />
      <ErrorBox error={error} />
      {saved && (
        <p className="notice" role="status">
          {saved}
        </p>
      )}
      {r.data && (
        <>
          {tab === "Staff & duties" &&
            r.data.staff.map((s) => (
              <article
                className={
                  "card " + (s.status === "NotApplicable" ? "muted" : "")
                }
                key={s.duty}
              >
                <span className="badge">{s.status}</span>
                <h3>{s.label}</h3>
                <p>{s.holder_names.join(", ") || "No staff assigned"}</p>
                <p>{s.message}</p>
                {s.solo_alternative && <p>{s.solo_alternative}</p>}
              </article>
            ))}
          {tab === "History" && (
            <>
              <h2>{tr("Service and profile changes")}</h2>
              {r.data.history.map((h) => (
                <details key={h.change_id}>
                  <summary>
                    {h.changed_at} · {h.changed_by_name} · {h.reason}
                  </summary>
                  <Details value={h} />
                </details>
              ))}
              <h2>{tr("Recorded PHC categories")}</h2>
              <Details value={r.data.confirmations} />
            </>
          )}
          {tab === "Profile & services" && (
            <>
              <section className="card">
                <span className="eyebrow">{tr("CURRENT PROFILE")}</span>
                <h2>
                  {r.data.est.profile?.label || "Profile not yet recorded"}
                </h2>
                <p>
                  {r.data.est.profile?.registration_number}
                  {tr("· Effective")} {r.data.est.profile?.effective_from}
                </p>
                <p>
                  {r.data.est.profile?.framework_edition} ·{" "}
                  {r.data.est.profile?.indicators}
                  {tr("indicators")}
                </p>
                {r.data.msds.needs_confirmation && (
                  <p className="notice">
                    {tr("Record the category on your PHC licence.")}
                  </p>
                )}
                <p>{r.data.msds.suggestion.note}</p>
                <details>
                  <summary>{tr("Ward count and licence review")}</summary>
                  <Details
                    value={{
                      wards: r.data.msds.suggestion.wards,
                      review: r.data.msds.review,
                    }}
                  />
                </details>
                <button
                  onClick={() => {
                    setEditing(!editing);
                    setProfile({
                      category:
                        r.data!.est.profile?.code || r.data!.profiles[0].code,
                      registration_number:
                        r.data!.est.profile?.registration_number || "",
                      effective_from: r.data!.est.profile?.effective_from || "",
                      licensed_beds: r.data!.est.profile?.licensed_beds ?? null,
                    });
                    change();
                  }}
                >
                  {editing
                    ? "Keep current profile"
                    : "Record or change profile"}
                </button>
              </section>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void doPreview();
                }}
                onChange={change}
              >
                {editing && (
                  <section className="card">
                    <h2>{tr("Category on the licence")}</h2>
                    <div className="form-grid">
                      <Field label={tr("PHC category")}>
                        <select
                          value={profile.category}
                          onChange={(e) => {
                            const p = r.data!.profiles.find(
                              (p) => p.code === e.target.value,
                            )!;
                            setProfile({ ...profile, category: p.code });
                            setMoves(
                              Object.fromEntries(
                                p.preset
                                  .filter(
                                    (c) => !r.data!.est.active.includes(c),
                                  )
                                  .map((c) => [c, "Active"]),
                              ),
                            );
                          }}
                        >
                          {r.data.profiles.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={tr("PHC registration / licence number")}>
                        <input
                          required
                          maxLength={60}
                          value={profile.registration_number}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              registration_number: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label={tr("Effective date")}>
                        <input
                          type="date"
                          required
                          value={profile.effective_from}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              effective_from: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label={tr("Licensed beds")}>
                        <input
                          type="number"
                          min={0}
                          max={5000}
                          value={profile.licensed_beds ?? ""}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              licensed_beds:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                      <Field label={tr("Licence document")}>
                        <select
                          value={profile.licence_document_id ?? ""}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              licence_document_id: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        >
                          <option value="">{tr("No document selected")}</option>
                          {r.data.documents.map((d) => (
                            <option key={d.document_id} value={d.document_id}>
                              {d.title} · {d.reference_no}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label={tr(
                          "Reason if category differs from bed suggestion",
                        )}
                      >
                        <textarea
                          maxLength={1000}
                          value={profile.reason || ""}
                          onChange={(e) =>
                            setProfile({ ...profile, reason: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <p className="muted">
                      {tr(
                        "Profile presets are suggestions. Review every service before previewing.",
                      )}
                    </p>
                  </section>
                )}
                <h2>{tr("Services")}</h2>
                <div className="service-grid">
                  {r.data.est.capabilities.map((c) => (
                    <article className="card" key={c.capability}>
                      <span className="badge">{c.state}</span>
                      <h3>{c.label}</h3>
                      <p>{c.purpose}</p>
                      {c.requires.length > 0 && (
                        <p>
                          {tr("Requires:")}
                          {c.requires.join(", ")}
                        </p>
                      )}
                      {c.outstanding.map((o) => (
                        <p key={o.kind}>
                          {o.count} {o.label} — {o.how}
                        </p>
                      ))}
                      {c.declaration_note && (
                        <p className="notice">{c.declaration_note}</p>
                      )}
                      {c.implemented && (
                        <Field label={tr("Proposed state")}>
                          <select
                            value={moves[c.capability] || c.state}
                            onChange={(e) =>
                              setMoves((m) => {
                                const next = { ...m };
                                if (e.target.value === c.state)
                                  delete next[c.capability];
                                else next[c.capability] = e.target.value;
                                return next;
                              })
                            }
                          >
                            {states.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </article>
                  ))}
                </div>
                <section className="card">
                  <Field label={tr("Reason for change")}>
                    <textarea
                      required
                      minLength={3}
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  <button className="primary" disabled={busy}>
                    {tr("Preview change")}
                  </button>
                </section>
              </form>
              {preview && (
                <section className="card">
                  <h2>{tr("Review before applying")}</h2>
                  <Details
                    value={{
                      profile: preview.profile,
                      moves: preview.moves,
                      warnings: preview.warnings,
                      problems: preview.problems,
                    }}
                  />
                  {preview.acknowledgements.map((a) => (
                    <label className="check" key={a.code}>
                      <input
                        type="checkbox"
                        checked={acks.includes(a.code)}
                        onChange={(e) =>
                          setAcks((old) =>
                            e.target.checked
                              ? [...old, a.code]
                              : old.filter((x) => x !== a.code),
                          )
                        }
                      />
                      {a.message}
                    </label>
                  ))}
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !preview.allowed ||
                      preview.acknowledgements.some(
                        (a) => !acks.includes(a.code),
                      )
                    }
                    onClick={apply}
                  >
                    {tr("Apply reviewed change")}
                  </button>
                  {!preview.allowed && (
                    <p>{tr("Resolve the problems above and preview again.")}</p>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
