import { useEffect, useRef, useState } from "react";
import { api, call } from "../bridge";
import { bilingual as t, tr } from "../i18n";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import {
  ClinicalVisit,
  type ClinicalUser,
  type VisitContext,
} from "../clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { formatHospitalTime } from "../hospital-time";
import * as lab from "../generated/lab_orders_results";
import * as emr from "../generated/consultation";
import { getTariff } from "../generated/tariff_display";
type Props = {
  user: ClinicalUser;
  revision: number;
  initialTicket?: number;
  readOnly: boolean;
  connected: boolean;
  active: string[];
  timeZone?: string;
  availableScreens: string[];
  onRoute: (screen: string, ticket: number) => void;
};
const allowedResult = (r: {
  status: string;
  provisionally_released_at: string | null;
}) =>
  r.status === "Published" ||
  (r.status === "PendingVerification" && !!r.provisionally_released_at);
const canCancel = (r: lab.LabRequisitionDetailOut, user: ClinicalUser) =>
  r.requester_user_id === user.user_id &&
  user.permissions.some((p) =>
    ["lab.requisition.cancel_own", "lab.requisition.cancel"].includes(p),
  ) &&
  r.status !== "Cancelled" &&
  r.items.length > 0 &&
  r.items.every(
    (i) =>
      i.status === "Ordered" &&
      !i.collected_at &&
      !["Collected", "Received", "Dispatched", "Consumed", "Rejected"].includes(
        i.sample_status || "",
      ),
  );
export function LabOrdersResults(props: Props) {
  return (
    <section>
      <h1>
        {t("Lab & imaging orders + results", "لیب و عکس کے احکامات اور نتائج")}
      </h1>
      <ClinicalVisit
        user={props.user}
        revision={props.revision}
        initialTicket={props.initialTicket}
      >
        {(ctx) => <Diagnostics {...props} ctx={ctx} />}
      </ClinicalVisit>
    </section>
  );
}
function Diagnostics({
  ctx,
  user,
  revision,
  readOnly,
  connected,
  active,
  timeZone,
  availableScreens,
  onRoute,
}: Props & { ctx: VisitContext }) {
  const can = (permission: string) => user.permissions.includes(permission),
    [local, setLocal] = useState(0),
    [testQ, setTestQ] = useState(""),
    [selectedTests, setSelectedTests] = useState<number[]>([]),
    [priority, setPriority] = useState<"Routine" | "Urgent" | "STAT">(
      "Routine",
    ),
    [notes, setNotes] = useState(""),
    [admission, setAdmission] = useState(""),
    [dirty, setDirty] = useState(false),
    [labId, setLabId] = useState<number>(),
    [imageId, setImageId] = useState<number>(),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [cancel, setCancel] = useState(false),
    [reason, setReason] = useState(""),
    [actionDirty, setActionDirty] = useState(false),
    [trend, setTrend] = useState(""),
    [metric, setMetric] = useState("");
  const [modality, setModality] = useState(""),
    [bodyPart, setBodyPart] = useState(""),
    [indication, setIndication] = useState(""),
    [service, setService] = useState(""),
    [side, setSide] = useState(""),
    [transport, setTransport] = useState(""),
    [escort, setEscort] = useState(""),
    [imagingDirty, setImagingDirty] = useState(false),
    [withdrawn, setWithdrawn] = useState<Record<number, boolean>>({}),
    [withdrawNotice, setWithdrawNotice] = useState("");
  const seenStudy = useRef(new Set<number>());
  const orders = useLoad(
    () =>
      can("lab.requisition.view") || can("lab.result.view")
        ? lab.listRequisitionsLab({
            patient_id: ctx.patient.patient_id,
            limit: 200,
          })
        : Promise.resolve([]),
    [ctx.patient.patient_id, revision, local],
  );
  const tests = useLoad(
    () =>
      can("lab.requisition.create") || can("lab.requisition.view")
        ? lab.listTests()
        : Promise.resolve([]),
    [revision, local],
  );
  const summary = useLoad(
    () =>
      can("patient.emr.view")
        ? emr.masterSummary(ctx.patient.patient_id)
        : Promise.resolve(undefined),
    [ctx.patient.patient_id, revision, local],
  );
  const results = useLoad(
    () =>
      can("lab.result.view")
        ? lab.patientResults(
            ctx.patient.patient_id,
            trend ? { test_id: Number(trend) } : undefined,
          )
        : Promise.resolve([]),
    [ctx.patient.patient_id, revision, local, trend],
  );
  const images = useLoad(
    () =>
      can("imaging.order.view")
        ? lab.patientOrders({ patient_id: ctx.patient.patient_id })
        : Promise.resolve([]),
    [ctx.patient.patient_id, revision, local],
  );
  const tariff = useLoad(
    () =>
      can("imaging.order.create") ? getTariff() : Promise.resolve(undefined),
    [revision, local],
  );
  const detail = useLoad(
    () =>
      labId
        ? lab.getRequisitionLabRequisitions(labId)
        : Promise.resolve(undefined),
    [labId, revision, local],
  );
  const image = useLoad(
    () => (imageId ? lab.getOrder(imageId) : Promise.resolve(undefined)),
    [imageId, revision, local],
  );
  const write = useClinicalWrite(
    user,
    `${ctx.ticket.ticket_id}:${ctx.patient.patient_id}`,
    async (value, command) => {
      if (command.path === "/lab/requisitions") {
        setLabId((value as lab.LabRequisitionDetailOut).requisition_id);
        setSelectedTests([]);
        setNotes("");
        setDirty(false);
      }
      if (command.path === "/imaging/orders") {
        setImageId((value as lab.ImagingOrderOut).imaging_order_id);
        setImagingDirty(false);
        setBodyPart("");
        setIndication("");
        setModality("");
        setSide("");
        setService("");
        setTransport("");
        setEscort("");
      }
      setCancel(false);
      setActionDirty(false);
      setLocal((n) => n + 1);
      await ctx.reload();
    },
  );
  const disabled =
    readOnly ||
    !connected ||
    !ctx.ready ||
    ctx.patient.is_deceased ||
    !!ctx.patient.merged_into_id ||
    ctx.ticket.is_clinical_locked ||
    ctx.ticket.approval_lock !== "None" ||
    write.blocked;
  const format = (s: string | null) =>
    s
      ? timeZone
        ? formatHospitalTime(s, timeZone)
        : s
      : t("Not recorded", "درج نہیں");
  const admissions = (summary.data?.admissions || []).filter(
    (a) =>
      a.patient_id === ctx.patient.patient_id &&
      [
        "Admitted",
        "CodeRedActive",
        "DischargeInProgress",
        "AdmissionPending",
        "BedReserved",
        "Waitlisted",
      ].includes(a.status),
  );
  const applicable = (test: lab.LabTestListItemOut) =>
    test.is_active &&
    active.includes(
      test.availability === "SendOut" ? "outsourced_diagnostics" : "laboratory",
    );
  const requisition =
    detail.data &&
    !detail.loading &&
    !detail.error &&
    detail.data.patient_id === ctx.patient.patient_id
      ? detail.data
      : undefined;
  const study =
    image.data &&
    !image.loading &&
    !image.error &&
    image.data.patient_id === ctx.patient.patient_id
      ? image.data
      : undefined;
  async function fresh(permission: string, newKind?: "lab" | "imaging") {
    const [ticket, patient, me, est] = await Promise.all([
      api<emr.OpdTicketDetailOut>(
        "GET",
        `/opd-tickets/${ctx.ticket.ticket_id}`,
      ),
      api<any>("GET", `/patients/${ctx.patient.patient_id}`),
      api<any>("GET", "/auth/me"),
      api<any>("GET", "/establishment"),
    ]);
    if (
      readOnly ||
      !connected ||
      ticket.patient_id !== ctx.patient.patient_id ||
      patient.patient_id !== ctx.patient.patient_id ||
      patient.merged_into_id ||
      (newKind && patient.is_deceased) ||
      ticket.is_clinical_locked ||
      ticket.approval_lock !== "None" ||
      me.user_id !== user.user_id ||
      !me.permissions.includes(permission)
    )
      throw new Error(
        t(
          "The current patient, visit or permission changed. Refresh and review.",
          "موجودہ مریض، پرچی یا اجازت بدل گئی۔ تازہ کرکے چیک کریں۔",
        ),
      );
    if (newKind === "imaging" && !est.active.includes("imaging"))
      throw new Error(
        t(
          "Imaging is not active for new orders.",
          "نئے احکامات کے لیے عکس کی خدمت فعال نہیں۔",
        ),
      );
    if (
      admission &&
      (!admissions.some((a) => a.admission_id === Number(admission)) ||
        !(await emr.masterSummary(ctx.patient.patient_id)).admissions.some(
          (a) =>
            a.admission_id === Number(admission) &&
            a.patient_id === ctx.patient.patient_id &&
            !["Cancelled", "Discharged"].includes(a.status),
        ))
    )
      throw new Error(
        t(
          "The admission changed; choose the current eligible admission.",
          "داخلہ بدل گیا؛ موجودہ موزوں داخلہ چنیں۔",
        ),
      );
    return est;
  }
  const context = () =>
    admission
      ? { admission_id: Number(admission) }
      : { ticket_id: ctx.ticket.ticket_id };
  function orderLab() {
    setError(undefined);
    if (disabled || !can("lab.requisition.create")) return;
    if (
      !selectedTests.length ||
      selectedTests.length > 50 ||
      selectedTests.some(
        (id) => !tests.data?.some((v) => v.test_id === id && applicable(v)),
      )
    ) {
      setError(
        new Error(
          t(
            "Choose 1–50 currently available tests.",
            "موجودہ دستیاب1تا50ٹیسٹ چنیں۔",
          ),
        ),
      );
      return;
    }
    write.start(
      {
        method: "POST",
        path: "/lab/requisitions",
        body: {
          ...context(),
          test_ids: selectedTests,
          priority,
          clinical_notes: notes || null,
        } satisfies lab.RequisitionIn,
        permission: "lab.requisition.create",
        protection: "idempotent",
        label: t("Order laboratory tests", "لیب ٹیسٹ کا حکم"),
        reconcilePath: `/lab/requisitions?patient_id=${ctx.patient.patient_id}&limit=200`,
      },
      async () => {
        const est = await fresh("lab.requisition.create", "lab");
        const catalogue = await lab.listTests();
        for (const id of selectedTests) {
          const test = catalogue.find((v) => v.test_id === id);
          if (
            !test?.is_active ||
            !est.active.includes(
              test.availability === "SendOut"
                ? "outsourced_diagnostics"
                : "laboratory",
            )
          )
            throw new Error(
              t(
                "A selected test or service became unavailable; review the catalogue.",
                "منتخب ٹیسٹ یا خدمت دستیاب نہیں رہی؛ فہرست چیک کریں۔",
              ),
            );
        }
      },
    );
  }
  function orderImaging() {
    setError(undefined);
    if (disabled || !can("imaging.order.create")) return;
    if (
      !modality ||
      !bodyPart.trim() ||
      !indication.trim() ||
      !side ||
      (admission && (!transport || !escort))
    ) {
      setError(
        new Error(
          t(
            "Choose modality and side (or Not applicable), state the body part and indication; an inpatient needs transport and escort. A doctor accompanies special/interventional procedures.",
            "عکس کی قسم، سمت یا غیر متعلق، جسم کا حصہ اور وجہ لکھیں؛ داخل مریض کو نقل و حمل اور ساتھ جانے والا لازم۔ خاص یا مداخلتی عمل میں ڈاکٹر ساتھ جاتا ہے۔",
          ),
        ),
      );
      return;
    }
    if (!active.includes("imaging")) return;
    const body: lab.OrderIn = {
      ...context(),
      modality: modality as lab.OrderIn["modality"],
      body_part: bodyPart.trim(),
      clinical_indication: indication.trim(),
      service_id: service ? Number(service) : null,
      priority,
      laterality: side as lab.OrderIn["laterality"],
      transport: admission ? (transport as lab.OrderIn["transport"]) : null,
      escort: admission ? (escort as lab.OrderIn["escort"]) : null,
    };
    write.start(
      {
        method: "POST",
        path: "/imaging/orders",
        body,
        permission: "imaging.order.create",
        protection: "idempotent",
        label: t("Order imaging", "عکس کا حکم"),
        reconcilePath: `/imaging/orders?patient_id=${ctx.patient.patient_id}`,
      },
      async () => {
        await fresh("imaging.order.create", "imaging");
        if (
          service &&
          !(await getTariff()).categories.some(
            (c) =>
              c.category === "Imaging" &&
              c.items.some((i) => i.service_id === Number(service)),
          )
        )
          throw new Error(
            t(
              "The selected catalogue service changed. Refresh and select it again.",
              "منتخب خدمت بدل گئی۔ تازہ کرکے دوبارہ چنیں۔",
            ),
          );
      },
    );
  }
  function closeCancel() {
    if (write.blocked) return;
    if (
      actionDirty &&
      !window.confirm(
        t(
          "Discard the unsent cancellation reason?",
          "غیر ارسال منسوخی کی وجہ چھوڑ دیں؟",
        ),
      )
    )
      return;
    setCancel(false);
    setActionDirty(false);
  }
  function cancelOrder() {
    if (!requisition || disabled || !canCancel(requisition, user)) return;
    if (reason.trim().length < 3) {
      setError(
        new Error(
          t(
            "A cancellation reason of at least 3 characters is required.",
            "منسوخی کی کم از کم3حروف کی وجہ لازم ہے۔",
          ),
        ),
      );
      return;
    }
    const permission = can("lab.requisition.cancel_own")
      ? "lab.requisition.cancel_own"
      : "lab.requisition.cancel";
    write.start(
      {
        method: "POST",
        path: `/lab/requisitions/${requisition.requisition_id}/cancel`,
        body: { reason: reason.trim() },
        permission,
        protection: "idempotent",
        label: t("Cancel own unsampled order", "اپنا غیر نمونہ لیا آرڈر منسوخ"),
        reconcilePath: `/lab/requisitions/${requisition.requisition_id}`,
      },
      async () => {
        await fresh(permission);
        if (
          !canCancel(
            await lab.getRequisitionLabRequisitions(requisition.requisition_id),
            user,
          )
        )
          throw new Error(
            t(
              "A sample was collected or the order changed. Ask the laboratory to review it.",
              "نمونہ لیا گیا یا آرڈر بدل گیا۔ لیب سے چیک کرائیں۔",
            ),
          );
      },
    );
  }
  async function print(
    kind: "lab" | "imaging",
    id: number,
    pdf: boolean,
    server = false,
  ) {
    setError(undefined);
    setNotice("");
    try {
      const value = server
        ? await call<{ saved: boolean }>("clinical-pdf", {
            path: `/${kind === "lab" ? "lab/requisitions" : "imaging/orders"}/${id}/report/pdf`,
          })
        : await call<{ saved?: boolean; printed?: boolean }>(
            "print-diagnostic",
            { kind, id, pdf },
          );
      setNotice(
        value.saved
          ? t("PDF saved.", "پی ڈی ایف محفوظ ہوگئی۔")
          : "printed" in value && value.printed
            ? t("Print sent.", "پرنٹ بھیج دیا۔")
            : t(
                "Save cancelled; order and results are unchanged.",
                "محفوظ کرنا منسوخ؛ آرڈر و نتائج برقرار ہیں۔",
              ),
      );
    } catch (e) {
      setError(e);
    }
  }
  async function viewer(id: number) {
    setError(undefined);
    try {
      await call("pacs-viewer", { orderId: id });
    } catch (e) {
      setError(e);
    }
  }
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (
          e.type !== "event" ||
          e.payload?.patient_id !== ctx.patient.patient_id
        )
          return;
        if (e.event_type === "lab.result.provisional_withdrawn") {
          setWithdrawn((prev) => ({ ...prev, [e.payload.result_id]: true }));
          setWithdrawNotice(
            t(
              "A provisional result was withdrawn by the verifier. Do not act on it. Review the current verified result and contact the laboratory.",
              "عارضی نتیجہ تصدیق کرنے والے نے واپس لے لیا۔ اس پر عمل نہ کریں۔ موجودہ مصدقہ نتیجہ اور لیب سے چیک کریں۔",
            ),
          );
        }
        if (
          e.event_type === "imaging.study.available" &&
          Number.isSafeInteger(e.payload.imaging_order_id) &&
          e.payload.viewer_url &&
          !seenStudy.current.has(e.payload.imaging_order_id)
        ) {
          seenStudy.current.add(e.payload.imaging_order_id);
          void viewer(e.payload.imaging_order_id);
        }
      }),
    [ctx.patient.patient_id],
  );
  const visibleResults = (results.data || []).filter(
    (r) => allowedResult(r) && !withdrawn[r.result_id],
  );
  const visibleDetail = (requisition?.results || []).filter(
    (r) => allowedResult(r) && !withdrawn[r.result_id],
  );
  const critical =
    visibleResults.some((r) => r.has_critical_value) ||
    visibleDetail.some((r) => r.has_critical_value) ||
    !!study?.critical_result_id;
  const allMetricKeys = [
    ...new Set(
      visibleResults
        .filter((r) => r.status === "Published")
        .flatMap((r) => Object.keys(r.metrics)),
    ),
  ];
  const trendRows = metric
    ? visibleResults
        .filter(
          (r) =>
            r.status === "Published" &&
            r.published_at &&
            typeof r.metrics[metric] === "number" &&
            Number.isFinite(r.metrics[metric]),
        )
        .sort((a, b) => a.published_at!.localeCompare(b.published_at!))
    : [];
  const values = trendRows.map((r) => r.metrics[metric] as number),
    min = Math.min(...values),
    max = Math.max(...values);
  const points = trendRows
    .map(
      (r, i) =>
        `${30 + (i * 540) / Math.max(1, trendRows.length - 1)},${150 - (120 * ((r.metrics[metric] as number) - min)) / (max - min || 1)}`,
    )
    .join(" ");
  const ranges = (testId: number, key: string) => {
    const m = tests.data
      ?.find((v) => v.test_id === testId)
      ?.metric_schema.find((m) => m.key === key);
    return m
      ? `${m.unit || ""} · ${(m.ref?.[ctx.patient.gender || "default"] || m.ref?.default || []).join(" – ")}`
      : "";
  };
  return (
    <section data-write-pending={write.blocked ? "true" : "false"}>
      <ErrorBox error={error} verbatim />
      <p role="status">{notice}</p>
      {!cancel && <ClinicalWriteFeedback write={write} />}
      {withdrawNotice && (
        <p className="error critical-diagnostic" role="alert">
          {withdrawNotice}
        </p>
      )}
      {critical && (
        <aside className="error critical-diagnostic" role="alert">
          <strong>
            {t(
              "Critical result — contact the clinical team immediately",
              "انتہائی اہم نتیجہ — فوراً طبی عملے سے رابطہ کریں",
            )}
          </strong>
          <p>
            {t(
              "Review patient identity and current verified status. Acknowledge on Critical results; reading or printing here is not acknowledgement.",
              "شناخت اور موجودہ تصدیق چیک کریں۔ انتہائی اہم نتائج میں وصولی درج کریں؛ یہاں پڑھنا یا پرنٹ تصدیق نہیں۔",
            )}
          </p>
          {availableScreens.includes("critical_results") && (
            <button
              data-help="diagnostics.critical"
              disabled={write.blocked}
              onClick={() => onRoute("critical_results", ctx.ticket.ticket_id)}
            >
              {t("Open critical results", "انتہائی اہم نتائج کھولیں")}
            </button>
          )}
        </aside>
      )}
      <section className="card">
        <h2>{t("Order context", "آرڈر کی جگہ")}</h2>
        <LoadState {...summary} retry={summary.reload} />
        <Field label={t("Diagnostic care context", "ٹیسٹ کے علاج کی جگہ")}>
          <select data-field="admission_id"
            data-help="diagnostics.context"
            disabled={disabled}
            value={admission}
            onChange={(e) => {
              setAdmission(e.target.value);
              setDirty(true);
              setImagingDirty(true);
            }}
          >
            <option value="">{t("This OPD visit", "یہ بیرونی ملاقات")}</option>
            {admissions.map((a) => (
              <option key={a.admission_id} value={a.admission_id}>
                {a.admission_number} · {tr(a.status)} · {a.ward_name}{" "}
                {a.bed_label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Diagnostic priority", "ٹیسٹ کی ترجیح")}>
          <select data-field="priority"
            data-help="diagnostics.context"
            value={priority}
            disabled={disabled}
            onChange={(e) => {
              setPriority(e.target.value as typeof priority);
              setDirty(true);
              setImagingDirty(true);
            }}
          >
            {["Routine", "Urgent", "STAT"].map((p) => (
              <option key={p} value={p}>
                {tr(p)}
              </option>
            ))}
          </select>
        </Field>
        <p>
          {t(
            "OPD laboratory orders create an unpaid invoice for the cashier; inpatient orders go to the running bill. Laboratory staff do not take cash. Urgent/STAT uses emergency turnaround.",
            "بیرونی لیب آرڈر کی غیر ادا انوائس کیشیئر کو، داخل مریض کا خرچ جاری بل میں جاتا ہے۔ لیب عملہ نقد نہیں لیتا۔ فوری ترجیح ایمرجنسی مدت استعمال کرتی ہے۔",
          )}
        </p>
      </section>
      {can("lab.requisition.create") && (
        <section className="card" data-unsaved={dirty ? "true" : "false"}>
          <h2>{t("Order laboratory tests", "لیب ٹیسٹ تجویز کریں")}</h2>
          <fieldset disabled={disabled}>
            <Field label={t("Filter test catalogue", "ٹیسٹ کی فہرست میں تلاش")}>
              <input
                data-help="diagnostics.tests"
                value={testQ}
                onChange={(e) => setTestQ(e.target.value)}
                maxLength={100}
              />
            </Field>
            <LoadState {...tests} retry={tests.reload} />
            {!tests.loading &&
              !tests.error &&
              tests.data
                ?.filter((v) =>
                  `${v.code} ${v.name} ${v.section}`
                    .toLowerCase()
                    .includes(testQ.toLowerCase()),
                )
                .map((test) => (
                  <label className="card" key={test.test_id}>
                    <input
                      data-help="diagnostics.tests"
                      type="checkbox"
                      checked={selectedTests.includes(test.test_id)}
                      disabled={!applicable(test)}
                      onChange={(e) => {
                        setSelectedTests((prev) =>
                          e.target.checked
                            ? [...prev, test.test_id]
                            : prev.filter((id) => id !== test.test_id),
                        );
                        setDirty(true);
                      }}
                    />
                    <strong>
                      {test.code} · {test.name}
                    </strong>{" "}
                    · {test.sample_type} · {test.section}
                    <p>
                      {tr(test.availability)}{" "}
                      {test.send_out_partner_name &&
                        ` · ${test.send_out_partner_name}`}{" "}
                      · {t("Price", "قیمت")}:{" "}
                      {test.price ?? t("Not available", "دستیاب نہیں")} ·{" "}
                      {t(
                        "Routine / emergency turnaround (minutes)",
                        "عام / ایمرجنسی مدت (منٹ)",
                      )}
                      : {test.turnaround_minutes ?? "—"} /{" "}
                      {test.emergency_turnaround_minutes ?? "—"}
                    </p>
                    {!applicable(test) && (
                      <p>
                        {t(
                          "Not available for new orders: the test or its service is inactive.",
                          "نئے آرڈر کے لیے دستیاب نہیں: ٹیسٹ یا اس کی خدمت فعال نہیں۔",
                        )}
                      </p>
                    )}
                    {test.availability === "SendOut" && (
                      <p>
                        {t(
                          "Tell the patient this test goes to the named partner laboratory.",
                          "مریض کو بتائیں یہ ٹیسٹ بتائی ہوئی شراکت دار لیب جاتا ہے۔",
                        )}
                      </p>
                    )}
                  </label>
                ))}
            {!tests.loading &&
              !tests.error &&
              !tests.data?.some((v) =>
                `${v.code} ${v.name} ${v.section}`
                  .toLowerCase()
                  .includes(testQ.toLowerCase()),
              ) && (
                <Empty>
                  {t(
                    "No tests match. Clear the filter or ask the laboratory about its active catalogue.",
                    "ٹیسٹ نہیں ملا۔ تلاش صاف یا لیب سے فعال فہرست پوچھیں۔",
                  )}
                </Empty>
              )}
            <p>
              {t("Selected tests", "منتخب ٹیسٹ")}: {selectedTests.length} / 50
            </p>
            <Field label={t("Laboratory clinical notes", "لیب کی طبی معلومات")}>
              <textarea data-field="notes clinical_notes"
                data-help="diagnostics.tests"
                maxLength={2000}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <button
              data-help="diagnostics.order"
              disabled={!selectedTests.length || tests.loading || !!tests.error}
              onClick={orderLab}
            >
              {t("Order selected tests", "منتخب ٹیسٹ کا آرڈر")}
            </button>
          </fieldset>
        </section>
      )}
      {can("imaging.order.create") && (
        <section
          className="card"
          data-unsaved={imagingDirty ? "true" : "false"}
        >
          <h2>{t("Order imaging", "عکس کا آرڈر")}</h2>
          {!active.includes("imaging") && (
            <p>
              {t(
                "No new imaging from now on; existing orders and reports remain below.",
                "اب نئے عکس نہیں؛ سابقہ احکامات اور رپورٹس نیچے ہیں۔",
              )}
            </p>
          )}
          <fieldset
            disabled={disabled || !active.includes("imaging")}
            onChange={() => setImagingDirty(true)}
          >
            <Field label={t("Imaging modality", "عکس کی قسم")}>
              <select data-field="modality"
                data-help="diagnostics.imaging"
                value={modality}
                onChange={(e) => setModality(e.target.value)}
              >
                <option value="">{t("Choose modality", "قسم چنیں")}</option>
                {[
                  "XRay",
                  "MRI",
                  "CT",
                  "Ultrasound",
                  "Doppler",
                  "Mammography",
                  "Fluoroscopy",
                  "Other",
                ].map((v) => (
                  <option key={v} value={v}>
                    {tr(v)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Body part / examination", "جسم کا حصہ / معائنہ")}>
              <input data-field="body_part"
                data-help="diagnostics.imaging"
                value={bodyPart}
                maxLength={100}
                onChange={(e) => setBodyPart(e.target.value)}
              />
            </Field>
            <Field label={t("Clinical indication", "طبی وجہ")}>
              <textarea data-field="indication clinical_indication"
                data-help="diagnostics.imaging"
                value={indication}
                maxLength={2000}
                onChange={(e) => setIndication(e.target.value)}
              />
            </Field>
            <Field label={t("Laterality", "سمت")}>
              <select data-field="laterality"
                data-help="diagnostics.imaging"
                value={side}
                onChange={(e) => setSide(e.target.value)}
              >
                <option value="">
                  {t("Choose the side deliberately", "سمت خود چنیں")}
                </option>
                {["Left", "Right", "Bilateral", "NotApplicable"].map((v) => (
                  <option key={v} value={v}>
                    {tr(v)}
                  </option>
                ))}
              </select>
            </Field>
            <LoadState {...tariff} retry={tariff.reload} />
            <Field label={t("Catalogued imaging service", "فہرست کی عکس خدمت")}>
              <select data-field="service service_id"
                data-help="diagnostics.imaging"
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                <option value="">
                  {t(
                    "No catalogued billing service selected",
                    "بل کی فہرست کی خدمت منتخب نہیں",
                  )}
                </option>
                {tariff.data?.categories
                  .filter((c) => c.category === "Imaging")
                  .flatMap((c) => c.items)
                  .map((v) => (
                    <option key={v.service_id} value={v.service_id}>
                      {v.code} · {v.name} · {v.price}
                    </option>
                  ))}
              </select>
            </Field>
            {admission && (
              <>
                <Field label={t("Patient transport", "مریض کی نقل و حمل")}>
                  <select data-field="transport"
                    data-help="diagnostics.transport"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                  >
                    <option value="">
                      {t("Choose transport", "نقل و حمل چنیں")}
                    </option>
                    {[
                      "Walking",
                      "Wheelchair",
                      "Trolley",
                      "Bed",
                      "Portable",
                    ].map((v) => (
                      <option key={v} value={v}>
                        {tr(v)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Escort", "ساتھ جانے والا")}>
                  <select data-field="escort"
                    data-help="diagnostics.transport"
                    value={escort}
                    onChange={(e) => setEscort(e.target.value)}
                  >
                    <option value="">
                      {t("Choose escort", "ساتھ جانے والا چنیں")}
                    </option>
                    {["None", "Nurse", "Doctor"].map((v) => (
                      <option key={v} value={v}>
                        {tr(v)}
                      </option>
                    ))}
                  </select>
                </Field>
                <p>
                  {t(
                    "Special and interventional examinations require a doctor escort. Coordinate safe transfer with the ward and radiology.",
                    "خاص اور مداخلتی معائنے میں ڈاکٹر ساتھ جاتا ہے۔ وارڈ و شعبہ عکس سے محفوظ منتقلی طے کریں۔",
                  )}
                </p>
              </>
            )}
            <button data-help="diagnostics.order" onClick={orderImaging}>
              {t("Create imaging order", "عکس کا آرڈر بنائیں")}
            </button>
          </fieldset>
        </section>
      )}
      <section className="card">
        <h2>{t("Laboratory orders — latest 200", "لیب احکامات — آخری200")}</h2>
        <LoadState {...orders} retry={orders.reload} />
        {!orders.loading &&
          !orders.error &&
          orders.data?.map((r) => (
            <p key={r.requisition_id}>
              <button
                data-help="diagnostics.history"
                disabled={write.blocked}
                onClick={() => setLabId(r.requisition_id)}
              >
                {r.requisition_number} · {tr(r.status)} · {tr(r.priority)} ·{" "}
                {r.published}/{r.tests} · {format(r.ordered_at)}
              </button>
            </p>
          ))}
        {!orders.loading && !orders.error && !orders.data?.length && (
          <Empty>
            {t(
              "No laboratory orders for this patient.",
              "اس مریض کے لیب احکامات نہیں۔",
            )}
          </Empty>
        )}
        <LoadState {...detail} retry={detail.reload} />
        {requisition && (
          <article>
            <h3>
              {requisition.requisition_number} · {tr(requisition.status)}
            </h3>
            <p>
              {requisition.patient_name} · <bdi>{requisition.mrn}</bdi> ·{" "}
              {requisition.doctor_name} · {format(requisition.ordered_at)}
            </p>
            <p>
              {requisition.clinical_notes} · {requisition.cancel_reason}
            </p>
            {requisition.items.map((i) => (
              <article key={i.lab_requisition_item_id}>
                <strong>
                  {i.code} · {i.test_name} · {tr(i.status)}
                </strong>
                <p>
                  {t("Sample", "نمونہ")}: <bdi>{i.barcode}</bdi> ·{" "}
                  {tr(i.sample_status || "Not recorded")} ·{" "}
                  {format(i.collected_at)} · {t("Result due", "نتیجے کی مدت")}:{" "}
                  {format(i.due_at)}
                </p>
                {i.is_send_out && (
                  <p>
                    {t("Sent to partner laboratory", "شراکت دار لیب بھیجا گیا")}
                    : {i.partner_name}
                  </p>
                )}
                {i.sample_status === "Rejected" && (
                  <p className="error">
                    {t(
                      "Sample rejected — a new sample is required. Coordinate with laboratory staff.",
                      "نمونہ مسترد — نیا نمونہ لازم ہے۔ لیب عملے سے رابطہ کریں۔",
                    )}
                  </p>
                )}
              </article>
            ))}
            {visibleDetail.map((r) => (
              <article
                key={r.result_id}
                className={r.has_critical_value ? "error" : ""}
              >
                <h4>
                  {
                    requisition.items.find(
                      (i) =>
                        i.lab_requisition_item_id === r.lab_requisition_item_id,
                    )?.test_name
                  }
                </h4>
                <strong>
                  {r.status === "PendingVerification"
                    ? t(
                        "Pending verification — unverified critical value; do not print",
                        "تصدیق باقی — غیر مصدقہ انتہائی اہم نتیجہ؛ پرنٹ نہ کریں",
                      )
                    : t("Published result", "جاری شدہ نتیجہ")}
                </strong>
                  {Object.entries(r.metrics_jsonb).map(([key,value])=>{
                    const testId=requisition.items.find(i=>i.lab_requisition_item_id===r.lab_requisition_item_id)?.test_id;
                    const label=tests.data?.find(v=>v.test_id===testId)?.metric_schema.find(m=>m.key===key)?.label||key;
                    return <p key={key}>{label}: <bdi>{typeof value==='object'?JSON.stringify(value):String(value)}</bdi> · {r.flags_jsonb[key]} · {testId?ranges(testId,key):''}</p>
                  })}
                <p>{r.interpretation}</p>
                <p>{r.performed_stamp.text}</p>
                <p>{r.verified_stamp?.text}</p>
                {r.is_correction && (
                  <p>
                    {t("Amended result; reason", "تصحیح شدہ نتیجہ؛ وجہ")}:{" "}
                    {r.correction_reason}
                  </p>
                )}
              </article>
            ))}
            {requisition.invoice && (
              <p>
                {t("Invoice / billing status", "انوائس / بل کی حالت")}:{" "}
                {requisition.invoice.invoice_no} ·{" "}
                {tr(requisition.invoice.status)} · {t("Balance", "بقایا")}:{" "}
                {requisition.invoice.balance_due}
              </p>
            )}
            {canCancel(requisition, user) && (
              <button
                data-help="diagnostics.cancel"
                disabled={disabled}
                onClick={() => {
                  setCancel(true);
                  setReason("");
                  setActionDirty(false);
                }}
              >
                {t(
                  "Cancel own unsampled order",
                  "اپنا غیر نمونہ لیا آرڈر منسوخ کریں",
                )}
              </button>
            )}
            {visibleDetail.some((r) => r.status === "Published") && (
              <>
                <p>
                  {t(
                    "Only published tests print. A report can be partial; provisional values are excluded.",
                    "صرف جاری شدہ ٹیسٹ پرنٹ ہیں۔ رپورٹ جزوی ہو سکتی ہے؛ عارضی نتائج شامل نہیں۔",
                  )}
                </p>
                <button
                  data-help="diagnostics.print"
                  onClick={() =>
                    void print("lab", requisition.requisition_id, false)
                  }
                >
                  {t("Print lab report", "لیب رپورٹ پرنٹ کریں")}
                </button>
                <button
                  data-help="diagnostics.print"
                  onClick={() =>
                    void print("lab", requisition.requisition_id, true)
                  }
                >
                  {t("Save lab report PDF", "لیب رپورٹ پی ڈی ایف محفوظ کریں")}
                </button>
                <button
                  data-help="diagnostics.print"
                  onClick={() =>
                    void print("lab", requisition.requisition_id, true, true)
                  }
                >
                  {t("Download official lab PDF", "اصل لیب پی ڈی ایف لیں")}
                </button>
              </>
            )}
          </article>
        )}
      </section>
      <section className="card">
        <h2>{t("Published results and trends", "جاری نتائج اور رجحان")}</h2>
        <Field label={t("Trend test", "رجحان کا ٹیسٹ")}>
          <select
            data-help="diagnostics.trends"
            value={trend}
            onChange={(e) => {
              setTrend(e.target.value);
              setMetric("");
            }}
          >
            <option value="">{t("All test results", "تمام ٹیسٹ نتائج")}</option>
            {tests.data?.map((v) => (
              <option key={v.test_id} value={v.test_id}>
                {v.code} · {v.name}
              </option>
            ))}
          </select>
        </Field>
        <LoadState {...results} retry={results.reload} />
        {!results.loading &&
          !results.error &&
          visibleResults.map((r) => (
            <article
              className={r.has_critical_value ? "error" : ""}
              key={r.result_id}
            >
              <h3>
                {r.code} · {r.test_name} · {r.requisition_number}
              </h3>
              {r.status === "PendingVerification" && (
                <strong>
                  {t(
                    "Pending verification — do not print",
                    "تصدیق باقی — پرنٹ نہ کریں",
                  )}
                </strong>
              )}
              <p>
                {format(r.published_at)} · {r.interpretation}
              </p>
              {Object.entries(r.metrics).map(([key, value]) => (
                <p key={key}>
                  {key}:{" "}
                  <bdi>
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </bdi>{" "}
                  · {r.flags[key]} · {ranges(r.test_id, key)}
                </p>
              ))}
              <p>{r.verified_stamp?.text}</p>
            </article>
          ))}
        {!results.loading && !results.error && !visibleResults.length && (
          <Empty>
            {t(
              "No published or provisionally released results. Unverified routine results are not shown.",
              "جاری یا عارضی جاری نتائج نہیں۔ عام غیر مصدقہ نتائج نہیں دکھائے جاتے۔",
            )}
          </Empty>
        )}
        {trend && (
          <>
            <Field label={t("Trend metric", "رجحان کی پیمائش")}>
              <select
                data-help="diagnostics.trends"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                <option value="">
                  {t("Choose an actual metric", "اصل پیمائش چنیں")}
                </option>
                {allMetricKeys.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            {metric && trendRows.length >= 2 && (
              <svg
                role="img"
                aria-label={t(
                  "Published numeric values in chronological order; exact values and dates follow",
                  "مصدقہ اعداد وقت کی ترتیب میں؛ اصل قدر اور تاریخ نیچے ہیں",
                )}
                viewBox="0 0 600 190"
              >
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  points={points}
                />
                <text x="5" y="15" fill="currentColor">
                  {max}
                </text>
                <text x="5" y="180" fill="currentColor">
                  {min}
                </text>
              </svg>
            )}
            {metric && (
              <>
                <p>
                  {t(
                    "Published numeric values only; text and provisional values are excluded. No interpretation or clinical threshold is invented.",
                    "صرف مصدقہ عدد؛ متن اور عارضی قدر شامل نہیں۔ تشریح یا طبی حد فرض نہیں کی جاتی۔",
                  )}
                </p>
                {trendRows.map((r) => (
                  <p key={r.result_id}>
                    {format(r.published_at)} ·{" "}
                    <bdi>{String(r.metrics[metric])}</bdi> · {r.flags[metric]} ·{" "}
                    {ranges(r.test_id, metric)}
                  </p>
                ))}
                {!trendRows.length && (
                  <p>
                    {t(
                      "No published numeric values for this metric.",
                      "اس پیمائش کی مصدقہ عددی قدریں نہیں۔",
                    )}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </section>
      <section className="card">
        <h2>{t("Imaging orders and reports", "عکس کے احکامات اور رپورٹس")}</h2>
        <LoadState {...images} retry={images.reload} />
        {!images.loading &&
          !images.error &&
          images.data?.map((i) => (
            <p key={i.imaging_order_id}>
              <button
                data-help="diagnostics.history"
                disabled={write.blocked}
                onClick={() => setImageId(i.imaging_order_id)}
              >
                {i.order_number} · {tr(i.modality)} · {i.body_part} ·{" "}
                {tr(i.status)}
              </button>
            </p>
          ))}
        {!images.loading && !images.error && !images.data?.length && (
          <Empty>
            {t(
              "No imaging orders for this patient.",
              "اس مریض کے عکس احکامات نہیں۔",
            )}
          </Empty>
        )}
        <LoadState {...image} retry={image.reload} />
        {study && (
          <article>
            <h3>
              {study.order_number} · {tr(study.status)}
            </h3>
            <p>
              {study.patient_name} ·{" "}
              <bdi>
                {study.mrn} · {study.accession_number}
              </bdi>
            </p>
            <p>
              {tr(study.modality)} · {study.body_part} ·{" "}
              {tr(study.laterality || "Not recorded")} · {tr(study.priority)}
            </p>
            <p>{study.clinical_indication}</p>
            <p>
              {tr(study.transport || "Not recorded")} ·{" "}
              {tr(study.escort || "Not recorded")} ·{" "}
              {t("Examination due / report due", "معائنے / رپورٹ کی مدت")}:{" "}
              {format(study.perform_due_at)} / {format(study.report_due_at)}
            </p>
            {study.partner_name && (
              <p>
                {t("Outside diagnostic partner", "بیرونی تشخیصی مرکز")}:{" "}
                {study.partner_name} · {study.external_reporter}
              </p>
            )}
            {study.status === "Reported" && (
              <>
                <p>{study.report_text}</p>
                <p>{study.reported_stamp?.text}</p>
                <button
                  data-help="diagnostics.print"
                  onClick={() =>
                    void print("imaging", study.imaging_order_id, false)
                  }
                >
                  {t("Print imaging report", "عکس رپورٹ پرنٹ کریں")}
                </button>
                <button
                  data-help="diagnostics.print"
                  onClick={() =>
                    void print("imaging", study.imaging_order_id, true)
                  }
                >
                  {t(
                    "Save imaging report PDF",
                    "عکس رپورٹ پی ڈی ایف محفوظ کریں",
                  )}
                </button>
                <button
                  data-help="diagnostics.print"
                  onClick={() =>
                    void print("imaging", study.imaging_order_id, true, true)
                  }
                >
                  {t("Download official imaging PDF", "اصل عکس پی ڈی ایف لیں")}
                </button>
              </>
            )}
            {study.viewer_url ? (
              <button
                data-help="diagnostics.viewer"
                onClick={() => void viewer(study.imaging_order_id)}
              >
                {t("Open PACS viewer", "عکس کا ویور کھولیں")}
              </button>
            ) : (
              <p>
                {t(
                  "PACS viewer is not available for this study. A linked-study event without a URL does not invent a viewer link.",
                  "اس معائنے کا ویور دستیاب نہیں۔ بغیر پتے کے واقعے پر فرضی ربط نہیں بنتا۔",
                )}
              </p>
            )}
          </article>
        )}
      </section>
      {cancel && requisition && (
        <Modal
          title={t(
            "Cancel own unsampled laboratory order",
            "اپنا غیر نمونہ لیا لیب آرڈر منسوخ",
          )}
          onClose={closeCancel}
          closable={!write.blocked}
        >
          <p>
            {ctx.patient.full_name} ·{" "}
            <bdi>
              {ctx.patient.mrn} · {requisition.requisition_number}
            </bdi>
          </p>
          <section data-unsaved={actionDirty ? "true" : "false"}>
            <fieldset disabled={disabled}>
              <Field
                label={t("Laboratory cancellation reason", "لیب منسوخی کی وجہ")}
              >
                <textarea data-field="reason"
                  data-help="diagnostics.cancel"
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setActionDirty(true);
                  }}
                />
              </Field>
              <button data-help="diagnostics.cancel" onClick={cancelOrder}>
                {t("Confirm laboratory cancellation", "لیب منسوخی کی تصدیق")}
              </button>
              <button data-help="diagnostics.cancel" onClick={closeCancel}>
                {t("Cancel", "منسوخ")}
              </button>
            </fieldset>
            <ErrorBox error={error} verbatim />
            <ClinicalWriteFeedback write={write} />
          </section>
        </Modal>
      )}
    </section>
  );
}
