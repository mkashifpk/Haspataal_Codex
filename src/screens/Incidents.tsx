import { StaffPicker } from "../StaffPicker";
import { DirectoryPicker,canReadDirectory } from '../DirectoryPicker';
import { tr } from "../i18n";
import { useEffect, useRef, useState } from "react";
import {
  formatHospitalTime,
  hospitalTimeInput,
  hospitalTimeToUtc,
  hospitalTimeZoneError,
} from "../hospital-time";
import * as incidents from "../generated/report_incident";
import contract from "../generated/report_incident-form.json";
import { api, call } from "../bridge";
import {
  writeAttempt,
  canRetryWrite,
  definiteWriteRefusal,
  type WriteAttempt,
} from "../write-attempt";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  useLoad,
} from "../components";
function Lookup({
  label,
  path,
  idField,
  labelFields,
  onSelect,
  allowed = true,
  query = true,
}: {
  label: string;
  path: string;
  idField: string;
  labelFields: string[];
  onSelect: (id: number) => void;
  allowed?: boolean;
  query?: boolean;
}) {
  const [q, setQ] = useState(""),
    [rows, setRows] = useState<any[]>(),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [chosen, setChosen] = useState("");
  const lookupGeneration = useRef(0);
  if(!allowed) return null;
  return (
    <div className="lookup">
      <Field label={label}>
        {query && (
          <input
            data-help="incident.lookup"
            value={q}
            onChange={(e) => {
              lookupGeneration.current++;
              setQ(e.target.value);
              setRows(undefined);
              setChosen("");
              onSelect(0);
            }}
            disabled={!allowed}
            placeholder={tr("Search by name or number")}
          />
        )}
      </Field>
      {!allowed ? (
        <p className="notice">
          {tr(
            "Your account has no access to this lookup. This reporting gap is with the backend team; no substitute identity will be used.",
          )}
        </p>
      ) : (
        <>
          <button
            data-help="incident.lookup"
            type="button"
            disabled={busy || (query && q.length < 2)}
            onClick={async () => {
              const generation = ++lookupGeneration.current;
              setBusy(true);
              setError(undefined);
              try {
                const d = await api(
                  "GET",
                  path +
                    (query
                      ? "?q=" + encodeURIComponent(q) + "&limit=30"
                      : "?limit=100"),
                );
                if (!Array.isArray(d))
                  throw new Error("Lookup response is not a list");
                if (generation === lookupGeneration.current) setRows(d);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Searching…" : "Find " + label.toLowerCase()}
          </button>
          <ErrorBox error={error} />
          {rows && (
            <select
              data-help="incident.lookup"
              required
              aria-label={`Select ${label}`}
              value={chosen}
              onChange={(e) => {
                setChosen(e.target.value);
                onSelect(Number(e.target.value));
              }}
            >
              <option value="">
                {tr("Select from")}
                {rows.length}
                {tr("matches")}
              </option>
              {rows.map((r) => (
                <option key={r[idField]} value={r[idField]}>
                  {labelFields
                    .map((f) => r[f])
                    .filter(Boolean)
                    .join(" · ")}
                </option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  );
}
export function Incidents({
  user,
  revision,
  timeZone,
  onRecorded,
  onPendingChange,
}: {
  user: any;
  revision: number;
  timeZone?: string;
  onRecorded?: (record: incidents.IncidentDetailOut) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const r = useLoad(
    async () => ({
      types: await incidents.listTypes({ active_only: true }),
      reports: await incidents.listIncidents({ mine: true, limit: 100 }),
      departments: await api<any[]>("GET", "/admin/departments"),
    }),
    [revision],
  );
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [saved, setSaved] = useState<incidents.IncidentDetailOut>(),
    [detail, setDetail] = useState<incidents.IncidentDetailOut>(),
    [affected, setAffected] = useState("None"),
    [type, setType] = useState(""),
    [ids, setIds] = useState<Record<string, number>>({});
  const [draftZone, setDraftZone] = useState(timeZone);
  const submitting = useRef(false),
    detailGeneration = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingReport, setPendingReport] =
    useState<WriteAttempt<incidents.IncidentIn>>();
  useEffect(() => { onPendingChange?.(busy || !!pendingReport); }, [busy, pendingReport, onPendingChange]);
  async function sendReport(attempt: WriteAttempt<incidents.IncidentIn>) {
    if (submitting.current || !canRetryWrite(attempt)) return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    setPendingReport(attempt);
    try {
      const result = await api<incidents.IncidentDetailOut>(
        "POST",
        "/incidents",
        attempt.body,
        { key: attempt.key },
      );
      setSaved(result);
      onRecorded?.(result);
      setPendingReport(undefined);
      formRef.current?.reset();
      setType("");
      setIds({});
      setAffected("None");
      setDirty(false);
      setWhen(hospitalTimeInput(Date.now(), timeZone!));
      await r.reload();
    } catch (cause) {
      setError(cause);
      if (definiteWriteRefusal(cause)) setPendingReport(undefined);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const [when, setWhen] = useState(() =>
    !hospitalTimeZoneError(timeZone)
      ? hospitalTimeInput(Date.now(), timeZone!)
      : "",
  );
  useEffect(() => {
    if (!dirty && !hospitalTimeZoneError(timeZone)) {
      setDraftZone(timeZone);
      setWhen(hospitalTimeInput(Date.now(), timeZone!));
    }
  }, [timeZone, dirty]);
  const zoneProblem =
    hospitalTimeZoneError(timeZone) ||
    (dirty && draftZone !== timeZone
      ? new Error(
          tr(
            "The hospital timezone changed. Reopen this form and review its time before submitting.",
          ),
        )
      : undefined);
  const selected = r.data?.types.find((t) => t.type_code === type);
  const schema = contract.schemas.IncidentIn.properties;
  const can = (p: string) => user.permissions.includes(p);
  const setReference=(field:string,value:string)=>setIds(old=>{const next={...old};if(value)next[field]=Number(value);else delete next[field];return next;});
  const enumSelect = (
    key: "kind" | "harm" | "affected" | "ot_phase" | "medication_stage",
    label: string,
  ) => {
    const s: any = schema[key];
    return (
      <Field label={label}>
        <select
          data-help="incident.classify"
          name={key}
          {...(key === "affected"
            ? {
                value: affected,
                onChange: (e: any) => {
                  setAffected(e.target.value);
                  setIds((v) => {
                    const n = { ...v };
                    delete n.patient_id;
                    delete n.employee_id;
                    return n;
                  });
                },
              }
            : {})}
        >
          {(s.enum || s.anyOf?.[0]?.enum).map((v: string) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </Field>
    );
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>{tr("Report an incident")}</h1>
          <p className="muted">
            {tr(
              "Record the facts, without blame. The Quality Officer will review your report.",
            )}
          </p>
        </div>
        <button
          data-help="incident.reference"
          onClick={() =>
            call("download", { path: "/incidents/sentinel-list/pdf" }).catch(
              setError,
            )
          }
        >
          {tr("What to report · PDF")}
        </button>
      </div>
      <LoadState {...r} retry={r.reload} />
      <ErrorBox error={error} />
      <ErrorBox error={zoneProblem} />
      {saved && (
        <p role="status" className="notice">
          {tr("Report")}
          {saved.incident_number}
          {tr("recorded. The Quality Officer will review it.")}
          {saved.next_step}
        </p>
      )}
      <form
        ref={formRef}
        className="card"
        data-unsaved={dirty}
        data-write-pending={busy || !!pendingReport}
        onChangeCapture={() => setDirty(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting.current || pendingReport) return;
          const form = e.currentTarget,
            d = new FormData(form);
          setError(undefined);
          try {
            if (zoneProblem) throw zoneProblem;
            const occurred = hospitalTimeToUtc(
              String(d.get("occurred_at")),
              timeZone!,
            );
            const body: any = {
              ...Object.fromEntries(d),
              ...ids,
              type_code: type,
              affected,
              occurred_at: occurred,
              reporter_confidential: d.has("reporter_confidential"),
            };
            if (body.department_id)
              body.department_id = Number(body.department_id);
            else delete body.department_id;
            if (affected === "Patient" && canReadDirectory('/patients/search',user.permissions) && !body.patient_id)
              throw new Error("Select the affected patient first.");
            if (affected === "Staff" && !body.employee_id)
              throw new Error("Select the affected staff member first.");
            await sendReport(writeAttempt(body));
          } catch (err) {
            setError(err);
          }
        }}
      >
        <fieldset
          disabled={busy || !!pendingReport || !r.data || !!zoneProblem}
        >
          <legend>{tr("What happened")}</legend>
          <div className="form-grid">
            <Field label={tr("Incident type")}>
              <select data-field="type_code"
                data-help="incident.classify"
                required
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setIds((v) => {
                    const n = { ...v };
                    delete n.drug_id;
                    delete n.booking_id;
                    delete n.death_id;
                    return n;
                  });
                }}
              >
                <option value="">{tr("Choose a type")}</option>
                {r.data &&
                  [...new Set(r.data.types.map((t) => t.area))].map((area) => (
                    <optgroup key={area} label={area}>
                      {r
                        .data!.types.filter((t) => t.area === area)
                        .map((t) => (
                          <option key={t.type_code} value={t.type_code}>
                            {t.name}
                            {t.sentinel === "Always" ? " · Sentinel" : ""}
                          </option>
                        ))}
                    </optgroup>
                  ))}
              </select>
            </Field>
            {enumSelect("kind", "Incident or near miss")}
            {enumSelect("harm", "Harm")}
            <Field
              label={tr("When it happened")}
              hint={timeZone || tr("Hospital timezone unavailable")}
            >
              <input
                data-help="incident.whenwhere"
                name="occurred_at"
                type="datetime-local"
                required
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </Field>
            <Field label={tr("Department")}>
              <select data-help="incident.whenwhere" name="department_id">
                <option value="">{tr("Not recorded")}</option>
                {r.data?.departments.filter(d=>d.is_active).map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr("Ward / location")}>
              <input
                data-help="incident.whenwhere"
                name="location"
                maxLength={300}
                placeholder={tr("Ward, bed or place")}
              />
            </Field>
            {enumSelect("affected", "Who was affected")}
          </div>
          {affected === "Patient" && (
            <Lookup
              label={tr("Patient")}
              path="/patients/search"
              idField="patient_id"
              labelFields={["mrn", "full_name", "mobile"]}
              onSelect={(id) => setIds({ ...ids, patient_id: id })}
              allowed={canReadDirectory('/patients/search',user.permissions)}
            />
          )}{" "}
          {affected === "Staff" && (
            <StaffPicker
              label={tr("Staff member")}
              required
              value={ids.employee_id}
              onSelect={(id) =>
                setIds((current) => {
                  const next = { ...current };
                  if (id) next.employee_id = id;
                  else delete next.employee_id;
                  return next;
                })
              }
            />
          )}{" "}
          <DirectoryPicker path="/beds/matrix?include_beds=false" idField="ward_id" list="wards" data-help="incident.whenwhere" value={ids.ward_id ?? ''} onChange={e=>setReference('ward_id',e.target.value)}/>
          {affected==='Patient'&&<DirectoryPicker path="/admissions?status=Admitted" idField="admission_id" data-help="incident.reference" value={ids.admission_id ?? ''} onChange={e=>setReference('admission_id',e.target.value)}/>}
          {!canReadDirectory('/patients/search',user.permissions)&&affected==='Patient'&&<p>{tr('Describe the patient in What happened. Your permissions do not allow patient lookup.')}</p>}
          {selected?.area === "Medication" && (
            <div className="form-grid">
              <Lookup
                label={tr("Medicine")}
                path="/drugs/search"
                idField="drug_id"
                labelFields={["name", "strength", "form"]}
                onSelect={(id) => setIds({ ...ids, drug_id: id })}
                allowed={canReadDirectory('/drugs/search',user.permissions)}
              />
              {enumSelect("medication_stage", "Medication stage")}
            </div>
          )}
          {["Surgery", "Anaesthesia"].includes(selected?.area || "") && (
            <div className="form-grid">
              <Lookup
                label={tr("Operation")}
                path="/ot/bookings"
                query={false}
                idField="booking_id"
                labelFields={[
                  "booking_number",
                  "patient_name",
                  "procedure_name",
                ]}
                onSelect={(id) => setIds({ ...ids, booking_id: id })}
                allowed={canReadDirectory('/ot/bookings',user.permissions)}
              />
              {enumSelect("ot_phase", "Phase of operation")}
            </div>
          )}
          <details>
            <summary data-help="incident.reference">
              {tr("Link a death record, if relevant")}
            </summary>
            <Lookup
              label={tr("Death record")}
              path="/deaths"
              query={false}
              idField="death_id"
              labelFields={["death_number", "patient_name", "mrn"]}
              onSelect={(id) => setIds({ ...ids, death_id: id })}
              allowed={canReadDirectory('/deaths',user.permissions)}
            />
          </details>
          <Field
            label={tr("What happened")}
            hint={tr("Facts, not opinions or blame.")}
          >
            <textarea
              data-help="incident.narrative"
              required
              minLength={10}
              maxLength={8000}
              name="description"
              rows={4}
            />
          </Field>
          <Field label={tr("What was done at once")}>
            <textarea
              data-help="incident.narrative"
              required
              minLength={3}
              maxLength={4000}
              name="immediate_action"
              rows={3}
            />
          </Field>
          <label className="check">
            <input
              data-help="incident.narrative"
              type="checkbox"
              name="reporter_confidential"
            />
            {tr(
              "Keep my name confidential (visible only to incident managers)",
            )}
          </label>
          <button
            data-help="incident.submit"
            className="primary"
            disabled={
              busy ||
              (affected === "Staff" && !ids.employee_id) ||
              (affected === "Patient" && canReadDirectory('/patients/search',user.permissions) && !ids.patient_id)
            }
          >
            {tr("Submit incident report")}
          </button>
        </fieldset>
      </form>
      {pendingReport && !busy && (
        <section className="notice" role="status">
          <h2>{tr("Report outcome needs checking")}</h2>
          <p>
            {tr(
              "Keep this window open. Check My reports; the original report may already exist. Retrying sends the identical report with its original request identity, never a new report. After 24 hours ask the Quality Officer to reconcile it.",
            )}
          </p>
          <button data-help="incident.recovery" onClick={() => void r.reload()}>
            {tr("Check My reports")}
          </button>
          <button
            data-help="incident.recovery"
            disabled={!canRetryWrite(pendingReport)}
            onClick={() => void sendReport(pendingReport)}
          >
            {tr("Retry original report")}
          </button>
          <button
            data-help="incident.recovery"
            onClick={() => {
              if (
                window.confirm(
                  tr(
                    "Only clear this hold after the responsible supervisor has reconciled the original report. This does not report success or undo anything. Continue?",
                  ),
                )
              )
                setPendingReport(undefined);
            }}
          >
            {tr("Close reviewed attempt")}
          </button>
        </section>
      )}
      <h2>{tr("My reports")}</h2>
      {r.data?.reports.length === 0 && (
        <Empty>{tr("You have no incident reports yet.")}</Empty>
      )}
      {r.data?.reports.map((i) => (
        <button
          data-help="incident.submit"
          className="list-row"
          key={i.incident_id}
          onClick={async () => {
            const generation = ++detailGeneration.current;
            setDetail(undefined);
            try {
              const current = await incidents.getIncident(i.incident_id);
              if (generation === detailGeneration.current) setDetail(current);
            } catch (cause) {
              if (generation === detailGeneration.current) setError(cause);
            }
          }}
        >
          <strong>
            {i.incident_number} · {i.type_name}
          </strong>
          <span>
            {i.status} ·{" "}
            {zoneProblem
              ? i.occurred_at
              : formatHospitalTime(i.occurred_at, timeZone!)}
          </span>
        </button>
      ))}
      {detail && (
        <section className="card">
          <h2>{detail.incident_number}</h2>
          <Details value={detail} />
        </section>
      )}
    </>
  );
}
