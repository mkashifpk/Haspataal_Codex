import { useRef, useState } from "react";
import { call } from "../bridge";
import { Empty, ErrorBox, Field, LoadState, useLoad } from "../components";
import { getTariff } from "../generated/tariff_display";
import { tr } from "../i18n";

export function Tariff({ revision }: { revision: number }) {
  const tariff = useLoad(getTariff, [revision]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const flight = useRef(false);
  async function pdf() {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(undefined); setNotice("");
    try {
      const result = await call<{ saved: boolean }>("download", { path: "/tariff/pdf" });
      setNotice(result.saved ? "Tariff PDF saved. Open the saved PDF in your PDF reader to print." : "PDF save cancelled. No file was saved.");
    } catch (cause) { setError(cause); }
    finally { flight.current = false; setBusy(false); }
  }
  const data = !tariff.loading && !tariff.error ? tariff.data : undefined;
  const matches = (...values: (string | null)[]) => values.some(value => value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const price = (amount: number | null) => amount === null ? tr("Price not listed") : `${data?.currency} ${amount}`;
  const groups = data?.categories.filter(c => category === "all" || category === `service:${c.category}`) || [];
  const wards = category === "all" || category === "wards" ? data?.wards.filter(w => matches(w.name, w.ward_type)) || [] : [];
  const labs = category === "all" || category === "lab" ? data?.lab_tests.filter(t => matches(t.name, t.code, t.section)) || [] : [];
  const count = groups.reduce((n,c) => n+c.items.filter(i => matches(i.name,i.code,i.department_name)).length, 0)+wards.length+labs.length;
  return <section>
    <h1>{tr("Tariff")}</h1>
    <p>{tr("Check the hospital's published prices before explaining a charge. This screen does not change prices or collect payment.")}</p>
    <div className="actions">
      <button data-help="tariff.read" onClick={() => void tariff.reload()} disabled={tariff.loading}>{tr("Refresh tariff")}</button>
      <button data-help="tariff.pdf" onClick={() => void pdf()} disabled={busy}>{tr(busy ? "Downloading PDF…" : "Print / save tariff PDF")}</button>
    </div>
    <p className="muted">{tr("The official PDF contains the full tariff; screen filters do not change it. Save it, then open it in your PDF reader to print.")}</p>
    <ErrorBox error={error} />
    {notice && <p role="status">{tr(notice)}</p>}
    <LoadState {...tariff} retry={tariff.reload} />
    {data && <>
      <section className="card">
        <h2>{data.hospital_name}</h2>
        <p>{tr("Prices as of")}: <bdi>{data.as_of}</bdi> · {tr("Currency")}: <bdi>{data.currency}</bdi></p>
        <div className="form-grid">
          <Field label={tr("Price category")}><select data-help="tariff.read" value={category} onChange={event => setCategory(event.target.value)}>
            <option value="all">{tr("All prices")}</option>
            {data.categories.map(c => <option key={c.category} value={`service:${c.category}`}>{tr(c.label)}</option>)}
            <option value="wards">{tr("Ward daily charges")}</option><option value="lab">{tr("Lab test prices")}</option>
          </select></Field>
          <Field label={tr("Find a service, ward or test")}><input data-help="tariff.read" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} /></Field>
        </div>
        <button data-help="tariff.read" onClick={() => { setQuery(""); setCategory("all"); }}>{tr("Show all prices")}</button>
      </section>
      {count === 0 && <Empty>{tr("No published prices match this view. Show all prices or refresh; a missing price does not mean a free service.")}</Empty>}
      {groups.map(group => {
        const items = group.items.filter(i => matches(i.name,i.code,i.department_name));
        return items.length ? <section className="card" key={group.category}>
          <h2>{tr(group.label)}</h2>
          <div className="table-wrap"><table aria-label={tr(group.label)}><thead><tr><th>{tr("Service")}</th><th>{tr("Code")}</th><th>{tr("Department")}</th><th>{tr("Price")}</th></tr></thead><tbody>
            {items.map(item => <tr key={item.service_id}><td>{item.name}</td><td><bdi>{item.code}</bdi></td><td>{item.department_name || tr("Not recorded")}</td><td><bdi>{price(item.price)}</bdi></td></tr>)}
          </tbody></table></div>
        </section> : null;
      })}
      {(category === "all" || category === "wards") && <section className="card">
        <h2>{tr("Ward daily charges")}</h2>
        {!wards.length ? <p>{tr("No ward prices match this view.")}</p> : <div className="table-wrap"><table aria-label={tr("Ward daily charges")}><thead><tr><th>{tr("Ward")}</th><th>{tr("Type")}</th><th>{tr("Price per day")}</th></tr></thead><tbody>
          {wards.map(w => <tr key={w.ward_id}><td>{w.name}</td><td>{tr(w.ward_type)}</td><td><bdi>{price(w.bed_day_price)}</bdi></td></tr>)}
        </tbody></table></div>}
      </section>}
      {(category === "all" || category === "lab") && <section className="card">
        <h2>{tr("Lab test prices")}</h2>
        {!labs.length ? <p>{tr("No lab test prices match this view.")}</p> : <div className="table-wrap"><table aria-label={tr("Lab test prices")}><thead><tr><th>{tr("Test")}</th><th>{tr("Code")}</th><th>{tr("Section")}</th><th>{tr("Price")}</th></tr></thead><tbody>
          {labs.map(t => <tr key={t.test_id}><td>{t.name}</td><td><bdi>{t.code}</bdi></td><td>{t.section}</td><td><bdi>{price(t.price)}</bdi></td></tr>)}
        </tbody></table></div>}
      </section>}
    </>}
  </section>;
}
