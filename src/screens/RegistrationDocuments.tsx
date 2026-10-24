import { useEffect, useRef, useState } from "react";
import { api, call, ApiError } from "../bridge";
import { ErrorBox, Field, LoadState, Modal, useLoad } from "../components";
import type { PatientDocumentOut } from "../generated/registration";
import { tr } from "../i18n";
import { definiteWriteRefusal } from "../write-attempt";

type Draft = {
  id: string;
  file: File;
  type: string;
  title: string;
  facility: string;
  date: string;
  key: string;
  saved?: number;
  error?: unknown;
  busy?: boolean;
  locked?: boolean;
  outside?: boolean;
};
export function RegistrationDocuments({
  patientId,
  photoId,
  permissions,
  onPending,
  onChanged,
  vault = false,
}: {
  patientId?: number;
  photoId?: number | null;
  permissions: string[];
  onPending: (pending: boolean) => void;
  onChanged: () => void;
  vault?: boolean;
}) {
  const allowed = permissions.includes("patient.document.upload");
  const canView = permissions.includes("patient.document.view");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [photo, setPhoto] = useState<Draft>();
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<unknown>();
  const [camera, setCamera] = useState(false);
  const [consent, setConsent] = useState(false);
  const [view, setView] = useState<string>();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const flights = useRef(new Set<string>());
  const started = useRef(new Map<string,number>());
  useEffect(() => {
    onPending(
      !!photo?.busy ||
        drafts.some((d) => d.busy || (d.locked && !d.saved)) ||
        !!(photo?.locked && !photo.saved),
    );
  }, [photo, drafts]);
  const list = useLoad(
    async () =>
      patientId && canView
        ? api<PatientDocumentOut[]>("GET", `/patients/${patientId}/documents`)
        : [],
    [patientId, canView],
  );
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  }
  useEffect(
    () => () => stream.current?.getTracks().forEach((t) => t.stop()),
    [],
  );
  useEffect(() => {
    if (camera && video.current) video.current.srcObject = stream.current;
  }, [camera]);
  const dataUrl = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  async function choosePhoto(file?: File) {
    if (!file) return;
    setError(undefined);
    try {
      if (!["image/jpeg", "image/png"].includes(file.type))
        throw new Error("Choose a JPEG or PNG patient photo.");
      const image = await createImageBitmap(file);
      const tooLarge = image.width * image.height > 16000000;
      image.close();
      if (tooLarge)
        throw new Error("Patient photos must be at most 16 megapixels.");
      setPreview(await dataUrl(file));
      setPhoto({
        id: crypto.randomUUID(),
        file,
        type: "Photo",
        title: "Patient photo",
        facility: "",
        date: "",
        key: crypto.randomUUID(),
      });
    } catch (cause) {
      setError(cause);
    }
  }
  async function startCamera() {
    setError(undefined);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      setCamera(true);
    } catch (cause) {
      setError(cause);
    }
  }
  async function capture() {
    if (!video.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext("2d")!.drawImage(video.current, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob)
          void choosePhoto(
            new File([blob], "patient-photo.jpg", { type: "image/jpeg" }),
          );
        stop();
      },
      "image/jpeg",
      0.9,
    );
  }
  async function upload(item: Draft, isPhoto = false) {
    if (!patientId || item.busy || item.saved || flights.current.has(item.id)) return;
    const update = (values: Partial<Draft>) =>
      isPhoto
        ? setPhoto((p) => (p ? { ...p, ...values } : p))
        : setDrafts((ds) =>
            ds.map((d) => (d.id === item.id ? { ...d, ...values } : d)),
          );
    if (
      !isPhoto &&
      (!item.title.trim() || (item.outside !== false && (!item.facility.trim() || !item.date)))
    ) {
      update({
        error: new Error(
          "Enter report title, issuing facility and the date on the document.",
        ),
      });
      return;
    }
    const first = started.current.get(item.id) ?? Date.now();
    started.current.set(item.id, first);
    if (Date.now() < first || Date.now() - first >= 86400000) {
      update({locked:true,error:new Error("The original request is outside the safe retry window. Ask IT to reconcile it; do not register or pay again.")});
      return;
    }
    flights.current.add(item.id);
    update({ busy: true, error: undefined, locked: true });
    try {
      const form = new FormData();
      form.append("file", item.file);
      form.append("doc_type", item.type);
      form.append("title", item.title);
      if (!isPhoto) {
        form.append("is_outside", String(item.outside !== false));
        if (item.outside !== false) form.append("source_facility", item.facility);
        if (item.date) form.append("document_date", item.date);
      }
      const result = await api<{ document_id: number }>(
        "POST",
        `/patients/${patientId}/documents`,
        form,
        { key: item.key },
      );
      update({ saved: result.document_id });
    } catch (cause) {
      const refused = definiteWriteRefusal(cause);
      if (refused) started.current.delete(item.id);
      update({
        error: cause,
        ...(refused
          ? { locked: false, key: crypto.randomUUID() }
          : {}),
      });
    } finally {
      flights.current.delete(item.id);
      update({ busy: false });
    }
    // A failed follow-up read cannot turn a confirmed upload into a new write.
    await list.reload();
    onChanged();
  }
  async function open(id: number) {
    try {
      const doc = await call<{ type: string; base64: string }>("patient-file", {
        documentId: id,
        save: true,
      });
      if (doc.base64) setView(`data:${doc.type};base64,${doc.base64}`);
    } catch (cause) {
      setError(cause);
    }
  }
  return (
    <section
      className="card"
      data-write-pending={
        !!photo?.busy ||
        drafts.some((d) => d.busy || (d.locked && !d.saved)) ||
        !!(photo?.locked && !photo.saved)
      }
      data-unsaved={!!(photo && !photo.saved) || drafts.some((d) => !d.saved)}
    >
      <h2>{tr("Patient photo (optional)")}</h2>
      <p className="muted">
        {tr(
          "Ask permission first. A photo is never required; respect refusal and never delay urgent care.",
        )}
      </p>
      <ErrorBox error={error} />
      {photoId && canView && (
        <button data-help="registration.documents" type="button" onClick={() => void open(photoId)}>
          {tr("View current patient photo")}
        </button>
      )}
      {allowed ? (
        <>
          <div className="patient-photo-layout">
            <div className="patient-photo-controls">
              <label className="photo-consent">
                <input data-help="registration.documents"
                  type="checkbox"
                  checked={consent}
                  disabled={photo?.busy || photo?.locked}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    if (!e.target.checked) {
                      stop();
                      setPhoto(undefined);
                      setPreview(undefined);
                      setError(undefined);
                    }
                  }}
                />
                {tr("The patient agrees to a photo")}
              </label>
              <div className="photo-toolbar">
                <Field label={tr("Choose photo")}>
                  <input data-help="registration.documents"
                    type="file"
                    accept="image/jpeg,image/png"
                    disabled={
                      !consent || !!photo?.saved || photo?.busy || photo?.locked
                    }
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void choosePhoto(file);
                    }}
                  />
                </Field>
                <button data-help="registration.documents"
                  type="button"
                  disabled={
                    !consent ||
                    camera ||
                    photo?.busy ||
                    !!photo?.saved ||
                    photo?.locked
                  }
                  onClick={() => void startCamera()}
                >
                  {tr("Take photo")}
                </button>
                <button data-help="registration.documents"
                  type="button"
                  disabled={photo?.busy || !!photo?.saved || photo?.locked}
                  onClick={() => {
                    stop();
                    setPhoto(undefined);
                    setPreview(undefined);
                    setConsent(false);
                    setError(undefined);
                  }}
                >
                  {tr("Skip photo")}
                </button>
              </div>
            </div>
            <div className="patient-photo-media">
              {!camera && !preview && (
                <div className="photo-placeholder">
                  {tr("No photo selected")}
                </div>
              )}
              {camera && (
                <div className="camera-preview">
                  <video
                    ref={video}
                    autoPlay
                    playsInline
                    muted
                    className="photo-frame"
                  />
                  <div className="actions">
                    <button data-help="registration.documents" type="button" onClick={() => void capture()}>
                      {tr("Capture photo")}
                    </button>
                    <button data-help="registration.documents" type="button" onClick={stop}>
                      {tr("Close camera")}
                    </button>
                  </div>
                </div>
              )}
              {preview && (
                <img
                  src={preview}
                  alt={tr("Patient photo preview")}
                  className="photo-frame"
                />
              )}
              {photo && (
                <>
                  <ErrorBox error={photo.error} />
                  <button data-help="registration.documents"
                    type="button"
                    disabled={!patientId || photo.busy || !!photo.saved}
                    onClick={() => void upload(photo, true)}
                  >
                    {photo.saved
                      ? tr("Photo uploaded")
                      : photo.busy
                        ? tr("Uploading…")
                        : tr("Upload patient photo")}
                  </button>
                </>
              )}
            </div>
          </div>
          {!patientId && (
            <p className="fine muted">
              {tr(
                "Photos and reports upload after registration succeeds. Their failure never repeats a registration or payment.",
              )}
            </p>
          )}
          <h2>{tr("Reports brought by the patient (optional)")}</h2>
          {vault && <p>{tr("Outside reports stay separate from this hospital's results. For an ID copy or hospital attachment, clear Outside document and select its type.")}</p>}
          <Field label={tr("Choose outside reports")}>
            <input data-help="registration.documents"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setDrafts((ds) => [
                  ...ds,
                  ...files.map((file) => ({
                    id: crypto.randomUUID(),
                    file,
                    type: "LabReport",
                    title: "",
                    facility: "",
                    date: "",
                    key: crypto.randomUUID(),
                  })),
                ]);
                e.target.value = "";
              }}
            />
          </Field>
          {drafts.map((d) => (
            <div className="card" key={d.id}>
              <strong>{d.file.name}</strong>
              <fieldset disabled={d.busy || !!d.saved || d.locked}>
                {vault && <label><input data-help="registration.documents" type="checkbox" checked={d.outside !== false} onChange={event => setDrafts(ds => ds.map(x => x.id === d.id ? { ...x, outside: event.target.checked, type: "Other" } : x))} />{tr("Outside document")}</label>}
                <div className="form-grid">
                  <Field label={tr("Report type")}>
                    <select data-help="registration.documents"
                      value={d.type}
                      onChange={(e) =>
                        setDrafts((ds) =>
                          ds.map((x) =>
                            x.id === d.id ? { ...x, type: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      {(vault && d.outside === false ? ["CNIC", "PanelCard", "Consent", "ReferralLetter", "DeathCertificate", "AutopsyReport", "PostMortemReport", "MedicoLegalReport", "LabReport", "Imaging", "DischargeSummary", "Prescription", "Other"] : [
                        "LabReport",
                        "Imaging",
                        "DischargeSummary",
                        "Prescription",
                        "ReferralLetter",
                        "Other",
                      ]).map((t) => (
                        <option key={t} value={t}>{tr(t)}</option>
                      ))}
                    </select>
                  </Field>
                  {(
                    [
                      ["title", "Report title"],
                      ["facility", "Issued by facility"],
                      ["date", "Document date"],
                    ] as const
                  ).map(([field, label]) => (
                    <Field key={field} label={tr(label)}>
                      <input data-help="registration.documents"
                        aria-label={tr(label)}
                        type={field === "date" ? "date" : "text"}
                        maxLength={200}
                        value={d[field]}
                        onChange={(e) =>
                          setDrafts((ds) =>
                            ds.map((x) =>
                              x.id === d.id
                                ? { ...x, [field]: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </Field>
                  ))}
                </div>
              </fieldset>
              <ErrorBox error={d.error} />
              <div className="actions">
                <button data-help="registration.documents"
                  type="button"
                  disabled={!patientId || d.busy || !!d.saved}
                  onClick={() => void upload(d)}
                >
                  {d.saved ? tr("Report uploaded") : tr("Upload report")}
                </button>
                {!d.saved && (
                  <button data-help="registration.documents"
                    type="button"
                    disabled={d.busy || d.locked}
                    onClick={() =>
                      setDrafts((ds) => ds.filter((x) => x.id !== d.id))
                    }
                  >
                    {tr("Remove")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      ) : (
        <p>{tr("Your account cannot upload patient documents.")}</p>
      )}
      {patientId && canView && (
        <>
          <h3>{tr("Stored patient documents")}</h3>
          <button data-help="registration.documents" type="button" onClick={() => void list.reload()} disabled={list.loading}>{tr("Refresh documents")}</button>
          <LoadState {...list} retry={list.reload} />
          {list.data?.length === 0 && (
            <p>{tr("No patient documents have been uploaded.")}</p>
          )}
          {!list.error && list.data?.map((d) => (
            <p key={d.document_id}>
              <button data-help="registration.documents" type="button" onClick={() => void open(d.document_id)}>
              {d.title || tr(d.doc_type)} · #{d.document_id}
              </button>{" "}
              ·{" "}
              {d.is_outside
                ? `${tr("Outside")}: ${d.source_facility}, ${d.document_date}`
                : tr("Hospital document")} · {tr(d.doc_type)} · {d.content_type} · {d.size_bytes} {tr("bytes")}
            </p>
          ))}
        </>
      )}
      {view && (
        <Modal
          title={tr("Patient document")}
          onClose={() => setView(undefined)}
        >
          <img
            src={view}
            alt={tr("Patient document")}
            style={{ maxWidth: "100%" }}
          />
        </Modal>
      )}
    </section>
  );
}
