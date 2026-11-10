import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../bridge";
import type { ClinicalUser } from "../clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { Empty, Field, LoadState, Modal, useLoad } from "../components";
import { deficiencies, type DeficiencyOut, type ResolveIn } from "../generated/record_deficiencies";
import { formatHospitalTime } from "../hospital-time";
import { bilingual as t } from "../i18n";
import { QualityHeading } from "./QualityRegister";

export type DeficiencyScreen = "record_deficiencies_doctor" | "record_deficiencies_nursing";
export const isDeficiencyScreen = (id: string): id is DeficiencyScreen =>
  id === "record_deficiencies_doctor" || id === "record_deficiencies_nursing";
export const deficiencyLimit = 1000;
export const canReadDeficiencies = (permissions: string[]) =>
  permissions.some(permission => ["quality.review.manage", "quality.deficiency.resolve", "quality.review.perform"].includes(permission));

const states = {
  Open: "کھلی",
  Corrected: "درست شدہ",
  Acknowledged: "تسلیم شدہ",
  Withdrawn: "واپس لی گئی",
} satisfies Record<DeficiencyOut["status"], string>;
const categories = { Timeliness: "بروقت", Legibility: "پڑھنے کے قابل", Completeness: "مکمل" };
const own = { mine: true, limit: deficiencyLimit } as const;

type List = {
  data?: DeficiencyOut[];
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
};

export function RecordDeficiencies({
  screenId, user, connected, stream, readOnly, timeZone, revision, openList, onOpenHelp,
}: {
  screenId: DeficiencyScreen;
  user: ClinicalUser;
  connected: boolean;
  stream?: string | null;
  readOnly: boolean;
  timeZone?: string;
  revision: number;
  openList: List;
  onOpenHelp: () => void;
}) {
  const [filter, setFilter] = useState<DeficiencyOut["status"] | "">("Open");
  const [draft, setDraft] = useState<DeficiencyOut>();
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState<DeficiencyOut>();
  const [refused, setRefused] = useState<number>();
  const readable = canReadDeficiencies(user.permissions);
  const history = useLoad(
    () => readable && filter !== "Open" ? deficiencies({ ...own, status: filter || undefined }) : Promise.resolve([]),
    [readable, filter, revision],
  );
  const list = filter === "Open" ? openList : history;
  const rows = !list.loading && !list.error ? list.data : undefined;
  const writePermission = user.permissions.find(permission =>
    permission === "quality.deficiency.resolve" || permission === "quality.review.manage");
  const live = connected && stream === "Live";
  const date = (value: string) => timeZone ? formatHospitalTime(value, timeZone) : value;
  const canCorrect = (row: DeficiencyOut) =>
    Boolean(writePermission && live && !readOnly &&
      row.status === "Open" && refused !== row.deficiency_id &&
      (row.responsible_employee_id === null
        ? screenId === "record_deficiencies_nursing"
        : row.responsible_employee_id === user.employee_id));
  const current = rows?.find(row => row.deficiency_id === draft?.deficiency_id);
  const refresh = async () => {
    await Promise.all([openList.reload(), filter !== "Open" ? history.reload() : undefined]);
  };
  const write = useClinicalWrite(user, screenId, async (result: DeficiencyOut) => {
    setSaved(result);
    setDraft(undefined);
    await refresh();
  });
  const errorCode = write.error instanceof ApiError ? write.error.response.error?.code : undefined;
  useEffect(() => {
    if (draft && (errorCode === "RECORD_DEFICIENCY_NOT_YOURS" || errorCode === "RECORD_DEFICIENCY_RESOLVED")) {
      setConfirmed(false);
      if (errorCode === "RECORD_DEFICIENCY_NOT_YOURS") setRefused(draft.deficiency_id);
      void refresh();
    }
  }, [errorCode]);

  function close() {
    if (write.blocked || (note.trim() && !window.confirm(t("Discard the unsent resolution note?", "غیر ارسال شدہ حل کا نوٹ چھوڑ دیں؟")))) return;
    setDraft(undefined);
    write.clearError();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = note.trim();
    if (!draft || !current || !canCorrect(current) || !writePermission || !confirmed || text.length < 3 || text.length > 1000) return;
    const body: ResolveIn = { status: "Corrected", note: text };
    const { deficiency_id, cycle_id } = draft;
    write.start({
      method: "POST",
      path: `/quality/record-review-deficiencies/${deficiency_id}/resolve`,
      body,
      permission: writePermission,
      protection: "reconcile",
      reconcilePath: `/quality/record-review-deficiencies?cycle_id=${cycle_id}&mine=true&limit=${deficiencyLimit}`,
      label: t("Mark corrected", "درست شدہ قرار دیں"),
    }, async () => {
      const live = (await deficiencies({ ...own, cycle_id })).find(row => row.deficiency_id === deficiency_id);
      if (!live || !canCorrect(live)) {
        setConfirmed(false);
        await refresh();
        throw Error(t("This deficiency can no longer be corrected here. Read its current status.", "یہ کمی یہاں درست نہیں کی جا سکتی۔ موجودہ حالت دیکھیں۔"));
      }
    });
  }

  function selectResult(result: unknown) {
    const row = Array.isArray(result) && result.find((entry: DeficiencyOut) =>
      entry.deficiency_id === draft?.deficiency_id && entry.cycle_id === draft?.cycle_id);
    if (!row) throw Error(t("The original deficiency was not returned. Keep the request locked and ask IT to check it.", "اصل کمی واپس نہیں ملی۔ درخواست مقفل رکھیں اور آئی ٹی سے جانچ کرائیں۔"));
    return row;
  }

  return (
    <section data-screen={screenId} data-unsaved={Boolean(draft)} data-write-pending={write.blocked}>
      <QualityHeading title={t("Record deficiencies to fix", "ریکارڈ کی درست کرنے والی کمیاں")}
        text={screenId === "record_deficiencies_nursing"
          ? t("Review nursing findings assigned to your team and record the correction after updating the source record.", "اپنی ٹیم کے نرسنگ نتائج پڑھیں اور اصل ریکارڈ میں اصلاح کے بعد اس کا اندراج کریں۔")
          : t("Review findings in your records. Append the correction in the source chart first.", "اپنے ریکارڈ کے نتائج پڑھیں۔ پہلے اصل چارٹ میں اصلاحی اندراج شامل کریں۔")}
        onHelp={onOpenHelp} />
      {readable ? <>
        <div className="actions">
          <Field label={t("Deficiency status", "کمی کی حالت")}>
            <select data-help="rdf.filter" value={filter} disabled={Boolean(draft)}
              onChange={event => setFilter(event.target.value as typeof filter)}>
              <option value="">{t("All statuses", "تمام حالتیں")}</option>
              {Object.entries(states).map(([en, ur]) => <option key={en} value={en}>{t(en, ur)}</option>)}
            </select>
          </Field>
          <button data-help="rdf.filter" onClick={() => void refresh()} disabled={list.loading || write.blocked}>{t("Refresh deficiencies", "کمیاں تازہ کریں")}</button>
        </div>
        <p role="status" className="muted">{live ? t("Live", "براہ راست") : t("Reconnecting. Corrections are paused.", "دوبارہ رابطہ ہو رہا ہے۔ اصلاح فی الحال موقوف ہے۔")}</p>
        <LoadState {...list} retry={() => void list.reload()} />
        {saved && <p role="status"><bdi>{saved.record_number} · {saved.criterion_code}</bdi> · {t(saved.status, states[saved.status])}</p>}
        {rows?.length === 0 && <Empty>{filter === "Open" ? t("There are no open deficiencies in your worklist.", "آپ کی فہرست میں کوئی کھلی کمی نہیں۔") : t("No deficiencies match this status.", "اس حالت میں کوئی کمی نہیں ملی۔")}</Empty>}
        {rows?.length === deficiencyLimit && <p role="status">{t("Showing the first 1,000 results. Narrow the status to see other records.", "پہلے 1,000 نتائج دکھائے جا رہے ہیں۔ دیگر ریکارڈ کے لیے حالت محدود کریں۔")}</p>}
        {rows?.map(row => (
          <article className="card" key={row.deficiency_id} data-deficiency={row.deficiency_id}>
            <h2>{row.criterion_title}</h2>
            <p><bdi>{row.record_number} · {row.mrn} · {row.cycle_number}</bdi> · {t(row.category, categories[row.category])} · <strong>{t(row.status, states[row.status])}</strong></p>
            <p>{row.description}</p>
            <p>{row.responsible_name ?? t("Nursing team", "نرسنگ ٹیم")} · {t("Raised by", "رپورٹ کرنے والا")} {row.raised_by_name}
              {" · "}{date(row.created_at)}</p>
            {row.resolution_note && <p>{row.resolution_note} · {row.resolved_by_name} {row.resolved_at && date(row.resolved_at)}</p>}
            {canCorrect(row) && <button data-help="rdf.open" disabled={write.blocked || Boolean(draft)} onClick={() => {
              setSaved(undefined);
              setDraft(row);
              setNote("");
              setConfirmed(false);
              write.clearError();
            }}>{t("Mark corrected", "درست شدہ قرار دیں")}</button>}
          </article>
        ))}
      </> : <Empty>{t("Your current permissions do not allow reading record deficiencies.", "موجودہ اجازتیں ریکارڈ کی کمیاں پڑھنے کی اجازت نہیں دیتیں۔")}</Empty>}
      {draft && <Modal title={t("Mark corrected", "درست شدہ قرار دیں")} onClose={close} closable={!write.blocked}>
        <form onSubmit={submit} className="form">
          <p><bdi>{draft.record_number} · {draft.mrn} · {draft.criterion_code}</bdi></p>
          <p>{draft.description}</p>
          <Field label={t("What was corrected?", "کیا درست کیا گیا؟")}>
            <textarea data-help="rdf.note" rows={3} minLength={3} maxLength={1000} required value={note} disabled={write.blocked} onChange={e => { setNote(e.target.value); setConfirmed(false); }} />
          </Field>
          <label><input data-help="rdf.confirm" type="checkbox" checked={confirmed} disabled={write.blocked}
            onChange={event => setConfirmed(event.target.checked)} /> {t("I already added the correction to the source record.", "میں اصل ریکارڈ میں اصلاح شامل کر چکا ہوں۔")}</label>
          <ClinicalWriteFeedback write={write} selectResult={selectResult} onReviewed={() => {
            setConfirmed(false);
            setDraft(undefined);
            void refresh();
          }} />
          <div className="actions">
            <button data-help="rdf.submit" className="primary" type="submit" disabled={!confirmed || note.trim().length < 3 || write.blocked || !current || !canCorrect(current)}>
              {t("Confirm correction", "اصلاح کی تصدیق کریں")}
            </button>
            <button data-help="rdf.note" type="button" disabled={write.blocked} onClick={close}>{t("Cancel", "منسوخ کریں")}</button>
          </div>
        </form>
      </Modal>}
    </section>
  );
}
