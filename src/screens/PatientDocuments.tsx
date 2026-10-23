import { useRef, useState } from "react";
import * as patients from "../generated/patient_search";
import { Empty, ErrorBox, Field, LoadState, useLoad } from "../components";
import { tr } from "../i18n";
import { RegistrationDocuments } from "./RegistrationDocuments";

export function PatientDocuments({ user, revision }: { user: any; revision: number }) {
  const permissions: string[] = user.permissions;
  const canSearch = permissions.includes("patient.search");
  const canViewPatient = permissions.includes("patient.view");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<patients.PatientSearchHitOut[]>([]);
  const [searchError, setSearchError] = useState<unknown>();
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [id, setId] = useState<number>();
  const generation = useRef(0);
  const pending = useRef(false);
  const root = useRef<HTMLElement>(null);
  const masters = useRef(new Map<number, number>());
  const profile = useLoad(async () => {
    if (!id || !canViewPatient) return null;
    const patient = await patients.getPatient(id);
    const previous = masters.current.get(id);
    if (previous !== undefined && previous !== patient.patient_id) throw new Error(tr("Patient identity changed. Reconcile pending uploads before selecting the master record."));
    masters.current.set(id, patient.patient_id);
    return { requestedId: id, patient };
  }, [id, revision, canViewPatient]);
  function changePatient(next?: number) {
    if (pending.current || root.current?.querySelector('[data-write-pending="true"]')) return;
    if (root.current?.querySelector('[data-unsaved="true"]') && !window.confirm(tr("Discard optional files that have not been uploaded?"))) return;
    setId(next);
  }
  async function search() {
    if (!canSearch || searching || query.trim().length < 2) return;
    const n = ++generation.current;
    setSearching(true); setHits([]); setSearchError(undefined); setSearched(false);
    try {
      const result = await patients.search({ q: query.trim(), limit: 20 });
      if (n === generation.current) { setHits(result); setSearched(true); }
    } catch (error) { if (n === generation.current) setSearchError(error); }
    finally { if (n === generation.current) setSearching(false); }
  }
  const patient = profile.data && profile.data.requestedId === id ? profile.data.patient : null;
  return <section ref={root}>
    <h1>{tr("Patient document vault")}</h1>
    <p>{tr("Verify the patient's name and MRN before attaching or opening a document. Files open only when you choose them.")}</p>
    {!canSearch || !canViewPatient ? <Empty>{tr("Your account cannot search and open patient records.")}</Empty> : <>
      <form className="card" onSubmit={event => { event.preventDefault(); void search(); }}>
        <Field label={tr("Patient name, mobile, CNIC or MRN")}><input data-help="documents.select" value={query} minLength={2} maxLength={100} onChange={event => { ++generation.current; setSearching(false); setQuery(event.target.value); setHits([]); setSearched(false); setSearchError(undefined); }} /></Field>
        <button data-help="documents.select" disabled={searching || query.trim().length < 2}>{tr("Search")}</button>
        {searching && <p role="status">{tr("Loading from the hospital server…")}</p>}
        <ErrorBox error={searchError} />
        {searched && !hits.length && <Empty>{tr("No matching patients. Check the identifier; this screen does not register a patient.")}</Empty>}
        {hits.map(hit => <p key={hit.patient_id}><button data-help="documents.select" type="button" onClick={() => changePatient(hit.patient_id)}><bdi>{hit.mrn} · {hit.full_name} · {hit.mobile || tr("Not recorded")}</bdi></button></p>)}
      </form>
      {id && <>
        <LoadState {...profile} retry={profile.reload} />
        {patient && <>
          <section className="card">
            <h2><bdi>{patient.full_name} · {patient.mrn}</bdi></h2>
            <p><bdi>{patient.dob ?? patient.age_years ?? tr("Not recorded")}</bdi> · {patient.gender || tr("Not recorded")} · <bdi>{patient.mobile || tr("Not recorded")}</bdi></p>
            {patient.outstanding.banner_text && <p className="error">{patient.outstanding.banner_text}</p>}
            {patient.is_deceased && <p className="error">{tr("DECEASED")} · <bdi>{patient.death_at}</bdi></p>}
            {!!patient.mlc_numbers.length && <p className="error">{tr("MEDICO-LEGAL")} · <bdi>{patient.mlc_numbers.join(", ")}</bdi></p>}
            {patient.temp_identifier && <p><bdi>{patient.temp_identifier}</bdi></p>}
            <p>{tr("Allergies")}: {patient.allergies || tr("Not recorded")} · {tr("Blood group")}: {patient.blood_group || tr("Not recorded")}</p>
            <button data-help="documents.select" type="button" onClick={() => changePatient()}>{tr("Clear patient selection")}</button>
          </section>
          <RegistrationDocuments key={id} patientId={patient.patient_id} photoId={patient.photo_document_id} permissions={profile.error || profile.loading ? permissions.filter(p => p !== "patient.document.upload") : permissions} vault onPending={value => { pending.current = value; }} onChanged={() => { void profile.reload(); }} />
        </>}
      </>}
    </>}
  </section>;
}
