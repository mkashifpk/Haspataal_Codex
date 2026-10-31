import { MedicationAdministration } from './screens/MedicationAdministration';
import { VerbalOrders } from './screens/VerbalOrders';
import { VitalsFlowsheet } from './screens/VitalsFlowsheet';
import { DoctorInpatients } from './screens/DoctorInpatients';
import { MedicationOrdersDoctor } from './screens/MedicationOrdersDoctor';
import { CostEstimates } from './screens/CostEstimates';
import { useCallback, useEffect, useRef, useState } from "react";
import { api, call, resetRequests } from "./bridge";
import type { MeOut, LicenseStatusOut, HealthOut } from "./generated/login";
import type { EstablishmentOut } from "./generated/facility_profile";
import type { HandbookOut } from "./generated/help_center";
import { Details, ErrorBox, Field, Modal, useLoad } from "./components";
import { Connection } from "./screens/Connection";
import { Login, ChangePassword } from "./screens/Login";
import { Settings, TerminalIdentity } from "./screens/Settings";
import {
  CriticalNotificationToast,
  Notifications,
} from "./screens/Notifications";
import { Approvals } from "./screens/Approvals";
import { Facility } from "./screens/Facility";
import { Incidents } from "./screens/Incidents";
import { CashShift } from "./screens/CashShift";
import { PatientSearch } from "./screens/PatientSearch";
import { Registration } from "./screens/Registration";
import { QueueManagement } from "./screens/QueueManagement";
import { RefundRequests } from "./screens/RefundRequests";
import { CashBack } from "./screens/CashBack";
import { PatientDocuments } from "./screens/PatientDocuments";
import { Tariff } from "./screens/Tariff";
import { Receivables } from "./screens/Receivables";
import { DoctorQueue } from "./screens/DoctorQueue";
import { ICDPicker } from "./screens/ICDPicker";
import { Consultation } from "./screens/Consultation";
import { EPrescription } from "./screens/EPrescription";
import { LabOrdersResults } from "./screens/LabOrdersResults";
import { LabOnlyWalkIn } from './screens/LabOnlyWalkIn';
import { LabSendOuts } from './screens/LabSendOuts';
import { ImagingQualitySetup } from './screens/ImagingQualitySetup';
import { DiagnosticServicesList } from './screens/DiagnosticServicesList';
import { LabBench } from './screens/LabBench';
import { ImagingRepeats } from './screens/ImagingRepeats';
import { ConsentsAdmissions } from './screens/ConsentsAdmissions';
import { BloodSources } from './screens/BloodSources';
import { BloodRequest } from './screens/BloodRequest';
import { BloodBank } from './screens/BloodBank';
import { BloodDonors } from './screens/BloodDonors';
import { DonorAssessment } from './screens/DonorAssessment';
import { BloodCollection } from './screens/BloodCollection';
import { BloodCenterLab } from './screens/BloodCenterLab';
import { BloodCenterRelease } from './screens/BloodCenterRelease';
import { TransfusionBedside } from './screens/TransfusionBedside';
import { MaternityPolicy } from './screens/MaternityPolicy';
import { ObstetricAssessment } from './screens/ObstetricAssessment';
import { NewbornRegistration } from './screens/NewbornRegistration';
import { LabourRegister } from './screens/LabourRegister';
import { MedicationSafetyWard } from './screens/MedicationSafetyWard';
import { WardTransfer } from './screens/WardTransfer';
import { WardTransferHeadNurse } from './screens/WardTransferHeadNurse';
import { WardIndent } from './screens/WardIndent';
import { DischargeSummary } from './screens/DischargeSummary';
import { TriageScale } from './screens/TriageScale';
import { ERBoard } from './screens/ERBoard';
import { ERBoardDoctor } from './screens/ERBoardDoctor';
import { ERVisit } from './screens/ERVisit';
import { CodeRed } from './screens/CodeRed';
import { TraumaMerge } from './screens/TraumaMerge';
import { Wristbands } from './screens/Wristbands';
import { OwnMedicinesWard } from './screens/OwnMedicinesWard';
import { OwnMedicinesPharmacy } from './screens/OwnMedicinesPharmacy';
import { BedMatrix } from './screens/BedMatrix';
import { MyBeds } from './screens/MyBeds';
import { WardEducation } from './screens/WardEducation';
import { NursingAssessment } from './screens/NursingAssessment';
import { PendingAdmissions } from './screens/PendingAdmissions';
import { RollCall } from './screens/RollCall';
import { DutyRoster } from './screens/DutyRoster';
import { ImagingOutsourced } from './screens/ImagingOutsourced';
import { RadiologyWorklist } from './screens/RadiologyWorklist';
import { LabVerification } from './screens/LabVerification';
import { CriticalResultsDoctor, DoctorCriticalAlert } from './screens/CriticalResultsDoctor';
import { CriticalResultsBench } from './screens/CriticalResultsBench';
import { CriticalResultsWard } from './screens/CriticalResultsWard';
import { ExternalReferral } from "./screens/ExternalReferral";
import { ReferralRegister } from "./screens/ReferralRegister";
import { PatientEducation } from "./screens/PatientEducation";
import { HomeVisitRecord } from "./screens/HomeVisitRecord";
import { PatientProgrammes } from "./screens/PatientProgrammes";
import { PrescriptionQueue } from "./screens/PrescriptionQueue";
import { Dispense } from "./screens/Dispense";
import { OrderQueries } from "./screens/OrderQueries";
import { OTCMode } from "./screens/OTCMode";
import { CharityOverride } from "./screens/CharityOverride";
import type {CharityHandoff} from "./charity-policy";
import { Help } from "./screens/Help";
import { setLanguage, tr } from "./i18n";
import { hasUnsavedChanges } from "./unsaved";
import { createMetadataFlight } from "./metadata-flight";
import { createBootstrapSeed } from "./bootstrap-seed";
type WorkspaceSnapshot = {establishment:EstablishmentOut;settings:any;me:MeOut;permittedWorkspaces:MeOut["workspaces"]};
const labels: Record<string, [string, string, string]> = {
 patient_education_ward: ["Ward health education","وارڈ میں صحت کی رہنمائی","◉"],
 mar: ["Medication administration record","دوا دینے کا ریکارڈ","▤"],
 verbal_orders_ward: ["Verbal and telephone orders","زبانی اور ٹیلی فون احکام","▤"],
 verbal_orders_er: ["Emergency Department Verbal and Telephone Orders", "ایمرجنسی ڈیپارٹمنٹ کے زبانی اور ٹیلی فون احکام", "▤"],
 vitals_tracker: ["Vitals flowsheet","حیاتیاتی پیمائش کا چارٹ","▤"],
 nursing_assessment: ["Nursing assessment and care plan","نرسنگ جائزہ و نگہداشت منصوبہ","▤"],
 my_beds: ["My beds this shift","اس شفٹ میں میرے بستر","▤"],
 doctor_inpatients: ["Inpatient rounds & discharge","داخل مریضوں کا معائنہ و ڈسچارج","▤"],
 explain_estimate: ["Explain a cost estimate","تخمینہ سمجھائیں","₨"],
 cost_estimates_billing: ["Cost estimates","متوقع اخراجات","₨"],
 cost_estimates_admissions: ["Cost estimates","متوقع اخراجات","₨"],
 consents_admissions: ["General consent at admission","داخلے پر عمومی رضامندی","▤"],
 consents_ward: ["Consents of my patients","میرے مریضوں کی رضامندی","▤"],
 consents_doctor: ["Consents: informed consent and refusal","رضامندی: باخبر رضامندی اور انکار","▤"],
 consents_triage: ["Consents in emergency department","ایمرجنسی میں رضامندیاں","📋"],
 er_board_doctor: ["ER board", "ایمرجنسی بورڈ", "🚨"],
 blood_sources: ["Licensed blood sources","مجاز بلڈ سنٹرز و ذرائع","🩸"],
 blood_request: ["Request blood","خون کی درخواست","🩸"],
 blood_bank: ["Blood bank","بلڈ بینک","🩸"],
 blood_donors: ["Blood donors","خون کے عطیہ دہندگان","🩸"],
 donor_assessment: ["Donor assessment","عطیہ دہندہ کا معائنہ","🩸"],
 blood_collection: ["Blood collection","خون کا حصول","💉"],
 blood_center_lab: ["Blood center laboratory","بلڈ سنٹر لیبارٹری","🧪"],
 wristbands_admissions: ["Identity wristbands","شناختی پٹیاں","▤"],
 wristbands_ward: ["Identity wristbands","شناختی پٹیاں","▤"],
 own_medicines_ward: ["Patient's own medicines","مریض کی اپنی ادویات","▤"],
 own_medicines_pharmacy: ["Identify patients' own medicines","مریض کی ادویات کی شناخت","Rx"],
  bed_matrix: ["Live bed matrix", "بستروں کی تازہ صورت حال", "▦"],
  roll_call: ["Roll call", "حاضری کی فہرست", "☑"],
  pending_admissions: ["Pending admissions & allocation", "منتظر داخلے اور بستر کی تعیناتی", "▤"],
  duty_roster: ["Nursing duty roster", "نرسنگ ڈیوٹی روسٹر", "▦"],
  imaging_repeats: ["Repeated images register","دوبارہ عکس کا رجسٹر","▤"],
  imaging_outsourced: ["Outsourced examinations","بیرونی مرکز کے معائنے","↗"],
  radiology_worklist: ["Imaging worklist", "عکس نگاری کی فہرست", "▤"],
  charity_override: ["Zakat / charity override", "زکوٰۃ / فلاحی امداد", "₨"],
  otc: ["OTC mode", "بغیر نسخہ فروخت", "Rx"],
  order_queries: ["Order queries", "حکم کے سوالات", "?"],
  dispense: ["Dispense", "دوا فراہم کریں", "Rx"],
  rx_queue: ["Prescription queue", "نسخوں کی قطار", "Rx"],
  home_visit_record: ["Record a home visit", "گھر کے دورے کا اندراج", "⌂"],
  patient_programmes: ["Preventive programmes of a patient", "مریض کے حفاظتی پروگرام", "◷"],
  patient_education: ["Health education given", "دی گئی صحت کی رہنمائی", "◉"],
  referral_register: ["Referral register", "حوالہ رجسٹر", "▤"],
  external_referral: ["Refer out (external referral)", "بیرونی مرکز کو حوالہ", "↗"],
  lab_orders_results: ["Lab & imaging orders + results", "لیب و عکس کے احکامات اور نتائج", "⌁"],
  eprescription: ["E-prescription builder", "دوائی کا نسخہ", "Rx"],
  consultation: ["Consultation (EMR)", "معائنہ (طبی ریکارڈ)", "▤"],
  icd_picker: ["ICD code picker", "تشخیصی کوڈ کا انتخاب", "⌕"],
  doctor_queue: ["My live queue", "میری جاری قطار", "≡"],
  app_shell: ["Workspace home", "کام کی جگہ", "⌂"],
  workspace_picker: ["Workspaces", "کام کی جگہیں", "▦"],
  notifications: ["Notifications", "اطلاعات", "◷"],
  approval_queue: ["Approvals", "منظوریاں", "✓"],
  charity_approvals: ["Charity approvals", "فلاحی منظوری", "♡"],
  my_cash_shift: ["My cash shift", "میری کیش شفٹ", "₨"],
  lab_only_walkin: ['Lab-only walk-in','صرف لیب کے لیے آمد','⚗'],
  lab_verification: ['Verification queue','تصدیق کی قطار','✓'],
  imaging_quality_setup: ['Imaging turnaround, critical findings and policy','عکس نگاری کی مدت، اہم نتائج اور پالیسی','⚙'],
  diagnostic_services_list: ['Diagnostic services list','تشخیصی خدمات کی فہرست','▤'],
  lab_send_outs: ['Samples sent to partner laboratories','شراکت دار لیب کو بھیجے گئے نمونے','↗'],
  lab_bench: ['Scanner-first lab bench','اسکینر سے لیب بنچ','⚗'],
  critical_results_doctor: ['Critical results to acknowledge','تسلیم کرنے والے اہم نتائج','!'],
  critical_results_radiology: ["Critical results to tell","فوری بتانے والے اہم نتائج","!"],
  critical_results_verifier: ['Critical results to tell','فوری بتانے والے اہم نتائج','!'],
  critical_results_bench: ['Critical results to tell','فوری بتانے والے اہم نتائج','!'],
  critical_results_ward: ["Critical results of my patients","میرے مریضوں کے ہنگامی نتائج","!"],
  critical_results_er: ["Emergency Department Critical Communication", "ایمرجنسی شعبے میں تشویشناک نتائج کی اطلاع", "!"],
  queue_management: ["Queue management", "قطاروں کا انتظام", "≡"],
  refund_waiver_credit: [
    "Refund / waiver / credit",
    "واپسی، رعایت اور ادھار",
    "↩",
  ],
  cash_back_prompts: ["Cash-back", "رقم کی واپسی", "₨"],
  patient_search: ["Patient search", "مریض کی تلاش", "⌕"],
  patient_documents: ["Patient document vault", "مریض کی دستاویزات", "▤"],
  tariff_display: ["Tariff", "نرخ نامہ", "₨"],
  receivables: [
    "Outstanding dues (Udhaar)",
    "بقایا جات (ادھار)",
    "₨",
  ],
  registration: [
    "New registration + OPD slip",
    "نئی رجسٹریشن اور او پی ڈی پرچی",
    "+",
  ],
  report_incident: ["Report an incident", "واقعے کی رپورٹ", "!"],
  facility_profile: ["Facility & services", "ہسپتال اور خدمات", "▤"],
  settings: ["Settings", "ترتیبات", "⚙"],
};
const frontDeskScreens = new Set([
  'roll_call',
  'cost_estimates_billing',
  'explain_estimate',
  'patient_education_ward',
  'mar',
  'verbal_orders_ward',
  'verbal_orders_er',
  'vitals_tracker',
  'nursing_assessment',
  'my_beds',
  'doctor_inpatients',
  'cost_estimates_admissions',
  'consents_admissions',
  'wristbands_admissions',
  'wristbands_ward',
  'own_medicines_ward',
  'own_medicines_pharmacy',
  'critical_results_ward',
  'critical_results_er',
  'consents_triage',
  'er_board_doctor',
  'consents_ward',
  'consents_doctor',
  'blood_sources',
  'blood_request',
  'blood_bank',
  'blood_donors',
  'donor_assessment',
  'blood_collection',
  'blood_center_lab',
  'bed_matrix',
  'pending_admissions',
  'duty_roster',
  'imaging_repeats',
  'imaging_outsourced',
  'radiology_worklist',
  'imaging_quality_setup',
  'diagnostic_services_list',
  'critical_results_doctor',
  'critical_results_radiology',
  'critical_results_bench',
  'critical_results_verifier',
  'lab_only_walkin',
  'lab_verification',
  'lab_bench',
  'lab_send_outs',
  "charity_override",
  "otc",
  "order_queries",
  "dispense",
  "rx_queue",
  // Navigation and contextual help must share the active workspace's server scope.
  "patient_search",
  "my_cash_shift",
  "registration",
  "home_visit_record",
  "patient_programmes",
  "patient_education",
  "referral_register",
  "external_referral",
  "lab_orders_results",
  "eprescription",
  "consultation",
  "icd_picker",
  "doctor_queue",
  "queue_management",
  "refund_waiver_credit",
  "cash_back_prompts",
  "patient_documents",
  "tariff_display",
  "receivables",
]);
export function App() {
  const [charitySelection,setCharitySelection]=useState<{userId:number;prescriptionId:number}>();
  const [querySelection,setQuerySelection]=useState<{userId:number;prescriptionId:number;itemId?:number|null}>();
  const [pharmacySelection,setPharmacySelection]=useState<{userId:number;prescriptionId:number;assistance?:CharityHandoff}>();
  const [clinicalSelection,setClinicalSelection]=useState<{userId:number;ticketId:number}>();
  const [user, setUser] = useState<MeOut | null>(null),
    [server, setServer] = useState<any>(),
    [connected, setConnected] = useState(false),
    [prefs, setPrefs] = useState<any>({
      language: "en",
      theme: "Light",
      ui_scale_pct: 100,
      pdf_download: "Separate",
    }),
    [workspace, setWorkspace] = useState<string | null>(null),
    [screen, setScreen] = useState("connect_server"),
    [license, setLicense] = useState<LicenseStatusOut>(),
    [loginHealth, setLoginHealth] = useState<HealthOut>(),
    [healthError, setHealthError] = useState<unknown>(),
    [est, setEst] = useState<EstablishmentOut>(),
    [outline, setOutline] = useState<HandbookOut>(),
    [meta, setMeta] = useState<any>(),
    [unread, setUnread] = useState<number>(),
    [revision, setRevision] = useState(0),
    [stream, setStream] = useState("Connecting"),
    [error, setError] = useState<unknown>(),
    [helpOpen, setHelpOpen] = useState(false),
    [helpPage, setHelpPage] = useState<string>(),
    [infoOpen, setInfoOpen] = useState(false),
    [logoutOpen, setLogoutOpen] = useState(false),
    [logoutBusy, setLogoutBusy] = useState(false),
    [maintenance, setMaintenance] = useState<any>(),
    [critical, setCritical] = useState<any>(),
    [criticalNotices, setCriticalNotices] = useState<any[]>([]),
    [notice, setNotice] = useState(""),
    [booting, setBooting] = useState(true),
    [clock, setClock] = useState(Date.now());
  const [sessionRecovery, setSessionRecovery] = useState<string | null>(null),
    [sessionPassword, setSessionPassword] = useState(""),
    [sessionBusy, setSessionBusy] = useState(false),
    [sessionError, setSessionError] = useState<unknown>();
  const reauthFlight = useRef(false);
  const [metadataFlight] = useState(createMetadataFlight);
  const metadataEpoch = useRef(0);
  const [bootstrapSeed] = useState(() => createBootstrapSeed<WorkspaceSnapshot>());
  const catalogueEpoch = useRef<number | undefined>(undefined);
  const [referenceError, setReferenceError] = useState<unknown>();
  const [readyContext, setReadyContext] = useState<{userId:number;workspace:string|null;epoch:number}>();
  const logoutFlight = useRef(false);
  const first = useRef(true),
    loaded = useRef(false),
    liveState = useRef({ user, workspace, screen });
  liveState.current = { user, workspace, screen };
  const ur = prefs.language === "ur";
  setLanguage(prefs.language);
  const t = (en: string, urText: string) => (ur ? urText : en);
  const refreshState = useCallback(async () => {
    try {
      const s = await call("state");
      setServer(s.server);
      setConnected(s.connected);
      setUser(s.user);
      setWorkspace(s.workspace);
      setPrefs(s.prefs);
      setSessionRecovery(s.sessionRecovery || null);
      if (first.current) {
        first.current = false;
        setScreen(
          !s.server
            ? "connect_server"
            : s.user
              ? s.workspace
                ? "app_shell"
                : "workspace_picker"
              : "login",
        );
      }
    } catch (e) {
      setError(e);
    } finally {
      setBooting(false);
    }
  }, []);
  const refreshReferences = useCallback((userId: number, epoch: number) => {
    const current = () => metadataEpoch.current === epoch && liveState.current.user?.user_id === userId;
    return metadataFlight(`references:${epoch}:${userId}`, async () => {
      try {
        const [count] = await Promise.all([
          api<{unread:number}>("GET", "/notifications/unread-count"),
          ...(catalogueEpoch.current !== epoch ? [Promise.all([
            api("GET", "/meta/enums"), api("GET", "/meta/workspaces"),
            api("GET", "/meta/error-codes"), api("GET", "/meta/events"),
          ])] : []),
        ]);
        if (!current()) return;
        catalogueEpoch.current = epoch;
        setUnread(count.unread);
        setReferenceError(undefined);
      } catch (error) {
        if (current()) setReferenceError(error);
      }
    });
  }, [metadataFlight]);
  const refreshData = useCallback(async () => {
    const current = liveState.current;
    if (!current.user || current.user.must_change_password) return;
    const userId = current.user.user_id;
    const epoch = metadataEpoch.current;
    const isCurrent = () => metadataEpoch.current === epoch && liveState.current.user?.user_id === userId && liveState.current.workspace === current.workspace;
    return metadataFlight(`${epoch}:${userId}:${current.workspace || ""}`, async () => {
    try {
      const key = `${epoch}:${userId}:${current.workspace || ""}`;
      const seed = bootstrapSeed.take(key);
      // On first login defer the handbook until the authoritative workspace is
      // known. A selected workspace reads only its own handbook, once.
      const handbookRead = current.workspace ? api<HandbookOut>("GET", "/meta/handbook?workspace=" + encodeURIComponent(current.workspace)) : undefined;
      const [snapshot, scopedHandbook] = await Promise.all([
        seed ? Promise.resolve(seed) : Promise.all([
          api<EstablishmentOut>("GET", "/establishment"), api("GET", "/meta/settings"),
          api<MeOut>("GET", "/auth/me"), api<MeOut["workspaces"]>("GET", "/auth/workspaces"),
        ]).then(([establishment,settings,me,permittedWorkspaces]) => ({establishment,settings,me,permittedWorkspaces})),
        handbookRead,
      ]);
      const {establishment,settings,me,permittedWorkspaces} = snapshot;
      if (!isCurrent()) return;
      setEst(establishment);
      setMeta(settings);
      setUser({ ...me, workspaces: permittedWorkspaces });
      setPrefs(me.preferences);
      if (!loaded.current) {
        const available = permittedWorkspaces.filter(
          (w) =>
            establishment.views.workspaces.find((v) => v.workspace === w.code)
              ?.view !== "hidden",
        );
        if (
          !current.workspace &&
          ["login", "workspace_picker", "app_shell"].includes(
            liveState.current.screen,
          )
        ) {
          if (available.length === 1) {
            await call("workspace", { code: available[0].code });
            if (!isCurrent()) return;
            loaded.current = true;
            bootstrapSeed.offer(`${epoch}:${userId}:${available[0].code}`, snapshot);
            setOutline(undefined);
            setHelpOpen(false);
            setHelpPage(undefined);
            setWorkspace(available[0].code);
            setScreen(currentScreen => ["login", "workspace_picker", "app_shell"].includes(currentScreen) ? "app_shell" : currentScreen);
            return; // Scoped handbook must arrive before publishing its menu.
          } else {
            setScreen("workspace_picker");
          }
        }
        loaded.current = true;
      }
      if (
        current.workspace &&
        (!me.workspaces.some((w) => w.code === current.workspace) ||
          establishment.views.workspaces.some(
            (v) => v.workspace === current.workspace && v.view === "hidden",
          ))
      ) {
        await call("workspace", { code: null });
        if (!isCurrent()) return;
        setWorkspace(null);
        setScreen("workspace_picker");
        return;
      }
      const handbook = scopedHandbook || await api<HandbookOut>("GET", "/meta/handbook");
      if (!isCurrent()) return;
      setOutline(handbook);
      setReadyContext({userId,workspace:current.workspace,epoch});
      // Reference lists and badge counts cannot delay an authorized workspace.
      void refreshReferences(userId, epoch);
    } catch (e) {
      if (isCurrent()) setError(e);
    }
    });
  }, [metadataFlight, bootstrapSeed, refreshReferences]);
  useEffect(() => {
    void refreshState();
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [refreshState]);
  useEffect(() => {
    if (!window.terminal) return;
    return window.terminal.subscribe((e) => {
      if (e.type === "login") {
        metadataEpoch.current++;
        bootstrapSeed.clear();
        setReferenceError(undefined);
        setReadyContext(undefined);
        if (e.license) setLicense(e.license);
        loaded.current = false;
        setUser(e.user);
        setScreen(e.user.must_change_password ? "login" : "app_shell");
        setSessionRecovery(null);
      }
      if (e.type === "session-recovery") {
        setSessionPassword("");
        setSessionRecovery(e.message);
      }
      if (e.type === "session-restored") {
        metadataEpoch.current++;
        bootstrapSeed.clear();
        setReferenceError(undefined);
        setReadyContext(undefined);
        setSessionRecovery(null);
        setSessionPassword("");
        setSessionError(undefined);
        setUser(e.user);
        if (e.user.must_change_password) setScreen("login");
        void refreshData();
      }
      if (e.type === "logout") {
        metadataEpoch.current++;
        bootstrapSeed.clear();
        setReferenceError(undefined);
        setReadyContext(undefined);
        setSessionRecovery(null);
        setSessionPassword("");
        resetRequests();
        loaded.current = false;
        setUser(null);
        setEst(undefined);
        setOutline(undefined);
        setMeta(undefined);
        setUnread(undefined);
        setWorkspace(null);
        setCritical(undefined);
        setCriticalNotices([]);
        setMaintenance(undefined);
        setHelpOpen(false);
        setHelpPage(undefined);
        setLogoutOpen(false);
        setScreen("login");
        setNotice(e.reason);
        void refreshState();
      }
      if (e.type === "prefs") setPrefs({ ...e.prefs });
      if (e.type === "connection") setConnected(e.connected);
      if (e.type === "permissions") {
        metadataEpoch.current++;
        bootstrapSeed.clear();
        setReferenceError(undefined);
        setReadyContext(undefined);
        setOutline(undefined);
        setHelpOpen(false);
        setHelpPage(undefined);
        setUser(e.user);
        void refreshData();
      }
      if (e.type === "error")
        setError(new Error(e.error?.message || "Terminal error"));
      if (e.type === "stream") {
        setStream(e.status);
        if (e.resync) {
          setRevision((n) => n + 1);
          void refreshData();
        }
      }
      if (e.type === "event") {
        setRevision((n) => n + 1);
        if (e.event_type === "system.license") {
          // The documented DEV fixture belongs to this authenticated socket;
          // an ordinary REST read would erase it with the global DEV state.
          if (e.simulated === true && e.event_id < 0) setLicense(e.payload);
          else
            void api<LicenseStatusOut>("GET", "/meta/license")
              .then(setLicense)
              .catch(setError);
        }
        if (["system.license", "system.maintenance"].includes(e.event_type)) {
          loaded.current = false;
          void refreshData();
        }
        if (e.event_type === "system.maintenance")
          setMaintenance(
            e.payload.enabled || e.payload.maintenance_mode
              ? e.payload
              : undefined,
          );
        if (e.event_type === "admission.code_red")
          setCritical({ kind: "code_red", ...e.payload });
        if (
          e.event_type === "notification.created" &&
          e.payload.severity === "critical"
        )
          setCriticalNotices((current) => [
            ...current.filter(
              (n) => n.notification_id !== e.payload.notification_id,
            ),
            { ...e.payload, id: e.event_id },
          ]);
        if (
          [
            "establishment.changed",
            "notification.created",
            "approval.resolved",
          ].includes(e.event_type)
        )
          void refreshData();
      }
    });
  }, [refreshData, refreshState, bootstrapSeed]);
  useEffect(() => {
    if (user && !user.must_change_password) {
      void call("stream").catch(setError);
      void refreshData();
    }
  }, [user?.user_id, user?.must_change_password, workspace, refreshData]);
  useEffect(() => {
    if (!server) return;
    let cancelled = false;
    const read = () =>
      api<LicenseStatusOut>("GET", "/meta/license")
        .then((v) => {
          if (!cancelled) setLicense(v);
        })
        .catch((e) => {
          if (!cancelled) setError(e);
        });
    void read();
    const id = setInterval(
      read,
      license?.reason?.startsWith("standby_") ? 30000 : 600000,
    );
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [server?.current, !!license?.reason?.startsWith("standby_"), user?.user_id]);
  useEffect(() => {
    if (!server) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setLoginHealth(undefined);
    setHealthError(undefined);
    const ping = async () => {
      try {
        await api("GET", "/health/live");
        const health = await api<HealthOut>("GET", "/health");
        if (!cancelled) {
          if (user) setMaintenance(health.maintenance_mode ? {message:health.maintenance_message} : undefined);
          else setLoginHealth(health);
          setHealthError(undefined);
        }
      } catch (e) {
        if (!cancelled) {
          setLoginHealth(undefined);
          setHealthError(e);
        }
      } finally {
        if (!cancelled) timer = setTimeout(ping, 5000);
      }
    };
    void ping();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.user_id, server?.current]);
  useEffect(() => {
    const receive = (event: Event) => setMaintenance({message:(event as CustomEvent<string>).detail});
    window.addEventListener("haspataal-maintenance", receive);
    return () => window.removeEventListener("haspataal-maintenance", receive);
  }, []);
  useEffect(() => {
    document.documentElement.lang = prefs.language;
    document.documentElement.dir = ur ? "rtl" : "ltr";
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs, ur]);
  useEffect(() => {
    const deepLink = () => {
      if (!window.location.hash.startsWith("#help/")) return;
      try {
        const requested = decodeURIComponent(window.location.hash.slice(6));
        setHelpPage(
          requested.startsWith("screens/") ? requested.slice(8) : requested,
        );
        setHelpOpen(true);
      } catch {
        setError(new Error("This handbook link is invalid."));
      }
    };
    window.addEventListener("hashchange", deepLink);
    deepLink();
    return () => window.removeEventListener("hashchange", deepLink);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setHelpPage(document.activeElement?.closest("[data-help-screen]")?.getAttribute("data-help-screen") || undefined);
        setHelpOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        if (navigate("settings")) setLogoutOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && ["+", "=", "-", "0"].includes(e.key))
        e.preventDefault();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  const dirty = hasUnsavedChanges;
  async function signOut(all: boolean) {
    if (logoutFlight.current) return;
    if (document.querySelector('[data-write-pending="true"]')) {
      setNotice(
        t(
          "Wait for the pending action to finish.",
          "جاری عمل مکمل ہونے کا انتظار کریں۔",
        ),
      );
      return;
    }
    if (
      dirty() &&
      !window.confirm(
        t(
          "Sign out and discard unsaved input?",
          "سائن آؤٹ کرکے غیر محفوظ اندراج ختم کریں؟",
        ),
      )
    )
      return;
    logoutFlight.current = true;
    setLogoutBusy(true);
    try {
      await call("logout", { all });
    } catch (cause) {
      // Revocation can arrive before the HTTP reply. A server-ended session
      // is already closed; do not attach an old logout error to a new login.
      if (liveState.current.user) setError(cause);
    } finally {
      logoutFlight.current = false;
      setLogoutBusy(false);
    }
  }
  const [doctorAdmissionEntry,setDoctorAdmissionEntry]=useState<{userId:number;admissionId:number}>();
  const [estimateAdmissionEntry,setEstimateAdmissionEntry]=useState<{userId:number;admissionId:number}>();
  const [wardAdmissionEntry,setWardAdmissionEntry]=useState<{userId:number;admissionId:number}>();
  const [bedAdmissionEntry,setBedAdmissionEntry]=useState<{userId:number;admissionId:number}>();
  const [imagingSetupEntry, setImagingSetupEntry] = useState(false);
  const facilitySetupScope = !!user && user.permissions.includes('establishment.manage') && user.permissions.includes('diagnostics.setup.manage') && (screen === 'facility_profile' || (screen === 'imaging_quality_setup' && imagingSetupEntry));
  const facilitySetupHandbook = useLoad(() => facilitySetupScope && user ? call<HandbookOut>('service-setup-handbook').then(data=>({userId:user.user_id, data})) : Promise.resolve(undefined), [facilitySetupScope,user?.user_id,revision]);
  const facilitySetupPage = !facilitySetupHandbook.loading && !facilitySetupHandbook.error && facilitySetupHandbook.data?.userId === user?.user_id ? [...(facilitySetupHandbook.data?.data.shared_screens||[]),...(facilitySetupHandbook.data?.data.workspaces.flatMap(w=>w.screens)||[])].find(s=>s.id==='imaging_quality_setup') : undefined;
  const facilitySetupOutline = outline && facilitySetupPage ? {...outline, shared_screens:[...outline.shared_screens.filter(s=>s.id!=='imaging_quality_setup'),facilitySetupPage]} : outline;

  function navigate(next: string, fromFacility = false) {
    if (sessionRecovery) return false;
    if(next === "imaging_quality_setup" && est?.views.screens.find(s=>s.screen_id===next)?.view === "setup" && !(fromFacility && screen === "facility_profile" && user?.permissions.includes("establishment.manage"))) return false;
    if (frontDeskScreens.has(next) && !workspace) return false;
    const routeOutline = next === "imaging_quality_setup" && fromFacility && facilitySetupPage ? facilitySetupOutline : outline;
    const required: Record<string, string[]> = {
      radiology_worklist: ["imaging.order.update", "imaging.order.view"],
      rx_queue: ["pharmacy.queue.view", "prescription.view"],
      dispense: ["pharmacy.dispense", "prescription.view", "ipd.discharge.clear_pharmacy"],
      own_medicines_pharmacy: ["patient.own_medicine.identify", "patient.own_medicine.record", "medication.safety.view", "prescription.view"],
      critical_results_ward: ["diagnostics.critical.view", "patient.view"],
      order_queries: ["prescription.view", "prescription.query.raise"],
      otc: ["pharmacy.otc.sell", "pharmacy.formulary.view"],
      facility_profile: ["establishment.manage"],
      report_incident: ["incident.report"],
      patient_search: ["patient.search", "patient.view"],
      patient_documents: ["patient.document.view", "patient.document.upload"],
      registration: ["opd.ticket.create"],
      my_cash_shift: ["finance.shift.operate"],
      queue_management: ["opd.queue.view", "opd.ticket.view"],
      refund_waiver_credit: ["opd.ticket.view", "opd.queue.doctor"],
      cash_back_prompts: ["opd.ticket.view", "opd.queue.doctor"],
    };
    if (
      (frontDeskScreens.has(next) &&
        !routeOutline?.shared_screens.some(s => s.id === next) && !routeOutline?.workspaces.some((w) =>
          w.screens.some((s) => s.id === next),
        )) ||
      est?.views.screens.some(
        (v) => v.screen_id === next && v.view === "hidden",
      ) ||
      (required[next] &&
        !required[next].some((p) => user?.permissions.includes(p)))
    ) {
      setNotice(
        tr(
          "This screen is not available with your current permissions and hospital services.",
        ),
      );
      return false;
    }
    if (
      next !== screen &&
      document.querySelector('[data-write-pending="true"]')
    ) {
      setNotice(
        "Finish or retry the pending action before leaving this screen.",
      );
      return false;
    }
    if (
      next !== screen &&
      dirty() &&
      !window.confirm("Leave this screen and discard unsaved input?")
    )
      return false;
    setImagingSetupEntry(next === "imaging_quality_setup" && fromFacility);
    setScreen(next);
    setError(undefined);
    setNotice("");
    return true;
  }
  async function selectWorkspace(code: string, newWindow = false) {
    if (!newWindow && document.querySelector('[data-write-pending="true"]')) {
      setNotice(
        "Finish or retry the pending action before changing workspace.",
      );
      return;
    }
    try {
      if (
        !newWindow &&
        dirty() &&
        !window.confirm("Discard unsaved input and switch workspace?")
      )
        return;
      await call("workspace", { code, newWindow });
      if (!newWindow) {
        // Reopening the same workspace does not retrigger the workspace effect.
        // Keep its authorized menu while explicitly refreshing the server data.
        if (code === liveState.current.workspace) void refreshData();
        else setOutline(undefined);
        setWorkspace(code);
        if (liveState.current.screen === "workspace_picker") {
          setScreen("app_shell");
        }
      }
    } catch (e) {
      setError(e);
    }
  }
  function route(url: string) {
    const normalized = url
      .replace(/^\//, "")
      .replaceAll("-", "_")
      .split(/[/?]/)[0];
    const known: Record<string, string> = {
      prescriptions: "rx_queue",
      rx_queue: "rx_queue",
      dispensations: "dispense",
      dispense: "dispense",
      prescription_queries: "order_queries",
      order_queries: "order_queries",
      otc_sales: "otc",
      otc: "otc",
      charity_override: "charity_override",
      approvals: "approval_queue",
      notifications: "notifications",
      incidents: "report_incident",
      settings: "settings",
      establishment: "facility_profile",
      cash_shifts: "my_cash_shift",
      my_cash_shift: "my_cash_shift",
      patients: "patient_search",
      patient_search: "patient_search",
      registration: "registration",
      registrations: "registration",
      opd_queues: "queue_management",
      queue_management: "queue_management",
      refund_waiver_credit: "refund_waiver_credit",
      cash_back_prompts: "cash_back_prompts",
    };
    if (known[normalized]) navigate(known[normalized]);
    else setNotice("The related destination is outside this foundation build.");
  }
  const workspaceName = user?.workspaces.find((w) => w.code === workspace);
  const visible =
    user?.workspaces.filter(
      (w) =>
        est?.views.workspaces.find((v) => v.workspace === w.code)?.view !==
        "hidden",
    ) || [];
  const workspaceReady = !!user && !!outline && !!est && !!meta && readyContext?.userId === user.user_id && readyContext.workspace === workspace && readyContext.epoch === metadataEpoch.current;
  const nav = (workspaceReady ? [
    "app_shell",
    "workspace_picker",
    "notifications",
    "approval_queue",
    ...(workspace === "zakat" ? ["charity_approvals"] : []),
    ...(user?.permissions.includes("finance.shift.operate")
      ? ["my_cash_shift"]
      : []),
    ...(user?.permissions.includes("patient.search") ||
    user?.permissions.includes("patient.view")
      ? ["patient_search"]
      : []),
    ...(user?.permissions.includes("patient.document.view") || user?.permissions.includes("patient.document.upload")
      ? ["patient_documents"]
      : []),
    ...(user?.permissions.includes("opd.queue.doctor") ? ["doctor_queue"] : []),
    ...(user?.permissions.some(p => ["pharmacy.queue.view", "prescription.view"].includes(p)) ? ["rx_queue"] : []),
    ...(user?.permissions.some(p => ["pharmacy.dispense", "prescription.view", "ipd.discharge.clear_pharmacy"].includes(p)) ? ["dispense"] : []),
    ...(user?.permissions.some(p=>["prescription.view","prescription.query.raise"].includes(p)) ? ["order_queries"] : []),
    ...(user?.permissions.some(p=>["pharmacy.otc.sell","pharmacy.formulary.view"].includes(p)) ? ["otc"] : []),
    "charity_override",
    'lab_only_walkin',
    'lab_bench',
    'lab_send_outs',
    'imaging_quality_setup',
    'roll_call',
  'cost_estimates_billing',
  'explain_estimate',
  'patient_education_ward',
  'mar',
  'verbal_orders_ward',
  'verbal_orders_er',
  'vitals_tracker',
  'nursing_assessment',
  'my_beds',
  'doctor_inpatients',
  'cost_estimates_admissions',
  'consents_admissions',
  'wristbands_admissions',
  'wristbands_ward',
  'own_medicines_ward',
  'own_medicines_pharmacy',
  'critical_results_ward',
  'critical_results_er',
  'consents_triage',
  'er_board_doctor',
  'consents_ward',
  'consents_doctor',
  'blood_sources',
  'bed_matrix',
  'pending_admissions',
  'duty_roster',
    'imaging_repeats',
    'imaging_outsourced',
    'radiology_worklist',
    ...(user?.permissions.some(p => ['diagnostics.quality.view','lab.requisition.create','imaging.order.create','lab.requisition.view'].includes(p)) ? ['diagnostic_services_list'] : []),
    ...(user?.permissions.includes('diagnostics.critical.view') ? ['critical_results_bench','critical_results_verifier','critical_results_doctor','critical_results_radiology','critical_results_ward','critical_results_er'] : []),
    ...(user?.permissions.some(p => ['lab.result.verify', 'lab.result.view'].includes(p)) ? ['lab_verification'] : []),
    ...(user?.permissions.includes("clinical.encounter.view") || user?.permissions.includes("clinical.encounter.create") ? ["consultation"] : []),
    ...(user?.permissions.includes("prescription.view") || user?.permissions.includes("prescription.create") ? ["eprescription"] : []),
    ...(user?.permissions.some(p=>["lab.result.view","lab.requisition.view","lab.requisition.create","imaging.order.view","imaging.order.create"].includes(p)) ? ["lab_orders_results"] : []),
    ...(user?.permissions.includes("referral.create") ? ["external_referral"] : []),
    ...(user?.permissions.some(p=>["referral.view","referral.create"].includes(p)) ? ["referral_register"] : []),
    ...(user?.permissions.some(p=>["education.give","education.manage"].includes(p)) ? ["patient_education"] : []),
    ...(user?.permissions.some(p=>["homevisit.record","homevisit.view","msds.view"].includes(p)) ? ["home_visit_record"] : []),
    ...(user?.permissions.some(p=>["programme.view","programme.manage","programme.give"].includes(p)) ? ["patient_programmes"] : []),
    "icd_picker",
    "tariff_display",
    ...(user?.permissions.includes("finance.ar.view")
      ? ["receivables"]
      : []),
    ...(workspace === "reception" &&
    user?.permissions.includes("opd.ticket.create")
      ? ["registration"]
      : []),
    ...(user?.permissions.includes("opd.queue.view") ||
    user?.permissions.includes("opd.ticket.view")
      ? ["queue_management"]
      : []),
    ...(user?.permissions.includes("opd.ticket.view") ||
    user?.permissions.includes("opd.queue.doctor")
      ? ["refund_waiver_credit", "cash_back_prompts"]
      : []),
    ...(user?.permissions.includes("incident.report")
      ? ["report_incident"]
      : []),
    ...(user?.permissions.includes("establishment.manage")
      ? ["facility_profile"]
      : []),
    "settings",
  ] : []).filter(
    (id) =>
      (!frontDeskScreens.has(id) || (!!workspace && (
        !!outline?.shared_screens.some(s => s.id === id) ||
        !!outline?.workspaces.some((w) =>
          w.screens.some((s) => s.id === id),
        )))) &&
      est?.views.screens.find((v) => v.screen_id === id)?.view !== "hidden" &&
      (id !== "imaging_quality_setup" || ["full","open_work","records"].includes(est?.views.screens.find(v=>v.screen_id===id)?.view || "")) &&
      (id !== "blood_sources" || ["full","open_work","records","setup"].includes(est?.views.screens.find(v=>v.screen_id===id)?.view || "")) &&
      (id !== "blood_request" || ["full","open_work","records","setup"].includes(est?.views.screens.find(v=>v.screen_id===id)?.view || "")) &&
      (id !== "blood_bank" || ["full","open_work","records","setup"].includes(est?.views.screens.find(v=>v.screen_id===id)?.view || "")) &&
      (id !== "blood_donors" || ["full","open_work","records","setup"].includes(est?.views.screens.find(v=>v.screen_id===id)?.view || "")) &&
      (id !== "donor_assessment" || ["full","open_work","records","setup"].includes(est?.views.screens.find(v=>v.screen_id===id)?.view || "")) &&
      (id !== "blood_collection" || ["full","open_work","records","setup"].includes(est?.views.screens.find(v=>v.screen_id===id)?.view || "")) &&
      (id !== "blood_center_lab" || ["full","open_work","records","setup"].includes(est?.views.screens.find(v=>v.screen_id===id)?.view || "")) &&
      (!["mar","verbal_orders_ward","verbal_orders_er","vitals_tracker","patient_education_ward","nursing_assessment","my_beds","doctor_inpatients","cost_estimates_admissions","consents_admissions","wristbands_admissions","wristbands_ward","own_medicines_ward","own_medicines_pharmacy","bed_matrix","pending_admissions","imaging_repeats","imaging_outsourced","critical_results_radiology","radiology_worklist","rx_queue","dispense","order_queries","otc","charity_override","lab_only_walkin","lab_bench","lab_send_outs","lab_verification","critical_results_bench","critical_results_verifier","critical_results_doctor","critical_results_ward","critical_results_er","consents_ward","consents_triage","er_board_doctor"].includes(id) || ["full", "open_work", "records"].includes(est?.views.screens.find(v => v.screen_id === id)?.view || "")),
  );
  const view = est?.views.workspaces.find(
    (v) => v.workspace === workspace,
  )?.view;
  const date = meta?.hospital_timezone
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: meta.hospital_timezone,
      }).format(clock)
    : "";
  return (
    <div className="app">
      <a data-help="shell.navigation" href="#content" className="skip">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">H</span>
          <div>
            <strong>
              haspataal<span className="brand-dot">.</span>
            </strong>
            <small>{server?.hospital || "HOSPITAL TERMINAL"}</small>
          </div>
        </div>
        <div className="header-context">
          <span>
            {workspaceName
              ? ur
                ? workspaceName.label_ur
                : workspaceName.label
              : t("Shared foundation", "بنیادی نظام")}
          </span>
          <small>{date}</small>
        </div>
        <div className="header-actions">
          <span className={"connection-state " + (!connected ? "offline" : "")}>
            {connected ? "●" : "○"}{" "}
            {connected
              ? user
                ? stream
                : t("Connected", "رابطہ قائم")
              : t("Offline", "رابطہ منقطع")}
          </span>
          <button
            data-help="shell.terminal"
            title="This terminal"
            onClick={() => setInfoOpen(true)}
          >
            ⓘ
          </button>
          <button
            data-help="shell.help"
            onClick={() => {
              setHelpPage(undefined);
              setHelpOpen(true);
            }}
          >
            {t("Help · F1", "مدد · F1")}
          </button>
          {user?.permissions.includes("incident.report") && (
            <button
              data-help="shell.navigation"
              onClick={() => navigate("report_incident")}
            >
              {t("Report an incident", "واقعے کی رپورٹ")}
            </button>
          )}
          {!user && server && (
            <button
              data-help="shell.settings"
              onClick={() =>
                navigate(screen === "settings" ? "login" : "settings")
              }
            >
              {t("Settings", "ترتیبات")}
            </button>
          )}
          {user && (
            <button
              data-help="shell.logout"
              className="avatar"
              onClick={() => setLogoutOpen(true)}
              title={user.display_name}
            >
              {user.display_name.slice(0, 1)}
            </button>
          )}
        </div>
      </header>
      {license && ["grace", "locked"].includes(license.state) && (
        <div className="licence-banner" role="alert">
          <strong>{license.message}</strong>
          {license.days_left !== null && (
            <span><bdi>{license.days_left}</bdi> {tr("days left")}</span>
          )}
          <span>
            {license.vendor.company} · {license.vendor.phone} ·{" "}
            {license.vendor.email}
          </span>
        </div>
      )}
      {!connected && server && (
        <div className="offline-banner" role="alert">
          {t(
            "Server unreachable — retrying. Keep this window open; your unsaved input is preserved.",
            "سرور سے رابطہ نہیں — دوبارہ کوشش جاری ہے۔ ونڈو کھلی رکھیں؛ غیر محفوظ اندراج برقرار ہے۔",
          )}
        </div>
      )}
      <div className="body-layout">
        {user && !user.must_change_password && (
          <aside className="sidebar">
            <div className="staff">
              <small>{t("SIGNED IN AS", "صارف")}</small>
              <strong>{user.display_name}</strong>
              <span>{user.designation}</span>
            </div>
            <nav aria-label="Main navigation">
              {nav.map((id) => (
                <button
                  data-help="shell.navigation"
                  className={screen === id ? "active" : ""}
                  key={id}
                  onClick={() => navigate(id)}
                >
                  <span aria-hidden="true">{labels[id][2]}</span>
                  {labels[id][ur ? 1 : 0]}
                  {id === "notifications" && unread !== undefined && (
                    <b>{unread}</b>
                  )}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <button
                data-help="shell.logout"
                onClick={() => setLogoutOpen(true)}
              >
                {t("Sign out", "سائن آؤٹ")}
              </button>
            </div>
          </aside>
        )}
        <main id="content">
          <ErrorBox error={error} />
          {!!referenceError && user && <section className="notice" data-help="shell.navigation">
            <p>{t("Some reference lists could not be loaded. Retry to refresh them.", "بعض حوالہ جاتی فہرستیں حاصل نہیں ہو سکیں۔ تازہ کرنے کے لیے دوبارہ کوشش کریں۔")}</p>
            <ErrorBox error={referenceError} />
            <button data-help="shell.navigation" onClick={() => void refreshReferences(user.user_id, metadataEpoch.current)}>{t("Retry loading reference lists", "حوالہ جاتی فہرستیں دوبارہ حاصل کریں")}</button>
          </section>}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {ur && (
            <p className="translation-note">
              اردو ترجمہ مسودہ ہے؛ مقامی ماہر کا جائزہ باقی ہے۔
            </p>
          )}
          {booting ? (
            <p role="status">Opening terminal…</p>
          ) : !server ? (
            <Connection
              onConnected={async () => {
                await refreshState();
                setScreen("login");
              }}
            />
          ) : user?.must_change_password ? (
            <ChangePassword onDone={refreshState} />
          ) : !user ? (
            screen === "settings" ? (
              <Settings
                user={null}
                prefs={prefs}
                onPrefs={refreshState}
                onFacility={() => {}}
                connected={connected}
                revision={revision}
              />
            ) : (
              <Login
                connected={connected}
                health={loginHealth}
                healthError={healthError}
                hospital={server.hospital}
                onLogin={refreshState}
              />
            )
          ) : !workspaceReady && screen !== "settings" ? (
            <section className="card" data-help="shell.navigation" aria-busy={!error}>
              <h1>{t("Preparing your workspace…", "آپ کی کام کی جگہ تیار ہو رہی ہے…")}</h1>
              <p role="status">{t("Loading your permitted tasks and hospital settings together.", "آپ کے مجاز کام اور ہسپتال کی ترتیبات ایک ساتھ حاصل کی جا رہی ہیں۔")}</p>
              {!!error && <button data-help="shell.navigation" onClick={() => {setError(undefined);void refreshData();}}>{t("Retry loading workspace", "کام کی جگہ دوبارہ حاصل کریں")}</button>}
            </section>
          ) : (
            <>
              {view && view !== "full" && (
                <p className="notice">
                  {view === "records"
                    ? "Records only"
                    : view === "open_work"
                      ? "This service is retiring. Continue open work; no new work may start."
                      : "Service setup"}
                </p>
              )}
              {screen === "workspace_picker" && (
                <>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">YOUR WORKSPACES</span>
                      <h1>
                        {t(
                          "Where are you working today?",
                          "آج آپ کہاں کام کر رہے ہیں؟",
                        )}
                      </h1>
                      <p className="muted">
                        {t(
                          "Choose a workspace for your next task.",
                          "اگلے کام کے لیے جگہ منتخب کریں۔",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="workspace-grid">
                    {visible.map((w, i) => (
                      <article className="workspace-card" key={w.code}>
                        <span className="workspace-number">0{i + 1}</span>
                        <h2>{ur ? w.label_ur : w.label}</h2>
                        <p>{w.description}</p>
                        <span className="badge">
                          {est?.views.workspaces.find(
                            (v) => v.workspace === w.code,
                          )?.view || "full"}
                        </span>
                        <div className="actions">
                          <button
                            data-help="workspace.open"
                            className="primary"
                            onClick={() => selectWorkspace(w.code)}
                          >
                            {t("Open workspace →", "کام کی جگہ کھولیں")}
                          </button>
                          <button
                            data-help="workspace.open"
                            onClick={() => selectWorkspace(w.code, true)}
                          >
                            {t("Open in new window", "نئی ونڈو میں کھولیں")}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {est && nav.includes('critical_results_doctor') && <DoctorCriticalAlert key={user.user_id+':'+workspace} user={user} establishment={est} onOpen={()=>navigate('critical_results_doctor')}/>}
              {screen === 'critical_results_doctor' && est && <CriticalResultsDoctor key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone}/>}
              {screen === "app_shell" && (
                <>
                  <span className="eyebrow">
                    {t("READY FOR YOUR NEXT TASK", "اگلے کام کے لیے تیار")}
                  </span>
                  <h1>
                    {workspaceName
                      ? ur
                        ? workspaceName.label_ur
                        : workspaceName.label
                      : t("Your shared workspace", "آپ کی مشترکہ کام کی جگہ")}
                  </h1>
                  <p className="lead">
                    {t(
                      "The essentials for a connected hospital team.",
                      "مربوط ہسپتال ٹیم کے لیے بنیادی سہولیات۔",
                    )}
                  </p>
                  <div className="home-grid">
                    {nav
                      .filter(
                        (x) =>
                          ![
                            "app_shell",
                            "workspace_picker",
                            "settings",
                          ].includes(x),
                      )
                      .map((id) => (
                        <button
                          data-help="shell.navigation"
                          className="home-card"
                          onClick={() => navigate(id)}
                          key={id}
                        >
                          <span className="home-icon">{labels[id][2]}</span>
                          <h2>{labels[id][ur ? 1 : 0]}</h2>
                          <span>
                            {id === "notifications" && unread !== undefined
                              ? `${unread} unread`
                              : t("Open →", "کھولیں ←")}
                          </span>
                        </button>
                      ))}
                  </div>
                  <section className="card muted">
                    <h3>{t("About this build", "اس بلڈ کے بارے میں")}</h3>
                    <p>
                      {t(
                        "Shared tools connect to the live DEV hospital. Clinical screens are planned for the next build phases.",
                        "مشترکہ سہولیات حقیقی DEV ہسپتال سے منسلک ہیں۔ طبی صفحات اگلے مراحل میں بنیں گے۔",
                      )}
                    </p>
                  </section>
                </>
              )}
              {screen === "settings" && (
                <Settings
                  user={user}
                  prefs={prefs}
                  onPrefs={refreshState}
                  onFacility={() => navigate("facility_profile")}
                  connected={connected}
                  revision={revision}
                />
              )}
              {screen === "notifications" && (
                <Notifications
                  timeZone={meta?.hospital_timezone}
                  revision={revision}
                  onRefresh={refreshData}
                  onRoute={route}
                />
              )}
              {screen === "approval_queue" && (
                <Approvals user={user} revision={revision} />
              )}
              {screen === "charity_approvals" && (
                <Approvals user={user} revision={revision} charity />
              )}
              {screen === "my_cash_shift" && (
                <CashShift
                  workspace={workspace || undefined}
                  user={user}
                  revision={revision}
                  timeZone={meta?.hospital_timezone}
                  currency={meta?.currency_code}
                />
              )}
              {screen === "patient_search" && (
                <PatientSearch user={user} revision={revision} timeZone={meta?.hospital_timezone} currency={meta?.currency_code} />
              )}
              {screen === "registration" && (
                <Registration user={user} revision={revision} />
              )}
              {screen === 'lab_only_walkin' && est && <LabOnlyWalkIn key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone} currency={meta?.currency_code} onCashShift={nav.includes('my_cash_shift')?()=>{navigate('my_cash_shift')}:undefined}/>}
              {screen === 'imaging_quality_setup' && est && <ImagingQualitySetup key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} fromFacility={imagingSetupEntry}/>}
              {screen === 'diagnostic_services_list' && <DiagnosticServicesList key={user.user_id} user={user} connected={connected} stream={stream}/>}
              {screen === 'lab_send_outs' && est && <LabSendOuts key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone}/>}
              {screen === 'my_beds' && est && <MyBeds key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} initialAdmissionId={wardAdmissionEntry?.userId===user.user_id?wardAdmissionEntry.admissionId:undefined} availableScreens={nav} onRoute={(next,id)=>{if(nav.includes(next)&&navigate(next))setWardAdmissionEntry({userId:user.user_id,admissionId:id});}}/>}
              {screen === 'patient_education_ward' && est && <WardEducation key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} initialAdmissionId={wardAdmissionEntry?.userId===user.user_id?wardAdmissionEntry.admissionId:undefined} onBack={id=>{if(navigate('my_beds'))setWardAdmissionEntry({userId:user.user_id,admissionId:id});}}/>}
              {screen === 'mar' && est && <MedicationAdministration key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} initialAdmissionId={wardAdmissionEntry?.userId===user.user_id?wardAdmissionEntry.admissionId:undefined} onBack={id=>{if(navigate('my_beds'))setWardAdmissionEntry({userId:user.user_id,admissionId:id});}}/>}
              {screen === 'verbal_orders_ward' && est && <VerbalOrders key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} initialAdmissionId={wardAdmissionEntry?.userId===user.user_id?wardAdmissionEntry.admissionId:undefined} onBack={id=>{if(navigate('my_beds'))setWardAdmissionEntry({userId:user.user_id,admissionId:id});}}/>}
              {screen === 'vitals_tracker' && est && <VitalsFlowsheet key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} initialAdmissionId={wardAdmissionEntry?.userId===user.user_id?wardAdmissionEntry.admissionId:undefined} onBack={id=>{if(navigate('my_beds'))setWardAdmissionEntry({userId:user.user_id,admissionId:id});}}/>}
              {screen === 'nursing_assessment' && est && <NursingAssessment key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} initialAdmissionId={wardAdmissionEntry?.userId===user.user_id?wardAdmissionEntry.admissionId:undefined} onBack={id=>{if(navigate('my_beds'))setWardAdmissionEntry({userId:user.user_id,admissionId:id});}}/>}
              {screen === 'doctor_inpatients' && est && <DoctorInpatients key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} availableScreens={nav} initialAdmissionId={doctorAdmissionEntry?.userId===user.user_id?doctorAdmissionEntry.admissionId:undefined} onRoute={(next,id)=>{if(nav.includes(next)&&navigate(next)){setDoctorAdmissionEntry({userId:user.user_id,admissionId:id});if(next==='explain_estimate')setEstimateAdmissionEntry({userId:user.user_id,admissionId:id});}}}/>}
              {screen === 'medication_orders_doctor' && <MedicationOrdersDoctor key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} availableScreens={nav} onRoute={(next,id)=>{if(nav.includes(next))navigate(next);}}/>}
              {screen === 'explain_estimate' && est && <CostEstimates key={user.user_id+'explain'} screenId="explain_estimate" initialAdmissionId={estimateAdmissionEntry?.userId===user.user_id?estimateAdmissionEntry.admissionId:undefined} onAdmission={nav.includes("doctor_inpatients")?id=>{if(navigate("doctor_inpatients"))setDoctorAdmissionEntry({userId:user.user_id,admissionId:id})}:undefined} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'cost_estimates_billing' && est && <CostEstimates key={user.user_id+'billing'} screenId="cost_estimates_billing" user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'cost_estimates_admissions' && est && <CostEstimates key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'consents_admissions' && est && <ConsentsAdmissions key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'consents_ward' && est && <ConsentsAdmissions key={user.user_id+'ward'} screenId="consents_ward" user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'consents_doctor' && est && <ConsentsAdmissions key={user.user_id+'doctor'} screenId="consents_doctor" user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'consents_triage' && est && <ConsentsAdmissions key={user.user_id+'triage'} screenId="consents_triage" user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'blood_sources' && est && <BloodSources key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} />}
              {screen === 'blood_request' && est && <BloodRequest key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} onNavigateToConsent={() => navigate('consents_doctor')} />}
              {screen === 'blood_bank' && est && <BloodBank key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} />}
              {screen === 'blood_donors' && est && <BloodDonors key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} />}
              {screen === 'donor_assessment' && est && <DonorAssessment key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} />}
              {screen === 'blood_collection' && est && <BloodCollection key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} />}
              {screen === 'blood_center_lab' && est && <BloodCenterLab key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} />}
              {screen === 'blood_center_release' && est && <BloodCenterRelease key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} />}
              {screen === 'transfusion_bedside' && est && <TransfusionBedside key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} />}
              {screen === 'maternity_policy' && est && <MaternityPolicy key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} />}
              {screen === 'obstetric_assessment' && est && <ObstetricAssessment key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} />}
              {screen === 'newborn_registration' && est && <NewbornRegistration key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} onNavigateScreen={navigate} />}
              {screen === 'labour_register' && est && <LabourRegister key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} onNavigateScreen={navigate} />}
              {screen === 'medication_safety_ward' && est && <MedicationSafetyWard key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} onNavigateScreen={navigate} />}
              {screen === 'ward_transfer' && est && <WardTransfer key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)} />}
              {screen === 'ward_transfer_head_nurse' && est && <WardTransferHeadNurse key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)} />}
              {screen === 'ward_indent' && est && <WardIndent key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)} />}
              {screen === 'discharge_summary' && est && <DischargeSummary key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)} />}
              {screen === 'triage_scale' && est && <TriageScale key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)} />}
              {screen === 'er_board' && est && <ERBoard key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)} />}
              {screen === 'er_board_doctor' && est && <ERBoardDoctor key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)} />}
              {screen === 'er_visit' && est && <ERVisit key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)} onBack={() => navigate('er_board')} />}
              {screen === 'code_red' && est && <CodeRed key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)} onBack={() => navigate('er_board')} />}
              {screen === 'trauma_merge' && est && <TraumaMerge key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)} onBack={() => navigate('er_board')} />}
              {screen === 'wristbands_admissions' && est && <Wristbands key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'wristbands_ward' && est && <Wristbands screenId="wristbands_ward" key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'wristbands_er' && est && <Wristbands screenId="wristbands_er" key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'verbal_orders_er' && est && <VerbalOrders screenId="verbal_orders_er" key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onNavigateScreen={(s) => navigate(s)}/>}
              {screen === 'own_medicines_ward' && est && <OwnMedicinesWard key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} initialAdmissionId={wardAdmissionEntry?.userId===user.user_id?wardAdmissionEntry.admissionId:undefined} onBack={id=>{if(navigate('my_beds'))setWardAdmissionEntry({userId:user.user_id,admissionId:id});}}/>}
              {screen === 'own_medicines_pharmacy' && est && <OwnMedicinesPharmacy key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone}/>}
              {screen === 'bed_matrix' && est && <BedMatrix key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onAdmission={nav.includes("pending_admissions")?id=>{if(navigate("pending_admissions"))setBedAdmissionEntry({userId:user.user_id,admissionId:id})}:undefined}/>}
              {screen === 'pending_admissions' && est && <PendingAdmissions key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} currency={meta?.currency_code} initialAdmissionId={bedAdmissionEntry?.userId===user.user_id?bedAdmissionEntry.admissionId:undefined}/>}
              {screen === 'roll_call' && <RollCall key={user.user_id} user={user} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'duty_roster' && <DutyRoster key={user.user_id} user={user} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'imaging_repeats' && est && <ImagingRepeats key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'imaging_outsourced' && est && <ImagingOutsourced key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'radiology_worklist' && est && <RadiologyWorklist key={user.user_id} user={user} establishment={est} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}
              {screen === 'lab_bench' && est && <LabBench key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone}/>}
              {screen === 'lab_verification' && est && <LabVerification key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone}/>}
              {screen === 'critical_results_radiology' && est && <CriticalResultsBench screenId="critical_results_radiology" key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone}/>}
              {screen === 'critical_results_verifier' && est && <CriticalResultsBench screenId="critical_results_verifier" key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone}/>}
              {screen === 'critical_results_bench' && est && <CriticalResultsBench key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone}/>}
              {screen === 'critical_results_ward' && est && <CriticalResultsWard key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone}/>}
              {screen === 'critical_results_er' && est && <CriticalResultsWard screenId="critical_results_er" key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone}/>}
              {screen === "patient_documents" && <PatientDocuments user={user} revision={revision} />}
              {screen === "rx_queue" && <PrescriptionQueue key={user.user_id} permissions={user.permissions} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} view={est?.views.screens.find(v => v.screen_id === "rx_queue")?.view || "hidden"} onDispense={nav.includes("dispense")?id=>{if(navigate("dispense"))setPharmacySelection({userId:user.user_id,prescriptionId:id})}:undefined} />}
              {screen === "dispense" && est && <Dispense onCashShift={nav.includes("my_cash_shift")?()=>{navigate("my_cash_shift")}:undefined} initialAssistance={pharmacySelection?.userId===user.user_id?pharmacySelection.assistance:undefined} onCharity={nav.includes("charity_override")?id=>{if(navigate("charity_override"))setCharitySelection({userId:user.user_id,prescriptionId:id})}:undefined} key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} initialId={pharmacySelection?.userId===user.user_id?pharmacySelection.prescriptionId:undefined} onQueue={nav.includes("rx_queue")?()=>{navigate("rx_queue")}:undefined} onQuery={nav.includes("order_queries")?(id,itemId)=>{if(navigate("order_queries"))setQuerySelection({userId:user.user_id,prescriptionId:id,itemId})}:undefined} />}
              {screen === "order_queries" && est && <OrderQueries key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone} initial={querySelection?.userId===user.user_id?querySelection:undefined} onDispense={nav.includes("dispense")?id=>{if(navigate("dispense"))setPharmacySelection({userId:user.user_id,prescriptionId:id})}:undefined} />}
              {screen === "charity_override" && est && <CharityOverride key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} timeZone={meta?.hospital_timezone} currency={meta?.currency_code} initialId={charitySelection?.userId===user.user_id?charitySelection.prescriptionId:undefined} onDispense={nav.includes("dispense")?h=>{if(navigate("dispense"))setPharmacySelection({userId:user.user_id,prescriptionId:h.prescriptionId,assistance:h})}:undefined} onApprovals={nav.includes("approval_queue")?()=>{navigate("approval_queue")}:undefined} />}
              {screen === "otc" && est && <OTCMode key={user.user_id} user={user} connected={connected} stream={stream} establishment={est} currency={meta?.currency_code} onCashShift={nav.includes("my_cash_shift")?()=>{navigate("my_cash_shift")}:undefined} />}
              {screen === "tariff_display" && <Tariff revision={revision} />}
              {screen === "icd_picker" && <ICDPicker />}
              {screen === "doctor_queue" && <DoctorQueue key={user.user_id} permissions={user.permissions} connected={connected} stream={stream} timeZone={meta?.hospital_timezone} onConsultation={nav.includes("consultation") ? id=>{if(navigate("consultation"))setClinicalSelection({userId:user.user_id,ticketId:id})}:undefined} readOnly={view === "records" || est?.views.screens.find(s => s.screen_id === "doctor_queue")?.view === "records"} />}
              {screen === "home_visit_record" && <HomeVisitRecord key={user.user_id} user={user} revision={revision} initialTicket={clinicalSelection?.userId===user.user_id?clinicalSelection.ticketId:undefined} readOnly={view==="records"||est?.views.screens.find(s=>s.screen_id==="home_visit_record")?.view==="records"} connected={connected} timeZone={meta?.hospital_timezone} establishment={est}/>}
              {screen === "patient_programmes" && <PatientProgrammes key={user.user_id} user={user} revision={revision} initialTicket={clinicalSelection?.userId===user.user_id?clinicalSelection.ticketId:undefined} readOnly={view==="records"||est?.views.screens.find(s=>s.screen_id==="patient_programmes")?.view==="records"} connected={connected} timeZone={meta?.hospital_timezone} establishment={est}/>}
              {screen === "patient_education" && <PatientEducation key={user.user_id} user={user} revision={revision} initialTicket={clinicalSelection?.userId===user.user_id?clinicalSelection.ticketId:undefined} readOnly={view==="records"||est?.views.screens.find(s=>s.screen_id==="patient_education")?.view==="records"} connected={connected} timeZone={meta?.hospital_timezone}/>}
              {screen === "referral_register" && <ReferralRegister key={user.user_id} user={user} revision={revision} connected={connected} timeZone={meta?.hospital_timezone}/>}
              {screen === "external_referral" && <ExternalReferral key={user.user_id} user={user} revision={revision} initialTicket={clinicalSelection?.userId===user.user_id?clinicalSelection.ticketId:undefined} readOnly={view==="records"||est?.views.screens.find(s=>s.screen_id==="external_referral")?.view==="records"} connected={connected} timeZone={meta?.hospital_timezone} availableScreens={nav} onRoute={(next,id)=>{if(navigate(next)&&id)setClinicalSelection({userId:user.user_id,ticketId:id})}}/>}
              {screen === "lab_orders_results" && <LabOrdersResults key={user.user_id} user={user} revision={revision} initialTicket={clinicalSelection?.userId===user.user_id?clinicalSelection.ticketId:undefined} readOnly={view==="records"||est?.views.screens.find(s=>s.screen_id==="lab_orders_results")?.view==="records"} connected={connected} active={est?.active||[]} timeZone={meta?.hospital_timezone} availableScreens={nav} onRoute={(next,id)=>{if(navigate(next))setClinicalSelection({userId:user.user_id,ticketId:id})}}/>}
              {screen === "eprescription" && <EPrescription key={user.user_id} user={user} revision={revision} initialTicket={clinicalSelection?.userId===user.user_id?clinicalSelection.ticketId:undefined} readOnly={view==="records"||est?.views.screens.find(s=>s.screen_id==="eprescription")?.view==="records"} connected={connected} active={est?.active||[]} timeZone={meta?.hospital_timezone}/>}
              {screen === "consultation" && <Consultation key={user.user_id} user={user} revision={revision} initialTicket={clinicalSelection?.userId===user.user_id?clinicalSelection.ticketId:undefined} readOnly={view==="records"||est?.views.screens.find(s=>s.screen_id==="consultation")?.view==="records"} connected={connected} active={est?.active||[]} rulesInForce={est?.rules_in_force||[]} timeZone={meta?.hospital_timezone} availableScreens={nav} onRoute={(next,id)=>{if(navigate(next))setClinicalSelection({userId:user.user_id,ticketId:id})}}/>}
              {screen === "receivables" && (
                <Receivables
                  user={user}
                  revision={revision}
                  currency={meta?.currency_code}
                  readOnly={view === "records" || est?.views.screens.find(s => s.screen_id === "receivables")?.view === "records"}
                />
              )}
              {screen === "queue_management" && (
                <QueueManagement
                  currency={meta?.currency_code}
                  permissions={user.permissions}
                  revision={revision}
                  timeZone={meta?.hospital_timezone}
                  readOnly={
                    view === "records" ||
                    est?.views.screens.find((s) => s.screen_id === screen)
                      ?.view === "records"
                  }
                  onShift={() =>
                    void selectWorkspace(workspace || "reception", true)
                  }
                />
              )}
              {screen === "refund_waiver_credit" && (
                <RefundRequests
                  currency={meta?.currency_code}
                  permissions={user.permissions}
                  revision={revision}
                  timeZone={meta?.hospital_timezone}
                  readOnly={
                    view === "records" ||
                    est?.views.screens.find((s) => s.screen_id === screen)
                      ?.view === "records"
                  }
                  onShift={() =>
                    void selectWorkspace(workspace || "reception", true)
                  }
                />
              )}
              {screen === "cash_back_prompts" && (
                <CashBack
                  currency={meta?.currency_code}
                  permissions={user.permissions}
                  revision={revision}
                  timeZone={meta?.hospital_timezone}
                  readOnly={
                    view === "records" ||
                    est?.views.screens.find((s) => s.screen_id === screen)
                      ?.view === "records"
                  }
                  onShift={() =>
                    void selectWorkspace(workspace || "reception", true)
                  }
                />
              )}
              {screen === "report_incident" && (
                <Incidents
                  user={user}
                  revision={revision}
                  timeZone={meta?.hospital_timezone}
                />
              )}
              {screen === "facility_profile" && facilitySetupScope && facilitySetupHandbook.loading && <p role="status">{t('Checking permitted service setup pages…','مجاز خدمت ترتیب صفحات چیک ہو رہے ہیں…')}</p>}
              {screen === "facility_profile" && facilitySetupScope && facilitySetupHandbook.error && <><ErrorBox error={facilitySetupHandbook.error}/><button data-help="facility.imaging-access" onClick={facilitySetupHandbook.reload}>{t('Retry setup access','ترتیب رسائی پھر چیک')}</button></>}
              {screen === "facility_profile" && (
                <Facility
                  revision={revision}
                  onImagingSetup={user.permissions.includes("diagnostics.setup.manage") && ["setup","full","open_work","records"].includes(est?.views.screens.find(s=>s.screen_id==="imaging_quality_setup")?.view||"") && !!facilitySetupPage ? ()=>{navigate("imaging_quality_setup",true)} : undefined}
                  onChanged={refreshData}
                  storageScope={`${server.fingerprint}:${user.user_id}`}
                />
              )}
            </>
          )}
        </main>
      </div>
      <footer className="statusbar">
        <span>{server?.current || "No server selected"}</span>
        <span>
          {user ? user.username : "Not signed in"} · {prefs.ui_scale_pct}% ·
          v0.1.0
        </span>
      </footer>
      {helpOpen && (
        <Help
          screen={screen}
          initialPage={helpPage}
          outline={screen === "imaging_quality_setup" && imagingSetupEntry ? facilitySetupOutline : outline}
          language={prefs.language}
          onClose={() => {
            setHelpOpen(false);
            setHelpPage(undefined);
            if (window.location.hash.startsWith("#help/"))
              history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search,
              );
          }}
        />
      )}{" "}
      {infoOpen && (
        <Modal
          title={t("Terminal information", "ٹرمینل کی معلومات")}
          onClose={() => setInfoOpen(false)}
        >
          {server ? (
            <TerminalIdentity />
          ) : (
            <p>Connect to a server to identify this terminal.</p>
          )}
        </Modal>
      )}
      {logoutOpen && (
        <Modal
          title={t("Your account", "آپ کا اکاؤنٹ")}
          onClose={() => !logoutBusy && setLogoutOpen(false)}
        >
          <p>
            {t(
              "Finish pending actions before signing out. Resolve uncertain cash-shift requests while this window is open. Unsaved input needs your confirmation before it is discarded. Retained Facility requests stay with this account and hospital.",
              "سائن آؤٹ سے پہلے جاری عمل مکمل کریں۔ غیر یقینی کیش شفٹ کا نتیجہ اسی کھلی ونڈو میں واضح کریں۔ غیر محفوظ اندراج ختم کرنے سے پہلے تصدیق ہوگی۔ ہسپتال کی محفوظ درخواستیں اسی اکاؤنٹ اور ہسپتال کے ساتھ رہتی ہیں۔",
            )}
          </p>
          <div className="actions" data-write-pending={logoutBusy}>
            {logoutBusy && (
              <p role="status">{t("Signing out…", "سائن آؤٹ جاری ہے…")}</p>
            )}
            <button
              data-help="shell.help"
              disabled={logoutBusy}
              onClick={() => {
                setLogoutOpen(false);
                setHelpPage("home");
                setHelpOpen(true);
              }}
            >
              {t("Help & handbook", "مدد اور رہنما")}
            </button>
            <button
              data-help="shell.settings"
              disabled={logoutBusy}
              onClick={() => {
                if (navigate("settings")) setLogoutOpen(false);
              }}
            >
              {t("Settings", "ترتیبات")}
            </button>
            <button
              data-help="shell.logout"
              disabled={logoutBusy}
              onClick={() => setLogoutOpen(false)}
            >
              {t("Keep working", "کام جاری رکھیں")}
            </button>
            <button
              data-help="shell.logout"
              disabled={logoutBusy}
              onClick={() => void signOut(true)}
            >
              {t("Sign out everywhere", "ہر جگہ سائن آؤٹ کریں")}
            </button>
            <button
              data-help="shell.logout"
              className="primary"
              disabled={logoutBusy}
              onClick={() => void signOut(false)}
            >
              {t("Sign out", "سائن آؤٹ کریں")}
            </button>
          </div>
        </Modal>
      )}
      {maintenance && (
        <div className="blocking-banner" role="alert">
          <h1>Hospital maintenance</h1>
          <p style={{whiteSpace:"pre-wrap"}}>{maintenance.message}</p>
          <button
            data-help="shell.maintenance"
            onClick={() =>
              api<HealthOut>("GET", "/health")
                .then((s) =>
                  setMaintenance(s.maintenance_mode ? {message:s.maintenance_message} : undefined),
                )
                .catch(setError)
            }
          >
            Check again
          </button>
          <button data-help="shell.logout" onClick={() => setLogoutOpen(true)}>
            Sign out
          </button>
        </div>
      )}
      {criticalNotices.length > 0 && (
        <CriticalNotificationToast
          key={criticalNotices[0].notification_id}
          notice={criticalNotices[0]}
          onDismiss={() => setCriticalNotices((current) => current.slice(1))}
          onOpen={() => navigate("notifications")}
        />
      )}
      {critical?.kind === "code_red" && (
        <Modal
          title={
            critical.kind === "code_red" ? "Code Red" : "Critical notification"
          }
          onClose={() => setCritical(undefined)}
        >
          <Details value={critical} />
          <button
            data-help="shell.critical"
            className="primary"
            onClick={() => setCritical(undefined)}
          >
            Acknowledge on this terminal
          </button>
        </Modal>
      )}
      {sessionRecovery && user && (
        <Modal
          title={t("Confirm your session", "اپنے سیشن کی تصدیق کریں")}
          onClose={() => {}}
        >
          <p>{tr(sessionRecovery)}</p>
          <p>{user.username}</p>
          <ErrorBox error={sessionError} />
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (reauthFlight.current) return;
              reauthFlight.current = true;
              setSessionBusy(true);
              setSessionError(undefined);
              try {
                await call("reauthenticate", { password: sessionPassword });
              } catch (cause) {
                setSessionError(cause);
              } finally {
                setSessionPassword("");
                setSessionBusy(false);
                reauthFlight.current = false;
              }
            }}
          >
            <Field label={t("Password", "پاس ورڈ")}>
              <input
                data-help="shell.session"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                disabled={sessionBusy}
                value={sessionPassword}
                onChange={(e) => setSessionPassword(e.target.value)}
              />
            </Field>
            <button
              data-help="shell.session"
              className="primary"
              disabled={sessionBusy || !connected}
            >
              {t("Confirm your session", "اپنے سیشن کی تصدیق کریں")}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
