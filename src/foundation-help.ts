export type Bilingual = [string, string];
export type ControlGuide = {
  screens: string[];
  title: Bilingual;
  body: Bilingual;
};
export const phase1Screens = [
  "connect_server",
  "login",
  "app_shell",
  "settings",
  "notifications",
  "help_center",
  "approval_queue",
  "charity_approvals",
  "report_incident",
  "facility_profile",
  "workspace_picker",
];
const approvalScreens = ["approval_queue", "charity_approvals"];
// Coverage grows screen by screen; Phase 1 acceptance remains separate.
export const deliveredHelpScreens = [
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
  ...phase1Screens,
  "my_cash_shift",
  "queue_management",
  "refund_waiver_credit",
  "cash_back_prompts",
  "patient_search",
  "registration",
  "patient_documents",
  "tariff_display",
  "receivables",
];
const g = (
  screens: string[],
  title: Bilingual,
  body: Bilingual,
): ControlGuide => ({ screens, title, body });
// IDs are also attached to the actual controls. The build rejects missing
// mappings and empty translations instead of treating a page as coverage.
export const controlGuides: Record<string, ControlGuide> = {
"home.policy":g(["home_visit_record"],["Home-visit policy","گھر کے دورے کی پالیسی"],["Read the actual provided/state/arrangements/notice before offering home visits. Refresh home-visit policy rereads the server; it saves no policy and does not enable a service. Active alone permits a new record, including a corrective new record; Retiring says No new records. Records stay readable with permission. A failure is not a statement that no visits exist.","دورہ دینے سے پہلے اصل فعال حالت، انتظام و اطلاع پڑھیں۔ تازہ کرنا صرف پڑھتا، پالیسی محفوظ یا خدمت فعال نہیں کرتا۔ صرف فعال میں نیا/تصحیح اندراج؛ بند ہوتی میں نئے نہیں۔ مجاز تاریخ باقی؛ خرابی کو کوئی دورہ نہ ہونے کا ثبوت نہ سمجھیں۔"]),
"home.notice":g(["home_visit_record"],["Display the official policy notice","اصل پالیسی اطلاع دکھائیں"],["Open official home-visit notice PDF fetches the current authenticated server PDF in a separate sandbox viewer. With homevisit.view or msds.view, use its print/download controls independently of any patient save. While inactive the notice states that home visits are not provided; never turn this policy notice into a patient certificate. Cancel or printer failure never repeats a visit.","مجاز اجازت سے اصل سرور پی ڈی ایف الگ محفوظ ناظر میں کھولیں؛ پرنٹ/محفوظ مریض کے اندراج سے الگ ہیں۔ غیر فعال اطلاع دورے نہ دینے کی ہے، مریض کا سرٹیفکیٹ نہیں۔ منسوخ یا پرنٹ خرابی دورہ نہیں دہراتی۔"]),
"home.facts":g(["home_visit_record"],["Record the completed visit facts","مکمل دورے کے حقائق"],["Only the clinician or nurse who made the visit records who requested it and relationship, reason, actual address, companion, reported history, assessment, care and follow-up. Required: requester2–200, reason3–1000, address3–500, history3–4000, assessment3–2000 and care3–4000characters. Companion/follow-up optional except a corrective entry needs its original #reference and actual explanation. These inputs stay in memory; they do not dispatch or bill a visit.","دورہ کرنے والا معالج/نرس درخواست کنندہ و رشتہ، وجہ، اصل پتہ، ساتھی، تاریخ، رائے، نگہداشت و فالو اپ لکھے۔ درخواست2تا200، وجہ3تا1000، پتہ3تا500، تاریخ/نگہداشت3تا4000، رائے3تا2000حروف لازم۔ ساتھی/فالو اپ اختیاری؛ تصحیح میں اصل #حوالہ و وضاحت لازم۔ صرف یادداشت میں؛ دورہ روانہ یا بل نہیں۔"]),
"home.times":g(["home_visit_record"],["Verify request and actual visit times","درخواست اور اصل دورے کا وقت"],["Enter both blank date/time fields in hospital timezone. Visit must be at or after the request and never after a freshly read server clock. Invalid, impossible or ambiguous local times are refused rather than guessed. Do not record a planned future visit as completed.","دونوں خالی تاریخ/وقت ہسپتال کے علاقے میں لکھیں۔ دورہ درخواست سے پہلے یا تازہ سرور وقت کے بعد نہیں۔ غلط یا مبہم وقت فرض نہیں؛ مستقبل کا منصوبہ مکمل دورہ نہ لکھیں۔"]),
"home.address":g(["home_visit_record"],["Review the actual visited address","اصل دورے کا پتہ چیک کریں"],["Copy recorded patient address for review appears only when an actual patient address exists. Replacing an unsaved address asks first. Check where this visit actually happened; a copied profile address is not evidence of a visit or a verified current address.","اصل مریض پتہ ہو تو نقل کا بٹن ہے؛ غیر محفوظ پتہ بدلنے سے پہلے پوچھتا ہے۔ اصل دورے کی جگہ چیک کریں؛ نقل کیا پتہ دورے یا تازہ پتے کا ثبوت نہیں۔"]),
"home.consent":g(["home_visit_record"],["Choose examination consent deliberately","معائنے کی رضامندی خود چنیں"],["Three buttons start with none selected: Verbal consent obtained (VCO), Examination declined, Not examined. Findings appear only for VCO. Changing away with unsent findings asks before clearing them; refusing leaves both untouched. The signed record shows consent and author stamp; never infer consent from saving.","تین بٹن پہلے خالی: زبانی رضامندی VCO، معائنہ مسترد، معائنہ نہیں کیا۔ نتائج صرف VCO میں۔ نتائج چھوڑنے سے پہلے پوچھتا؛ انکار پر برقرار۔ محفوظ ریکارڈ میں رضامندی و مہر؛ محفوظ کرنے کو رضامندی نہ سمجھیں۔"]),
"home.outcome":g(["home_visit_record"],["Describe what happened next","آگے کیا ہوا لکھیں"],["Choose actual Managed at home, Asked to attend the facility or Referred. Referred requires the actual destination, at most300characters. This records an outcome; it does not create an external referral, admission, transport request or appointment. Make those separate handovers through their permitted screens.","اصل نتیجہ گھر نگہداشت، ہسپتال آنے کو کہا یا حوالہ چنیں۔ حوالہ میں اصل جگہ300حروف تک لازم۔ صرف نتیجہ ہے؛ الگ حوالہ، داخلہ، گاڑی یا ملاقات نہیں بناتا۔ مجاز الگ کام سے منتقلی کریں۔"]),
"home.save":g(["home_visit_record"],["Sign one completed visit safely","ایک مکمل دورہ محفوظ کریں"],["Record completed home visit checks current Active policy/service, permission, actual patient and fresh server time. Confirm name/MRN and immutable facts once. One original actor/patient/key/body is frozen, double clicks cannot create a second. Unknown replies lock input/navigation for exact-key recovery within24hours; inspect actual history without inventing success. A confirmed entry shows its server number and author stamp; later read/print failure never repeats it.","مکمل دورہ موجودہ فعال پالیسی، اجازت، اصل مریض و تازہ وقت چیک کرتا۔ نام/ایم آر این اور حقائق کی ایک تصدیق۔ اصل صارف/مریض/کلید/معلومات مقفل؛ دہرے کلک سے دوسرا نہیں۔ گم جواب پر24گھنٹے وہی درخواست؛ تاریخ پڑھ کر چیک، کامیابی فرض نہیں۔ اصل نمبر/مہر تصدیق؛ بعد کی خرابی دوبارہ نہیں بناتی۔"]),
"home.new":g(["home_visit_record"],["Clear only the unsent draft","صرف غیر ارسال مسودہ صاف"],["Clear / new home-visit draft asks before discarding in-memory changes. It saves nothing and cannot delete a signed visit. Unknown writes prevent clearing or context changes. A new ordinary draft has blank times, consent and outcome.","نیا مسودہ غیر محفوظ تبدیلی چھوڑنے سے پہلے پوچھتا؛ کچھ محفوظ یا دستخط شدہ حذف نہیں۔ گم جواب پر صاف یا جگہ بدلنا بند۔ نئے میں وقت، رضامندی و نتیجہ خالی ہیں۔"]),
"home.history":g(["home_visit_record"],["Read the dated signed history","تاریخ کے مطابق محفوظ دورے پڑھیں"],["Choose Home visits from/to and Read home-visit history. Only this verified patient is queried,100records a page; invalid/reversed dates make no request. Older uses the last actual ID; Newer returns to the previous cursor. Empty means none returned for that patient/period; try the appropriate period. Access is audited; a failed read never counts as empty.","ابتدا/انتہا چن کر تاریخ پڑھیں۔ صرف اصل مریض100ریکارڈ فی صفحہ؛ غلط/الٹی تاریخ درخواست نہیں۔ پرانے اصل آخری نمبر؛ نئے پچھلا صفحہ۔ خالی اسی مدت کا ہے؛ مناسب مدت چنیں۔ رسائی درج؛ خرابی خالی تاریخ نہیں۔"]),
"home.detail":g(["home_visit_record"],["Read one signed home visit","ایک دستخط شدہ دورہ پڑھیں"],["Select an actual returned visit number. With homevisit.view the full record is freshly read; MSDS-only readers use the authorized register row. Verify number/MRN, all original facts, consent, outcome, actual author_stamp.text and recorded time. No edit or delete is offered.","اصل فہرست کا نمبر چنیں۔ دورہ دیکھنے کی اجازت سے تازہ مکمل ریکارڈ؛ صرف معیار ناظر مجاز قطار پڑھتا۔ نمبر/ایم آر این، حقائق، رضامندی، نتیجہ، اصل مصنف مہر و وقت چیک۔ ترمیم/حذف نہیں۔"]),
"home.correct":g(["home_visit_record"],["Append a corrective record","الگ تصحیح ریکارڈ"],["While the service is Active and record permission remains, Record a corrective home visit for #ID opens a separate draft with the old facts for review. Keep the original #reference and replace the explanation placeholder with the actual correction in Follow-up; recheck times/consent/outcome and sign separately. Original and separate stamps remain. Retired/retiring service never silently starts new work through correction.","فعال خدمت و اجازت میں اصل #نمبر کی تصحیح نیا مسودہ بناتی؛ پرانے حقائق خود چیک کریں۔ اصل حوالہ رکھ کر فالو اپ کی جگہ اصل تصحیح لکھیں؛ وقت/رضامندی/نتیجہ دوبارہ چیک و الگ محفوظ۔ اصل و نئی مہر برقرار۔ بند خدمت میں تصحیح سے نیا کام چھپ کر نہیں۔"]),
  "programme.enrol": g(["patient_programmes"],["Enrol using the actual programme card","اصل پروگرام کارڈ سے اندراج کریں"],["Only while preventive_programmes is Active, select an offered programme and enter its actual card/register number. Read the programme's national guideline and service list; never invent a programme or card. One frozen original UUID/body is sent after fresh patient/permission/service/catalogue checks. PROGRAMME_ENROLLED means read/open the actual existing Active enrolment, not create another. Unknown replies freeze input/navigation for identical-key/body retry within24hours; patient programme history is read-only reconciliation. Clear draft asks before losing edits.","صرف فعال حفاظتی خدمت میں اصل پروگرام و کارڈ/رجسٹر نمبر چنیں۔ قومی رہنما و خدمات پڑھیں؛ فرضی پروگرام/کارڈ نہیں۔ تازہ مریض، اجازت، خدمت و فہرست کے بعد اصل مقفل درخواست۔ پہلے سے درج کا مطلب اصل کھلا اندراج پڑھ/کھولیں، دوسرا نہیں۔ گم جواب پر24گھنٹے اسی درخواست کی کوشش، تاریخ صرف پڑھ کر چیک؛ ترمیم و جگہ بدلنا بند۔ صاف سے پہلے پوچھتا ہے۔"]),
  "programme.history": g(["patient_programmes"],["Read the patient's enrolments and signed entries","مریض کے اندراج اور مہر والے ریکارڈ پڑھیں"],["Select the actual enrolment number. Check patient name/MRN, programme/card, Active/closed state, enrolment time, closure note and each service's actual time, batch, next date and author stamp. Refresh programme history and due list rereads actual server records without changing unsent input; use it after reconciling an unknown closure. Confirmed enrolment/service/closure also refreshes due patients. History reads are logged. Closed entries never gain Record service; re-enrol deliberately if appropriate and the service is Active. There is no edit/delete of a service entry; make a correct new entry with an explanatory note instead. Loading/errors never pretend no history.","اصل اندراج نمبر چنیں۔ نام/ایم آر این، پروگرام/کارڈ، کھلی/بند حالت، وقت، بندش نوٹ، ہر خدمت کا اصل وقت، بیچ، اگلی تاریخ و مہر پڑھیں۔ تاریخ و اگلی خدمت تازہ کریں اصل ریکارڈ پڑھتا اور غیر ارسال معلومات رکھتا؛ گم بندش کا نتیجہ چیک کے بعد لیں۔ تصدیق شدہ تبدیلی اگلی خدمت خود تازہ کرتی۔ رسائی درج ہے۔ بند میں خدمت نہیں؛ مناسب ہو تو فعال خدمت میں نیا اندراج۔ خدمت بدل/حذف نہیں؛ وضاحت سے درست نیا ریکارڈ۔ لوڈنگ/خرابی کو خالی تاریخ نہ کہیں۔"]),
  "programme.entry": g(["patient_programmes"],["Record only the service and date the card states","صرف کارڈ کی اصل خدمت و تاریخ لکھیں"],["For an Active enrolment, choose a service in that programme's actual list, enter when it was given in hospital time, the actual vaccine/medicine batch where applicable, the card-written next date and optional note. Start time and next date are blank; no schedule, dose, interval or follow-up date is calculated. Server clock checks reject future given times and a next date before the local given day. The service can continue while Retiring only for enrolments started before retirement. Each append has a separate original idempotency key/stamp; no retrospective edit.","کھلے اندراج میں اسی پروگرام کی اصل خدمت، ہسپتال کے وقت میں اصل وقت، جہاں لازم ویکسین/دوائی بیچ، کارڈ کی اگلی تاریخ و نوٹ دیں۔ وقت/اگلی تاریخ خالی؛ شیڈول، خوراک، وقفہ یا تاریخ حساب نہیں۔ سرور کے وقت سے مستقبل یا پہلے اگلی تاریخ منع۔ ریٹائر ہوتی خدمت صرف پہلے اندراج کا کام جاری رکھتی ہے۔ ہر اضافہ الگ اصل درخواست و مہر؛ پرانی ترمیم نہیں۔"]),
  "programme.close": g(["patient_programmes"],["Close with the actual programme outcome","پروگرام کے اصل نتیجے سے بند کریں"],["Choose Completed, TransferredOut or Discontinued deliberately. Transfer requires where the patient went; discontinuation requires why. Confirm the patient/enrolment once. Closed enrolments reject more services/closure (PROGRAMME_ENROLMENT_CLOSED); a future course needs a new enrolment, never reopening the old audit. Closure is state-guarded, not idempotent replay: after a lost reply read original patient enrolments, compare the exact number/status and reconcile before another action.","مکمل، باہر منتقل یا بند خود چنیں۔ منتقلی کو منزل، بندش کو وجہ۔ مریض و اندراج ایک بار چیک/تصدیق۔ بند میں مزید خدمت/بندش منع؛ آئندہ نیا اندراج، پرانی تاریخ کھولنا نہیں۔ گم بندش خود نہیں دہراتی؛ مریض کی اصل فہرست میں اسی نمبر/حالت کو پڑھ کر چیک، پھر اگلا عمل۔"]),
  "programme.action": g(["patient_programmes"],["Confirm a separate programme action","پروگرام کا الگ عمل تصدیق کریں"],["Read patient/name/MRN, programme and enrolment in the dialog. Fill service/time/card details or actual closure outcome/note, then Confirm once. Cancel/Close/Escape asks before losing edited unsent input. Pending/unknown state locks ordinary inputs/dismissal while original-key retry or read-only reconciliation remains outside the disabled form. An error keeps the draft and marks invalid time/service/date. Saving a programme service does not erase an unrelated unsent enrolment draft.","مکالمے میں نام/ایم آر این، پروگرام و اندراج پڑھیں۔ خدمت/وقت/کارڈ یا اصل بندش/نوٹ مکمل اور ایک تصدیق۔ بند/منسوخ/ایسکیپ ترمیم چھوڑنے سے پہلے پوچھتا۔ زیرعمل/نامعلوم پر عام خانے و بندش مقفل، اصل کوشش/صرف پڑھ چیک باہر۔ خرابی مسودہ رکھ، غلط وقت/خدمت/تاریخ دکھاتی ہے۔ خدمت محفوظ الگ اندراج مسودہ نہیں مٹاتی۔"]),
  "programme.due": g(["patient_programmes"],["Follow up the card-written due list","کارڈ کے مطابق اگلی خدمت پر رابطہ کریں"],["Due on or before defaults to today in the hospital timezone from the authenticated server clock; this is a query date, never a computed clinical schedule. Filter a real programme, then read open enrolment/name/MRN/card/mobile/last service/next_due_on. Reads are logged; use only authorized follow-up. Older/Newer uses real enrolment cursors100rows until empty. Open this programme patient changes to that actual returned patient after discard confirmation; pending writes block it. Displayed phone numbers send no automated message or call.","فہرست کی تاریخ سرور کے موجودہ ہسپتال دن سے ہے؛ یہ تلاش، حساب شدہ طبی شیڈول نہیں۔ اصل پروگرام فلٹر، کھلا اندراج، نام/ایم آر این، کارڈ، فون، پچھلی خدمت و اگلی تاریخ پڑھیں۔ درج رسائی صرف مجاز رابطے کو۔ اصل نمبر سے100سطروں کے پرانے/نئے صفحے خالی تک۔ اصل واپس آئے مریض کو مسودہ چھوڑنے کی تصدیق کے بعد کھولتا؛ نامعلوم عمل پر بند۔ نمبر سے خود پیغام یا کال نہیں ہوتی۔"]),
  "programme.catalogue": g(["patient_programmes"],["Read offered programmes and their national guidance","پروگرام اور قومی رہنما پڑھیں"],["Catalogue reads include no-longer-offered programmes so existing history remains understandable; only is_offered programmes can enrol new patients while the service is Active. Read kind, national programme, guideline and service names as the backend supplies them. An authorized programme manager/MSDS viewer may open the official offered-list PDF for display; while inactive it states that none is provided. There is no invented patient card, certificate, dose schedule or enrolment print contract. Current handbook images show an explicitly labelled read-only component preview against the real inactive DEV service, not positive service delivery.","فہرست میں پرانے غیر پیش پروگرام بھی تاکہ تاریخ سمجھ آئے؛ نئے صرف دیے جانے والے اور فعال خدمت میں۔ قسم، قومی پروگرام، رہنما و نام سرور کے مطابق۔ مجاز پروگرام منتظم/معیار ناظر اصل فہرست پی ڈی ایف کھول سکتا؛ غیر فعال میں نہ دینے کی اصل پالیسی ہے۔ فرضی کارڈ، سرٹیفکیٹ، خوراک شیڈول یا اندراج پرنٹ نہیں۔ موجودہ مثال اصل غیر فعال ڈی وی کا واضح صرف پڑھنے جزوی منظر، خدمت دینے کا ثبوت نہیں۔"]),
  "education.record": g(["patient_education"],["Record actual guidance and its recipient","اصل رہنمائی اور وصول کنندہ درج کریں"],["Enter the actual topic (3–300characters), deliberately choose Verbal, Leaflet, Written instructions, Demonstration or Video and Patient/Attendant/Both. No method or recipient is preselected. Note is optional unless you started a corrective entry, when explain the correction. Saving records what was given; it does not provide guidance, play a video or invent a clinical interaction. Keep patient name/MRN/age and flags verified. No offline writes or fabricated education certificate.","اصل موضوع3تا300حروف، زبانی/پرچہ/تحریری/مظاہرہ/ویڈیو اور مریض/تیماردار/دونوں خود چنیں؛ پہلے انتخاب نہیں۔ نوٹ اختیاری، اصلاحی اندراج میں وضاحت لازم۔ محفوظ کرنا دی گئی بات درج کرتا ہے؛ رہنمائی دینا، ویڈیو یا فرضی تعامل نہیں۔ شناخت، عمر اور نشان چیک رہیں۔ آف لائن عمل یا فرضی سرٹیفکیٹ نہیں۔"]),
  "education.material": g(["patient_education"],["Use an actual active material","اصل فعال مواد استعمال کریں"],["Leaflet and Video require the actual active material used. Other methods may link an active material. Read title, topic, kind, language and displayed location; the catalogue filter only changes this view. No resource is invented when the catalogue is empty and no file/video URL is guessed: ask authorized quality/setup staff for the physical or approved media resource. A retired material is refused after a fresh preflight. Material metadata is not a download or print endpoint; Help can print this guide.","پرچے و ویڈیو کو اصل استعمال شدہ فعال مواد لازم؛ دیگر طریقے بھی فعال مواد سے منسلک ہو سکتے ہیں۔ عنوان، موضوع، قسم، زبان و جگہ پڑھیں؛ تلاش صرف نظر بدلتی ہے۔ خالی فہرست پر فرضی مواد یا فائل/ویڈیو پتہ نہیں؛ مجاز کوالٹی/ترتیب سے اصل ذریعہ لیں۔ بند مواد تازہ چیک پر منع۔ یہ فائل یا پرنٹ کا معاہدہ نہیں؛ مدد سے رہنما پرنٹ ہوتا ہے۔"]),
  "education.encounter": g(["patient_education"],["Link the consultation where guidance happened","رہنمائی والی ملاقات منسلک کریں"],["When opened from consultation, the single unambiguous final note of this visit is linked; otherwise deliberately choose the actual patient's encounter. The list includes its type/status/complaint. No linked encounter is explicit for guidance outside a consultation. A different patient's or cancelled note is refused; the actual note is re-read before saving. Linking does not create or finalize a consultation.","معائنے سے کھولنے پر اسی ملاقات کا ایک واضح حتمی نوٹ منسلک؛ ورنہ اصل مریض کی ملاقات خود چنیں۔ قسم، حالت و شکایت پڑھیں۔ معائنے سے باہر رہنمائی میں منسلک نہ ہونا واضح ہے۔ دوسرے مریض یا منسوخ نوٹ منع، محفوظ سے پہلے اصل نوٹ پڑھتا ہے۔ منسلک کرنا معائنہ بنانا یا حتمی کرنا نہیں۔"]),
  "education.save": g(["patient_education"],["Save once and recover the original signed entry","ایک بار محفوظ اور اصل دستخط شدہ اندراج چیک کریں"],["Save education record validates actual topic/method/recipient/material and fresh patient, permission and encounter. It sends one frozen original key/body and prevents double submission. Confirmed response yields an education ID and the author's stamp; a later history read cannot repeat it. Unknown response locks input/navigation for an identical-key/body retry within24hours, with patient history for read-only reconciliation. Outside retention or changed actor ask IT; never create a replacement because a reply is missing.","محفوظ اصل موضوع، طریقہ، وصول کنندہ، مواد، تازہ مریض، اجازت و ملاقات چیک کرتا ہے۔ اصل مقفل درخواست اور دوہرا عمل بند۔ مصدقہ جواب اصل نمبر و مصنف مہر؛ بعد کی پڑھائی نہیں دہراتی۔ گم جواب پر ترمیم و جگہ بدلنا بند،24گھنٹے میں اسی کلید/مواد کی کوشش اور تاریخ سے صرف پڑھ کر چیک۔ مدت گزرے یا صارف بدلے تو آئی ٹی؛ گم جواب پر متبادل نہیں۔"]),
  "education.correction": g(["patient_education"],["Append a corrective entry without editing the original","اصل بدلے بغیر اصلاحی اندراج بڑھائیں"],["Saved education entries have no edit/delete contract. Record a corrective entry for #ID copies the original topic/method/recipient/encounter and any still-active material into a NEW draft, asks before discarding another draft, and requires your explanatory note. The saved note references the original ID; a new server ID/stamp is added while the original remains. Review every copied fact and replace a retired material. Clear/new education entry asks before losing changed text and creates nothing until Save.","محفوظ رہنمائی میں ترمیم/حذف نہیں۔ اصل نمبر کا اصلاحی اندراج موضوع، طریقہ، وصول کنندہ، ملاقات و ابھی فعال مواد نئے مسودے میں لیتا، پچھلا چھوڑنے سے پہلے پوچھتا اور وضاحت مانگتا ہے۔ نوٹ اصل نمبر کا حوالہ، نیا نمبر و مہر؛ اصل برقرار۔ ہر نقل بات اور بند مواد چیک کریں۔ صاف/نیا ترمیم چھوڑنے سے پہلے پوچھتا، محفوظ کیے بغیر کچھ نہیں بنتا۔"]),
  "education.pages": g(["patient_education"],["Read the patient's auditable education history","مریض کی درج ہونے والی رہنمائی تاریخ پڑھیں"],["History reads are patient-record access and are logged. Review actual education ID, topic, time, recipient/method, material, encounter/note and given_by_stamp. Pages are100entries newest first. Older uses the last actual education_id as before_id; continue until an empty page. Newer returns to the previous actual cursor. A failed read is an error, never no education; loading hides stale entries. No data is edited by paging, printing Help or opening a corrective draft.","تاریخ پڑھنا مریض ریکارڈ کی درج رسائی ہے۔ اصل نمبر، موضوع، وقت، وصول کنندہ، طریقہ، مواد، ملاقات، نوٹ و مصنف مہر پڑھیں۔100اندراج نئے پہلے؛ پرانا اصل آخری نمبر سے خالی صفحے تک، نیا پچھلے نمبر پر۔ ناکام پڑھائی خرابی، رہنمائی نہ ہونے کا دعویٰ نہیں؛ لوڈنگ پر پرانا چھپا۔ صفحہ، رہنما پرنٹ یا اصلاحی مسودہ اصل ریکارڈ نہیں بدلتا۔"]),
  "register.filters": g(["referral_register"],["Choose the review period and acknowledgement filter","جائزے کی مدت اور وصولی کا فلٹر چنیں"],["The register defaults to the server's last12months. Enter start/end dates, optional Issued/Acknowledged/Cancelled status and Acknowledgement pending, then Apply referral filters. Reversed dates show an error and preserve the prior applied list without a request. The applied-period caption identifies what you are actually viewing; editing fields alone does not apply them. Reset to last12months clears filters/cursor and rereads. These controls only read records and never record acknowledgement, cancel, issue a letter or change clinical data.","رجسٹر عام طور پر سرور کے آخری12ماہ لاتا ہے۔ ابتدا، اختتام، اختیاری جاری/وصول/منسوخ اور وصولی باقی چن کر فلٹر لاگو کریں۔ الٹی تاریخ پر خرابی، پچھلی فہرست اور کوئی درخواست نہیں۔ لاگو مدت اصل دکھائی فہرست بتاتی؛ خانہ بدلنا لاگو نہیں کرتا۔ آخری12ماہ پر واپس فلٹر و صفحہ صاف کرکے پڑھتا ہے۔ ان سے وصولی، منسوخی، اجرا یا طبی تبدیلی نہیں ہوتی۔"]),
  "register.find": g(["referral_register"],["Find within the loaded page","لائے ہوئے صفحے میں تلاش کریں"],["Search the current loaded page by referral number, patient name/MRN, destination or reason. This is explicitly a page filter, not a whole-register backend search. Clear it to see the page's50returned rows; use period/status/pending filters and Older/Newer pages for other records. No-match is distinct from a server-empty page and from a failed read. The search never saves patient information.","موجودہ صفحے میں حوالہ نمبر، نام/ایم آر این، منزل یا وجہ تلاش کریں۔ یہ اسی صفحے کا فلٹر، پورے سرور کی تلاش نہیں۔ صاف کرنے سے واپس آئی50سطریں؛ باقی کو مدت، حالت، وصولی اور پرانے/نئے صفحے لیں۔ تلاش میں نہ ملنا خالی سرور صفحے یا خرابی سے الگ ہے۔ تلاش مریض کی معلومات محفوظ نہیں کرتی۔"]),
  "register.pages": g(["referral_register"],["Read older and newer real cursor pages","اصل نمبروں سے پرانے اور نئے صفحے پڑھیں"],["Older referral page requests records below the last actual referral_id returned while retaining the applied filters; each page is50rows. Continue until an empty server page, even if the current page has fewer than50. Newer referral page revisits the previous actual cursor; applying/resetting filters starts the newest page. Loading/errors pause page changes and stale rows are hidden. No totals or missing pages are fabricated; the visible/loaded count is only this page.","پرانا صفحہ اصل آخری نمبر سے نیچے وہی لاگو فلٹر رکھ کر50سطریں لاتا ہے۔50سے کم ہوں تب بھی سرور کے خالی صفحے تک جاری رہیں۔ نیا صفحہ پچھلے اصل نمبر، فلٹر یا واپس آغاز پر نیا صفحہ۔ لوڈنگ/خرابی پر صفحہ بدلنا رکتا، پرانی سطر چھپتی ہے۔ فرضی کل یا غائب صفحے نہیں؛ شمار اسی صفحے کا ہے۔"]),
  "register.open": g(["referral_register"],["Open an auditable patient referral for review","جائزے کے لیے درج ہونے والا مریض کا حوالہ کھولیں"],["Use only this establishment's authorized clinical/quality review. Each read is logged. Check number/date, name/MRN, destination, urgency, reason, transport and status, then Open referral on the actual row. The issued letter retains its snapshot and author stamp; current patient flags are separately labelled. Detail and PDF are read-only here, even when you also prescribe. Use the separate Refer out workflow for actual acknowledgement or permitted cancellation; never pretend that reviewing a letter records receipt.","صرف اسی ہسپتال کا مجاز طبی/کوالٹی جائزہ؛ ہر پڑھائی درج ہے۔ نمبر، وقت، نام/ایم آر این، منزل، ترجیح، وجہ، نقل و حمل اور حالت چیک کرکے اصل سطر کھولیں۔ خط اجرا کی شناخت و مہر رکھتا، موجودہ نشان الگ ہیں۔ یہاں تفصیل و پی ڈی ایف صرف پڑھنے کے ہیں چاہے آپ معالج ہوں۔ اصل وصولی/مجاز منسوخی بیرونی حوالے میں؛ خط پڑھنا وصولی نہیں۔"]),
  "referral.history": g(["external_referral"],["Retrieve the patient's saved referrals after reopening","دوبارہ کھولنے پر مریض کے محفوظ حوالے لائیں"],["Patient referral buttons come from real authorized register pages, filtered to the selected patient, plus this session's confirmed issues. The server defaults to the last12months. Load older referral page sends before_id from the actual last row of the current hospital page; a page with no matching patient does not mean the patient has no older referral. Continue until the server returns an empty page, or use Referral register's explicit period when available. Newest referral page resets the cursor. Choosing a letter asks before discarding a draft; no writes or duplicate letters are made by history reads.","مریض کے حوالے اصل مجاز رجسٹر صفحات سے اسی مریض کے اور نشست کے مصدقہ اجرا ہیں۔ عام مدت آخری12ماہ۔ پرانا صفحہ اصل آخری ہسپتال ریکارڈ سے پچھلا لیتا ہے؛ اس صفحے میں مریض نہ ہونا پرانے حوالوں کی نفی نہیں۔ سرور کے خالی صفحے تک یا مجاز رجسٹر میں مدت چنیں۔ نیا صفحہ آغاز پر جاتا ہے۔ خط چننا مسودہ چھوڑنے سے پہلے پوچھتا؛ پڑھائی کوئی خط یا دوہرا عمل نہیں بناتی۔"]),
  "clinical.patient": g(["external_referral","patient_education","patient_programmes","home_visit_record"],["Find a clinical patient with or without an OPD slip","پرچی کے ساتھ یا بغیر طبی مریض تلاش کریں"],["Choose by OPD slip/queue retains the usual verified visit. Find patient without an OPD slip searches actual permitted name/MRN identifiers from2characters with a300msdelay and30results. A Found by old MRN, merged into this record note explains a match through the merged identity; the selected record is the actual master. Select an actual returned patient, then verify name/MRN/age and allergy/death/MLC/temp/merge/outstanding flags. No guessed IDs or fabricated visits. A merged result pauses actions until deliberate selection of the returned master. Changing mode or patient asks before discarding unsaved clinical text and is blocked during an unknown write. Searching cannot register or pay.","پرچی یا قطار سے معمول کی مصدقہ ملاقات چنیں۔ پرچی کے بغیر تلاش اصل نام/شناخت کے2حروف سے300ملی سیکنڈ بعد30نتائج لاتی ہے۔ پرانی شناخت سے ملا، اس ریکارڈ میں ضم ہے کا پیغام پرانے نمبر اور اصل مریض کا فرق واضح کرتا ہے۔ اصل مریض چن کر نام، ایم آر این، عمر، الرجی، وفات، قانونی، عارضی، انضمام و بقایا چیک کریں۔ فرضی نمبر یا ملاقات نہیں۔ ضم مریض پر اصل واپس آئے مریض کا واضح انتخاب لازم۔ مریض یا طریقہ بدلنا مسودہ چھوڑنے سے پہلے پوچھتا اور نامعلوم عمل پر بند ہے۔ تلاش رجسٹر یا ادائیگی نہیں کرتی۔"]),
  "referral.source": g(["external_referral"],["Choose the actual outpatient or emergency source","اصل بیرونی یا ایمرجنسی ماخذ چنیں"],["An external referral is for another facility. Open an OPD slip/queue, or search a patient without an OPD slip and choose an actual open emergency visit. For an outpatient without a selected slip choose the note with its real ticket. Linked sources must name the same patient/visit; the server checks. An admitted patient uses the admission transfer/referral workflow instead. Switching source clears the linked note/summary only after confirmation. Internal re-routing belongs to My live queue, not this letter.","بیرونی حوالہ دوسرے مرکز کو ہے۔ پرچی یا قطار کھولیں، یا بغیر پرچی مریض تلاش کرکے اصل کھلی ایمرجنسی چنیں۔ بغیر پرچی بیرونی مریض کا اصل پرچی والا نوٹ چنیں۔ تمام ماخذ ایک مریض و ملاقات؛ سرور تصدیق کرتا ہے۔ داخل مریض اپنا داخلہ منتقلی طریقہ لیتا ہے۔ ماخذ بدلنا تصدیق کے بعد منسلک نوٹ/خلاصہ صاف کرتا ہے۔ اندرونی ڈاکٹر منتقلی قطار میں، اس خط میں نہیں۔"]),
  "referral.destination": g(["external_referral"],["Choose the receiving facility honestly","وصول کنندہ مرکز درست چنیں"],["Select an active ReferralHospital, TraumaCentre, BloodBank or MlrHospital contact. Read its district/phone before arranging reception. If the patient chooses elsewhere, deliberately tick At the patient's request and name their chosen facility; free text is not a substitute for a missing contact permission. Destination department is optional. No contact is invented, silently created or rewritten. A retired contact is refused on fresh preflight. Contact maintenance belongs to authorized setup staff.","فعال حوالہ ہسپتال، ٹراما مرکز، بلڈ بینک یا قانونی رپورٹ ہسپتال چنیں۔ ضلع و فون پڑھ کر وصولی طے کریں۔ مریض کہیں اور چاہے تو درخواست کا نشان خود لگا اور مانگا مرکز لکھیں؛ آزاد متن اجازت کی کمی کا بدل نہیں۔ شعبہ اختیاری ہے۔ فرضی رابطہ بننا یا بدلنا نہیں۔ بند رابطہ تازہ چیک پر منع۔ رابطوں کی ترتیب مجاز عملہ کرتا ہے۔"]),
  "referral.summary": g(["external_referral"],["Confirm the clinical summary and reason","طبی خلاصہ اور وجہ تصدیق کریں"],["The unambiguous current doctor's final note prefills complaint/findings/provisional diagnosis; otherwise select the actual note and Use summary from selected note. Replacing edited text requires confirmation. Read and deliberately confirm the summary; editing it clears confirmation. Reason needs3–2000characters, summary3–4000; choose Routine/Urgent/Emergency. Treatment actually given is optional and never inferred from a treatment plan. Draft-note status remains visible. Verify details for the receiving clinician before issue.","واضح اسی معالج کے حتمی نوٹ سے شکایت، معائنہ و ابتدائی تشخیص آتی ہے؛ ورنہ اصل نوٹ چن کر اس کا خلاصہ لیں۔ ترمیم شدہ متن بدلنے سے پہلے پوچھتا ہے۔ خلاصہ پڑھ کر خود تصدیق کریں؛ بدلنے سے تصدیق صاف ہوتی ہے۔ وجہ3تا2000، خلاصہ3تا4000حروف؛ عام، فوری یا ایمرجنسی چنیں۔ واقعی دیا علاج اختیاری، منصوبے سے فرض نہیں۔ مسودے کی حالت واضح رہتی ہے۔ وصول کرنے والے معالج کے لیے چیک کریں۔"]),
  "referral.transport": g(["external_referral"],["Plan transport and follow receiving acknowledgement","نقل و حمل اور مرکز کی وصولی طے کریں"],["Choose Own, Ambulance, Rescue or WithStaff deliberately. WithStaff requires the actual escort name and shows Acknowledgement pending after issue. Care during transfer is optional: record the actual oxygen/drip/monitoring plan, never default a treatment. This entry does not dispatch an ambulance or prove arrival. Coordinate reception/transport through the hospital's real workflow. Actual receipt at the destination is a separate named acknowledgement.","اپنی، ایمبولینس، ریسکیو یا ہمارے عملے کے ساتھ خود چنیں۔ ساتھ عملے کا اصل نام لازم اور اجرا کے بعد وصولی باقی دکھتی ہے۔ راستے میں نگہداشت اختیاری؛ اصل آکسیجن، ڈرپ یا نگرانی منصوبہ لکھیں، علاج فرض نہیں۔ یہ ایمبولینس نہیں بھیجتا اور پہنچنے کا ثبوت نہیں۔ اصل ہسپتال کے طریقے سے وصولی و منتقلی طے کریں۔ منزل پر اصل وصولی الگ نام زد تصدیق ہے۔"]),
  "referral.issue": g(["external_referral"],["Issue one immutable referral letter","ایک ناقابل ترمیم حوالہ خط جاری کریں"],["Issue external referral sends a frozen original actor/patient/source/key/body after current patient, author permission, source lock and contact checks. Double-click is single-flight. The server snapshots patient particulars and the active registered doctor's stamp; a later demographic edit cannot rewrite the issued letter. A lost reply locks input/navigation and offers the identical original-key retry within24hours; never create a replacement on uncertainty. No offline queue, automatic print, patient transfer, payment or acknowledgement is fabricated.","جاری کریں تازہ مریض، مصنف اجازت، اصل پابندی اور رابطہ چیک کرکے مقفل اصل صارف، ماخذ، نمبر و مواد بھیجتا ہے۔ دو کلک ایک عمل ہیں۔ سرور اس وقت کی شناخت و مجاز رجسٹرڈ معالج کی مہر محفوظ کرتا؛ بعد کی شناخت خط نہیں بدلتی۔ گم جواب پر ترمیم و جگہ بدلنا بند؛24گھنٹے میں وہی اصل کوشش ہے، متبادل نہیں۔ آف لائن قطار، خود پرنٹ، منتقلی، ادائیگی یا فرضی وصولی نہیں۔"]),
  "referral.record": g(["external_referral","referral_register"],["Read the issued referral and its audit state","جاری حوالہ اور اس کی حالت پڑھیں"],["Read the immutable number, patient snapshot, destination, urgency, reason, summary, treatment, transport/escort/care and referring stamp. Current patient flags are separately labelled; a merge does not rewrite the letter. Patient history retrieves saved letters from the current hospital register page, filtered to this patient. Load older referral page continues by the actual cursor; Open referral register chooses a wider period when permitted. New external referral starts a distinct draft after discard confirmation. No edit/delete is offered; Issued can be cancelled or actually acknowledged, and either closed state remains readable.","ناقابل ترمیم نمبر، شناخت، منزل، ترجیح، وجہ، خلاصہ، علاج، نقل و حمل و نگہداشت اور مہر پڑھیں۔ موجودہ مریض کے نشان الگ ہیں؛ انضمام خط نہیں بدلتا۔ موجودہ اصل ہسپتال صفحے سے مریض کے محفوظ حوالے ہیں؛ پرانا صفحہ اصل نمبر سے اور مجاز رجسٹر وسیع مدت لیتا ہے۔ نیا حوالہ تصدیق کے بعد الگ مسودہ ہے۔ ترمیم یا حذف نہیں؛ جاری حوالہ منسوخ یا واقعی وصول، اور بند حالت بھی پڑھی جا سکتی ہے۔"]),
  "referral.ack": g(["external_referral"],["Record actual receiving-facility acknowledgement","مرکز کی اصل وصولی درج کریں"],["Only record what actually happened: name who received this patient at the destination, and the hospital-time receipt timestamp (blank means server now), with an optional note. Timestamp must be between issue and now. Deliberately confirm the receiving facility acknowledged actual receipt; printing or issuing is not acknowledgement. WithStaff remains pending until this is recorded. No automatic replay: a lost state-guard reply requires reading the original referral; REFERRAL_CLOSED means it may already have succeeded. Never invent a receiving person or physical handover.","صرف اصل واقعہ درج کریں: منزل پر اسی مریض کو لینے والے کا نام اور ہسپتال کے وقت میں وصولی، خالی تو سرور کا اب؛ نوٹ اختیاری۔ وقت اجرا اور اب کے درمیان۔ مرکز کی اصل وصولی خود تصدیق کریں؛ اجرا یا پرنٹ وصولی نہیں۔ عملے کے ساتھ پر یہی تصدیق آنے تک باقی ہے۔ گم جواب خود نہیں دہراتا؛ اصل حوالہ پڑھیں، بند کا مطلب پہلے عمل ہو سکتا ہے۔ فرضی شخص یا حوالگی نہ لکھیں۔"]),
  "referral.cancel": g(["external_referral"],["Cancel a referral that did not happen","جو حوالہ واقع نہیں ہوا اسے منسوخ کریں"],["An Issued referral that did not happen can be cancelled with a3–1000character reason; check patient, number and destination and confirm once. The letter remains in the record marked CANCELLED. Acknowledged/Cancelled is closed (REFERRAL_CLOSED). Never edit an issued summary; cancel and deliberately create a new letter if required. A lost reply uses read-only reconciliation, not automatic replay or a new key. Cancel/Close/Escape asks before losing unsent reason text.","جو جاری حوالہ واقع نہیں ہوا اسے3تا1000حروف کی وجہ سے منسوخ کریں؛ مریض، نمبر و منزل چیک اور ایک بار تصدیق۔ خط منسوخ نشان کے ساتھ رہتا ہے۔ وصول یا منسوخ بند ہے۔ جاری خلاصہ نہ بدلیں؛ ضرورت ہو تو منسوخ کرکے سوچا ہوا نیا خط۔ گم جواب پر صرف پڑھ کر چیک، خود دہرانا یا نیا نمبر نہیں۔ بند یا منسوخ غیر ارسال وجہ چھوڑنے سے پہلے پوچھتا ہے۔"]),
  "referral.action": g(["external_referral"],["Confirm a separate referral action","حوالے کا الگ عمل تصدیق کریں"],["Read the dialog title and patient/referral/destination. Supply cancellation reason or actual recipient/time/confirmation as requested, then Confirm referral action once. Pending/unknown results lock dismissal and normal controls; recovery remains outside the disabled form. Read current result re-reads the original record; compare it, release the hold and refresh before any further action. No state-guard action is replayed automatically, and closing an unsent dialog creates nothing.","عنوان، مریض، نمبر و منزل پڑھیں۔ منسوخی کی وجہ یا اصل وصول کنندہ، وقت اور تصدیق دے کر ایک بار عمل کریں۔ زیر عمل یا نامعلوم نتیجے پر بند کرنا و عام خانے مقفل، چیک باہر دستیاب۔ اصل ریکارڈ پڑھ کر ملائیں، روک ختم و تازہ کرکے اگلا عمل کریں۔ حالت والا عمل خود نہیں دہراتا اور غیر ارسال مکالمہ بند کرنے سے کچھ نہیں بنتا۔"]),
  "referral.print": g(["external_referral","referral_register"],["Open, print or save the original referral PDF","اصل حوالہ پی ڈی ایف کھول، پرنٹ یا محفوظ کریں"],["Open referral letter/print fetches the authenticated issued PDF into a separate sandboxed PDF window; use its Print control and actual printer, checking patient/MRN and referring stamp. Save referral letter PDF downloads the same issued document through a native Save dialog. The record keeps the letter; a cancellation copy says CANCELLED. Viewer windows close on logout/session recovery. Save/print failure does not repeat issue, transport, payment or acknowledgement. No rewritten client letter or ZIP; native physical printer/Urdu review remains pending.","خط کھول/پرنٹ مجاز اصل پی ڈی ایف الگ محفوظ کھڑکی میں؛ اس کا پرنٹ اور اصل پرنٹر، پہلے مریض و مہر چیک۔ محفوظ کریں وہی اصل خط عام مکالمے سے لیتا ہے۔ ریکارڈ خط رکھتا؛ منسوخ نقل پر نشان ہے۔ سائن آؤٹ یا بحالی پر کھڑکی بند۔ خرابی اجرا، نقل و حمل، ادائیگی یا وصولی نہیں دہراتی۔ مقامی بدلا خط یا زپ نہیں؛ اصل پرنٹر و اردو جائزہ باقی ہے۔"]),
  "diagnostics.context": g(["lab_orders_results"],["Choose diagnostic care context and priority","ٹیسٹ کی جگہ اور ترجیح چنیں"],["Keep name/MRN/age and patient flags visible. Choose this OPD visit or an actual eligible admission from this patient's history. Routine is the backend default; Urgent and STAT use emergency turnaround. OPD tests create an unpaid laboratory invoice for the cashier; IPD costs go to the running bill. No cash is collected on this screen. A service change, death, merged identity, clinical lock or lost current context blocks new orders while history stays readable.","نام، ایم آر این، عمر اور نشان چیک رکھیں۔ اسی ملاقات یا اسی مریض کا اصل موزوں داخلہ چنیں۔ عام سرور کی طے شدہ ترجیح؛ فوری پر ایمرجنسی مدت ہے۔ بیرونی ٹیسٹ کی غیر ادا انوائس کیشیئر اور داخل مریض کا خرچ جاری بل میں ہے۔ یہاں نقد نہیں لیا جاتا۔ خدمت بدلنے، وفات، ضم شناخت، طبی پابندی یا گم تازہ شناخت پر نئے احکامات بند؛ تاریخ پڑھی جا سکتی ہے۔"]),
  "diagnostics.tests": g(["lab_orders_results"],["Choose real tests and explain send-outs","اصل ٹیسٹ اور بیرونی لیب بتائیں"],["Filter the returned active test catalogue by name/code/section. Check sample type, price where your permission exposes it, routine/emergency turnaround and InHouse versus SendOut. A SendOut names the partner laboratory: tell the patient where it goes. InHouse needs Active laboratory; SendOut needs Active outsourced_diagnostics. Disabled choices explain missing test/service availability. Select1–50tests; notes capture the clinical question, not a laboratory result. Refresh cannot submit an order.","واپس آئی فعال فہرست میں نام، کوڈ یا شعبے سے تلاش کریں۔ نمونہ، مجاز قیمت، عام و فوری مدت اور اندرونی یا بیرونی لیب چیک کریں۔ بیرونی ٹیسٹ کا شراکت دار مریض کو بتائیں۔ اندرونی کو فعال لیب، بیرونی کو فعال بیرونی تشخیص لازم۔ بند انتخاب وجہ بتاتا ہے۔1تا50ٹیسٹ اور طبی سوال لکھیں؛ نتیجہ نہیں۔ تازہ کریں آرڈر نہیں بھیجتا۔"]),
  "diagnostics.order": g(["lab_orders_results"],["Submit a separate diagnostic order once","ٹیسٹ کا الگ آرڈر ایک بار بھیجیں"],["Order selected tests or Create imaging order sends one frozen request after fresh identity, permission, admission, test and service checks. Each has its own original UUID/body and single-flight protection. A lost reply locks edits/navigation; Retry original request repeats the exact key/body within24hours, never a new invoice/order. Read current result is read-only reconciliation. A confirmed order is not a result or payment; follow-up reads/printing do not repeat it. Record the returned requisition or imaging accession number for the receiving team.","منتخب ٹیسٹ یا عکس کا آرڈر تازہ شناخت، اجازت، داخلہ، ٹیسٹ و خدمت چیک کرکے ایک مقفل درخواست بھیجتا ہے۔ ہر ایک الگ اصل نمبر، مواد اور ایک وقت کا عمل ہے۔ جواب گم ہو تو ترمیم و جگہ بدلنا بند؛24گھنٹے میں اصل درخواست وہی نمبر و مواد سے چیک ہے، نئی انوائس نہیں۔ نتیجہ چیک صرف پڑھتا ہے۔ مصدقہ آرڈر نتیجہ یا ادائیگی نہیں؛ بعد کی پڑھائی یا پرنٹ نہیں دہراتا۔ وصول کرنے والے کو اصل آرڈر و ایکسیشن نمبر بتائیں۔"]),
  "diagnostics.imaging": g(["lab_orders_results"],["Specify the imaging examination and side","عکس کا معائنہ اور سمت لکھیں"],["Choose modality, actual body part/examination and clinical indication. Deliberately select Left/Right/Bilateral or Not applicable; never infer the side from text. A catalogued Imaging tariff service is optional; select its actual code/name/price, never guess a service ID or promise an unselected price. New imaging requires Active imaging. Saved order shows DICOM accession number, current state, priority, due times, clinical indication and partner details if outsourced. Progressing/cancelling imaging belongs to radiology's separate workflow.","عکس کی قسم، اصل حصہ/معائنہ اور طبی وجہ لکھیں۔ بائیں، دائیں، دونوں یا غیر متعلق خود چنیں؛ متن سے سمت فرض نہ کریں۔ نرخ کی عکس خدمت اختیاری ہے؛ اصل کوڈ، نام، قیمت چنیں، فرضی نمبر یا غیر منتخب قیمت کا وعدہ نہیں۔ نئی عکس خدمت فعال ہو۔ محفوظ حکم میں ایکسیشن، حالت، ترجیح، مدت، وجہ اور بیرونی مرکز آتا ہے۔ عکس کو آگے یا منسوخ کرنا شعبہ عکس کا الگ کام ہے۔"]),
  "diagnostics.transport": g(["lab_orders_results"],["Arrange safe inpatient transfer","داخل مریض کی محفوظ منتقلی طے کریں"],["For an inpatient choose how the patient comes: Walking, Wheelchair, Trolley, Bed or Portable at bedside, and choose None/Nurse/Doctor escort deliberately. Special or interventional procedures require a Doctor escort. Coordinate the chosen transfer with the ward and radiology; entering a transport plan does not dispatch a porter or perform the examination. OPD orders do not invent inpatient transport details.","داخل مریض کے لیے پیدل، وہیل چیئر، ٹرالی، بیڈ یا بستر پر قابل نقل معائنہ چنیں؛ کوئی نہیں، نرس یا ڈاکٹر ساتھ جانے والا خود چنیں۔ خاص یا مداخلتی عمل میں ڈاکٹر لازم ہے۔ وارڈ و شعبہ عکس سے منتقلی طے کریں؛ لکھنے سے پورٹر روانہ یا معائنہ نہیں ہوتا۔ بیرونی مریض پر داخل کی نقل و حمل فرض نہیں ہوتی۔"]),
  "diagnostics.history": g(["lab_orders_results"],["Read the patient's real order history","مریض کے اصل احکامات پڑھیں"],["Laboratory history shows the latest200requisitions allowed by the endpoint. Open the actual number for items, sample barcode/status, due time, send-out partner, result status, correction reason and invoice balance. A rejected sample requires a new sample coordinated with the laboratory, not a fabricated result or repeated registration. Imaging rows open their real order/report. Loading or error hides stale details. Refresh is read-only; no edit/delete of published results is offered here.","لیب کا معاہدہ آخری200احکامات دکھاتا ہے۔ اصل نمبر سے ٹیسٹ، نمونہ بارکوڈ و حالت، مدت، بیرونی لیب، نتیجہ، تصحیح اور انوائس بقایا پڑھیں۔ مسترد نمونے کو لیب کے ساتھ نیا نمونہ چاہیے؛ فرضی نتیجہ یا نئی رجسٹریشن نہیں۔ عکس کی اصل قطار آرڈر و رپورٹ کھولتی ہے۔ لوڈنگ یا خرابی پر پرانی تفصیل چھپتی ہے۔ تازہ صرف پڑھتا؛ جاری نتیجہ بدلنا یا حذف یہاں نہیں۔"]),
  "diagnostics.cancel": g(["lab_orders_results"],["Cancel your unsampled laboratory order","اپنا غیر نمونہ لیا لیب آرڈر منسوخ کریں"],["The ordering doctor with lab.requisition.cancel_own may cancel their own order while no test is sampled; the lab administrator has wider cancellation permission in their workspace. Enter3–1000characters, verify patient/requisition and Confirm once. A fresh sample/status/ownership read occurs before sending. Collected samples hide the button and LAB_ITEM_STATE_INVALID must be respected. Another doctor's order is not yours to cancel. Unpaid bills are voided by the server; already paid effects are not invented as refunds. Lost reply recovery uses this cancellation's identical original key. Cancel/Close/Escape asks before losing reason text.","مجاز حکم دینے والا ڈاکٹر صرف اپنا آرڈر نمونہ لیے جانے سے پہلے منسوخ کرتا ہے؛ لیب ایڈمن کی جگہ میں وسیع اجازت ہے۔3تا1000حروف کی وجہ، مریض و نمبر چیک اور ایک تصدیق کریں۔ پہلے تازہ نمونہ، حالت اور مالک پڑھتا ہے۔ نمونہ لیا ہو تو بٹن چھپا اور سرور کے انکار کا احترام ہے۔ دوسرے ڈاکٹر کا حکم منسوخ نہ کریں۔ غیر ادا بل سرور واپس کرتا ہے؛ ادا رقم کو فرضی واپسی نہیں۔ گم جواب اسی منسوخی کی اصل درخواست سے چیک ہے۔ بند یا منسوخ وجہ چھوڑنے سے پہلے پوچھتا ہے۔"]),
  "diagnostics.trends": g(["lab_orders_results"],["Read published results and numeric trends","جاری نتائج اور عددی رجحان پڑھیں"],["Doctors see Published results only, plus an explicitly provisionally released critical value labelled Pending verification in red. Rejected/Superseded/unreleased routine entries are not clinical results. Read metric value, unit/reference from the current catalogue, flag and verified_stamp; the issued report owns its historical reference ranges. Select one actual test and metric for chronologically ordered published numeric values and dates; at least2values draws a line. Text/provisional values are excluded from the numeric chart. No diagnosis, interpolation or clinical threshold is invented. Outside reports belong to Patient document vault and must remain labelled as outside.","ڈاکٹر صرف جاری نتائج اور واضح عارضی انتہائی اہم نتیجہ سرخ تصدیق باقی کے ساتھ دیکھتے ہیں۔ مسترد، بدلا یا عام غیر جاری اندراج نتیجہ نہیں۔ قدر، موجودہ فہرست کی اکائی و حد، نشان اور مہر پڑھیں؛ اصل رپورٹ اپنی تاریخی حد رکھتی ہے۔ اصل ٹیسٹ و پیمائش سے وقت کی ترتیب میں مصدقہ عدد و تاریخ، کم از کم دو پر لکیر ہے۔ متن و عارضی عدد چارٹ میں نہیں۔ تشخیص، درمیانی قدر یا طبی حد فرض نہیں ہوتی۔ بیرونی رپورٹ دستاویزات میں بیرونی نشان کے ساتھ ہے۔"]),
  "diagnostics.critical": g(["lab_orders_results"],["Respond to critical and withdrawn provisional values","انتہائی اہم یا واپس عارضی نتیجے پر عمل"],["A sticky red warning means contact the clinical team promptly, verify the patient and current status, and use the permitted Critical results workflow for acknowledgement. Reading/printing is not acknowledgement. Pending verification means the value is unverified and must not print. A provisional_withdrawn event immediately removes that value and says do not act on it; current reads reload without polling. If acknowledgement is not available in this build/account, contact the responsible clinical team and use their authorized workflow; never fabricate an acknowledgement.","مسلسل سرخ پیغام پر فوراً طبی عملے سے رابطہ، مریض و موجودہ حالت چیک اور مجاز انتہائی اہم نتائج میں وصولی درج کریں۔ پڑھنا یا پرنٹ وصولی نہیں۔ تصدیق باقی غیر مصدقہ قدر ہے، پرنٹ نہیں۔ واپس لینے کا واقعہ فوراً وہ قدر ہٹاتا اور اس پر عمل سے روکتا؛ پڑھائی خود تازہ، ٹائمر نہیں۔ اس بلڈ یا اکاؤنٹ میں وصولی نہ ہو تو ذمہ دار طبی عملے کا مجاز طریقہ لیں؛ فرضی تصدیق نہ کریں۔"]),
  "diagnostics.print": g(["lab_orders_results"],["Print verified reports separately from orders","مصدقہ رپورٹ آرڈر سے الگ پرنٹ کریں"],["Only a requisition with Published tests offers a report; the fresh print payload contains verified tests only. Partial reports say other tests remain pending. A4 local EN/UR PDF/print preserves hospital letterhead, patient identifiers, reference ranges, flags, performed/verified stamps, corrections/reasons and partner details. Imaging prints only a Reported study with its reported stamp. Download official PDF uses the authenticated server endpoint; no ZIP. Registered terminals need the mapped document printer; unregistered ones use a normal dialog. A print/save failure leaves order/results unchanged and cannot repeat ordering, registration or payment. Physical/native Urdu printing still needs human review.","جاری ٹیسٹ والے آرڈر میں رپورٹ؛ تازہ پرنٹ معلومات صرف مصدقہ ٹیسٹ ہیں۔ جزوی رپورٹ باقی ٹیسٹ بتاتی ہے۔ مقامی انگریزی/اردو اے4میں ہسپتال، شناخت، حد، نشان، کرنے و تصدیق کی مہر، تصحیح، وجہ اور بیرونی مرکز محفوظ ہیں۔ عکس صرف رپورٹ شدہ معائنہ اور مہر کے ساتھ۔ اصل پی ڈی ایف مجاز سرور سے؛ زپ نہیں۔ رجسٹرڈ کو مقررہ دستاویز پرنٹر، ورنہ عام مکالمہ۔ خرابی آرڈر و نتائج نہیں بدلتی اور رجسٹریشن، آرڈر یا ادائیگی نہیں دہراتی۔ اصل اردو پرنٹر کا انسانی جائزہ باقی ہے۔"]),
  "diagnostics.viewer": g(["lab_orders_results"],["Open the actual PACS viewer safely","اصل عکس ویور محفوظ کھولیں"],["Open PACS viewer re-reads the authorized imaging order and opens only its supplied HTTP/HTTPS viewer_url in a separate sandboxed window without the terminal bridge. A study-available event for this patient does the same once per order; null URL offers no invented link. The window closes on logout/session recovery. A missing URL or network failure is visible; ask radiology to check the study link rather than guessing an Orthanc address. Do not share patient viewer links.","ویور اصل مجاز آرڈر دوبارہ پڑھ کر صرف سرور کا دیا ہوا ویب پتہ الگ محفوظ کھڑکی میں کھولتا ہے، ٹرمینل رسائی کے بغیر۔ اسی مریض کے دستیاب معائنے کا واقعہ ایک بار یہی کرتا؛ خالی پتے پر فرضی ربط نہیں۔ سائن آؤٹ یا سیشن بحالی پر کھڑکی بند۔ گم پتہ یا رابطے کی خرابی واضح؛ فرضی پتہ بنانے کے بجائے شعبہ عکس سے ربط چیک کرائیں۔ مریض کا ویور ربط شیئر نہ کریں۔"]),
  "rx.action": g(["eprescription"],["Confirm a separate prescription action","نسخے کے الگ عمل کی تصدیق"],["Check the dialog title, patient and prescription. Cancellation needs a reason; actual handover needs recipient, retained-copy method and explicit confirmation that it happened. Confirm once. Pending or unknown results lock normal dismissal and inputs while recovery remains available. Cancel/Close/Escape asks before discarding changed details. Neither action edits the medicine content or records a payment.","مکالمے کا عنوان، مریض اور نسخہ چیک کریں۔ منسوخی کو وجہ؛ اصل حوالگی کو وصول کنندہ، نقل کا طریقہ اور واقع ہونے کی واضح تصدیق لازم ہے۔ ایک بار تصدیق کریں۔ زیرعمل یا نامعلوم نتیجے پر عام بند کرنا و خانے مقفل، نتیجہ چیک دستیاب ہے۔ منسوخ، بند یا ایسکیپ ترمیم چھوڑنے سے پہلے پوچھتا ہے۔ دونوں دوائی کا مواد یا ادائیگی نہیں بدلتے۔"]),
  "rx.history": g(["eprescription"],["Read prescriptions or start a separate order","نسخے پڑھیں یا الگ حکم شروع کریں"],["Use the patient's real consolidated prescription list, including prescriptions brought across a merge. Opening a saved prescription is read-only; its medicine content is never edited. New prescription starts a separate order after confirming unsaved draft disposal. Check the number, status, prescriber, destination, queries, dispensations and handovers. Refresh repeats reads only. No delete is offered; cancellation requires its separate permission and reason.","مریض کی اصل مجموعی فہرست پڑھیں، انضمام سے آئے نسخے بھی۔ محفوظ نسخے کی دوائیاں تبدیل نہیں ہوتیں۔ نیا نسخہ غیر محفوظ مسودہ چھوڑنے کی تصدیق کے بعد الگ حکم ہے۔ نمبر، حالت، معالج، منزل، سوالات، فراہمی اور حوالگی چیک کریں۔ تازہ کریں صرف پڑھتا ہے۔ حذف نہیں؛ منسوخی الگ اجازت اور وجہ مانگتی ہے۔"]),
  "rx.destination": g(["eprescription"],["Choose hospital pharmacy or external market","ہسپتال کی فارمیسی یا بیرونی بازار چنیں"],["Choose deliberately. Hospital pharmacy is offered only while the server's dispensing capability is Active; an external/local-market prescription remains available otherwise and never enters the hospital dispensing queue. An external free-text line cannot be sent to Hospital pharmacy. Changing destination preserves your draft for correction; it does not submit anything.","خود انتخاب کریں۔ ہسپتال کی فارمیسی صرف سرور کی فراہمی خدمت فعال ہو تو ملتی ہے؛ بیرونی بازار کا نسخہ پھر بھی دستیاب اور ہسپتال کی قطار میں نہیں جاتا۔ بیرونی آزاد نام والی دوائی ہسپتال نہیں بھیجی جا سکتی۔ منزل بدلنے سے مسودہ تصحیح کے لیے محفوظ رہتا ہے، کچھ ارسال نہیں ہوتا۔"]),
  "rx.context": g(["eprescription"],["Link the care context and consultation","علاج کی جگہ اور طبی نوٹ منسلک کریں"],["Select OPD/ER or IPD/CodeRed. Inpatient orders require this patient's actual eligible admission from consolidated history; no guessed identifiers. Select the relevant encounter from this visit so the printout includes complaint, examination, diagnosis, advice, weight if recorded and VCO. No note selected is explicit. Verify the patient's name, MRN, age and allergy/death/merge flags before submitting.","او پی ڈی، ایمرجنسی یا داخلہ چنیں۔ داخل مریض کے لیے مجموعی تاریخ سے اسی مریض کا اصل موزوں داخلہ لازم ہے؛ فرضی نمبر نہیں۔ اسی ملاقات کا نوٹ چنیں تاکہ پرنٹ میں شکایت، معائنہ، تشخیص، مشورہ، درج وزن اور رضامندی آئے۔ نوٹ نہ چننا واضح ہے۔ ارسال سے پہلے نام، ایم آر این، عمر اور الرجی، وفات و انضمام چیک کریں۔"]),
  "rx.search": g(["eprescription"],["Search and select a formulary medicine","فہرست سے دوائی تلاش اور منتخب کریں"],["Enter at least two characters; search waits300ms and returns up to30 server matches. Stale responses are hidden. Read name, generic, strength, form, schedule, stock text and safety warnings; Add medicine creates an unsent line. Stock updates/reconnect refresh reads without polling. Never choose by colour alone or treat stock as a dispensing guarantee.","کم از کم دو حروف لکھیں؛300ملی سیکنڈ بعد سرور کے30نتائج تک آتے ہیں۔ پرانے جواب چھپتے ہیں۔ نام، عام نام، طاقت، شکل، شیڈول، اسٹاک اور خطرات پڑھیں۔ شامل کریں صرف غیر ارسال دوائی بناتا ہے۔ اسٹاک واقعہ یا دوبارہ رابطے پر پڑھائی تازہ ہوتی ہے، ٹائمر سے نہیں۔ صرف رنگ سے نہ چنیں، اسٹاک فراہمی کی ضمانت نہیں۔"]),
  "rx.stock": g(["eprescription"],["Read live stock and expiry detail","موجودہ اسٹاک اور میعاد پڑھیں"],["Stock details opens the real selected medicine's quantity and batches in FEFO order. InStock is green, Low amber and OutOfStock red, each with text. Medicines already added to the draft refresh on stock events and reconnect. Old availability is hidden during a read or failure; Create prescription waits for current stock. Retry the failed read. A change to safety facts clears the acknowledgement for that line; dose and other authored fields remain intact. A failed read is an error, never zero stock. This is prescribing information; no stock adjustment or dispensing occurs here. Close/Escape returns to the prescription, and F1 preserves it.","تفصیل اصل منتخب دوائی کی مقدار اور جلد ختم ہونے والے بیچ دکھاتی ہے۔ دستیاب سبز، کم زرد اور ختم سرخ ہے؛ ہر رنگ کے ساتھ لفظ بھی ہے۔ مسودے کی دوائی بھی اسٹاک کے واقعے یا دوبارہ اتصال پر تازہ ہوتی ہے۔ پڑھنے یا خرابی کے دوران پرانا اسٹاک چھپتا اور نسخہ بنانا رک جاتا ہے؛ ناکام پڑھائی دوبارہ کریں۔ حفاظتی معلومات بدلنے پر اسی دوائی کی تصدیق دوبارہ کریں؛ خوراک اور لکھے خانے برقرار ہیں۔ ناکام پڑھائی خرابی ہے، صفر اسٹاک نہیں۔ یہاں اسٹاک بدلنا یا دوائی دینا نہیں ہوتا۔ بند یا ایسکیپ نسخے پر واپس آتا اور ایف۱ اسے محفوظ رکھتا ہے۔"]),
  "rx.lines": g(["eprescription"],["Build medicine lines without guessing a regimen","خوراک فرض کیے بغیر دوائیاں لکھیں"],["Add a formulary medicine or an external name/strength/form when External market is selected. Enter a positive quantity and dose including units. No treatment, route, frequency or duration is invented. Remove unsent line only removes draft input; saved content cannot be edited. Read server PRESCRIPTION_INCOMPLETE details for each line and correct highlighted fields while keeping the draft. Notes are instructions for this actual prescription.","فہرست کی دوائی شامل کریں یا بیرونی بازار پر نام، طاقت، شکل لکھیں۔ مثبت مقدار اور اکائی سمیت خوراک دیں۔ علاج، راستہ، وقفہ یا مدت فرض نہیں کی جاتی۔ غیر ارسال دوائی ہٹانا صرف مسودہ بدلتا ہے؛ محفوظ مواد نہیں بدلتا۔ سرور کی نامکمل دوائی کی تفصیل سے نمایاں خانے درست کریں؛ مسودہ رہتا ہے۔ نوٹ اسی نسخے کی ہدایات ہیں۔"]),
  "rx.directions": g(["eprescription"],["Specify directions and inpatient timing","ہدایات اور داخل مریض کا وقت لکھیں"],["OPD/ER needs dose, route, frequency and duration in whole days; a single STAT dose needs dose and route. Inpatients also need a start time in the hospital timezone; end is optional and later than start. PRN and STAT set their explicit flags. Other frequency needs a positive interval in hours. No MAR doses are fabricated by the client: the server generates the inpatient MAR from the confirmed order.","بیرونی مریض کے لیے خوراک، راستہ، وقفہ اور پورے دنوں میں مدت لازم ہے؛ ایک فوری خوراک کو خوراک اور راستہ چاہیے۔ داخل مریض کا آغاز ہسپتال کے وقت میں لازم؛ اختتام اختیاری اور بعد میں ہے۔ حسب ضرورت اور فوری انتخاب اپنے نشان رکھتے ہیں۔ دیگر وقفے کے لیے مثبت گھنٹے دیں۔ ایپ خوراک کا فرضی چارٹ نہیں بناتی؛ سرور مصدقہ حکم سے بناتا ہے۔"]),
  "rx.safety": g(["eprescription"],["Confirm medicine safety warnings","دوائی کے حفاظتی خطرات کی تصدیق کریں"],["Read red high-alert category, restricted-prescribing notice and looks/sounds-like medicine names, then deliberately confirm the intended name, strength and form for each warned line. The server verifies PMDC/Prescribing and RestrictedPrescribing privileges; permission to open the screen does not grant them. A fresh safety change blocks submission until reselection/review. Self-administration is only an inpatient non-high-alert oral, inhaled or topical medicine explicitly allowed by the prescriber.","سرخ زیادہ خطرے کی قسم، محدود اجازت اور ملتے نام پڑھیں، پھر ہر خطرے والی دوائی کا مطلوبہ نام، طاقت اور شکل خود تصدیق کریں۔ سرور رجسٹریشن اور خصوصی اجازت چیک کرتا ہے؛ صفحہ کھولنا اجازت نہیں دیتا۔ حفاظتی تبدیلی پر دوائی دوبارہ چن کر پڑھیں۔ خود لینے کی اجازت صرف معالج کے واضح حکم سے داخل مریض کی غیر خطرناک منہ، سانس یا جلد کی دوائی کے لیے ہے۔"]),
  "rx.save": g(["eprescription"],["Create once and recover the original request","ایک بار نسخہ بنائیں اور اصل درخواست چیک کریں"],["Create prescription reviews fresh patient/ticket, permissions, capability and medicine safety, then sends one frozen body/key. Double-click is single-flight. An unknown reply locks draft/navigation; Retry original request uses the identical key/body within24hours, never a new prescription. State/version actions use read-only reconciliation instead. A later print or read failure cannot undo or repeat the confirmed prescription. Read visible errors and references; contact IT after retention or an actor change.","نسخہ بنائیں تازہ مریض، پرچی، اجازت، خدمت اور دوائی کی حفاظت چیک کرکے ایک مقفل درخواست بھیجتا ہے۔ دو کلک ایک عمل ہیں۔ جواب گم ہو تو مسودہ اور جگہ بدلنا بند؛ اصل کوشش24گھنٹے میں اسی نمبر اور مواد سے ہے، نیا نسخہ نہیں۔ حالت والے عمل صرف پڑھ کر چیک ہوتے ہیں۔ بعد کی پرنٹ یا پڑھائی خرابی مصدقہ نسخہ نہیں دہراتی۔ خرابی اور حوالہ پڑھیں؛ مدت یا صارف بدلنے پر آئی ٹی سے کہیں۔"]),
  "rx.cancel": g(["eprescription"],["Cancel with a reason; never edit saved content","وجہ سے منسوخ کریں؛ محفوظ دوائی نہ بدلیں"],["Only a permitted prescriber of this order can cancel its eligible open lines. Enter3–500characters, verify patient/Rx, and Confirm once. The server cancels remaining scheduled work; already dispensed effects are not undone. Cancelled/Replaced/FullyDispensed is refused. A lost cancellation reply has no automatic replay: read the original prescription, reconcile and refresh explicitly. Cancel/Close/Escape asks before losing unsent reason text.","صرف اسی حکم کا مجاز معالج کھلی دوائیاں منسوخ کرتا ہے۔3تا500حروف کی وجہ، مریض اور نسخہ چیک کرکے ایک بار تصدیق کریں۔ سرور باقی کام منسوخ کرتا ہے؛ دی گئی دوائی واپس نہیں ہوتی۔ منسوخ، بدل یا مکمل فراہم حالت پر انکار ہے۔ گم جواب خود دوبارہ نہیں جاتا؛ اصل نسخہ پڑھ کر چیک اور تازہ کریں۔ بند یا منسوخ غیر ارسال وجہ چھوڑنے سے پہلے پوچھتا ہے۔"]),
  "rx.handover": g(["eprescription"],["Record actual handover and retained copy","اصل حوالگی اور محفوظ نقل درج کریں"],["Printing alone is not proof. The person who actually gives the slip chooses Patient or a named Attendant and Electronic, Carbon copy, or Scan. A Scan must be this patient's uploaded Prescription document; upload separately in Patient document vault. Confirm actual handover only after it happened. This adds an audit record with actor/time, not a dispense or payment. Unknown replies retain the original key; never acknowledge an imagined handover. Cancelled/Replaced prescriptions cannot be handed over.","صرف پرنٹ ثبوت نہیں۔ اصل دینے والا مریض یا نام زد تیماردار، اور برقی، کاربن یا اسکین نقل چنے۔ اسکین اسی مریض کی اپ لوڈ نسخہ دستاویز ہو؛ الگ دستاویزات میں اپ لوڈ کریں۔ اصل دینے کے بعد ہی تصدیق کریں۔ یہ صارف و وقت کا ریکارڈ ہے، دوائی فراہمی یا ادائیگی نہیں۔ گم جواب پر اصل درخواست محفوظ ہے؛ فرضی حوالگی درج نہ کریں۔ منسوخ یا بدلا نسخہ نہیں دیا جا سکتا۔"]),
  "rx.print": g(["eprescription"],["Print or save the issued prescription","جاری شدہ نسخہ پرنٹ یا محفوظ کریں"],["Print prescription/Save prescription PDF fetches the authorized print-payload independently. Preserve server-issued patient particulars, allergy text, clinical context/VCO, directions in words, advice, prescriber stamp and signature line. Uses the returned receipt-paper width and mapped receipt printer; unregistered terminals use the default dialog. Original issued text is preserved, including Urdu patient text in the bundled font. PDF cancellation and printer errors stay visible; retry printing only, never repeat prescribing or invent a handover. Physical/native Urdu print review is pending.","پرنٹ یا پی ڈی ایف اصل مجاز پرنٹ معلومات الگ لیتا ہے۔ مریض، الرجی، طبی معلومات و رضامندی، لفظی ہدایات، مشورہ، معالج کی مہر اور دستخط کی جگہ محفوظ ہیں۔ واپس آئی رسید چوڑائی اور مقررہ پرنٹر استعمال ہوتا؛ غیر رجسٹرڈ پر عام مکالمہ ہے۔ جاری متن اور اردو نام مقامی فونٹ میں محفوظ ہیں۔ منسوخی و خرابی واضح؛ صرف پرنٹ دوبارہ، نسخہ یا فرضی حوالگی نہیں۔ اصل پرنٹر و اردو جائزہ باقی ہے۔"]),
  "doctorqueue.consultation": g(["doctor_queue"],["Open the patient's consultation","مریض کا معائنہ کھولیں"],["Open consultation carries this actual ticket into the clinical workspace; it does not call, register, charge or save a note. Verify the name and MRN again there. The button is shown only when the permitted consultation screen is in this build and is blocked during an uncertain queue action.","معائنہ کھولیں اصل پرچی طبی کام میں لے جاتا ہے؛ یہ مریض کو بلاتا، رجسٹر، ادائیگی یا نوٹ محفوظ نہیں کرتا۔ وہاں نام اور ایم آر این پھر چیک کریں۔ یہ مجاز معائنہ دستیاب ہونے پر دکھتا اور قطار کے غیر یقینی عمل پر بند ہے۔"]),
  "clinical.context": g(["consultation","eprescription","lab_orders_results","external_referral","patient_education","patient_programmes","home_visit_record"],["Verify and change patient context","مریض کی شناخت اور انتخاب"],["Open a complete OPD slip number with the scan field, or Choose from my live queue and select a real token/name/MRN. Check patient name and MRN, age/date of birth, allergies (blank means not recorded), death, medico-legal/temp/merge flags and outstanding dues before acting. A changing identity or failed current-context read pauses writes and retains the draft. Pending writes block a different visit; unsent edits require discard confirmation. Death prohibits new orders, not retrospective documentation. No guessed record IDs.","اسکین خانے میں مکمل پرچی یا میری قطار سے اصل ٹوکن، نام اور ایم آر این چنیں۔ عمل سے پہلے نام، ایم آر این، عمر، الرجی، وفات، میڈیکو لیگل، عارضی یا ضم شناخت اور بقایا چیک کریں۔ خالی الرجی درج نہیں ہے۔ شناخت بدلنے یا تازہ پڑھائی ناکام ہونے پر عمل رکتا اور مسودہ رہتا ہے۔ زیر عمل درخواست مریض بدلنے نہیں دیتی؛ غیر ارسال ترمیم چھوڑنے کی تصدیق لازم ہے۔ وفات پر نئے احکامات منع ہیں؛ بعد کی دستاویز الگ ہے۔ فرضی نمبر نہ لکھیں۔"]),
  "clinical.recovery": g(["consultation","eprescription","lab_orders_results","external_referral","patient_education","patient_programmes","home_visit_record"],["Recover an uncertain clinical write","غیر یقینی طبی عمل کا نتیجہ"],["A lost reply freezes the exact original request, actor, visit, input and navigation. Retry original request is offered only for an idempotent operation within24hours, with the identical key/body. Draft PATCH and finalize are not replayed automatically: Read current result is read-only, compare its version/status and Result reviewed returns to the draft without claiming success. After reviewing a referral result, its details and list refresh; a closed referral action closes without resubmitting. Reload the note explicitly before another edit when its state changed. Outside retention or denied reconciliation ask IT; never create a replacement, repeat medication, payment or a registration. A failed follow-up read/print never repeats a confirmed write.","گم جواب پر اصل درخواست، صارف، پرچی، معلومات اور جگہ بدلنا مقفل ہے۔ صرف محفوظ شناخت والے عمل کو24گھنٹے میں وہی کلید اور معلومات سے دوبارہ بھیجیں۔ مسودہ ترمیم یا حتمی کرنا خود نہیں دہراتے۔ موجودہ نتیجہ پڑھیں صرف پڑھتا ہے؛ نسخہ اور حالت چیک کرکے واپس آئیں، کامیابی فرض نہیں ہوتی۔ حوالے کا نتیجہ چیک کرنے کے بعد تفصیل اور فہرست تازہ اور بند حوالے کا عمل بغیر دوبارہ ارسال بند ہوتا ہے۔ نوٹ بدل چکا ہو تو اگلی ترمیم سے پہلے واضح طور پر تازہ کریں۔ وقت گزرنے یا اجازت نہ ملنے پر آئی ٹی سے کہیں؛ متبادل، دوائی، ادائیگی یا رجسٹریشن نہ دہرائیں۔ بعد کی پڑھائی یا پرنٹ کی ناکامی تصدیق شدہ عمل دوبارہ نہیں کرتی۔"]),
  "consultation.note": g(["consultation"],["Write a visit note and observations","ملاقات کا نوٹ اور مشاہدات"],["Doctor/specialist/surgeon/anaesthetist with clinical.encounter.create: verify the visit, choose New note, then OPD/FollowUp or the relevant real admission for IPD/CodeRed. Existing note types/links do not change. Enter complaint/history, examination after deliberate consent, diagnosis, clinical note and plan. Vital signs are entered measurements, not prefilled. Save draft creates a record; Save draft changes uses the original expected_version. New note asks before discarding unsaved edits and never deletes a saved draft. Another author's note is read-only. The server-selected active Clinic rules are explained before signing: complaint or history, findings after VCO, diagnosis and plan; drafts can remain incomplete. Server completeness errors mark missing fields and retain the input.","طبی نوٹ کی اجازت سے ڈاکٹر، ماہر، سرجن یا بے ہوشی کا ڈاکٹر پرچی چیک کرکے نیا نوٹ اور متعلقہ قسم چنے؛ داخلے کے لیے اصل داخلہ چنیں۔ پرانے نوٹ کی قسم اور ربط نہیں بدلتے۔ شکایت، تاریخ، واضح رضامندی کے بعد معائنہ، تشخیص، نوٹ اور منصوبہ لکھیں۔ اہم علامات خود ناپے ہوئے نتائج ہیں، پہلے سے نہیں بھری جاتیں۔ مسودہ محفوظ نیا ریکارڈ ہے؛ تبدیلی اصل نسخے سے ہوتی ہے۔ نیا نوٹ غیر محفوظ ترمیم چھوڑنے سے پہلے پوچھتا، محفوظ مسودہ حذف نہیں کرتا۔ دوسرے کا نوٹ صرف پڑھیں۔ سرور کی فعال کلینک شرائط حتمی کرنے سے پہلے دکھتی ہیں: شکایت یا سابقہ معلومات، رضامندی پر نتائج، تشخیص اور منصوبہ؛ نامکمل مسودہ محفوظ رہتا ہے۔ سرور کی نامکمل خانے کی خرابی معلومات برقرار رکھتی ہے۔"]),
  "consultation.consent": g(["consultation"],["Ask permission before examination","معائنے سے پہلے اجازت لیں"],["Before the examination field choose deliberately: Verbal consent obtained (VCO), Patient declined or Not examined. A new note starts with none selected. Declined/Not examined disables and sends no examination findings; clearing existing findings asks first. When the server enables the Clinic rules, the screen explains consent and required record fields before signing; a missing choice or findings may prevent finalization; show the actual server error and retain the draft. Printed notes use the saved consent and author stamp, never inferred consent.","معائنے کے خانے سے پہلے واضح انتخاب کریں: زبانی رضامندی مل گئی، مریض نے انکار کیا یا معائنہ نہیں کیا۔ نیا نوٹ بغیر انتخاب شروع ہے۔ انکار یا معائنہ نہیں کیا پر نتائج بند اور نہیں بھیجے جاتے؛ پہلے سے نتائج صاف کرنے سے پہلے پوچھتا ہے۔ متعلقہ پالیسی میں خالی انتخاب یا نتائج حتمی کرنے سے روک سکتے ہیں؛ اصل خرابی دکھائیں، مسودہ رکھیں۔ پرنٹ محفوظ رضامندی اور مصنف کی مہر لیتا ہے، فرض شدہ رضامندی نہیں۔"]),
  "consultation.icd": g(["consultation"],["Add a coded diagnosis","کوڈ والی تشخیص شامل کریں"],["Add diagnosis code opens the shared ICD picker; search/browse the hospital's current release, verify code/title/path, choose a real category, and remove an unsent code if needed (maximum20). Only codes are sent; persisted notes show icd_terms code/title/WHO URI. This picker does not save/finalize the note. Unknown codes show the server refusal. F1 inside the picker opens its own help without losing the clinical draft.","تشخیصی کوڈ شامل کریں سے مشترک انتخاب کھولیں؛ ہسپتال کی موجودہ فہرست میں کوڈ، عنوان اور راستہ چیک اور اصل کوڈ چنیں۔ غیر ارسال کوڈ ہٹا سکتے ہیں، زیادہ سے زیادہ20۔ صرف کوڈ بھیجتا ہے؛ محفوظ نوٹ کوڈ، عنوان اور عالمی ادارہ صحت کا پتہ دکھاتا ہے۔ انتخاب نوٹ محفوظ یا حتمی نہیں کرتا۔ نامعلوم کوڈ پر اصل انکار دکھتا ہے۔ انتخاب میں ایف۱ اسی کی مدد کھولتا اور طبی مسودہ رکھتا ہے۔"]),
  "consultation.procedure": g(["consultation"],["Document a bedside procedure","مریض کے پاس طریقہ کار درج کریں"],["Procedure notes need active outpatient_procedures unless linked to an admission. Enter procedure name, site/side, indication, anaesthesia, actual Given patient consent (optional link), active assistant via staff lookup, hospital-time start/end, technique/devices/sizes, findings, specimens (explicit None when nothing removed), complications and condition at end. Findings/specimens/condition are required to sign. Do not type guessed consent/staff IDs. A retired service permits records according to the server, not starting new outpatient work.","بیرونی طریقہ کار کے لیے فعال خدمت لازم ہے، داخلے سے متعلق نوٹ الگ ہے۔ نام، جگہ و سمت، وجہ، بے ہوشی، مریض کی اصل دی گئی رضامندی کا اختیاری ربط، تلاش سے فعال معاون، ہسپتال کے وقت شروع و ختم، طریقہ و آلات، نتائج، نمونے، پیچیدگیاں اور اختتامی حالت لکھیں۔ کچھ نہ نکالا تو نمونے میں واضح None لکھیں۔ نتائج، نمونے اور اختتامی حالت حتمی کرنے کو لازم ہیں۔ رضامندی یا معاون کے فرضی نمبر نہ دیں۔ بند خدمت میں سرور کے مطابق ریکارڈ دیکھیں؛ نیا بیرونی عمل شروع نہیں۔"]),
  "consultation.save": g(["consultation"],["Save a draft safely","مسودہ محفوظ طریقے سے رکھیں"],["Save draft note creates a draft with a new action key; its unknown reply can only replay that exact original within24hours. Save draft changes sends expected_version from the note actually edited. Fresh identity/lock/version checks precede a new write. No autosave/offline queue. A confirmed save is separate from refresh and print; errors after confirmation do not undo it. Resolve any version conflict explicitly before saving more.","مسودہ نوٹ محفوظ کریں نئی کلید سے نیا مسودہ ہے؛ گم جواب صرف وہی اصل24گھنٹے میں دہرا سکتا ہے۔ تبدیلی ترمیم کیے گئے اصل نسخے سے جاتی ہے۔ نئے عمل سے پہلے شناخت، مقفل حالت اور نسخہ چیک ہیں۔ خودکار یا آف لائن محفوظ نہیں۔ تصدیق شدہ محفوظ کرنا تازہ پڑھائی اور پرنٹ سے الگ ہے؛ ان کی خرابی اسے واپس نہیں کرتی۔ مزید ترمیم سے پہلے نسخے کا تنازع حل کریں۔"]),
  "consultation.finalize": g(["consultation"],["Submit and sign a consultation","معائنہ جمع اور حتمی کریں"],["Submit consultation creates and signs a new note atomically. For an existing draft first Save draft changes, then Finalize saved note; signing is disabled while unsaved edits remain. The server enforces completeness and deliberate examination consent as applicable; keep its missing-field feedback. Final notes cannot be edited; use Append correction with a reason. The final author_stamp.text appears below the note and on A4 output. Signing and reprinting are independent.","معائنہ جمع کریں نیا نوٹ ایک عمل میں حتمی کرتا ہے۔ پرانے مسودے کی تبدیلی پہلے محفوظ، پھر محفوظ نوٹ حتمی کریں؛ غیر محفوظ ترمیم کے ساتھ حتمی بند ہے۔ سرور نامکمل معلومات اور واضح رضامندی کی پالیسی چیک کرتا ہے؛ خانے کی خرابی رکھیں۔ حتمی نوٹ نہیں بدلتا؛ وجہ کے ساتھ تصحیح شامل کریں۔ مصنف کی اصل مہر نوٹ اور اے4پرنٹ پر ہے۔ حتمی کرنا اور دوبارہ پرنٹ الگ ہیں۔"]),
  "consultation.correction": g(["consultation"],["Append a correction, never edit a final note","حتمی نوٹ میں الگ تصحیح"],["With clinical.encounter.correct, select Append correction on a Final note, select the affected field, write correction text and a meaningful reason (3–1000characters). Confirm appends, preserving the original and both author stamps. It does not overwrite/delete the original. Cancel discards only unsent correction input after confirmation; an unknown append uses its original action key only.","مجاز اجازت سے حتمی نوٹ پر تصحیح شامل کریں؛ متعلقہ خانہ، تصحیح اور3تا1000حروف کی واضح وجہ لکھیں۔ تصدیق الگ اندراج کرتی، اصل اور دونوں مصنف کی مہریں رکھتی ہے۔ اصل تبدیل یا حذف نہیں ہوتا۔ منسوخ صرف غیر ارسال معلومات تصدیق سے چھوڑتا ہے؛ گم جواب وہی اصل کلید استعمال کرتا ہے۔"]),
  "consultation.conflict": g(["consultation"],["Reconcile concurrent changes","بیک وقت تبدیلیوں کا موازنہ"],["A stale version or changed note keeps your unsaved text. Reload note and discard unsaved edits asks before replacing it with the latest server note; read what changed and reapply consciously. Never silently advance the version while retaining stale field values. A finalized record is read-only. A clinical lockout's server message is shown verbatim and editing stops.","پرانا نسخہ یا بدلا نوٹ آپ کی غیر محفوظ عبارت رکھتا ہے۔ نوٹ تازہ کریں اور ترمیم چھوڑیں تازہ ریکارڈ لانے سے پہلے پوچھتا ہے؛ فرق پڑھ کر خود ترمیم دوبارہ کریں۔ پرانی عبارت کے ساتھ نسخہ خاموشی سے نیا نہیں ہوتا۔ حتمی ریکارڈ صرف پڑھیں۔ طبی مقفل حالت کا اصل پیغام دکھتا اور ترمیم رکتی ہے۔"]),
  "consultation.history": g(["consultation"],["Read visit and consolidated history","ملاقات اور مجموعی تاریخ پڑھیں"],["Visit notes lists this slip's notes and author/status. Choose one to load full detail/corrections; changing an unsaved draft asks first. Consolidated patient history includes notes across merged identities, admissions, prescriptions and lab results when your permissions allow. Historical other-visit notes are identified/read-only until their own context is opened. Loading/failure hides stale lists. New published lab/imaging and identity/lock events refresh reads without polling, preserving the draft.","ملاقات کے نوٹ اسی پرچی کے مصنف اور حالت دکھاتے ہیں۔ مکمل تفصیل اور تصحیح کے لیے چنیں؛ غیر محفوظ مسودہ بدلنے سے پہلے پوچھتا ہے۔ اجازت سے مجموعی تاریخ ضم شناختوں کے نوٹ، داخلے، نسخے اور لیب نتائج دکھاتی ہے۔ دوسری ملاقات کا پرانا نوٹ اپنی شناخت کے بغیر صرف پڑھیں۔ لوڈنگ یا خرابی پر پرانی فہرست چھپتی ہے۔ نئے نتائج اور شناخت یا مقفل واقعات بغیر پولنگ پڑھائی تازہ، مسودہ برقرار رکھتے ہیں۔"]),
  "consultation.documents": g(["consultation"],["Open documents and outside reports","دستاویزات اور بیرونی رپورٹ کھولیں"],["Patient documents lists files only with document permission. Check title/type/source/date and the Outside document label: an uploaded outside report is never a published hospital result. Choose a file explicitly to use the secure native download/viewer; no automatic document opening. PDF save cancellation/failure never repeats a clinical or financial write. Patient photos/documents remain optional and managed separately in the vault.","اجازت سے مریض کی دستاویزات دیکھیں۔ عنوان، قسم، ماخذ، تاریخ اور بیرونی نشان چیک کریں؛ باہر کی اپ لوڈ رپورٹ ہسپتال کا شائع نتیجہ نہیں۔ فائل خود چننے پر محفوظ مقامی ناظر یا محفوظ کرنے کا مکالمہ کھلتا ہے، خودکار نہیں۔ پی ڈی ایف منسوخ یا ناکام ہو تو طبی یا مالی عمل نہیں دہراتا۔ تصویر و دستاویز اختیاری اور الگ خزانے میں ہیں۔"]),
  "consultation.admit": g(["consultation"],["Request an admission","داخلے کی درخواست"],["Admit needs ipd.admission.request, a current living patient and Active inpatient service. Admission reason and provisional diagnosis are required; they and initial care plan are proposed from this note for you to confirm. Review admission type, optional desk notes and vitals interval15–1440minutes. Confirm creates one request for Admissions; it does not allocate a bed, register or collect money. Admission request recorded shows the actual admission number, returned status, reason, diagnosis and doctor's stamp. Give this number to Admissions; do not submit another request after a later read or print failure. Cancel leaves the unsent request unrecorded.","داخلہ درخواست کی اجازت، زندہ موجودہ مریض اور فعال داخلہ خدمت لازم ہیں۔ وجہ اور ابتدائی تشخیص ضروری ہیں؛ یہ اور نگہداشت کا منصوبہ نوٹ سے آپ کی تصدیق کو آتے ہیں۔ قسم، اختیاری ڈیسک نوٹ اور علامات کا15تا1440منٹ وقفہ چیک کریں۔ تصدیق داخلہ ڈیسک کو ایک درخواست دیتی ہے؛ بستر، رجسٹریشن یا ادائیگی نہیں کرتی۔ درخواست درج ہونے پر اصل داخلہ نمبر، سرور کی حالت، وجہ، تشخیص اور ڈاکٹر کی مہر دکھتی ہے۔ نمبر داخلہ ڈیسک کو دیں؛ بعد کی پڑھنے یا پرنٹ کی خرابی پر نئی درخواست نہ دیں۔ منسوخ غیر ارسال درخواست محفوظ نہیں کرتا۔"]),
  "consultation.waiver": g(["consultation"],["Request post-consult VIP waiver","معائنے کے بعد رعایت مانگیں"],["A permitted clinician selects a Final note and Convert to VIP waiver, writes a reason3–1000characters and confirms. This creates an approval request, not an approved waiver or cash handover. The server freezes the applicable visit while pending; follow Approvals/refund and reception cash-back separately. Never acknowledge physical cash from this screen.","مجاز ڈاکٹر حتمی نوٹ چن کر وی آئی پی رعایت،3تا1000حروف کی وجہ اور تصدیق کرے۔ یہ منظوری کی درخواست ہے، منظور شدہ رعایت یا نقد حوالگی نہیں۔ متعلقہ ملاقات سرور کے مطابق منظوری تک مقفل ہے؛ منظوری، واپسی اور استقبالیہ نقد الگ ہیں۔ یہاں نقد کی جسمانی حوالگی تسلیم نہ کریں۔"]),
  "consultation.complete": g(["consultation"],["Complete the visit after handovers","منتقلی کے بعد ملاقات مکمل کریں"],["Complete visit needs opd.ticket.complete or opd.queue.view, a Final note and the server's eligible ticket state. Review pending prescriptions/orders/referral/admission and confirm the correct name/MRN/slip. Completion is an independent idempotent action; it does not charge, print or create orders again. A refusal remains visible for reconciliation.","ملاقات مکمل کرنے کو ان میں سے ایک اجازت، حتمی نوٹ اور سرور کی درست حالت لازم ہیں۔ نسخے، احکامات، حوالہ، داخلہ اور نام، ایم آر این، پرچی چیک کرکے تصدیق کریں۔ یہ الگ محفوظ عمل ہے؛ دوبارہ رقم، پرنٹ یا احکامات نہیں بناتا۔ انکار نتیجہ چیک کرنے کے لیے واضح رہتا ہے۔"]),
  "consultation.handover": g(["consultation"],["Clinical quick-action handovers","طبی فوری منتقلی"],["Quick actions carry the verified ticket to Re-route/queue, Prescribe, Order lab/imaging, External referral, Education and Programmes when those permitted screens are available. They navigate only; each destination has its own draft, validation and confirmation. Unsaved edits ask before discard and an unknown write prevents leaving. The selected visit remains tied to the signed-in actor; a different user does not inherit the patient selection.","فوری بٹن مجاز جگہ دستیاب ہونے پر اصل پرچی قطار یا منتقلی، نسخہ، لیب یا عکس، بیرونی حوالہ، تعلیم اور پروگرام کو لے جاتے ہیں۔ یہ صرف جگہ بدلتے ہیں؛ ہر جگہ اپنی جانچ اور تصدیق ہے۔ غیر محفوظ ترمیم چھوڑنے سے پہلے پوچھتا اور غیر یقینی لکھائی باہر نہیں جانے دیتی۔ انتخاب اصل صارف سے متعلق ہے؛ دوسرے صارف کو مریض کا انتخاب نہیں ملتا۔"]),
  "consultation.action": g(["consultation"],["Confirm or cancel a separate action","الگ عمل کی تصدیق یا منسوخی"],["The confirmation dialog keeps the patient's name, MRN and slip visible. Fill the correction/admission/waiver details described in their control instructions, then Confirm clinical action once. Cancel/Close/Escape asks before losing edited unsent input. During a pending/unknown result all normal inputs and dismissal are locked; recovery buttons remain available outside that disabled form. Success shows server confirmation, never an invented approval.","تصدیق کے مکالمے میں نام، ایم آر این اور پرچی موجود ہیں۔ متعلقہ ہدایت کے مطابق تصحیح، داخلہ یا رعایت کی معلومات بھر کر ایک بار تصدیق کریں۔ منسوخ، بند یا ایسکیپ ترمیم شدہ غیر ارسال معلومات چھوڑنے سے پہلے پوچھتا ہے۔ زیر عمل یا نامعلوم نتیجے پر عام خانے اور بند کرنا مقفل ہیں؛ نتیجہ چیک کے بٹن بند فارم سے باہر دستیاب ہیں۔ کامیابی سرور کی تصدیق ہے، فرضی منظوری نہیں۔"]),
  "consultation.print": g(["consultation"],["Print or save a finalized clinical note","حتمی طبی نوٹ پرنٹ یا محفوظ کریں"],["Only Final notes have Print note, Save note PDF (locally shaped A4 in your interface language) and Download server PDF. Fetch the fresh authorized print payload; include the issued hospital letterhead/PHC/issue line, name/MRN/visit, consent/VCO, note, procedure, codes/titles/WHO URI, author and correction stamps. The mapped document printer is required on a registered terminal; unregistered terminals use the default printer dialog with a hint. A save cancellation or printer failure is visible and reprint only reads again; it never repeats consultation, registration, payment or orders. Urdu physical/native review remains pending.","صرف حتمی نوٹ پر پرنٹ، مقامی زبان میں اے4پی ڈی ایف محفوظ اور سرور پی ڈی ایف کے بٹن ہیں۔ تازہ مجاز معلومات میں جاری ہسپتال کی سرخی، رجسٹریشن و اجرا، نام، ایم آر این، ملاقات، رضامندی، نوٹ، طریقہ کار، کوڈ، عنوان، عالمی ادارہ صحت کا پتہ، مصنف اور تصحیح کی مہر شامل ہیں۔ رجسٹرڈ ٹرمینل کا مقررہ دستاویز پرنٹر لازم ہے؛ غیر رجسٹرڈ پر عام پرنٹ مکالمہ آتا ہے۔ منسوخ یا خرابی واضح ہے، دوبارہ پرنٹ صرف پڑھتا ہے؛ طبی نوٹ، رجسٹریشن، ادائیگی یا احکامات نہیں دہراتا۔ اردو اور اصل پرنٹر کا انسانی جائزہ باقی ہے۔"]),
  "icd.search": g(["icd_picker"], ["Find a diagnosis code", "تشخیصی کوڈ تلاش کریں"], ["Any signed-in staff member: open ICD code picker or the diagnosis picker inside a clinical form. Type at least two letters of a code or diagnosis words in any order; search is debounced300ms and limited30matches. Code is bold, its title and muted parent distinguish similar entries. Refine words when no match, or after a read failure edit the query or Refresh classification. English WHO titles are retained as supplied; Urdu labels are a draft. No server record is written by searching.", "داخل شدہ عملہ تشخیصی کوڈ یا طبی فارم میں کوڈ کا انتخاب کھولے۔ کوڈ یا تشخیص کے کم از کم دو حروف لکھیں؛ 300ملی سیکنڈ کے وقفے پر زیادہ سے زیادہ30نتائج آتے ہیں۔ نمایاں کوڈ، عنوان اور مدھم اصل عنوان ملتے نام الگ کرتے ہیں۔ نتیجہ نہ ملے یا پڑھائی ناکام ہو تو الفاظ بدلیں یا درجہ بندی تازہ کریں۔ عالمی ادارہ صحت کے عنوان اسی طرح رہتے ہیں؛ اردو بٹن مسودہ ہیں۔ تلاش سرور ریکارڈ نہیں لکھتی۔"]),
  "icd.browse": g(["icd_picker"], ["Browse the classification", "درجہ بندی میں جائیں"], ["Browse classification starts at chapters. Browse children walks down blocks and categories; All chapters resets the path, Parent level moves one level up. Inspect an entry to see its ancestor path. Specific categories appear before residual other specified/unspecified codes; prefer the most specific diagnosis justified by the record, never invent one.", "درجہ بندی دیکھیں ابواب سے شروع ہوتا ہے۔ ذیلی اندراج سے بلاک اور کوڈ میں جائیں؛ تمام ابواب راستہ صاف اور اوپر کی سطح ایک درجہ واپس کرتی ہے۔ اندراج سے اس کا راستہ دیکھیں۔ مخصوص کوڈ غیر متعین کوڈ سے پہلے آتے ہیں؛ صرف طبی ریکارڈ سے ثابت مخصوص تشخیص چنیں، خود نہ بنائیں۔"]),
  "icd.detail": g(["icd_picker"], ["Inspect code and title", "کوڈ اور عنوان چیک کریں"], ["Open an entry to inspect its code, title, ancestor path, release, WHO URI and children. Chapters/blocks are navigation, not diagnoses. Residual codes carry a specificity caution. A failed or outdated detail read cannot be selected. Clinical forms store codes only and display server-resolved terms beside them.", "اندراج سے کوڈ، عنوان، درجہ بندی، اشاعت، عالمی ادارہ صحت کا پتہ اور ذیلی کوڈ دیکھیں۔ باب اور بلاک تشخیص نہیں۔ غیر مخصوص کوڈ پر احتیاط ہے۔ ناکام یا پرانا نتیجہ منتخب نہیں ہوتا۔ طبی فارم صرف کوڈ محفوظ اور ساتھ سرور کا عنوان دکھاتے ہیں۔"]),
  "icd.select": g(["icd_picker"], ["Choose a verified code", "چیک شدہ کوڈ چنیں"], ["Choose this diagnosis code returns the category's code to the current unsaved form. It does not save or finalize a note, discharge summary or death certificate. The standalone finder only previews a choice. F1 opens the picker's help even inside another form and retains that form. Cancel the parent dialog without changing a saved diagnosis; its own save is separate.", "یہ تشخیصی کوڈ چنیں موجودہ غیر محفوظ فارم کو کوڈ دیتا ہے۔ اس سے نوٹ، رخصت نامہ یا وفات کا سرٹیفیکیٹ محفوظ یا حتمی نہیں ہوتا۔ الگ تلاش میں صرف انتخاب کا جائزہ ہے۔ دوسرے فارم میں بھی ایف۱ اسی رہنما کو کھولتا اور فارم رکھتا ہے۔ اصل مکالمہ بند کرنے سے محفوظ تشخیص نہیں بدلتی؛ اسے محفوظ کرنا الگ ہے۔"]),
  "icd.refresh": g(["icd_picker"], ["Hospital classification and licence", "ہسپتال کی درجہ بندی اور لائسنس"], ["Refresh classification reads the hospital's selected ICD system and active release, refreshes the visible code list, and clears the prior detail/choice. Your query and browse level remain; inspect and choose the current code again. It never rewrites a saved clinical record. Do not pick a different system locally. ICD_SYSTEM_NOT_LOADED means IT must load the hospital's licensed list; do not substitute or fabricate codes. WHO attribution and active licence notes appear below. There is no picker print or business-write endpoint; Help prints the handbook and the parent clinical document owns printing.", "درجہ بندی تازہ کریں ہسپتال کا منتخب نظام، فعال اشاعت اور موجودہ فہرست دوبارہ پڑھتا اور پچھلی تفصیل و انتخاب صاف کرتا ہے۔ تلاش اور سطح برقرار ہیں؛ موجودہ کوڈ دوبارہ دیکھ کر چنیں۔ محفوظ طبی ریکارڈ نہیں بدلتا۔ مقامی طور پر دوسرا نظام نہ چنیں۔ فہرست لوڈ نہ ہو تو آئی ٹی ہسپتال کی مجاز فہرست لوڈ کرے؛ متبادل یا فرضی کوڈ نہ دیں۔ عالمی ادارہ صحت اور لائسنس نیچے دکھتے ہیں۔ یہاں پرنٹ یا ریکارڈ لکھنے کا عمل نہیں؛ مدد رہنما پرنٹ اور طبی دستاویز اپنا پرنٹ کرتی ہے۔"]),
  "doctorqueue.confirm": g(["doctor_queue"], ["Confirm the reviewed queue action", "قطار کے عمل کی تصدیق"], ["Verify patient identity and the selected call or re-route. Confirm rechecks current source state; for a transfer it also checks the active destination and required reason. A call announces, including a deliberate re-call. A re-route closes the source and hands over to the destination. No automatic retry: a lost reply freezes the dialog until read-only reconciliation. Consult the Call patient and Re-route patient instructions on this page.", "مریض کی شناخت اور بلانے یا منتقلی کا منتخب عمل چیک کریں۔ تصدیق اصل حالت اور منتقلی میں فعال منزل و لازمی وجہ پھر چیک کرتی ہے۔ بلانا اعلان کرتا ہے، دوبارہ بلانا بھی۔ منتقلی اصل قطار بند کرکے منزل کو سپرد کرتی ہے۔ خودکار کوشش نہیں؛ گم جواب پر صرف پڑھ کر نتیجہ چیک ہونے تک مکالمہ مقفل ہے۔ اسی صفحے کی بلانے اور منتقلی کی ہدایات پڑھیں۔"]),
  "doctorqueue.read": g(["doctor_queue"], ["Read the live queue", "جاری قطار دیکھیں"], ["Doctor, specialist, surgeon or anaesthetist with queue permission: open Clinical OPD / IPD → My live queue. Server calling order is preserved; the current consultation comes first and re-routed arrivals are marked with their reason. Token, date, MRN and slip identify the visit. Refresh repeats a read; events and reconnect reload without polling. Loading/errors hide stale rows. The queue itself has no print or delete operation; print this guide from Help. Slip printing belongs to reception; clinical documents belong to the consultation.", "قطار کی اجازت رکھنے والا ڈاکٹر، ماہر، سرجن یا بے ہوشی کا ڈاکٹر ڈاکٹر کی جگہ سے میری جاری قطار کھولے۔ سرور کی ترتیب برقرار ہے؛ جاری معائنہ پہلے ہے اور منتقل مریض کی وجہ نمایاں ہے۔ ٹوکن، تاریخ، ایم آر این اور پرچی چیک کریں۔ تازہ کریں صرف پڑھتا ہے؛ واقعات اور دوبارہ رابطہ خود قطار تازہ کرتے ہیں۔ پرانا ڈیٹا لوڈنگ یا خرابی پر چھپتا ہے۔ قطار میں پرنٹ یا حذف کا عمل نہیں؛ مدد سے رہنما پرنٹ کریں۔ پرچی استقبالیہ اور طبی دستاویز معائنے سے ملتی ہے۔"]),
  "doctorqueue.call": g(["doctor_queue"], ["Call a patient", "مریض کو بلائیں"], ["Verify identity and the server calling order. Call patient opens confirmation; Confirm announces and changes the visit to InConsultation after the server answers. Call again is a deliberate new announcement. A live connection, Active entry, Waiting/InConsultation ticket, no pending approval and queue permission are required. Fresh status is checked before sending. Double clicks are blocked. No automatic replay or offline submission; a lost answer requires reconciliation. This screen does not finalize a clinical note.", "شناخت اور سرور کی ترتیب چیک کریں۔ مریض کو بلائیں سے تصدیق کھلتی ہے؛ تصدیق پر اعلان اور سرور کے جواب کے بعد معائنہ جاری ہوتا ہے۔ دوبارہ بلائیں نیا اعلان ہے۔ براہ راست رابطہ، فعال اندراج، منتظر یا جاری معائنہ، کوئی زیر منظوری درخواست نہ ہونا اور اجازت لازم ہیں۔ ارسال سے پہلے حالت چیک ہوتی ہے۔ دوہرے کلک روکے جاتے ہیں۔ خودکار یا آف لائن ارسال نہیں؛ جواب گم ہو تو نتیجہ چیک کریں۔ یہاں طبی نوٹ حتمی نہیں ہوتا۔"]),
  "doctorqueue.reroute": g(["doctor_queue"], ["Re-route with a reason", "وجہ کے ساتھ منتقل کریں"], ["With re-route permission, select a currently active doctor or department from the hospital OPD catalogue, explain the destination to the patient, and enter a meaningful 3–500 character reason. No guessed IDs. Confirm moves the patient to the top of the receiving queue and updates reception. A department queue may need reception to assign its doctor. Repeated transfers are reviewed; never omit the reason. Cancel has no server effect and asks before discarding an unsent draft. F1 preserves the draft and focus.", "منتقلی کی اجازت سے ہسپتال کے فعال او پی ڈی ڈاکٹر یا شعبے کا انتخاب کریں، مریض کو منزل بتائیں اور 3 تا 500 حروف کی واضح وجہ لکھیں۔ خود سے شناختی نمبر نہ دیں۔ تصدیق مریض کو نئی قطار میں اوپر لے جاتی اور استقبالیہ تازہ کرتی ہے۔ شعبے کی قطار میں ڈاکٹر کی تعیین استقبالیہ سے کرائیں۔ بار بار منتقلی کا جائزہ ہوتا ہے؛ وجہ نہ چھوڑیں۔ منسوخ سرور نہیں بدلتا اور غیر ارسال مسودہ چھوڑنے سے پہلے پوچھتا ہے۔ ایف۱ مسودہ اور فوکس رکھتا ہے۔"]),
  "doctorqueue.cancel": g(["doctor_queue"], ["Cancel an unsent action", "غیر ارسال عمل منسوخ کریں"], ["Cancel, Close or Escape dismisses an unsent action; a re-route draft asks before discard. During submission or an unknown outcome these routes are blocked, as is workspace navigation. Cancellation cannot undo a confirmed call or re-route.", "منسوخ، بند یا ایسکیپ غیر ارسال عمل بند کرتے ہیں؛ منتقلی کا مسودہ چھوڑنے سے پہلے تصدیق ہوتی ہے۔ ارسال یا غیر یقینی نتیجے پر یہ راستے اور جگہ کی تبدیلی بند ہیں۔ تصدیق شدہ بلانا یا منتقلی واپس نہیں ہوتے۔"]),
  "doctorqueue.reconcile": g(["doctor_queue"], ["Reconcile a lost reply", "گم جواب کا نتیجہ چیک کریں"], ["Never retry call/reroute automatically: calling again announces again; re-routing may already have closed the source. Re-read queue to reconcile is read-only. Inspect current status/last call and contact reception or the receiving clinician to verify an absent source. Finish reconciliation returns to the queue only after a successful read. It does not claim success, undo or retry. A still-needed call must be a deliberate new confirmation. Retain the error reference for IT.", "خودکار دوبارہ ارسال نہ کریں: دوبارہ بلانے سے اعلان دہرے گا؛ منتقلی اصل قطار بند کر چکی ہو سکتی ہے۔ نتیجہ چیک کرنے کا بٹن صرف قطار پڑھتا ہے۔ حالت اور آخری اعلان دیکھیں؛ غائب اندراج استقبالیہ یا وصول کرنے والے ڈاکٹر سے چیک کریں۔ کامیاب پڑھائی کے بعد نتیجہ چیک مکمل کریں قطار پر لوٹاتا ہے؛ کامیابی، واپسی یا دوبارہ ارسال کا دعویٰ نہیں۔ ضرورت پر نیا اعلان الگ تصدیق سے کریں۔ آئی ٹی کے لیے خرابی کا حوالہ رکھیں۔"]),
  "receivables.list": g(
    ["receivables"],
    ["Outstanding dues queue and debt aging", "بقایا جات کی قطار اور قرض کی عمر"],
    [
      "Cashier / Finance: view outstanding accounts receivable (patient credit Udhaar and panel receivables) and age buckets (0–30, 31–60, 61–90, 90+ days). Use search to find by patient name, MRN, mobile, panel or invoice number; filter by receivable type or status. Show all clears filters. Refresh reloads live receivables and aging from the server without polling. Loading and error states hide stale totals; Try again repeats the read only.",
      "کیشیئر / فنانس: مریض کے بقایا جات (ادھار اور پینل) اور قرض کی عمر کے خانے (۰ تا ۳۰، ۳۱ تا ۶۰، ۶۱ تا ۹۰ اور ۹۰ سے زائد دن) دیکھیں۔ مریض کے نام، ایم آر این، موبائل، پینل یا انوائس نمبر سے تلاش کریں؛ قسم یا حالت کے لحاظ سے فلٹر کریں۔ تمام دکھائیں فلٹر صاف کرتا ہے۔ تازہ کریں بغیر پولنگ کے سرور سے نیا ڈیٹا لاتا ہے۔ لوڈنگ اور خرابی پرانے ٹوٹل چھپاتی ہے۔",
    ],
  ),
  "receivables.settle": g(
    ["receivables"],
    ["Settle outstanding debt with open shift", "کھلی شفٹ کے ساتھ بقایا جات ادا کریں"],
    [
      "Cashier: settle a patient or panel debt when the debtor returns to pay. Requires an open cash shift (my_cash_shift) for cash collection. Enter the payment amount (defaults to full balance) and choose Cash, Card or Bank transfer with reference number. Settle Debt sends an idempotent request once; if the response is lost, the original key and payload are retained for safe retry. Confirmation displays the receipt number and remaining balance. After an unknown result the exact financial draft is frozen and cannot close or change. Retry original financial action reuses its original key/body/actor within24hours; it never collects cash again. Outside retention ask IT to reconcile. Only a definite refusal releases it. Current balances/locks/permissions and your own assigned open cash drawer are checked before a new Cash write. F1 keeps the draft; cancelling an unsent draft asks first. A failed follow-up read never repeats a confirmed payment.",
      "کیشیئر: جب مریض یا پینل ادھار ادا کرنے آئے تو بقایا ادا کریں۔ نقد وصولی کے لیے کھلی کیش شفٹ لازم ہے۔ رقم درج کریں (پہلے سے پورا بقایا لکھا ہوتا ہے) اور نقد، کارڈ یا بینک ٹرانسفر کا انتخاب حوالہ نمبر کے ساتھ کریں۔ یہ درخواست ایک بار محفوظ کلید کے ساتھ جاتی ہے۔ کامیابی پر رسید نمبر اور باقی رقم دکھتی ہے۔ غیر یقینی نتیجے پر اصل مالی مسودہ مقفل ہے؛ تبدیلی یا بند نہیں ہوتا۔ اصل مالی عمل کی دوبارہ کوشش وہی کلید، معلومات اور فرد ۲۴ گھنٹے میں بھیجتی ہے، نقد دوبارہ نہیں لیا جاتا۔ وقت ختم ہو تو آئی ٹی سے اصل نتیجہ چیک کرائیں۔ صرف قطعی انکار سے نئی کوشش ملتی ہے۔ اصل بقایا، اجازت اور نقد کے لیے اپنی مقررہ کھلی دراز چیک ہوتی ہے۔ ایف۱ مسودہ رکھتا ہے؛ غیر ارسال مسودہ چھوڑنے کی تصدیق لازم ہے۔",
    ],
  ),
  "receivables.write_off": g(
    ["receivables"],
    ["Write off uncollectible receivable", "ناقابل وصول قرض معاف یا ختم کریں"],
    [
      "Owner and Hospital Admin only (finance.ar.write_off): record an authorized write-off for an uncollectible receivable. Enter the amount to write off and mandatory reason (5–500 characters). The confirmed result shows the cumulative amount written off, remaining balance and status. A partial write-off leaves the remaining debt outstanding; a full write-off removes it from this queue. A cashier collects and settles dues but never writes off; the write-off button is shown only to an authorised role; cashiers see guidance to ask an administrator. Write-off is safe and idempotent. After an unknown result the exact financial draft is frozen and cannot close or change. Retry original financial action reuses its original key/body/actor within24hours; it never collects cash again. Outside retention ask IT to reconcile. Only a definite refusal releases it. Current balances/locks/permissions and your own assigned open cash drawer are checked before a new Cash write. F1 keeps the draft; cancelling an unsent draft asks first. A failed follow-up read never repeats a confirmed payment.",
      "صرف مالک اور ہسپتال ایڈمن (مجاز کردار): ناقابل وصول قرض کو معاف یا ختم کرنے کا اندراج کریں۔ معاف کی جانے والی رقم اور لازمی وجہ (۵ تا ۵۰۰ حروف) درج کریں۔ تصدیق شدہ نتیجے میں کل معاف رقم، باقی بقایا اور حالت دیکھیں۔ جزوی معافی کے بعد باقی قرض واجب الادا ہے؛ مکمل معافی سے یہ قطار سے نکل جاتا ہے۔ کیشیئر ادھار وصول اور ادا کرتا ہے مگر معاف نہیں کر سکتا؛ کیشیئر کو یہ بٹن نہیں دکھتا؛ مجاز منتظم سے رابطے کی رہنمائی ملتی ہے۔ غیر یقینی نتیجے پر اصل مالی مسودہ مقفل ہے؛ تبدیلی یا بند نہیں ہوتا۔ اصل مالی عمل کی دوبارہ کوشش وہی کلید، معلومات اور فرد ۲۴ گھنٹے میں بھیجتی ہے، نقد دوبارہ نہیں لیا جاتا۔ وقت ختم ہو تو آئی ٹی سے اصل نتیجہ چیک کرائیں۔ صرف قطعی انکار سے نئی کوشش ملتی ہے۔ اصل بقایا، اجازت اور نقد کے لیے اپنی مقررہ کھلی دراز چیک ہوتی ہے۔ ایف۱ مسودہ رکھتا ہے؛ غیر ارسال مسودہ چھوڑنے کی تصدیق لازم ہے۔",
    ],
  ),
  "receivables.invoice": g(
    ["receivables"],
    ["Inspect invoice and itemized lines", "انوائس اور اس کی مدات کی تفصیل دیکھیں"],
    [
      "Invoices & direct payments tab: view invoices, net payable, amount paid, credit amount, and balance due. Click an invoice number to inspect its itemized lines, quantity, unit price, and discount. This view is read-only and does not modify the invoice or balances. If no invoices match, choose All statuses and All types, or refresh. Loading and failed reads hide old invoices; Try again repeats the read.",
      "انوائسز اور براہ راست ادائیگی ٹیب: انوائسز، قابل ادائیگی رقم، ادا شدہ رقم، ادھار رقم اور باقی واجبات دیکھیں۔ انوائس نمبر پر کلک کر کے اس کی تفصیلی مدات، مقدار اور قیمت دیکھیں۔ یہ صرف پڑھنے کے لیے ہے اور انوائس کو تبدیل نہیں کرتا۔ بل نہ ملے تو تمام حالتیں اور تمام اقسام چنیں یا تازہ کریں۔ لوڈنگ یا خرابی پر پرانے بل چھپتے ہیں؛ دوبارہ کوشش صرف پڑھتی ہے۔",
    ],
  ),
  "receivables.payment": g(
    ["receivables"],
    ["Collect direct payment against invoice", "انوائس کی براہ راست رقم وصول کریں"],
    [
      "Cashier: collect payment directly against an unpaid or partially paid invoice. Enter the amount (defaults to balance due), select payment method (Cash, Card, BankTransfer), and enter transaction reference for non-cash. Requires an open cash shift. Confirmation records the payment, issues a receipt number, and updates the invoice balance. After an unknown result the exact financial draft is frozen and cannot close or change. Retry original financial action reuses its original key/body/actor within24hours; it never collects cash again. Outside retention ask IT to reconcile. Only a definite refusal releases it. Current balances/locks/permissions and your own assigned open cash drawer are checked before a new Cash write. F1 keeps the draft; cancelling an unsent draft asks first. A failed follow-up read never repeats a confirmed payment.",
      "کیشیئر: غیر ادا یا جزوی ادا شدہ انوائس پر براہ راست رقم وصول کریں۔ رقم درج کریں، طریقہ ادائیگی منتخب کریں اور نقد کے علاوہ ٹرانزیکشن حوالہ دیں۔ کھلی کیش شفٹ لازم ہے۔ تصدیق پر رسید جاری ہوتی ہے اور انوائس کا بقایا اپ ڈیٹ ہوتا ہے۔ غیر یقینی نتیجے پر اصل مالی مسودہ مقفل ہے؛ تبدیلی یا بند نہیں ہوتا۔ اصل مالی عمل کی دوبارہ کوشش وہی کلید، معلومات اور فرد ۲۴ گھنٹے میں بھیجتی ہے، نقد دوبارہ نہیں لیا جاتا۔ وقت ختم ہو تو آئی ٹی سے اصل نتیجہ چیک کرائیں۔ صرف قطعی انکار سے نئی کوشش ملتی ہے۔ اصل بقایا، اجازت اور نقد کے لیے اپنی مقررہ کھلی دراز چیک ہوتی ہے۔ ایف۱ مسودہ رکھتا ہے؛ غیر ارسال مسودہ چھوڑنے کی تصدیق لازم ہے۔",
    ],
  ),

  "tariff.read": g(["tariff_display"], ["Read and filter the published tariff", "شائع شدہ نرخ پڑھیں اور تلاش کریں"], ["Reception → Tariff shows the server's hospital name, as-of date and currency. Read services grouped by category, each ward's daily charge and the lab tests. Price category and Find a service, ward or test only filter this display; Show all prices clears both. Refresh tariff reloads the server; there is no polling. Loading/error hides old prices; Try again repeats only the read. A blank/missing price is not zero or a free service. No patient, bill, price edit or payment is created. Any signed-in user may call the tariff; the server's permitted screen list decides where it appears.", "استقبالیہ سے نرخ نامہ کھولیں۔ ہسپتال، تاریخ اور کرنسی دیکھیں۔ خدمات کی اقسام، وارڈ کا یومیہ خرچ اور ٹیسٹ الگ ہیں۔ قسم یا تلاش صرف دکھائی فہرست بدلتی ہے؛ تمام نرخ دکھائیں دونوں صاف کرتا ہے۔ تازہ کریں اصل سرور دوبارہ پڑھتا ہے۔ خرابی پر پرانے نرخ چھپتے ہیں؛ دوبارہ کوشش صرف پڑھتی ہے۔ خالی نرخ مفت خدمت نہیں۔ یہاں مریض، بل یا ادائیگی نہیں بنتی۔"]),
  "tariff.pdf": g(["tariff_display"], ["Save the official tariff for printing", "چھاپنے کے لیے اصل نرخ نامہ محفوظ کریں"], ["Print / save tariff PDF downloads the official complete PDF from the hospital server and opens the native Save dialog. Screen search/category filters never change that PDF. Choose a file location to save, or Cancel to save nothing. Wait for the saved/cancelled outcome; repeated clicks while pending create no parallel download. Open the saved PDF in your PDF reader to print. A failed download or printer never changes tariff data or takes payment; retry the download/read only. Physical print quality and native-language review remain human checks.", "نرخ نامہ چھاپیں یا پی ڈی ایف محفوظ کریں سے اصل مکمل فائل سرور سے آتی اور محفوظ کرنے کا مکالمہ کھلتا ہے۔ تلاش یا قسم پی ڈی ایف نہیں بدلتی۔ جگہ چنیں یا منسوخ کریں؛ نتیجے کا انتظار کریں۔ محفوظ پی ڈی ایف ریڈر میں کھول کر چھاپیں۔ ناکامی پر صرف ڈاؤن لوڈ دہرائیں، رقم یا نرخ نہیں بدلتے۔ اصل پرنٹر اور اردو انسانی جائزہ باقی ہے۔"]),
  "documents.select": g(["patient_documents"], ["Select the correct patient", "درست مریض منتخب کریں"], ["In Reception open Patient document vault. Enter 2–100 characters of name, mobile, CNIC or MRN and Search or scanner Enter. Pick the matching identity; verify name, MRN, age/date of birth and flags. Search does not create a patient. Clear patient selection or another result asks before discarding unsent files, and is blocked during an uncertain upload. A failed patient refresh prevents new uploads; retry the read. Files remain attached to their original patient. No automatic document download occurs.", "استقبالیہ سے مریض کی دستاویزات کھولیں۔ نام، موبائل، شناختی کارڈ یا ایم آر این کے ۲ تا ۱۰۰ حروف لکھ کر تلاش یا انٹر دبائیں۔ نام، ایم آر این، عمر اور نشانیاں چیک کریں۔ تلاش مریض نہیں بناتی۔ انتخاب بدلنے پر غیر ارسال فائل چھوڑنے کی تصدیق ہوتی ہے؛ غیر یقینی اپ لوڈ میں تبدیلی رکتی ہے۔ مریض پڑھنے میں خرابی ہو تو تازہ کریں۔ فائل خود نہیں کھلتی۔"]),
  "registration.intake": g(["registration"], ["Register once and recover the original request", "ایک بار رجسٹریشن اور اصل درخواست کی بحالی"], ["Reception: choose New patient or Returning patient; search by name/mobile/CNIC/MRN, then verify the selected master identity, deceased/MLC flags and dues before proceeding. Regular intake requires name, gender, mobile and age or DOB; CNIC, photo and UPMRN are optional. Enter an issued UPMRN only (4–40 letters/digits, slash or hyphen). PATIENT_CNIC_EXISTS and PATIENT_UPMRN_EXISTS mean this patient is already registered: search for them instead; verify identity before selecting. Optional contact, address, allergies, staff payroll lookup and server panel selection belong to the same draft. Patient record only creates no visit. Otherwise select an active OPD service, source and permitted discount; emergency source is available only while the server emergency service is Active. Dues and discount refusals come from the server; correct only a definite refusal. A ceiling refusal shows the returned percentage and maximum amount. Prepare unpaid slip within my limit uses the returned maximum amount. If the server returns only a percentage, Prepare unpaid slip with no discount uses zero instead of calculating a ceiling. Both only change the draft and turn off pay-now; they send nothing. Check the draft, explicitly issue the unpaid slip, then use Request VIP waiver in Payment, approval and printing for an eligible approver to decide the requested percentage. The server dues banner is also shown for AR_OUTSTANDING_BLOCK. Register and collect payment is a real charge: verify method/reference first. Each action retains an original UUID/body for explicit retry after an unknown result, never automatic replay or a changed payload. REQUEST_IN_PROGRESS, timeout/throttling and server failures keep it frozen; Retry same registration reuses that original identity inside24hours. After that ask IT to reconcile; never create a replacement registration/payment. Confirmed patient and ticket numbers are the recovery reference. Open ticket reads an existing slip; Start another registration begins a separate action only after current work is resolved. F1 and zoom keep the draft.", "استقبالیہ: نیا یا واپس آنے والا مریض چنیں؛ شناخت، ایم آر این، وفات، میڈیکو لیگل اور واجبات چیک کریں۔ نام، جنس، موبائل اور عمر یا تاریخ پیدائش لازم؛ شناختی کارڈ، تصویر اور یونیورسل مریض نمبر اختیاری ہیں۔ صرف جاری کردہ نمبر لکھیں۔ شناختی کارڈ یا یونیورسل نمبر پہلے موجود ہو تو دوبارہ اندراج کے بجائے مریض تلاش اور شناخت چیک کریں۔ رابطہ، الرجی، ملازم اور اصل پینل کی فہرست منتخب کریں۔ صرف مریض ریکارڈ سے وزٹ نہیں بنتا۔ اصل فعال خدمت، ذریعہ اور مجاز رعایت چنیں۔ ہنگامی ذریعہ صرف فعال خدمت میں ملتا ہے۔ حد سے زیادہ رعایت پر سرور کی اصل شرح اور زیادہ سے زیادہ رقم دکھتی ہے۔ اپنی حد کے اندر غیر ادا پرچی تیار کریں مسودے کی رعایت سرور کی بتائی رقم پر لاتا ہے۔ اگر صرف شرح ملی تو بغیر رعایت غیر ادا پرچی تیار کریں رقم صفر رکھتا ہے، حد کا حساب نہیں لگاتا۔ دونوں صرف مسودہ بدلتے اور فوری وصولی بند کرتے ہیں؛ کوئی درخواست ارسال نہیں ہوتی۔ مسودہ چیک کرکے خود غیر ادا پرچی جاری کریں، پھر ادائیگی، منظوری اور پرنٹ میں وی آئی پی رعایت مانگیں؛ مجاز فرد شرح کا فیصلہ کرے گا۔ واجبات کی رکاوٹ پر سرور کا اصل بقایا بینر بھی دکھتا ہے۔ وصولی حقیقی ادائیگی ہے، طریقہ اور حوالہ چیک کریں۔ غیر یقینی جواب پر اصل کلید اور معلومات محفوظ رہتی ہیں؛ اسی رجسٹریشن کی دوبارہ کوشش ۲۴ گھنٹے کے اندر وہی درخواست بھیجتی ہے۔ وقت ختم ہونے پر آئی ٹی سے نتیجہ چیک کرائیں، دوبارہ رجسٹریشن یا ادائیگی نہ بنائیں۔ پرانی پرچی کھولنا صرف پڑھتا ہے۔ ایف۱ مسودہ محفوظ رکھتا ہے۔"]),
  "registration.documents": g(["registration", "patient_documents"], ["Optional photo and outside reports", "اختیاری تصویر اور بیرونی رپورٹس"], ["Ask for photo consent first. Choose JPEG/PNG or Take photo with the camera, preview/retake, or Skip photo without a reason; skipping clears the photo error and consent, and you can choose the same file again. Refusal, an injured face or emergency never blocks registration. PDF is not a patient photo. For each optional outside report choose PDF/JPEG/PNG, report type/title, issuing facility and document date; remove an unsent report if unnecessary. Register first, then upload each file separately under its own key. Upload retries retain the original file/metadata/patient; an uncertain result never repeats registration or payment. Wait for Photo uploaded/Report uploaded before treating upload as confirmed. Outside: facility,date identifies external provenance, not this hospital's own test result. Stored files and current photo open through the authenticated document viewer; failed download/reprint only retries the read. Camera permission denial must leave Skip/Choose file available. Physical camera still needs human review.", "تصویر سے پہلے اجازت لیں۔ جے پیگ یا پی این جی فائل یا کیمرہ، پیش منظر، دوبارہ تصویر یا بلا وجہ چھوڑنے کا انتخاب ہے؛ تصویر کا پیغام اور اجازت صاف ہوتے ہیں اور وہی فائل دوبارہ چن سکتے ہیں۔ انکار یا ہنگامی حالت رجسٹریشن نہیں روکتی۔ پی ڈی ایف تصویر نہیں ہے۔ بیرونی رپورٹ کی فائل، قسم، عنوان، ادارہ اور تاریخ درج کریں؛ غیر ارسال رپورٹ ہٹا سکتے ہیں۔ پہلے مریض درج پھر ہر فائل الگ کلید سے اپ لوڈ کریں۔ غیر یقینی اپ لوڈ پر وہی مریض، فائل اور معلومات دوبارہ جاتے ہیں، رجسٹریشن یا رقم نہیں۔ اپ لوڈ کی اصل تصدیق دیکھیں۔ بیرونی ادارہ اور تاریخ ہسپتال کے اپنے نتائج سے الگ ہیں۔ کیمرہ اجازت نہ ملے تو فائل یا چھوڑنے کا راستہ رہتا ہے۔"]),
  "registration.actions": g(["registration"], ["Payment, waiver and reprinting", "ادائیگی، رعایت اور دوبارہ پرنٹ"], ["Verify the confirmed ticket/patient and server balance. Only permitted unpaid/partially paid unlocked tickets offer payment; blank amount collects the full balance, otherwise enter the actual amount. Card/bank needs a reference; cash needs your own open shift. Collect payment sends one separate immutable original request; unknown outcome freezes new actions and Retry original action keeps its original key/body, within24hours. Never change amount/method while resolving it. An unpaid eligible ticket may request a reasoned VIP waiver for approval by another eligible person; a request is not an approval. Review server approval lock/cash-back messages. Preview slip reads the original print text/barcodes; Print / reprint slip uses the mapped receipt printer and Save slip PDF produces the80mm PDF. Printer/PDF/download failure is separate from registration and payment; repeat printing only. Physical printer output remains a human acceptance item.", "اصل پرچی، مریض اور سرور کا بقایا چیک کریں۔ مجاز غیر ادا یا جزوی ادا غیر مقفل پرچی پر وصولی ہوتی ہے؛ خالی رقم پورا بقایا وصول کرتی ہے۔ کارڈ یا بینک کا حوالہ، نقد کے لیے اپنی کھلی شفٹ لازم ہے۔ وصولی الگ اصل کلید سے ایک بار؛ غیر یقینی نتیجے پر رقم یا طریقہ نہ بدلیں، اسی عمل کی دوبارہ کوشش کریں۔ درخواست منظوری نہیں؛ مجاز دوسرے فرد کا فیصلہ اور اصل لاک دیکھیں۔ پیش منظر اصل متن اور بارکوڈ پڑھتا ہے؛ دوبارہ پرنٹ نقش شدہ رسید پرنٹر پر، پی ڈی ایف الگ ہے۔ پرنٹ ناکامی پر رجسٹریشن یا ادائیگی نہ دہرائیں۔ اصل پرنٹر کا انسانی جائزہ باقی ہے۔"]),
  "patients.lookup": g(["patient_search"], ["Find a returning patient", "واپس آنے والا مریض تلاش کریں"], ["Reception: enter 2–100 characters of name, mobile, CNIC or MRN. Search waits 250 ms; scanner Enter searches immediately. Search repeats the current query; Clear removes the query and selection. No match is not a new registration. Check identifiers before selecting; search and profile access require their respective permissions. Results are limited to 20; narrow the query when there are many matches.", "استقبالیہ میں نام، موبائل، شناختی کارڈ یا ایم آر این کے ۲ تا ۱۰۰ حروف درج کریں۔ تلاش ۲۵۰ ملی سیکنڈ بعد، سکینر پر انٹر سے فوراً ہوتی ہے۔ صاف کریں سے انتخاب اور تلاش ختم ہوتے ہیں۔ شناخت چیک کریں؛ نتائج زیادہ ہوں تو تلاش محدود کریں۔ اجازت کے بغیر پروفائل نہیں کھلتا۔"]),
  "patients.profile": g(["patient_search"], ["Patient identity, flags and dues", "مریض کی شناخت، نشانیاں اور واجبات"], ["Select a matching identity, verify MRN, name and mobile, then inspect outstanding.banner_text above the card. MEDICO-LEGAL lists case numbers; DECEASED shows the recorded death time in hospital timezone and prohibits new visits. Search itself creates no visit. Found by an old MRN, merged into this record explains a server-matched merged identity; the master MRN is the current identity. Names containing letters and digits are searched as typed. Merged identifiers resolve through the server to the master record; the retained source is read only as a pointer and the actual master profile and its finances are loaded. Never create a duplicate for an old MRN. If a profile merges during editing, the draft stays open but Save is blocked: Read current record, compare the master, then explicitly discard/reload before editing it. View dues & invoices expands the real merge-chain financial summary; refresh a failed read deliberately. Another screen handles collections. Merge/death and reconnect events refresh reads without polling or overwriting an open edit draft.", "شناخت، ایم آر این، نام اور موبائل چیک کریں۔ سرخ واجبات اصل سرور کا پیغام ہیں۔ میڈیکو لیگل میں کیس نمبر، وفات میں ہسپتال کے وقت سے تاریخ آتی ہے؛ نیا وزٹ ممنوع ہے۔ پرانی شناخت سے ملا، اس ریکارڈ میں ضم ہے کا پیغام سرور کی واپس کی ہوئی پرانی شناخت اور موجودہ اصل ایم آر این واضح کرتا ہے۔ حروف اور اعداد والے نام جیسے لکھے گئے ویسے تلاش ہوتے ہیں۔ ضم شدہ شناخت سے اصل پروفائل اور اس کے واجبات کھلتے ہیں۔ پرانے ضم ایم آر این پر نیا مریض نہ بنائیں۔ ترمیم کے دوران ضم ہو تو مسودہ محفوظ مگر ارسال بند ہے؛ موجودہ اصل ریکارڈ پڑھ کر موازنہ اور پھر خود مسودہ چھوڑ کر تازہ کریں۔ واجبات اور انوائس اصل حساب کھولتے ہیں، وصولی الگ صفحے پر ہے۔ رابطہ بحال یا ضم ہونے پر معلومات تازہ ہوتی ہیں، کھلا مسودہ نہیں بدلتا۔"]),
  "patients.edit": g(["patient_search"], ["Correct demographics and reconcile a save", "معلومات درست اور محفوظ نتیجہ چیک کریں"], ["Only patient.update holders see Edit demographics. Verify the selected MRN and change the appropriate identity/contact/billing fields; a LabOnly record can request upgrade to Regular. Choose a panel from the real server list; failed loading has an explicit retry. Save changes sends changed fields once with the original row_version; it is never automatically retried. Cancel or close asks before discarding a changed draft. F1 keeps the draft and restores focus. UPMRN is optional and can be corrected or cleared. Duplicate CNIC/UPMRN refusals preserve your editable draft: search for the existing patient instead. PATIENT_TYPE_TRANSITION_INVALID refuses an ineligible upgrade; review the registration type. After VERSION_CONFLICT or an uncertain save, Read current record shows the real server record beside the preserved draft. Compare values and version; only then choose Discard draft and reload latest record, re-enter still-needed changes and save deliberately. A lost reply may have committed. Never repeat registration, merge or payment to repair a demographic edit. Records are not deleted here. Urdu wording needs native review.", "صرف ترمیم کی اجازت والا فرد معلومات بدلتا ہے۔ ایم آر این چیک کرکے رابطہ، شناخت اور بلنگ درست کریں۔ اصل سرور کی فہرست سے پینل چنیں۔ محفوظ کریں صرف بدلے خانے اصل ورژن کے ساتھ ایک بار بھیجتا ہے۔ بند یا منسوخ کرنے پر بدلا مسودہ چھوڑنے کی تصدیق ہوتی ہے۔ ایف۱ مسودہ رکھتا ہے۔ یونیورسل مریض نمبر اختیاری ہے، درست یا خالی کیا جا سکتا ہے۔ شناختی کارڈ یا نمبر موجود ہو تو مریض تلاش کریں۔ قسم بدلنے کا انکار مسودہ رکھتا ہے۔ ورژن کی تبدیلی یا غیر یقینی نتیجے پر موجودہ ریکارڈ پڑھیں، اصل معلومات اور ورژن کا موازنہ کریں؛ پھر مسودہ چھوڑ کر تازہ ریکارڈ لیں اور صرف باقی تبدیلی کریں۔ گم جواب کے باوجود تبدیلی محفوظ ہو سکتی ہے۔ رجسٹریشن یا ادائیگی دوبارہ نہ کریں۔ یہاں ریکارڈ حذف نہیں ہوتا۔ اردو انسانی جائزے کی منتظر ہے۔"]),
  "desk.lookup": g(
    ["patient_programmes", "patient_education", "external_referral", "lab_orders_results", "eprescription", "consultation", "queue_management", "refund_waiver_credit", "cash_back_prompts"],
    ["Open a slip by barcode or number", "بارکوڈ یا نمبر سے پرچی کھولیں"],
    [
      "Verify the physical slip and patient. Enter its full OPD number or let the USB scanner type it, then Enter/Open slip. This reads only: it never registers, pays or creates a token. A failed lookup stays visible; correct the number and try again. Unsaved reasons require confirmation before replacing the selected slip; an unresolved write blocks replacement.",
      "اصل پرچی اور مریض چیک کریں۔ مکمل او پی ڈی نمبر لکھیں یا اسکینر سے درج کرکے انٹر یا پرچی کھولیں دبائیں۔ یہ صرف پڑھتا ہے، رجسٹریشن، ادائیگی یا ٹوکن نہیں بناتا۔ خطا پر نمبر درست کریں۔ غیر محفوظ وجہ بدلنے کی تصدیق اور غیر یقینی تبدیلی کا جائزہ پہلے ضروری ہے۔",
    ],
  ),
  "desk.refresh": g(
    ["queue_management", "refund_waiver_credit", "cash_back_prompts"],
    ["Read the latest slip", "تازہ پرچی پڑھیں"],
    [
      "Refresh slip reads current status, invoice, pending approval and cash-back prompts. It never repeats a write. Loading or failed reads keep a visible message; do not assume the old state is current. Server time governs expiry; the hospital timezone governs display.",
      "پرچی تازہ کریں اصل حالت، بل، زیر التوا منظوری اور واپس دینے کی رقم پڑھتا ہے۔ یہ تبدیلی نہیں دہراتا۔ انتظار یا خطا واضح ہے؛ پرانی حالت کو تازہ فرض نہ کریں۔ میعاد سرور کے وقت اور نمایش ہسپتال کے وقت کے مطابق ہے۔",
    ],
  ),
  "desk.recovery": g(
    ["queue_management", "refund_waiver_credit", "cash_back_prompts"],
    ["Resolve a lost answer", "گم شدہ جواب کا جائزہ"],
    [
      "New actions and navigation remain blocked while a write is pending or uncertain. Check latest slip and history/requests. Retry original action reuses its frozen payload/key for an idempotent action within24 hours; no automatic retry. Deferral cannot replay. After personally reviewing the actual record, tick the review statement and Close reviewed action; this does not assert success, undo cash or resend. A confirmed Saved message remains true even if a following read fails; refresh, never repeat a confirmed handover.",
      "جاری یا غیر یقینی تبدیلی میں نئے کام اور راستہ بند ہیں۔ تازہ پرچی، تاریخ اور درخواستیں دیکھیں۔ اصل عمل دوبارہ صرف محفوظ اصل معلومات اور کلید سے چوبیس گھنٹے کے اندر، خودکار نہیں۔ مؤخر کرنا دوبارہ نہیں بھیجا جاتا۔ اصل ریکارڈ دیکھ کر جائزے کا نشان اور بند کریں چنیں؛ یہ کامیابی، رقم کی واپسی یا دوبارہ ارسال نہیں۔ محفوظ ہونے کے بعد پڑھنے کی خطا ہو تو صرف تازہ کریں، تصدیق شدہ رقم دوبارہ نہ دیں۔",
    ],
  ),
  "queue.refresh": g(
    ["queue_management"],
    ["Refresh queues", "قطاریں تازہ کریں"],
    [
      "Reads the dashboard, chosen doctor's queue, selected slip and history. Live events and reconnect refresh them without polling. A failed read shows an error, never a fabricated empty queue. No queue edit or cash movement occurs.",
      "ڈیش بورڈ، منتخب ڈاکٹر، پرچی اور تاریخ دوبارہ پڑھتا ہے۔ حقیقی واقعات اور دوبارہ رابطہ انہیں تازہ کرتے ہیں۔ خرابی خالی کامیابی نہیں۔ قطار یا رقم نہیں بدلتی۔",
    ],
  ),
  "queue.filter": g(
    ["queue_management"],
    ["Doctor queue / All queues", "ڈاکٹر کی قطار یا تمام قطاریں"],
    [
      "Choose a real doctor supplied by the dashboard or the selected slip to read their calling order, status and waiting minutes. The selected doctor stays visible even when that queue becomes empty. All queues includes department-level queues where no doctor is assigned. This changes the view only; it never calls or reroutes a patient.",
      "ڈیش بورڈ یا منتخب پرچی کے اصل ڈاکٹر کو چن کر ترتیب، حالت اور انتظار پڑھیں۔ قطار خالی ہونے پر بھی منتخب ڈاکٹر برقرار رہتا ہے۔ تمام قطاروں میں بغیر ڈاکٹر شعبہ بھی شامل ہے۔ صرف منظر بدلتا ہے، مریض کو بلاتا یا منتقل نہیں کرتا۔",
    ],
  ),
  "queue.open": g(
    ["queue_management"],
    ["Open a queued, deferred or locked slip", "قطار، مؤخر یا بند پرچی کھولیں"],
    [
      "Open slip loads that exact ticket's patient, MRN, original token, payment, validity and history. Deferred and Awaiting approval groups are distinct; locked visits are off the doctor's queue. Expired — new visit needs a new slip means do not reuse or charge this old token. Opening a cash-back slip shows its mandatory handover.",
      "پرچی کھولیں اسی مریض، ایم آر این، اصل ٹوکن، ادائیگی، میعاد اور تاریخ پڑھتا ہے۔ مؤخر اور منظوری کی قطاریں الگ ہیں۔ بند وزٹ ڈاکٹر کی قطار سے باہر ہے۔ میعاد ختم پر نیا وزٹ نئی پرچی چاہتا ہے، پرانے ٹوکن پر نئی وصولی نہ کریں۔ واپسی والی پرچی رقم کا لازمی مکالمہ کھولتی ہے۔",
    ],
  ),
  "queue.change": g(
    ["queue_management"],
    ["Defer, reactivate or cancel unpaid", "مؤخر، بحال یا غیر ادا پرچی منسوخ"],
    [
      "Only eligible statuses and your permissions expose actions. Verify patient/number in the review. A changed slip version/token blocks confirmation; close and review the current status. Closing a changed reason asks before discarding it. Defer slip requires a3–500 character reason, keeps the ticket and does not refund. Reactivate slip keeps its token without another payment while valid. Cancel unpaid slip requires a reason and is unavailable when paid/locked. Confirm ticket action sends once; Close keeps the reason unsaved. Server refusals remain visible; re-read before any new decision after a concurrent change.",
      "اجازت اور درست حالت پر عمل نظر آتا ہے۔ جائزے میں مریض اور نمبر چیک کریں۔ جائزے کے دوران ورژن یا ٹوکن بدلے تو تصدیق رکتی ہے؛ بند کرکے تازہ حالت دیکھیں۔ لکھی وجہ چھوڑنے پر تصدیق ہوتی ہے۔ مؤخر کرنے کو تین تا پانچ سو حروف وجہ، پرچی برقرار اور رقم واپس نہیں۔ جائز میعاد میں بحالی اصل ٹوکن اور بغیر نئی ادائیگی ہے۔ غیر ادا منسوخی وجہ مانگتی، ادا یا بند پر دستیاب نہیں۔ تصدیق ایک بار بھیجتی ہے؛ بند کرنے پر وجہ غیر محفوظ رہتی ہے۔ خطا پر تازہ پڑھ کر اگلا فیصلہ کریں۔",
    ],
  ),
  "requests.refresh": g(
    ["refund_waiver_credit"],
    ["Refresh requests and slip", "درخواستیں اور پرچی تازہ کریں"],
    [
      "Reads the selected ticket and up to100 of your own approval requests. Live approval/cash-back/ticket events refresh the view. Pending is not approved; inspect actual status and decision note. Refresh preserves the unsaved reason and never resends a request.",
      "منتخب پرچی اور اپنی سو تک منظوری کی درخواستیں پڑھتا ہے۔ حقیقی منظوری، واپسی اور پرچی کے واقعات منظر تازہ کرتے ہیں۔ زیر التوا، منظور نہیں؛ اصل حالت اور نوٹ دیکھیں۔ تازہ کرنا وجہ رکھتا اور درخواست نہیں دہراتا۔",
    ],
  ),
  "requests.form": g(
    ["refund_waiver_credit"],
    ["Choose and prepare a request", "درخواست چنیں اور تیار کریں"],
    [
      "Open the actual slip. Request type offers only permitted lifecycle actions. Enter the factual reason. Refund: choose reason and optional positive amount (blank=remaining refundable). Pre-consult waiver: percentage greater than0 up to100. Post-consult waiver: authorized doctor needs a finalized note; the server selects the latest one, outcome Waivered rather than Refunded. Credit: enter amount paid now, actual method and optional due date; that amount is collected immediately, cash needs your own open shift. Void is only for an unpaid unlocked slip and is risk-monitored. Review request does not save.",
      "اصل پرچی کھولیں۔ اجازت اور حالت کے مطابق درخواست چنیں، حقیقی وجہ دیں۔ ریفنڈ میں وجہ اور مثبت رقم اختیاری، خالی پر قابل واپسی باقی رقم۔ پہلے معائنے کی رعایت صفر سے زیادہ سو تک۔ بعد کی رعایت مجاز ڈاکٹر اور حتمی نوٹ مانگتی ہے؛ نتیجہ رعایت ہے، ریفنڈ نہیں۔ ادھار میں ابھی ادا رقم، اصل طریقہ اور اختیاری تاریخ دیں؛ رقم فوراً وصول ہوتی، نقد کے لیے اپنی کھلی شفٹ لازم۔ غیر ادا غیر بند پرچی کی منسوخی نگرانی میں ہے۔ جائزہ ابھی محفوظ نہیں کرتا۔",
    ],
  ),
  "requests.confirm": g(
    ["refund_waiver_credit"],
    ["Confirm a request", "درخواست کی تصدیق"],
    [
      "Verify patient/MRN/ticket, action, reason and amount in Review request. Review keeps the original ticket version, fields and amounts fixed. A second-session change blocks confirmation: go back, compare the latest balance/status and review again. Confirm request sends once with its own retained key. Pending approval locks the visit and removes it from the doctor's queue. A clinical-activity refund needs elevated approval and is risk-flagged; ask the doctor about a post-consult waiver. Nobody hands back money merely because the request was submitted. The approver decides; approved refunds/waivers later create the mandatory cash-back prompt.",
      "جائزے میں اصل ورژن، معلومات اور رقم محفوظ رہتے ہیں۔ دوسری نشست سے تبدیلی پر تصدیق رکتی ہے؛ واپس جاکر تازہ بقایا اور حالت دیکھیں۔ جائزے میں مریض، ایم آر این، پرچی، عمل، وجہ اور رقم چیک کریں۔ تصدیق اصل کلید سے ایک بار بھیجتی ہے۔ زیر التوا منظوری وزٹ بند کرکے ڈاکٹر کی قطار سے ہٹاتی ہے۔ طبی کام کے بعد ریفنڈ بڑی منظوری اور خطرے کا نشان رکھتا ہے؛ ڈاکٹر سے بعد معائنہ رعایت پوچھیں۔ درخواست بھیجتے ہی رقم نہ دیں؛ منظوری کے بعد لازمی واپسی آتی ہے۔",
    ],
  ),
  "cashback.shift": g(
    ["queue_management", "refund_waiver_credit", "cash_back_prompts"],
    ["Own drawer and pending handover", "اپنی دراز اور باقی واپسی"],
    [
      "Cash leaves the signed-in cashier's own open shift at this counter, not an approver's drawer. The app first reads your identity, this terminal cash node and your own open shift. Missing/mismatched/closed drawer or a failed read disables the handover acknowledgement; do not give cash yet. Open another window for My cash shift opens your workspace separately; use its My cash shift screen, then return and Refresh slip. SHIFT_NOT_OPEN remains an error; no success is invented. Sign out; leave cash-back pending ends this session without dispensing or erasing the prompt; an authorized cashier can resume. Sign-out is disabled after a dispensation attempt becomes uncertain: first reconcile its original key/status; never lose the retained attempt or hand cash over again.",
      "نقد اسی کاؤنٹر پر اپنے کھلے کیش دراز سے نکلتا، منظور کنندہ سے نہیں۔ پہلے اصل شناخت، ٹرمینل کاؤنٹر اور اپنی کھلی شفٹ پڑھی جاتی ہے؛ بند، مختلف یا غیر دستیاب دراز پر نقد نہ دیں، بیان کا نشان بند رہتا ہے۔ دوسری ونڈو کھول کر میری کیش شفٹ استعمال کریں، پھر واپس پرچی تازہ کریں۔ شفٹ نہ کھلے تو خطا ہے، فرضی کامیابی نہیں۔ سائن آؤٹ رقم دیے یا اطلاع مٹائے بغیر نشست ختم کرتا؛ مجاز کیشیئر بعد میں مکمل کرتا ہے۔ ادائیگی کی کوشش کا نتیجہ غیر یقینی ہو تو سائن آؤٹ بند رہتا ہے؛ پہلے اصل درخواست اور حالت چیک کریں، نقد دوبارہ نہ دیں۔",
    ],
  ),
  "cashback.confirm": g(
    ["queue_management", "refund_waiver_credit", "cash_back_prompts"],
    ["Mandatory exact cash-back", "عین رقم کی لازمی واپسی"],
    [
      "The blocking modal shows the server's exact message/amount and patient identity until the approved cash-back is confirmed. The acknowledgement belongs to this exact ticket/patient/prompt/amount/shift; a changed context invalidates it. Verify and physically hand that cash over before ticking the statement and Confirm cash handed back. Only opd.cash_back.dispense may confirm; records-only mode cannot. Each refund/waiver handover has a separate original key. A lost reply requires checking and only an explicit original-key retry; never pay twice. A successful write cannot be repeated just because its following read fails.",
      "لازمی مکالمہ سرور کا عین پیغام، رقم اور مریض دکھاتا ہے۔ بیان صرف اسی مریض، پرچی، اطلاع، رقم اور شفٹ سے متعلق ہے؛ بدلنے پر درست نہیں رہتا۔ اصل نقد دینے کے بعد بیان کا نشان اور تصدیق کریں۔ صرف مجاز کیشیئر؛ صرف ریکارڈ حالت میں عمل نہیں۔ ہر ریفنڈ اور رعایت کی الگ اصل کلید۔ گم جواب پر پہلے جائزہ اور صرف اصل دوبارہ عمل؛ رقم دو بار نہیں۔ محفوظ تبدیلی کے بعد پڑھنے کی خطا نقد دوبارہ دینے کی وجہ نہیں۔",
    ],
  ),
  "cashback.refresh": g(
    ["cash_back_prompts"],
    ["Refresh cash-back", "رقم کی واپسی تازہ کریں"],
    [
      "Rereads the selected slip and, with queue permission, the dashboard's outstanding prompts. If none remains for the actual slip, no cash-back is pending. Cashier accounts without queue permission scan their physical slip; no guessed ID or fabricated list.",
      "منتخب پرچی اور قطار کی اجازت ہو تو باقی واپسی دوبارہ پڑھتا ہے۔ اصل پرچی پر اطلاع نہ ہو تو واپسی باقی نہیں۔ بغیر قطار اجازت کیشیئر اصل پرچی اسکین کرتا ہے؛ فرضی شناخت یا فہرست نہیں۔",
    ],
  ),
  "cashback.open": g(
    ["cash_back_prompts"],
    ["Open an outstanding handover", "باقی رقم کا اندراج کھولیں"],
    [
      "Open slip reads the server's exact outstanding ticket before showing the mandatory cash-back modal. The list's amount is not a completed payment. Confirm patient and read the current prompt before giving cash.",
      "پرچی کھولیں اصل باقی اندراج پڑھ کر لازمی مکالمہ دکھاتا ہے۔ فہرست کی رقم مکمل ادائیگی نہیں۔ نقد دینے سے پہلے مریض اور تازہ پیغام چیک کریں۔",
    ],
  ),
  "notifications.refresh": g(
    ["notifications"],
    ["Refresh inbox and unread count", "اطلاعات اور غیر پڑھے عدد کو تازہ کریں"],
    [
      "Refresh inbox reads your latest first page and the server's total unread count, including older and filtered-out items. It never repeats a read-status change. A failed refresh keeps the last view with a visible error; do not assume an empty or current inbox. After an uncertain mark-read result, refresh successfully before deciding on another action. Read status saved confirms a write even if its following refresh failed.",
      "اطلاعات تازہ کریں پہلا صفحہ اور سرور کا کل غیر پڑھا عدد پڑھتا ہے، جس میں پرانی اور فلٹر سے باہر اطلاعات شامل ہیں۔ یہ حالت کی تبدیلی نہیں دہراتا۔ خرابی پر آخری منظر اور واضح خطا رہتی ہے؛ فہرست خالی یا تازہ فرض نہ کریں۔ غیر یقینی تبدیلی کے بعد اگلا عمل چننے سے پہلے کامیابی سے تازہ کریں۔ حالت محفوظ ہونے کا پیغام تازہ کرنے کی خرابی کے باوجود اصل تبدیلی کی تصدیق ہے۔",
    ],
  ),
  "notifications.critical": g(
    ["notifications", "app_shell"],
    [
      "Critical notice: Open notifications / Dismiss",
      "اہم اطلاع: کھولیں / بند کریں",
    ],
    [
      "A notification whose severity is critical stays in the corner until Dismiss; it does not interrupt as Code Red. The title comes from the server event and the body is read from your permitted inbox. A loading/error or missing item is shown honestly; Try again only rereads. Open notifications keeps the notice open while you inspect the inbox. Dismiss closes this local notice only, never marks it read, resolves an alert, approves a request or records care. Other queued critical notices appear next. Signing out clears this account's notices.",
      "سرور کی اہم شدت والی اطلاع بند کریں تک کونے میں رہتی ہے؛ کوڈ ریڈ جیسی رکاوٹ نہیں بنتی۔ عنوان سرور کے واقعے اور تفصیل آپ کی مجاز فہرست سے آتی ہے۔ انتظار، خرابی یا گم شدہ اندراج واضح بتایا جاتا ہے؛ دوبارہ کوشش صرف پڑھتی ہے۔ اطلاعات کھولنے سے اطلاع بند نہیں ہوتی۔ بند کریں صرف مقامی اطلاع ہٹاتا ہے، پڑھا ہوا نشان، انتباہ کا حل، منظوری یا علاج نہیں کرتا۔ اگلی اہم اطلاع باری سے دکھتی ہے۔ سائن آؤٹ پر اکاؤنٹ کی اطلاعات صاف ہوتی ہیں۔",
    ],
  ),
  "settings.it.read": g(
    ["settings"],
    ["System sections, user search and audit", "نظام، صارف تلاش اور لاگ"],
    [
      "Open Settings > System (IT). Your server permissions decide the available sections. Users, roles and access reads HR's submitted provisioning queue, users, role matrix and sign-in audit. Find user searches the server by name/username; Account state limits to active/inactive; up to 100 matches are shown, so refine a full list. Sign-in failures only filters the latest 200 audit events. Empty HR queue means no submitted employee needs a login; it never authorizes inventing an employee ID. Open user rereads the selected real account. Hardware reads terminal, printer and badge-station mappings; Server health reads actual database/worker/disk/realtime diagnostics. Reload system records checks the server again without discarding the open draft or repeating a change. After a stale edit, Cancel the draft, reload the records and reopen the device before editing again. Errors stay visible and do not turn into empty-success data.",
      "ترتیبات > نظام (آئی ٹی) کھولیں۔ سرور کی اجازتیں دستیاب حصے طے کرتی ہیں۔ صارف، کردار اور رسائی میں ایچ آر کی جمع شدہ قطار، صارف، اجازتیں اور سائن اِن لاگ آتے ہیں۔ صارف تلاش نام یا یوزرنیم سے سرور پر ہوتی ہے؛ حالت سے فعال یا غیر فعال چنیں۔ زیادہ سے زیادہ سو نتائج ہیں، بھری فہرست پر تلاش محدود کریں۔ صرف ناکامیوں میں تازہ دو سو لاگ ہیں۔ خالی قطار نئی فرضی ملازم شناخت بنانے کی اجازت نہیں۔ صارف کھولیں منتخب اصل اکاؤنٹ دوبارہ پڑھتا ہے۔ ہارڈویئر اصل ٹرمینل، پرنٹر اور بیج ترتیب؛ صحت اصل ڈیٹابیس، ورکر، ڈسک اور رابطہ پڑھتی ہے۔ نظام کے ریکارڈ تازہ کریں کھلا مسودہ برقرار رکھتے ہوئے سرور پڑھتا ہے، تبدیلی دوبارہ نہیں کرتا۔ پرانی ترمیم کی خرابی پر مسودہ منسوخ کریں، ریکارڈ تازہ کریں اور آلہ دوبارہ کھول کر ترمیم کریں۔ خرابی کو خالی کامیابی نہیں دکھایا جاتا۔",
    ],
  ),
  "settings.it.fields": g(
    ["settings"],
    ["System change fields", "نظام کی تبدیلی کے خانے"],
    [
      "Select the actual HR employee before Provision login; use the server's role checklist and a unique username. New installation: Create the first Owner is offered only while the server says it is needed; enter their real authorized personnel details and extra roles. Nobody may provision SupportZeroInterface staff: they use badge stations. For devices enter the actual terminal MAC, location and printer names; choose only real department/printer mappings. Badge stations without RFID may use BarcodeScanner; station identity, location/action type and any ward/bed references must describe the actual installation. Review inactive/deactivation choices carefully. Yes/No fields with a server default always show an explicit choice; there is no blank choice that silently restores a default. The form preserves value types and server enumerations; a refused reference is an error, never a guessed replacement. Required fields and the exact emergency phrase must be complete before review.",
      "لاگ اِن دینے سے پہلے ایچ آر کا اصل ملازم چنیں؛ سرور کی کردار فہرست اور منفرد یوزرنیم استعمال کریں۔ نئی تنصیب پر سرور کے درکار بتانے تک پہلا مالک بنائیں دستیاب ہے؛ مجاز اصل کوائف اور اضافی کردار دیں۔ بغیر انٹرفیس مددگار عملہ بیج استعمال کرتا ہے، لاگ اِن نہیں۔ آلات کے لیے اصل میک، مقام، پرنٹر اور حقیقی شعبہ چنیں۔ آر ایف آئی ڈی نہ ہو تو بارکوڈ اسکینر چن سکتے ہیں؛ اسٹیشن، مقام، کام اور وارڈ یا بیڈ اصل تنصیب کے ہوں۔ غیر فعال کرنے کا انتخاب غور سے دیکھیں۔ ہاں یا نہیں کے سرور طے شدہ خانوں میں واضح انتخاب ہوتا ہے؛ خالی انتخاب سے پوشیدہ طے شدہ قدر بحال نہیں ہوتی۔ قسمیں اور سرور کی فہرست برقرار ہیں؛ غلط حوالہ پر فرضی متبادل نہیں۔ لازمی خانے اور ہنگامی عین عبارت مکمل کرکے جائزہ لیں۔",
    ],
  ),
  "settings.it.access": g(
    ["settings"],
    [
      "Roles, permission requests and Owner handover",
      "کردار، اجازت کی درخواست اور مالک",
    ],
    [
      "Open a user's roles or expand a role in the matrix before changing access. Request role change selects the proposed complete role list for someone else, requires a reason, and sends an Owner change request. Request permission change similarly submits the complete permission list for that role. The server decides Pending versus Applied; Pending is Waiting for an Owner, not completed access. Never remove your own roles or try to bypass LAST_OWNER/SELF_ROLE_CHANGE_FORBIDDEN. Refresh actual users/matrix and request status after the Owner's decision. A privileged provisioning refusal means provision permitted ordinary roles first, then request the extra access through the Owner; never invent a local success.",
      "رسائی بدلنے سے پہلے صارف کے کردار یا میٹرکس میں کردار کھولیں۔ کردار کی درخواست دوسرے صارف کی مکمل مجوزہ فہرست اور وجہ مالک کو بھیجتی ہے۔ اجازت کی درخواست بھی کردار کی مکمل فہرست بھیجتی ہے۔ منتظر یا لاگو سرور طے کرتا ہے؛ منتظر کا مطلب مالک کا انتظار ہے، مکمل رسائی نہیں۔ اپنے کردار بدلنے، آخری مالک ہٹانے یا سرور کی پابندی سے بچنے کی کوشش نہ کریں۔ مالک کے فیصلے پر اصل صارف، میٹرکس اور درخواست تازہ پڑھیں۔ استحقاقی کردار کی فراہمی منع ہو تو پہلے مجاز عام کردار دیں، پھر مالک کو درخواست کریں؛ مقامی کامیابی نہ بنائیں۔",
    ],
  ),
  "settings.it.actions": g(
    ["settings"],
    ["Review and confirm system changes", "نظام کی تبدیلی کا جائزہ اور تصدیق"],
    [
      "Opening another system action asks before discarding the current draft; Cancel keeps it, and accepting opens the other action without saving. Review system change opens a confirmation showing the exact selected target and submitted values. Go back returns to the draft; Confirm system change sends once and stays disabled while pending. Device edits reread their current mapping before replacement; a detected change requires reloading, and no atomic server-version guarantee is invented. Deactivate/reactivate requires a reason. Issue temporary password ends that user's sessions; End user's sessions also affects sessions opened since any prior attempt, so neither action is auto-repeated. Maintenance blocks non-admin work: coordinate with hospital staff first. The large red emergency-only Force global logout button opens the form; confirming the completed form ends every hospital session and requires the exact typed FORCE GLOBAL LOGOUT phrase plus a reason and confirmation. No global action is performed by merely opening or reading these panels.",
      "دوسرا نظام عمل کھولنے سے پہلے مسودہ چھوڑنے کی تصدیق ہوتی ہے؛ منسوخ پر مسودہ رہتا ہے اور قبول پر بغیر محفوظ کیے دوسرا عمل کھلتا ہے۔ نظام کی تبدیلی کا جائزہ منتخب ہدف اور بھیجے جانے والے کوائف کی تصدیق کھولتا ہے۔ واپس پر مسودہ رہتا ہے؛ تصدیق ایک بار بھیجتی اور انتظار میں بند رہتی ہے۔ آلے کی ترمیم سے پہلے اصل ترتیب پڑھی جاتی ہے؛ فرق پر دوبارہ لوڈ کریں، سرور کی ایٹمی ورژن ضمانت کا دعویٰ نہیں۔ غیر فعال یا بحال پر وجہ دیں۔ عارضی پاس ورڈ صارف کے سیشن ختم کرتا ہے؛ سیشن ختم کرنا بھی بعد کے سیشن متاثر کر سکتا ہے، اس لیے خود نہیں دہرایا جاتا۔ دیکھ بھال عام عملہ روکتی ہے؛ پہلے اطلاع و رابطہ کریں۔ بڑا سرخ ہنگامی عالمی سائن آؤٹ بٹن فارم کھولتا ہے؛ مکمل فارم کی تصدیق سب کے سیشن ختم کرتی ہے اور عین FORCE GLOBAL LOGOUT، وجہ اور تصدیق چاہتا ہے۔ صرف حصہ کھولنے یا پڑھنے سے کوئی عالمی تبدیلی نہیں ہوتی۔",
    ],
  ),
  "settings.it.recovery": g(
    ["settings"],
    ["Unknown system change outcome", "نظام کی تبدیلی کا نامعلوم نتیجہ"],
    [
      "Keep this window open after an uncertain reply. The original action/body/key is held in memory and navigation/new changes are blocked. Reload system records and open the exact user/device/request; reconcile with the responsible administrator. Only operations whose contract supplies an idempotency key offer Retry original request with the same body/key inside 24 hours. An unversioned replacement, provisioning, password reset, session revocation or station-key rotation is never blindly retried. A lost credential result cannot be recovered by repeating provisioning: inspect the account/station and require a deliberate new reset/rotation only if necessary after review. Close reviewed attempt clears the hold after supervisor reconciliation; it does not claim success or undo a change. Closing the app loses this in-memory hold.",
      "غیر یقینی جواب پر ونڈو کھلی رکھیں۔ اصل عمل، کوائف اور شناخت میموری میں رکتی اور نئی تبدیلی یا نقل و حرکت بند ہے۔ نظام کے ریکارڈ تازہ کرکے عین صارف، آلہ یا درخواست ذمہ دار منتظم کے ساتھ واضح کریں۔ صرف معاہدے میں شناختی کلید والے عمل چوبیس گھنٹے کے اندر وہی کوائف اور کلید دوبارہ بھیج سکتے ہیں۔ بے ورژن تبدیلی، لاگ اِن، پاس ورڈ، سیشن یا اسٹیشن کلید اندھا دھند نہیں دہرائی جاتی۔ گم شدہ کوائف کا جواب نئی فراہمی سے واپس نہیں ملتا؛ ریکارڈ دیکھ کر ضرورت ہو تو جائزے کے بعد الگ ری سیٹ یا گردش کریں۔ جائزہ شدہ کوشش بند روک ہٹاتا ہے، کامیابی یا واپسی نہیں۔ ایپ بند ہونے پر یہ میموری کی روک ختم ہوتی ہے۔",
    ],
  ),
  "settings.it.secret": g(
    ["settings"],
    ["Once-only credential slip", "صرف ایک بار دکھنے والے خفیہ کوائف"],
    [
      "Provisioning, password reset and station-key rotation may return a credential once. Copy credential is an explicit copy to this computer's clipboard; protect and clear it after private delivery. Print credential slip opens the native print dialog for this already-confirmed result. A failed print never issues a second password/key or repeats the write: reprint the same open slip. Closing the dialog or I have secured the credential clears its in-memory display; it is never saved to browser storage, preferences or a journal. The new user must change a temporary password on first sign-in; the Owner's personnel file still needs its CNIC copy. If the first response was lost, reconcile the record with IT before a deliberate new reset, never pretend the missing password was retrieved.",
      "فراہمی، پاس ورڈ ری سیٹ یا اسٹیشن کلید ایک بار خفیہ کوائف واپس دے سکتی ہے۔ نقل کرنا اسی کمپیوٹر کے کلپ بورڈ پر آپ کا واضح انتخاب ہے؛ نجی حوالگی کے بعد اسے محفوظ طور پر صاف کریں۔ پرچی چھاپنا اسی تصدیق شدہ نتیجے کا مقامی پرنٹ ڈائیلاگ ہے۔ پرنٹ ناکامی نیا پاس ورڈ یا کلید نہیں بناتی؛ وہی کھلی پرچی دوبارہ چھاپیں۔ بند کرنے یا محفوظ کر لیا سے میموری کا منظر صاف ہوتا ہے؛ براؤزر، ترجیحات یا جرنل میں نہیں رکھا جاتا۔ نیا صارف پہلے سائن اِن پر پاس ورڈ بدلے؛ مالک کی فائل کو شناختی کارڈ نقل اب بھی چاہیے۔ پہلا جواب گم ہو تو آئی ٹی سے اصل ریکارڈ واضح کرکے ضرورت پر الگ ری سیٹ کریں، گم شدہ پاس ورڈ ملنے کا دعویٰ نہ کریں۔",
    ],
  ),
  "incident.recovery": g(
    ["report_incident"],
    [
      "Check My reports / Retry original report / Close reviewed attempt",
      "میری رپورٹیں / اصل رپورٹ دوبارہ / جائزہ شدہ کوشش بند",
    ],
    [
      "A lost report reply freezes the original report and request identity in this window. Check My reports and open the actual record with the Quality Officer. Within 24 hours Retry original report sends that identical request and can replay its first result, never a replacement report. After expiry or clock reversal ask the Quality Officer to reconcile it. Close reviewed attempt clears only the hold after their review; it neither claims success nor undoes a report. Keep the window open: this recovery is in memory only.",
      "رپورٹ کا جواب گم ہو تو اصل رپورٹ اور شناخت اسی ونڈو میں رکتی ہے۔ کوالٹی افسر کے ساتھ میری رپورٹیں میں اصل ریکارڈ کھولیں۔ چوبیس گھنٹے کے اندر اصل رپورٹ دوبارہ وہی درخواست بھیجتی ہے، نیا متبادل نہیں بناتی۔ مدت یا گھڑی الٹنے پر کوالٹی افسر سے نتیجہ واضح کروائیں۔ جائزہ شدہ کوشش بند صرف روک ہٹاتا ہے، کامیابی یا واپسی کا اعلان نہیں۔ ونڈو کھلی رکھیں؛ بحالی صرف میموری میں ہے۔",
    ],
  ),
  "settings.recovery": g(
    ["settings"],
    [
      "Check policy and requests / Retry original request / Close reviewed attempt",
      "پالیسی اور درخواستیں / اصل درخواست دوبارہ / جائزہ شدہ کوشش بند",
    ],
    [
      "An uncertain policy reply holds the original value and request identity in this window. Read current policy and recent requests, then open the request's live detail. A failed follow-up read must never create another request. Retry original request keeps the exact payload/key within 24 hours; after expiry or clock reversal reconcile with the administrator. Close reviewed attempt clears only the reviewed hold, not the server record. Policy changes follow approval.resolved; they are not personal display preferences.",
      "پالیسی کا غیر یقینی جواب اصل قدر اور شناخت اسی ونڈو میں روکتا ہے۔ موجودہ پالیسی اور حالیہ درخواستیں پڑھ کر اصل تفصیل کھولیں۔ بعد کی پڑھائی ناکام ہو تو نئی درخواست نہ بنائیں۔ اصل درخواست دوبارہ چوبیس گھنٹے میں وہی مواد اور شناخت بھیجتی ہے؛ مدت یا گھڑی الٹنے پر ایڈمن سے مطابقت کرائیں۔ جائزہ شدہ کوشش بند صرف روک ہٹاتا ہے، سرور کا ریکارڈ نہیں۔ پالیسی کی تبدیلی منظوری کے مطابق ہوتی ہے، ذاتی ترتیب نہیں۔",
    ],
  ),
  "shell.session": g(
    deliveredHelpScreens,
    ["Confirm your session / Password", "سیشن کی تصدیق / پاس ورڈ"],
    [
      "When session renewal cannot be confirmed, this window keeps your draft and pauses authenticated work. Enter the same account's current password and choose Confirm your session once. This starts a new authenticated session; it never retries the lost refresh token, a password change or any business submission. For a confirmed password change use the NEW password. A different account cannot inherit this draft. Server revocation still signs out every window. An incorrect password is cleared; follow any server lockout message and contact IT if needed.",
      "سیشن کی تجدید غیر یقینی ہو تو ونڈو مسودہ برقرار رکھتی اور مجاز کام روکتی ہے۔ اسی اکاؤنٹ کا موجودہ پاس ورڈ درج کرکے ایک بار سیشن کی تصدیق کریں۔ یہ نیا سیشن بناتا ہے، گم شدہ ٹوکن، پاس ورڈ کی تبدیلی یا کاروباری ارسال نہیں دہراتا۔ پاس ورڈ بدل چکا ہو تو نیا پاس ورڈ دیں۔ دوسرے اکاؤنٹ کو مسودہ نہیں ملتا۔ سرور کی منسوخی پر تمام ونڈوز بند ہوتی ہیں۔ غلط پاس ورڈ صاف ہوتا ہے؛ سرور کی پابندی یا آئی ٹی کی ہدایت پر عمل کریں۔",
    ],
  ),
  "cash.refresh": g(
    ["my_cash_shift"],
    ["Refresh / Show my current shift", "تازہ کریں / میری موجودہ شفٹ"],
    [
      "Refresh reads the shift, its ledger and terminal counter again; it never opens or closes a drawer. Show my current shift returns from a reviewed closed shift to the current server result. Review the shift number, cashier, counter, business date, hospital time and transaction amounts. Empty collections mean no entries were returned, not a zero balance inferred after an error. A failed reviewed-shift refresh blocks closure until Refresh succeeds, with counted input kept. New actions recheck access, counter and drawer before submission. There is no cash-shift event guarantee: use Refresh before decisions.",
      "تازہ کریں شفٹ، کھاتہ اور ٹرمینل کاؤنٹر دوبارہ پڑھتا ہے؛ دراز کھولتا یا بند نہیں کرتا۔ میری موجودہ شفٹ سے جائزہ شدہ بند شفٹ کے بجائے موجودہ نتیجہ دکھتا ہے۔ نمبر، کیشیئر، کاؤنٹر، کاروباری تاریخ، ہسپتال کا وقت اور رقوم چیک کریں۔ خالی کھاتہ خطا کے بعد فرضی صفر نہیں ہے۔ جائزہ شدہ شفٹ کی تازگی ناکام ہو تو بندش کامیاب تازگی تک رکے گی اور گنی ہوئی رقم رہے گی۔ نیا عمل اجازت، کاؤنٹر اور دراز دوبارہ چیک کرتا ہے۔ فیصلے سے پہلے تازہ کریں۔",
    ],
  ),
  "cash.open": g(
    ["my_cash_shift"],
    ["Opening float / Open cash shift", "ابتدائی فلوٹ / کیش شفٹ کھولیں"],
    [
      "Counter staff with permission open My cash shift before cash work. Verify Terminal cash counter; it comes from the terminal mapping and cannot be changed here. A missing/wrong mapping needs IT. With no current open shift, enter a finite nonnegative Opening float and choose Open cash shift once. Wait for the server's shift number. An uncertain answer freezes the original counter, amount and request identity for review. Never start a replacement action to repair a failed follow-up read.",
      "مجاز کاؤنٹر عملہ نقد کام سے پہلے میری کیش شفٹ کھولے۔ ٹرمینل کا کیش کاؤنٹر چیک کریں؛ اسے یہاں نہیں بدلا جا سکتا۔ غلط یا غائب ترتیب آئی ٹی درست کرے۔ کھلی شفٹ نہ ہو تو درست غیر منفی ابتدائی فلوٹ درج کرکے ایک بار کیش شفٹ کھولیں۔ سرور کے نمبر کا انتظار کریں۔ غیر یقینی جواب پر اصل کاؤنٹر، رقم اور شناخت جائزے تک رکتی ہے۔ پڑھنے کی خطا کے لیے نیا عمل نہ کریں۔",
    ],
  ),
  "cash.close": g(
    ["my_cash_shift"],
    [
      "Counted cash / Close shift / Go back",
      "گنی ہوئی نقدی / شفٹ بند کریں / واپس",
    ],
    [
      "On your open shift at the mapped counter, count all physical cash including the opening float. Enter Counted cash in drawer (zero is allowed), choose Close shift, compare shift/counter and amounts, then Confirm & Close Shift. The confirmation retains the reviewed shift, counter and amounts. If the shift or expected cash changes, confirmation is blocked: Go back, Refresh and review again. Go back or Close dismisses confirmation without saving and keeps the amount. PendingCollection is server-confirmed closure, not accountant verification. Read Declared variance exactly as returned by the server; Expected cash includes the opening float. Opening float appears in the ledger and transaction totals; never subtract it or compute a drawer balance. A refused or lost close answer must be checked against the original shift; it is never blindly repeated. Another counter or missing identity blocks closing here.",
      "مقررہ کاؤنٹر کی اپنی کھلی شفٹ میں ابتدائی فلوٹ سمیت تمام نقد گنیں۔ دراز میں گنی ہوئی نقدی درج کریں، صفر بھی درست ہے۔ شفٹ بند کریں، نمبر، کاؤنٹر اور رقم دیکھیں پھر تصدیق کریں۔ تصدیق میں جائزہ شدہ شفٹ، کاؤنٹر اور رقم برقرار رہتے ہیں۔ شفٹ یا متوقع نقد بدل جائے تو تصدیق رک جاتی ہے؛ واپس جائیں، تازہ کریں اور دوبارہ جائزہ لیں۔ واپس یا بند سے کچھ محفوظ نہیں ہوتا اور رقم رہتی ہے۔ وصولی کا انتظار اکاؤنٹنٹ کی تصدیق نہیں۔ اعلانیہ نقد رقم کا فرق بعینہ سرور سے دیکھیں؛ متوقع نقد میں فلوٹ شامل ہے۔ ابتدائی فلوٹ لیجر اور مجموعوں میں ہے؛ اسے نہ نکالیں اور خود بیلنس نہ بنائیں۔ انکار یا گم جواب پر اصل شفٹ چیک کریں، اندھا دوبارہ ارسال نہ کریں۔ دوسرے کاؤنٹر یا نامعلوم شناخت پر بندش رکے گی۔",
    ],
  ),
  "cash.recovery": g(
    ["my_cash_shift"],
    [
      "Check original shift / Retry original opening / Close reviewed attempt",
      "اصل شفٹ چیک / اصل افتتاح دوبارہ / جائزہ شدہ کوشش بند",
    ],
    [
      "Keep this window open when an answer is uncertain: this action is in memory only. Check original shift only reads the server. A missing current shift alone cannot prove failure. Within 24 hours Retry original opening repeats the identical counter, float and request identity; it is unavailable after expiry or a clock reversal. There is no retry button for closure. Inspect the original shift with your supervisor, then Close reviewed attempt and confirm only after reconciliation. This clears the hold without declaring success or undoing anything. A new close may be considered only after the original still reads Open. Before closing/reloading the app, record the shift number and ask your supervisor to reconcile on the server; never create a new opening just because the reply was lost.",
      "جواب غیر یقینی ہو تو ونڈو کھلی رکھیں؛ عمل صرف میموری میں ہے۔ اصل شفٹ چیک صرف سرور پڑھتا ہے۔ موجودہ شفٹ نہ ملنا ناکامی کا ثبوت نہیں۔ چوبیس گھنٹے کے اندر اصل افتتاح دوبارہ وہی کاؤنٹر، فلوٹ اور شناخت بھیجتا ہے؛ مدت یا گھڑی الٹنے پر دستیاب نہیں۔ بندش دوبارہ بھیجنے کا بٹن نہیں۔ نگران کے ساتھ اصل شفٹ دیکھیں، نتیجہ واضح ہو تو جائزہ شدہ کوشش بند کی تصدیق کریں؛ یہ کامیابی یا واپسی کا اعلان نہیں۔ اصل شفٹ کھلی ملے تب نئی بندش سوچیں۔ ایپ بند کرنے سے پہلے نمبر لکھیں اور نگران سے سرور پر مطابقت کرائیں۔",
    ],
  ),
  "facility.recovery": g(
    ["facility_profile"],
    [
      "Check server status and history / Retry original request / Close reviewed attempt",
      "سرور کی حالت اور تاریخ / اصل درخواست دوبارہ / جائزہ شدہ کوشش بند",
    ],
    [
      "If an apply reply is uncertain, the exact request is retained for this account and hospital on this terminal, including after reload or reopening the app. Editing and navigation are blocked until reviewed. Check server status and history reads current records without applying anything. Expand Review recent server history to inspect the fetched records; collapse it to return to the recovery controls. History text alone is not proof that this attempt succeeded. Within 24 hours, Retry original request sends the identical request with its original identity; it cannot create a second logical action. After expiry or a clock change, no retry is offered. With your administrator, verify the actual saved outcome, then Close reviewed attempt and confirm; this only clears the recovery hold, never undoes a change or declares it applied. A confirmed server refusal requires a fresh preview. Other accounts or hospitals cannot reuse this request. Resolve retained attempts before starting new work.",
      "لاگو کرنے کا جواب غیر یقینی ہو تو اسی اکاؤنٹ اور ہسپتال کی اصل درخواست اس ٹرمینل پر، دوبارہ لوڈ یا ایپ کھولنے کے بعد بھی، رہتی ہے۔ جائزے تک ترمیم اور صفحہ بدلنا رکتا ہے۔ سرور کی حالت اور تاریخ صرف موجودہ ریکارڈ پڑھتے ہیں، کچھ نافذ نہیں کرتے۔ حالیہ تاریخ کا جائزہ کھول کر ریکارڈ دیکھیں اور بند کرکے بحالی کے بٹن پر لوٹیں۔ صرف متن ملنا کامیابی کا ثبوت نہیں۔ ۲۴ گھنٹوں کے اندر اصل درخواست دوبارہ وہی شناخت اور مواد بھیجتی ہے؛ دوسرا منطقی عمل نہیں بنتا۔ مدت یا گھڑی بدلنے پر دوبارہ ارسال نہیں ملتا۔ ایڈمن کے ساتھ اصل محفوظ نتیجہ چیک، پھر جائزہ شدہ کوشش بند کی تصدیق کریں؛ یہ صرف روک ہٹاتا ہے، تبدیلی واپس یا کامیابی کا اعلان نہیں کرتا۔ مصدقہ انکار پر نیا پیش منظر لازم ہے۔ دوسرے اکاؤنٹ یا ہسپتال میں یہ درخواست استعمال نہیں ہوتی۔ نیا کام شروع کرنے سے پہلے محفوظ کوشش حل کریں۔",
    ],
  ),
  "common.close": g(
    deliveredHelpScreens,
    ["Close · × / Escape", "بند کریں · × / Escape"],
    [
      "Close dismisses the current dialog and restores its previous keyboard focus. It does not save a form or confirm an approval. A submitting decision cannot be dismissed until the response returns. Closing Help keeps the underlying draft.",
      "بند کریں سے موجودہ مکالمہ بند اور پچھلا کی بورڈ فوکس واپس ہوتا ہے۔ فارم محفوظ یا منظوری کی تصدیق نہیں ہوتی۔ ارسال شدہ فیصلے کا جواب آنے تک مکالمہ بند نہیں ہوتا۔ مدد بند کرنے سے نیچے کا مسودہ رہتا ہے۔",
    ],
  ),
  "common.retry": g(
    deliveredHelpScreens,
    ["Try again", "دوبارہ کوشش کریں"],
    [
      "After checking the visible loading error and restoring connection or permissions, Try again reloads that view. It does not repeat a form submission. If the same error persists, give the displayed reference to IT or the responsible supervisor.",
      "خطا دیکھنے اور رابطہ یا اجازت بحال کرنے کے بعد دوبارہ کوشش کریں سے منظر تازہ ہوتا ہے۔ فارم دوبارہ ارسال نہیں ہوتا۔ وہی خطا رہے تو نظر آنے والا حوالہ آئی ٹی یا متعلقہ نگران کو دیں۔",
    ],
  ),
  "shell.navigation": g(
    ["app_shell"],
    [
      "Navigation, home cards and Skip to content",
      "فہرست، ابتدائی کارڈ اور مواد پر جائیں",
    ],
    [
      "After sign-in, Preparing your workspace checks access, hospital settings and the workspace handbook before showing the full menu together. Reference lists and the notification count refresh in the background; a failed reference read shows Retry loading reference lists, which does not repeat sign-in or submit business records. If loading fails, Retry loading workspace re-reads metadata without repeating sign-in or any business action. Use the sidebar or a home card to open its named task; Skip to content moves keyboard focus to the work area. The notification badge counts unread items. Navigation does not save a form. If a draft warning appears, Cancel keeps your input; accepting discards it. A running submission must finish before switching screens.",
      "سائن اِن کے بعد کام کی جگہ تیار ہونے کا انتظار کریں؛ اجازت، ترتیبات اور رہنمائی آنے پر مجاز فہرست ایک ساتھ آتی ہے۔ حوالہ جاتی فہرستیں اور اطلاعات کا عدد پس منظر میں تازہ ہوتے ہیں۔ خرابی پر حوالہ جاتی فہرستیں دوبارہ حاصل کریں سے صرف ان کی دوبارہ کوشش ہوتی ہے۔ خرابی پر کام کی جگہ دوبارہ حاصل کریں سے صرف معلومات دوبارہ پڑھی جاتی ہیں، دوبارہ سائن اِن یا کاروباری ارسال نہیں ہوتا۔ فہرست یا ابتدائی کارڈ سے مطلوبہ کام کھولیں؛ مواد پر جائیں سے کی بورڈ کا فوکس کام کے حصے میں جاتا ہے۔ اطلاعات کا عدد غیر پڑھی اطلاعات ہے۔ صفحہ بدلنے سے فارم محفوظ نہیں ہوتا۔ مسودے کی تنبیہ پر منسوخ کریں سے اندراج باقی رہتا ہے؛ قبول کرنے سے ضائع ہوتا ہے۔ جاری ارسال مکمل ہونے دیں۔",
    ],
  ),
  "shell.terminal": g(
    ["app_shell"],
    ["This terminal · ⓘ", "یہ ٹرمینل · ⓘ"],
    [
      "Open the information button to inspect this terminal's location and mapped printers before work. Close returns to the same screen without changing mappings; ask IT to correct a wrong counter or missing printer.",
      "کام سے پہلے معلومات کا بٹن کھول کر اس ٹرمینل کا مقام اور مقررہ پرنٹر دیکھیں۔ بند کرنے سے اسی صفحے پر واپس آتے ہیں اور ترتیب نہیں بدلتی۔ غلط کاؤنٹر یا غائب پرنٹر کے لیے آئی ٹی سے رابطہ کریں۔",
    ],
  ),
  "shell.help": g(
    ["app_shell", "help_center"],
    ["Help · F1", "مدد · F1"],
    [
      "Press F1, including while typing or inside a dialog, or select Help · F1. The current screen's permitted handbook opens over your work. Close restores focus and keeps the draft. Help works from bundled pages during an outage; it cannot grant access to a restricted page.",
      "لکھتے ہوئے یا مکالمے کے اندر بھی F1 دبائیں، یا مدد · F1 منتخب کریں۔ موجودہ صفحے کا مجاز رہنما کام کے اوپر کھلتا ہے۔ بند کرنے سے فوکس اور مسودہ باقی رہتے ہیں۔ رابطہ منقطع ہونے پر محفوظ رہنما پڑھ سکتے ہیں؛ مدد ممنوع صفحے کی اجازت نہیں دیتی۔",
    ],
  ),
  "shell.settings": g(
    ["app_shell", "settings"],
    ["Settings · Ctrl/Cmd+,", "ترتیبات · Ctrl/Cmd+,"],
    [
      "Open Settings from the avatar account menu, navigation, the login header or Ctrl/Cmd+comma. Before login only terminal settings are available. After login sections follow your permissions. Changing screen or section warns about an edited draft; Cancel keeps it.",
      "نام کے اکاؤنٹ مینو، فہرست، لاگ اِن کے اوپر یا Ctrl/Cmd+کاما سے ترتیبات کھولیں۔ لاگ اِن سے پہلے صرف ٹرمینل کی ترتیب ملتی ہے۔ بعد میں حصے آپ کی اجازت کے مطابق ہوتے ہیں۔ ترمیم شدہ مسودہ چھوڑنے پر تنبیہ آتی ہے؛ منسوخ کریں سے برقرار رہتا ہے۔",
    ],
  ),
  "shell.logout": g(
    ["app_shell"],
    [
      "Avatar, Sign out, Keep working, Sign out everywhere",
      "نام کا بٹن، سائن آؤٹ، کام جاری رکھیں، ہر جگہ سائن آؤٹ",
    ],
    [
      "Finish or deliberately discard drafts before signing out. Pending actions block sign-out; resolve uncertain cash-shift requests while their window stays open. Unsaved drafts require confirmation before being discarded. The avatar or Sign out opens a confirmation: Keep working closes it, Sign out ends this shared terminal session, and Sign out everywhere revokes your other sessions too. All windows sharing this session return to login. While Signing out is shown, confirmation actions are disabled; repeated clicks or another window cannot start another sign-out. Wait for the result; an error leaves the session open for deliberate recovery, while confirmed server revocation closes it. Signing out never saves unfinished forms.",
      "سائن آؤٹ سے پہلے مسودہ مکمل کریں یا جان بوجھ کر چھوڑیں۔ جاری عمل پر سائن آؤٹ رکتا ہے؛ غیر یقینی کیش شفٹ اسی کھلی ونڈو میں واضح کریں۔ مسودہ ختم کرنے سے پہلے تصدیق لازم ہے۔ نام کا بٹن یا سائن آؤٹ تصدیق کھولتا ہے: کام جاری رکھیں سے بند ہوتا ہے، سائن آؤٹ سے یہ ٹرمینل سیشن ختم ہوتا ہے، ہر جگہ سائن آؤٹ سے دوسرے سیشن بھی ختم ہوتے ہیں۔ اس سیشن کی تمام ونڈوز لاگ اِن پر لوٹتی ہیں۔ سائن آؤٹ جاری ہو تو تصدیق کے بٹن بند رہتے ہیں؛ بار بار کلک یا دوسری ونڈو نیا سائن آؤٹ نہیں بھیج سکتی۔ نتیجے کا انتظار کریں؛ خرابی پر خود بحالی کریں اور سرور کی تصدیق شدہ منسوخی پر سیشن بند ہوتا ہے۔ نامکمل فارم محفوظ نہیں ہوتے۔",
    ],
  ),
  "shell.maintenance": g(
    ["app_shell"],
    [
      "Maintenance: Check again and Sign out",
      "دیکھ بھال: دوبارہ چیک کریں اور سائن آؤٹ",
    ],
    [
      "When maintenance interrupts work, keep unsaved input in this window and follow the hospital's downtime procedure. The message is IT’s exact server text, including changes while you wait. Check again reads health again; it does not switch maintenance off. Sign out opens the normal sign-out confirmation. Contact IT if the notice persists.",
      "دیکھ بھال کی وجہ سے کام رکے تو غیر محفوظ اندراج اسی ونڈو میں رکھیں اور ہسپتال کے منظور شدہ متبادل طریقے پر عمل کریں۔ دوبارہ چیک کریں سرور کی حالت دیکھتا ہے، دیکھ بھال بند نہیں کرتا۔ سائن آؤٹ معمول کی تصدیق کھولتا ہے۔ پیغام برقرار رہے تو آئی ٹی سے رابطہ کریں۔",
    ],
  ),
  "shell.critical": g(
    ["app_shell"],
    ["Acknowledge on this terminal", "اس ٹرمینل پر اطلاع دیکھنے کی تصدیق"],
    [
      "Read an interrupting alert and follow the hospital's response procedure. Acknowledge on this terminal closes only this local dialog; it does not resolve the emergency or confirm another person's response. Do not infer a clinical outcome from dismissal.",
      "فوری اطلاع پڑھیں اور ہسپتال کے مقررہ ردعمل پر عمل کریں۔ اس ٹرمینل پر تصدیق صرف مقامی مکالمہ بند کرتی ہے؛ ایمرجنسی ختم یا دوسرے فرد کا ردعمل ثابت نہیں ہوتا۔ مکالمہ بند ہونے کو طبی نتیجہ نہ سمجھیں۔",
    ],
  ),
  "workspace.open": g(
    ["workspace_picker"],
    [
      "Open workspace → / Open in new window",
      "کام کی جگہ کھولیں / نئی ونڈو میں کھولیں",
    ],
    [
      "After login, check your name and choose the workspace for today's duty. Open workspace changes this window; Open in new window keeps the current work in its original window. Only server-permitted workspaces are listed. A service change may remove new-work access or leave records only. Ask an administrator about missing access rather than using another person's login.",
      "لاگ اِن کے بعد نام دیکھیں اور آج کی ڈیوٹی کی جگہ منتخب کریں۔ کام کی جگہ کھولیں اسی ونڈو کو بدلتا ہے؛ نئی ونڈو میں کھولیں سے پرانا کام اپنی ونڈو میں رہتا ہے۔ صرف سرور کی مجاز جگہیں دکھتی ہیں۔ خدمت کی تبدیلی سے نیا کام بند یا صرف ریکارڈ باقی رہ سکتے ہیں۔ دوسرے کا لاگ اِن استعمال کرنے کے بجائے ایڈمن سے رابطہ کریں۔",
    ],
  ),
  "connection.discover": g(
    ["connect_server"],
    [
      "Find servers on this network / hospital result",
      "نیٹ ورک پر سرور تلاش کریں / ہسپتال کا نتیجہ",
    ],
    [
      "Use discovery on the hospital network, then select the hospital supplied by IT. A result fills the address but does not establish trust. No results: obtain the HTTPS address or provisioning file from IT; do not choose an unfamiliar hospital.",
      "ہسپتال کے نیٹ ورک پر تلاش کریں، پھر آئی ٹی کا بتایا ہسپتال منتخب کریں۔ نتیجہ پتہ بھرتا ہے مگر شناخت کی تصدیق نہیں کرتا۔ نتیجہ نہ ملے تو آئی ٹی سے HTTPS پتہ یا ترتیب کی فائل لیں؛ نامعلوم ہسپتال منتخب نہ کریں۔",
    ],
  ),
  "connection.trust": g(
    ["connect_server"],
    [
      "Server address, Check server identity, fingerprint, They match — connect",
      "سرور کا پتہ، شناخت چیک کریں، فنگرپرنٹ، مطابقت پر رابطہ",
    ],
    [
      "Enter the hospital's HTTPS address and select Check server identity. Compare the complete displayed CA fingerprint with the independent value from IT. Enter that value; They match — connect is available only when they match. Editing the address requires checking identity again. A mismatch or changed certificate needs IT investigation, not repeated acceptance.",
      "ہسپتال کا HTTPS پتہ درج کرکے سرور کی شناخت چیک کریں۔ مکمل دکھایا گیا سی اے فنگرپرنٹ آئی ٹی سے الگ حاصل کردہ قدر سے ملائیں۔ وہ قدر درج کریں؛ مطابقت پر رابطے کا بٹن فعال ہوتا ہے۔ پتہ بدلنے پر شناخت دوبارہ چیک کریں۔ فرق یا بدلا ہوا سرٹیفکیٹ آئی ٹی سے حل کرائیں، بار بار قبول نہ کریں۔",
    ],
  ),
  "login.credentials": g(
    ["login"],
    ["Username, Password and Sign in →", "صارف نام، پاس ورڈ اور سائن اِن"],
    [
      "Use your own hospital account: enter Username and Password, then Sign in once. The button waits during submission, a lockout countdown or loss of connection. On refusal the password is cleared; check the message before deliberately trying again. Success opens your workspace or the workspace picker. If the reply is lost, Sign-in could not be confirmed explains that a session may exist. No automatic retry is made. Check connection before a deliberate new sign-in; an unused session expires on the server. Navigation waits while sign-in is pending. ACCOUNT_LOCKED or RATE_LIMITED keeps the server message and countdown visible; waiting never submits another login.",
      "اپنا ہسپتال اکاؤنٹ استعمال کریں: صارف نام اور پاس ورڈ درج کرکے ایک بار سائن اِن کریں۔ ارسال، عارضی پابندی یا رابطہ نہ ہونے پر بٹن رکتا ہے۔ انکار پر پاس ورڈ صاف ہوتا ہے؛ دوبارہ کوشش سے پہلے پیغام دیکھیں۔ کامیابی پر کام کی جگہ یا انتخاب کھلتا ہے۔ جواب گم ہو تو سائن اِن کی تصدیق نہیں ہو سکی بتاتا ہے کہ سیشن کھل سکتا ہے۔ خودکار کوشش نہیں ہوتی۔ رابطہ دیکھ کر ضرورت پر خود سائن اِن کریں؛ غیر استعمال شدہ سیشن سرور پر ختم ہوتا ہے۔ جاری سائن اِن کے دوران نقل و حرکت رکی رہتی ہے۔ اکاؤنٹ کی پابندی یا درخواستوں کی حد پر سرور کا پیغام اور گنتی دیکھیں؛ انتظار سے نیا لاگ اِن نہیں بھیجا جاتا۔",
    ],
  ),
  "login.password": g(
    ["login", "settings"],
    [
      "Current password, New password, Confirm new password, Change password",
      "موجودہ پاس ورڈ، نیا پاس ورڈ، تصدیق اور پاس ورڈ بدلیں",
    ],
    [
      "For a temporary password, complete this screen before other work; otherwise open Settings → Password. Enter the current password, a new password of 8–256 characters and the same new password again. Change password submits once. A mismatch is refused locally; the server also enforces hospital policy. Fields clear after a submitted attempt; use the shown error before retrying. Do not share the new password. On a DEV server shared demo accounts are protected (DEMO_ACCOUNT_PROTECTED); use your own provisioned test account for password, role or deactivation testing.",
      "عارضی پاس ورڈ ہو تو دوسرے کام سے پہلے یہ صفحہ مکمل کریں؛ ورنہ ترتیبات ← پاس ورڈ کھولیں۔ موجودہ پاس ورڈ، ۸ تا ۲۵۶ حروف کا نیا پاس ورڈ اور اسی کی تصدیق درج کریں۔ پاس ورڈ بدلیں ایک بار بھیجتا ہے۔ عدم مطابقت مقامی طور پر رکتی ہے؛ سرور ہسپتال کی پالیسی بھی لاگو کرتا ہے۔ ارسال کی کوشش کے بعد خانے صاف ہوتے ہیں؛ خطا دیکھ کر دوبارہ کوشش کریں۔ نیا پاس ورڈ کسی کو نہ دیں۔ ڈیو سرور پر مشترکہ ڈیمو اکاؤنٹ محفوظ ہے؛ پاس ورڈ، کردار یا غیر فعالیت کی جانچ اپنے الگ بنائے گئے اکاؤنٹ پر کریں۔",
    ],
  ),
  "settings.sections": g(
    ["settings"],
    ["Settings sections", "ترتیبات کے حصے"],
    [
      "Choose a section in the Settings sidebar. This terminal shows connection and printer/location facts; My settings changes your account; Facility is offered only with permission. System (IT) opens its actual users/access, hardware, health, maintenance or emergency panel. Changing section warns before discarding a draft and blocks navigation while a write, uncertain outcome or once-only credential is open. Selecting a section does not itself save anything.",
      "ترتیبات کی فہرست سے حصہ منتخب کریں۔ یہ ٹرمینل رابطے، پرنٹر اور مقام کی معلومات؛ میری ترتیبات اکاؤنٹ؛ ہسپتال اجازت سے دکھتا ہے۔ نظام (آئی ٹی) اصل صارف، رسائی، آلات، صحت، دیکھ بھال یا ہنگامی حصہ کھولتا ہے۔ حصہ بدلنے سے پہلے مسودے کی تنبیہ ہے؛ جاری ارسال، غیر یقینی نتیجہ یا ایک بار کے کوائف پر نقل و حرکت رکی ہے۔ صرف حصہ چننے سے کچھ محفوظ نہیں ہوتا۔",
    ],
  ),
  "settings.display": g(
    ["settings"],
    ["Language and Theme", "زبان اور تھیم"],
    [
      "Choose English or Urdu, or Light or Dark · high contrast. Each selection saves immediately; wait for it to finish. Before login this changes only the terminal display. After login it saves to your account and all this session's windows update. Reload preferences reads the account through the same ordered queue; it never repeats a save, sign-in or password change. Login and restored sessions also read account preferences. A failed save/read shows an error and must not be assumed applied. Urdu wording remains a draft awaiting language review.",
      "انگریزی یا اردو، یا روشن یا گہرا زیادہ تضاد والا تھیم منتخب کریں۔ ہر انتخاب فوراً محفوظ ہوتا ہے؛ مکمل ہونے دیں۔ لاگ اِن سے پہلے صرف ٹرمینل بدلتا ہے۔ بعد میں اکاؤنٹ میں محفوظ اور تمام ونڈوز میں ظاہر ہوتا ہے۔ ترجیحات دوبارہ لوڈ اسی قطار سے اکاؤنٹ پڑھتا ہے، محفوظ کرنا، سائن اِن یا پاس ورڈ نہیں دہراتا۔ سائن اِن اور بحالی پر بھی اکاؤنٹ کی ترجیحات پڑھی جاتی ہیں۔ ناکامی کو کامیابی نہ سمجھیں۔ اردو متن لسانی جائزے تک مسودہ ہے۔",
    ],
  ),
  "settings.zoom": g(
    ["settings"],
    [
      "Display size, Ctrl/Cmd + / − / 0, Reset to 100%",
      "نمائش کا سائز، Ctrl/Cmd + / − / 0، سو فیصد پر واپسی",
    ],
    [
      "Move Display size between 100 and 250 percent. Ctrl/Cmd+plus or equals increases by 10, minus decreases by 10, and zero or Reset to 100% resets. Shortcuts and slider share one saved setting across windows. Rapid key presses are saved in order. At a bound further presses stay at that bound. A connection failure shows an error; retry deliberately after recovery.",
      "نمائش کا سائز ۱۰۰ تا ۲۵۰ فیصد رکھیں۔ Ctrl/Cmd کے ساتھ جمع یا مساوی سے ۱۰ بڑھتا، منفی سے ۱۰ گھٹتا، صفر یا سو فیصد پر واپسی سے معمول ہوتا ہے۔ کلیدیں اور سلائیڈر تمام ونڈوز میں ایک محفوظ ترتیب ہیں۔ تیز کلیدیں ترتیب سے محفوظ ہوتی ہیں۔ حد پر مزید دبانے سے وہیں رہتا ہے۔ رابطے کی خطا پر بحالی کے بعد جان بوجھ کر دوبارہ کوشش کریں۔",
    ],
  ),
  "settings.downloads": g(
    ["settings"],
    ["Download a set of documents", "دستاویزات کے مجموعے کی ڈاؤن لوڈ ترتیب"],
    [
      "Choose Separate PDFs for one file per document or One combined PDF for one merged document. The preference saves immediately to your account and controls supported document sets. It does not download anything now and never requests a ZIP.",
      "ہر دستاویز کی الگ فائل کے لیے الگ پی ڈی ایف، یا ایک مشترک دستاویز کے لیے مشترک پی ڈی ایف منتخب کریں۔ انتخاب فوراً اکاؤنٹ میں محفوظ اور متعلقہ دستاویز مجموعوں پر لاگو ہوتا ہے۔ اس وقت کچھ ڈاؤن لوڈ نہیں ہوتا اور زپ نہیں بنتی۔",
    ],
  ),
  "settings.diagnostics": g(
    ["settings"],
    ["Test connection / This terminal", "رابطہ آزمائیں / یہ ٹرمینل"],
    [
      "Test connection refreshes health, server addresses, certificate and licence information. This terminal shows the server's location and mapped printers for this machine. These views do not edit mappings or repair the server. Give IT the visible error reference when a check fails.",
      "رابطہ آزمائیں سے صحت، سرور کے پتے، سرٹیفکیٹ اور لائسنس کی معلومات تازہ ہوتی ہیں۔ یہ ٹرمینل اس مشین کا مقام اور مقررہ پرنٹر دکھاتا ہے۔ ان سے نقشہ بندی یا سرور درست نہیں ہوتا۔ جانچ ناکام ہو تو نظر آنے والا خطا حوالہ آئی ٹی کو دیں۔",
    ],
  ),
  ...(typeof __BUILD_IS_DEV__ === "undefined" || __BUILD_IS_DEV__ ? {
    "settings.review-code": g(
      ["settings"],
      ["Review code (DEV only)", "جائزے کا کوڈ (صرف ڈیَو)"],
      [
        "The human tester opens Settings → This terminal before or after login, starts a review on the portal and types its code here. Apply review code activates it for all API requests across roles and windows. It starts empty and stays in memory until the app closes. When the review ends, empty the field and Apply review code to stop sending it. This is separate from account preferences and never authenticates you. Agents and automated tests must never enter a code. The hospital release build omits this field and the three DEV attribution/review headers.",
        "انسانی جائزہ لینے والا سائن اِن سے پہلے یا بعد ترتیبات ← یہ ٹرمینل کھولتا، پورٹل پر جائزہ شروع کرتا اور یہاں اس کا کوڈ درج کرتا ہے۔ کوڈ لاگو کرنے سے تمام کرداروں اور ونڈوز کی درخواستوں پر وہ فعال ہوتا ہے۔ ابتدا میں خالی ہے اور ایپ بند ہونے تک صرف یادداشت میں رہتا ہے۔ جائزہ ختم ہو تو خانہ خالی کرکے کوڈ لاگو کریں تاکہ بھیجنا بند ہو۔ یہ ذاتی ترتیبات سے الگ ہے اور سائن اِن نہیں کرتا۔ ایجنٹ اور خودکار ٹیسٹ کبھی کوڈ درج نہ کریں۔ ہسپتال کی ریلیز میں یہ خانہ اور تین ڈیَو ہیڈر شامل نہیں ہوتے۔",
      ],
    ),
  } : {}),
  "settings.policy": g(
    ["settings"],
    [
      "Policy row, New value, Reason, Cancel and Save policy",
      "پالیسی کی سطر، نئی قدر، وجہ، منسوخ اور محفوظ",
    ],
    [
      "With policy permission open Hospital policy and select a setting. Read its description, keep the current value format (quoted text, number, true/false or list), and enter New value. Control settings also require a Reason of 3–500 characters. Save policy changes ordinary settings directly; a control change may wait for an Owner. Check the returned status and Recent change requests. Cancel discards this editor without saving. A refusal leaves your draft for correction; do not change hospital policy merely to bypass another workflow.",
      "پالیسی کی اجازت ہو تو ہسپتال کی پالیسی کھول کر ترتیب منتخب کریں۔ وضاحت پڑھیں، موجودہ قدر کی قسم برقرار رکھیں (اقتباس والا متن، عدد، درست/غلط یا فہرست) اور نئی قدر لکھیں۔ کنٹرول ترتیب کے لیے ۳ تا ۵۰۰ حروف کی وجہ بھی لازم ہے۔ محفوظ کریں عام ترتیب فوراً بدلتا ہے؛ کنٹرول تبدیلی مالک کی منتظر رہ سکتی ہے۔ واپس آنے والی حالت اور حالیہ درخواستیں دیکھیں۔ منسوخ سے بغیر محفوظ کیے مدیر بند ہوتا ہے۔ انکار پر مسودہ درست کریں؛ کسی دوسرے کام کی روک ہٹانے کے لیے پالیسی نہ بدلیں۔",
    ],
  ),
  "settings.requests": g(
    ["settings"],
    ["Recent change requests", "حالیہ تبدیلی کی درخواستیں"],
    [
      "Expand a request's heading to read its status and recorded values. This is read-only history. Pending means an authorized Owner must decide; check the approval queue or contact that approver. Expanding or closing a row does not approve or withdraw it.",
      "درخواست کی سرخی کھول کر حالت اور درج قدریں پڑھیں۔ یہ صرف پڑھنے کی تاریخ ہے۔ منتظر کا مطلب مجاز مالک کا فیصلہ درکار ہے؛ منظوری کی قطار دیکھیں یا اس فرد سے رابطہ کریں۔ سطر کھولنے یا بند کرنے سے منظوری یا واپسی نہیں ہوتی۔",
    ],
  ),
  "notifications.filter": g(
    ["notifications"],
    ["Unread only / Load older notifications", "صرف غیر پڑھی / پرانی اطلاعات"],
    [
      "Unread only filters your inbox without changing any read status. Load older notifications appends earlier records when available; an empty inbox is normal. New server events refresh the inbox and unread badge. A filter or an older-page request does not save clinical or financial work.",
      "صرف غیر پڑھی آپ کی فہرست چھانٹتا ہے، پڑھے جانے کی حالت نہیں بدلتا۔ پرانی اطلاعات سے دستیاب پرانے اندراج شامل ہوتے ہیں؛ خالی فہرست معمول ہے۔ نئی اطلاعات پر فہرست اور عدد تازہ ہوتے ہیں۔ فلٹر یا پرانے صفحے سے طبی یا مالی کام محفوظ نہیں ہوتا۔",
    ],
  ),
  "notifications.read": g(
    ["notifications"],
    [
      "Mark as read / Mark all as read",
      "پڑھی ہوئی نشان لگائیں / سب کو پڑھا ہوا کریں",
    ],
    [
      "Read the item first, then mark that item or the whole inbox as read. Mark all as read opens a confirmation explaining that it includes every current notification, even older and filtered-out items. Go back changes nothing; Confirm mark all as read submits once. Buttons wait while saving; navigation waits for the write. The unread badge is reread from the server after confirmation. This acknowledges reading only: it does not decide an approval, deliver treatment or resolve an alert. Already read items have no single-item action.",
      "پہلے اطلاع پڑھیں، پھر ایک یا پوری فہرست کو پڑھا ہوا کریں۔ سب کو پڑھا ہوا کرنے پر تصدیق بتاتی ہے کہ پرانی اور فلٹر سے باہر تمام موجودہ اطلاعات بھی شامل ہیں۔ واپس پر کچھ نہیں بدلتا؛ تصدیق ایک بار بھیجتی ہے۔ محفوظ کرنے تک بٹن اور نقل و حرکت رکتے ہیں۔ پھر سرور سے اصل غیر پڑھا عدد پڑھا جاتا ہے۔ یہ صرف پڑھنے کی تصدیق ہے؛ منظوری، علاج یا ہنگامی حل نہیں۔ پہلے پڑھی اطلاع میں انفرادی بٹن نہیں ہوتا۔",
    ],
  ),
  "notifications.open": g(
    ["notifications"],
    ["Open related item", "متعلقہ اندراج کھولیں"],
    [
      "Use Open related item when the notification supplies a link. Verify the record and patient on the destination before acting. An unavailable screen is reported visibly; the notice is not proof that the underlying action completed. Opening a link does not mark it as approved.",
      "اطلاع میں ربط ہو تو متعلقہ اندراج کھولیں۔ کوئی عمل کرنے سے پہلے پہنچنے والے صفحے پر ریکارڈ اور مریض چیک کریں۔ غیر دستیاب صفحہ واضح بتایا جاتا ہے؛ اطلاع کسی عمل کی تکمیل کا ثبوت نہیں۔ ربط کھولنا منظوری نہیں ہے۔",
    ],
  ),
  "approval.filter": g(
    approvalScreens,
    ["My requests / Approval status", "میری درخواستیں / منظوری کی حالت"],
    [
      "My requests shows requests you raised; clear it to see those you may decide. Select Pending, Approved, Rejected or Cancelled to inspect that status. Charity approvals narrows the list to pharmacy charity overrides. Filters only change the view and may legitimately return no records.",
      "میری درخواستیں آپ کی بھیجی درخواستیں دکھاتا ہے؛ نشان ہٹا کر قابل فیصلہ درخواستیں دیکھیں۔ منتظر، منظور، نامنظور یا واپس شدہ حالت چنیں۔ فلاحی منظوری میں صرف فارمیسی کی فلاحی استثنا درخواستیں ہیں۔ فلٹر صرف منظر بدلتا ہے اور خالی نتیجہ درست ہو سکتا ہے۔",
    ],
  ),
  "approval.review": g(
    approvalScreens,
    ["Request row / Decision note", "درخواست کی سطر / فیصلے کا نوٹ"],
    [
      "Open a request and verify its number, requester, frozen facts, amount and consequences. Decision note records your reason (maximum 1000 characters); rejection and withdrawal require it. Eligible solo self-decisions also require a note. Editing the note does not save a decision. Opening another request discards the note only after your confirmation.",
      "درخواست کھول کر نمبر، بھیجنے والے، مقفل حقائق، رقم اور اثرات دیکھیں۔ فیصلے کا نوٹ وجہ درج کرتا ہے (زیادہ سے زیادہ ۱۰۰۰ حروف)؛ انکار اور واپسی میں لازم ہے۔ مجاز اکیلے اپنے فیصلے کے لیے بھی نوٹ لازم ہے۔ نوٹ لکھنے سے فیصلہ محفوظ نہیں ہوتا۔ دوسری درخواست کھولنے سے پہلے نوٹ چھوڑنے کی تصدیق ہوتی ہے۔",
    ],
  ),
  "approval.decide": g(
    approvalScreens,
    [
      "Approve, Reject, Cancel request, Go back, Confirm",
      "منظور، نامنظور، درخواست واپس، واپس جائیں، تصدیق",
    ],
    [
      "The server's current eligibility determines available buttons. Approve applies the proposed effect; Reject refuses it; Cancel request withdraws your own pending request. Each first opens a confirmation. Go back keeps the request undecided. Confirm rechecks eligibility and submits once; read Decision recorded and the returned effect. Pending work is unfrozen by the server's decision. If another person decided first, review the refreshed status instead of issuing a new request. Ordinary self-approval and approving your own large cash drop remain forbidden where the server says so.",
      "سرور کی موجودہ اہلیت بٹن طے کرتی ہے۔ منظور سے تجویز کا اثر لاگو، نامنظور سے انکار، درخواست واپس سے اپنی منتظر درخواست واپس ہوتی ہے۔ پہلے تصدیق کھلتی ہے۔ واپس جائیں سے فیصلہ نہیں ہوتا۔ تصدیق اہلیت دوبارہ دیکھ کر ایک بار بھیجتی ہے؛ درج فیصلہ اور واپس آیا اثر پڑھیں۔ سرور کے فیصلے سے منتظر کام کھلتا ہے۔ پہلے کسی اور نے فیصلہ کیا ہو تو تازہ حالت دیکھیں، نئی درخواست نہ بنائیں۔ عام خود منظوری اور اپنا بڑا کیش ڈراپ منظور کرنا جہاں سرور منع کرے ممنوع رہتا ہے۔",
    ],
  ),
  "incident.lookup": g(
    ["report_incident"],
    [
      "Affected patient, medicine, operation or death lookup",
      "متاثرہ مریض، دوا، آپریشن یا وفات کی تلاش",
    ],
    [
      "When the incident type or affected person needs a linked record, use its labelled search and Find button, then select the matching result after checking identifiers. A search needs at least two characters where a query is offered. A lookup without a query lists available records. A missing or forbidden result is an error to resolve with the responsible team, not a reason to type a database ID. Changing type or affected person clears incompatible selections.",
      "واقعے کی قسم یا متاثرہ فرد کے لیے ریکارڈ درکار ہو تو متعلقہ تلاش اور تلاش کریں استعمال کرکے شناخت دیکھ کر نتیجہ چنیں۔ جہاں متن مانگا جائے کم از کم دو حروف دیں۔ بغیر متن کی تلاش دستیاب ریکارڈ دیتی ہے۔ غائب یا ممنوع نتیجہ متعلقہ ٹیم سے حل کرائیں، خود ڈیٹابیس نمبر نہ لکھیں۔ قسم یا فرد بدلنے سے ناموافق انتخاب صاف ہوتے ہیں۔",
    ],
  ),
  "incident.staff": g(
    ["report_incident", "consultation"],
    [
      "Staff member / Find staff member / Select staff member",
      "عملے کا فرد / تلاش کریں / فرد منتخب کریں",
    ],
    [
      "For affected staff or the procedure assistant, type 2–80 characters of a name or badge number, select Find staff member (or Enter), then choose the verified staff result. Only badge facts are shown; HR access is not required. Editing the search clears the selected person; select again before submitting. Do not assume the first result is the intended person.",
      "متاثرہ فرد عملے سے ہو تو نام یا بیج نمبر کے ۲ تا ۸۰ حروف لکھیں، تلاش کریں یا Enter دبائیں، پھر تصدیق شدہ فرد چنیں۔ صرف بیج کی معلومات دکھتی ہیں؛ ایچ آر کی اجازت درکار نہیں۔ تلاش بدلنے سے منتخب فرد صاف ہوتا ہے؛ ارسال سے پہلے دوبارہ چنیں۔ پہلا نتیجہ خودبخود درست نہ سمجھیں۔",
    ],
  ),
  "incident.classify": g(
    ["report_incident"],
    [
      "Incident type, Incident or near miss, Harm, Affected and event details",
      "واقعے کی قسم، واقعہ یا قریب الوقوع، نقصان، متاثرہ اور تفصیل",
    ],
    [
      "Choose an active Incident type grouped by area; Sentinel marks a type needing special review. Select Incident or near miss, Harm and Affected to describe what actually occurred. Medication errors need the medicine and medication stage; theatre events need the operation and phase. These selections build a draft, not a report. If the type became inactive, refresh and choose the appropriate active type without changing the facts.",
      "شعبے کے تحت فعال قسم چنیں؛ سینٹینل خصوصی جائزے والی قسم ہے۔ اصل حقائق کے مطابق واقعہ یا قریب الوقوع، نقصان اور متاثرہ فرد چنیں۔ دوا کی غلطی میں دوا اور مرحلہ؛ تھیٹر میں آپریشن اور مرحلہ لازم ہیں۔ انتخاب مسودہ ہے، رپورٹ نہیں۔ قسم غیر فعال ہو تو تازہ کرکے مناسب فعال قسم چنیں مگر حقائق نہ بدلیں۔",
    ],
  ),
  "incident.whenwhere": g(
    ["report_incident"],
    ["When, Department and Location", "وقت، شعبہ اور مقام"],
    [
      "Check When against the event's actual date and time in the hospital timezone shown beside the field. The terminal converts it to UTC for saving; workstation timezone settings do not change its meaning. Choose the Department if known and enter a Location up to 300 characters, such as the ward or bed. These fields are draft information until Submit incident report. Confirm the terminal clock with IT if the displayed time is wrong.",
      "خانے کے ساتھ دکھائے ہسپتال کے ٹائم زون میں واقعے کا اصل وقت اور تاریخ دیں۔ محفوظ کرتے وقت یہ یو ٹی سی بنتا ہے؛ ٹرمینل کا مقامی ٹائم زون اس کا مطلب نہیں بدلتا۔ معلوم ہو تو شعبہ چنیں اور مقام میں وارڈ یا بیڈ جیسے زیادہ سے زیادہ ۳۰۰ حروف لکھیں۔ رپورٹ بھیجنے تک یہ مسودہ ہے۔ وقت غلط ہو تو آئی ٹی سے ٹرمینل کی گھڑی چیک کرائیں۔",
    ],
  ),
  "incident.narrative": g(
    ["report_incident"],
    [
      "What happened, Immediate action, Keep my name confidential",
      "کیا ہوا، فوری اقدام، میرا نام خفیہ رکھیں",
    ],
    [
      "Write factual What happened (10–8000 characters) and Immediate action (3–4000 characters), avoiding blame. Keep my name confidential requests the server's confidentiality treatment; it is not an anonymous report. Do not omit essential care facts or copy real patient information into DEV practice.",
      "الزام کے بغیر حقائق لکھیں: کیا ہوا میں ۱۰ تا ۸۰۰۰ اور فوری اقدام میں ۳ تا ۴۰۰۰ حروف۔ میرا نام خفیہ رکھیں سرور کی رازداری مانگتا ہے؛ رپورٹ بے نام نہیں ہوتی۔ ضروری نگہداشت کے حقائق نہ چھوڑیں اور مشق میں حقیقی مریض کی معلومات نہ ڈالیں۔",
    ],
  ),
  "incident.submit": g(
    ["report_incident"],
    ["Submit incident report / My reports", "رپورٹ بھیجیں / میری رپورٹیں"],
    [
      "Review the draft and selected person, then Submit incident report once. Wait for the incident number and The Quality Officer will review it before assuming success. A refusal keeps the draft; correct the specified field. A lost reply may have saved the report: check My reports and retry the same unchanged action, not a second report. Open a My reports row to read the saved report and review state; this form cannot edit or delete a submitted report.",
      "مسودہ اور فرد چیک کرکے ایک بار رپورٹ بھیجیں۔ کامیابی سمجھنے سے پہلے واقعے کا نمبر اور کوالٹی آفیسر کے جائزے کا پیغام دیکھیں۔ انکار پر مسودہ رہتا ہے؛ بتایا خانہ درست کریں۔ جواب گم ہو تو رپورٹ محفوظ ہو سکتی ہے: میری رپورٹیں دیکھیں اور وہی غیر تبدیل شدہ عمل دہرائیں، دوسری رپورٹ نہ بنائیں۔ سطر کھول کر محفوظ رپورٹ اور حالت پڑھیں؛ یہاں ارسال شدہ رپورٹ ترمیم یا حذف نہیں ہوتی۔",
    ],
  ),
  "incident.reference": g(
    ["report_incident"],
    [
      "What to report · PDF / Link a death record",
      "کیا رپورٹ کریں · پی ڈی ایف / وفات کا ریکارڈ",
    ],
    [
      "What to report downloads the hospital's sentinel-event guidance PDF; cancelling the save dialog changes no report. Link a death record expands an optional lookup for a relevant existing record. Do not delay the hospital's immediate safety response while completing this form or reading the PDF.",
      "کیا رپورٹ کریں ہسپتال کی سینٹینل رہنمائی پی ڈی ایف حاصل کرتا ہے؛ محفوظ کا مکالمہ منسوخ کرنے سے رپورٹ نہیں بدلتی۔ وفات کا ریکارڈ متعلقہ موجودہ ریکارڈ کی اختیاری تلاش کھولتا ہے۔ فارم یا پی ڈی ایف مکمل کرنے کے انتظار میں فوری حفاظتی ردعمل مؤخر نہ کریں۔",
    ],
  ),
  "facility.tabs": g(
    ["facility_profile"],
    [
      "Profile & services / Staff & duties / History",
      "پروفائل اور خدمات / عملہ اور ذمہ داریاں / تاریخ",
    ],
    [
      "Profile & services shows the current profile and editable proposed changes. Staff & duties shows server-assigned holders, gaps and any solo alternative; it does not assign staff. History shows applied service/profile changes and recorded categories. Switching these tabs retains the current draft; leaving the screen asks before discarding it. Expand history headings or Ward count and licence review to read supporting facts.",
      "پروفائل اور خدمات موجودہ پروفائل اور مجوزہ تبدیلیاں دکھاتا ہے۔ عملہ اور ذمہ داریاں سرور کے مقررہ افراد، کمی اور اکیلے متبادل دکھاتا ہے؛ تعیناتی نہیں کرتا۔ تاریخ لاگو تبدیلیاں اور درج زمرے دکھاتی ہے۔ ٹیب بدلنے سے مسودہ رہتا ہے؛ صفحہ چھوڑنے پر تصدیق آتی ہے۔ تاریخ یا وارڈ اور لائسنس کا جائزہ کھول کر متعلقہ حقائق پڑھیں۔",
    ],
  ),
  "facility.profile": g(
    ["facility_profile"],
    [
      "Record or change profile / Keep current profile and licence fields",
      "پروفائل درج یا تبدیل / موجودہ برقرار اور لائسنس کے خانے",
    ],
    [
      "With establishment permission, choose Record or change profile. Select the PHC category on the actual licence; enter PHC registration / licence number (up to 60 characters), Effective date and Licensed beds (0–5000 or blank if unknown). Select an existing Licence document if available. If category differs from the bed suggestion, enter the stated reason (up to 1000 characters). Category selection proposes service presets: review each one. Keep current profile removes the proposed profile edit; proposed service changes remain for review. Nothing applies until preview and Apply reviewed change.",
      "ہسپتال کی اجازت سے پروفائل درج یا تبدیل کھولیں۔ اصل لائسنس کا پی ایچ سی زمرہ چنیں؛ رجسٹریشن/لائسنس نمبر (۶۰ حروف تک)، مؤثر تاریخ اور منظور شدہ بیڈ (۰ تا ۵۰۰۰؛ نامعلوم ہو تو خالی) دیں۔ دستیاب ہو تو موجودہ لائسنس دستاویز چنیں۔ بیڈ کی تجویز سے مختلف زمرے کی وجہ (۱۰۰۰ حروف تک) لکھیں۔ زمرہ منتخب کرنے سے خدمات کی تجاویز بنتی ہیں؛ ہر ایک دیکھیں۔ موجودہ پروفائل برقرار سے پروفائل کی ترمیم ہٹتی ہے؛ مجوزہ خدمات باقی رہتی ہیں۔ پیش منظر اور لاگو کرنے تک کچھ نافذ نہیں ہوتا۔",
    ],
  ),
  "facility.services": g(
    ["facility_profile"],
    ["Proposed state / Reason for change", "مجوزہ حالت / تبدیلی کی وجہ"],
    [
      "For an implemented service choose Proposed state; returning to its current state removes that proposal. Read dependencies and outstanding work on every card. Retiring finishes existing work; Retired keeps records. Enter a factual Reason for change of 3–1000 characters. Only the server decides which transitions the licensed profile permits; a selector is not authorization.",
      "نافذ خدمت کی مجوزہ حالت چنیں؛ موجودہ حالت دوبارہ چننے سے تجویز ہٹتی ہے۔ ہر کارڈ کی انحصار اور باقی کام کی معلومات پڑھیں۔ بندش کے مرحلے میں موجودہ کام مکمل، بند خدمت میں ریکارڈ باقی رہتا ہے۔ تبدیلی کی حقیقی وجہ ۳ تا ۱۰۰۰ حروف میں لکھیں۔ صرف سرور طے کرتا ہے لائسنس کیا اجازت دیتا ہے؛ انتخاب خود اجازت نہیں۔",
    ],
  ),
  "facility.preview": g(
    ["facility_profile"],
    [
      "Preview change, acknowledgements, Apply reviewed change",
      "پیش منظر، تصدیقات، جائزہ شدہ تبدیلی لاگو",
    ],
    [
      "Preview change checks the exact draft without applying it. Read the proposed profile, moves, warnings and problems; tick every required acknowledgement only after understanding it. Apply reviewed change is disabled until the server allows it and all acknowledgements are checked. Editing the draft clears the preview; preview again. Apply once, wait for the change number/revision, then verify menus and History. A stale or refused change needs a new preview. If a reply is lost, use Check server status and history, then Retry original request when permitted; do not assume the change failed or create a new action. See the recovery instructions below.",
      "پیش منظر مسودہ جانچتا ہے مگر نافذ نہیں کرتا۔ مجوزہ پروفائل، تبدیلیاں، تنبیہ اور مسائل پڑھیں؛ سمجھنے کے بعد تمام مطلوبہ تصدیقات لگائیں۔ سرور کی اجازت اور تمام تصدیقات تک لاگو کا بٹن بند رہتا ہے۔ مسودہ بدلنے سے پیش منظر صاف ہوتا ہے؛ دوبارہ دیکھیں۔ ایک بار لاگو کرکے نمبر اور ترمیم کا انتظار کریں، پھر فہرست اور تاریخ دیکھیں۔ پرانی یا مسترد تبدیلی کا نیا پیش منظر لازم ہے۔ جواب گم ہو تو دوسری کوشش سے پہلے تاریخ اور موجودہ ترمیم دیکھیں؛ ناکامی فرض نہ کریں۔",
    ],
  ),
  "help.search": g(
    ["help_center"],
    ["Search this handbook / page list", "رہنما میں تلاش / صفحات کی فہرست"],
    [
      "Search matches only the handbook pages and foundation role guides the current account may read, in either language. Select a result to open it. A workspace guide lists the supported foundation tasks for your actual permissions, with links to screen instructions. Unimplemented later-phase tasks are explicitly outside this guide. Changing user clears the help dialog and results.",
      "تلاش صرف موجودہ اکاؤنٹ کے مجاز رہنما صفحات اور بنیادی کردار کی رہنمائی میں دونوں زبانوں سے ہوتی ہے۔ نتیجہ چن کر کھولیں۔ کام کی جگہ کا رہنما آپ کی اصل اجازت کے مطابق بنیادی کام اور صفحات کے ربط دیتا ہے۔ بعد کے غیر نافذ کام اس رہنما سے باہر ہیں۔ صارف بدلنے پر مدد اور نتائج صاف ہوتے ہیں۔",
    ],
  ),
  "help.links": g(
    ["help_center"],
    ["Related help / workspace guide links", "متعلقہ مدد / کام کی جگہ کے ربط"],
    [
      "Select a related screen or workspace guide inside Help. It changes only the help page, leaving the work underneath untouched. Links to pages outside the server's permitted outline are not offered. F1 still returns to the current work screen's page. Close restores your previous field or dialog focus.",
      "مدد میں متعلقہ صفحے یا کام کی جگہ کا ربط چنیں۔ صرف مدد کا صفحہ بدلتا ہے، نیچے کا کام نہیں۔ سرور کی مجاز فہرست سے باہر ربط نہیں ملتے۔ F1 موجودہ کام کے رہنما پر لوٹتا ہے۔ بند کرنے سے پہلے خانے یا مکالمے کا فوکس واپس آتا ہے۔",
    ],
  ),
  "help.print": g(
    ["help_center"],
    ["Print handbook page / Close", "رہنما صفحہ پرنٹ / بند کریں"],
    [
      "Print handbook page opens the terminal's print dialog for the selected help content; choose the printer or cancel without changing records. A printer error is shown and does not submit any form. Close (× or Escape) returns to the previous focus. Screenshots are synthetic DEV examples, not evidence that your own action succeeded.",
      "رہنما صفحہ پرنٹ سے منتخب مدد کے لیے ٹرمینل کا پرنٹ مکالمہ کھلتا ہے؛ پرنٹر چنیں یا ریکارڈ بدلے بغیر منسوخ کریں۔ پرنٹر کی خطا دکھتی ہے اور فارم ارسال نہیں ہوتا۔ بند کریں (× یا Escape) سے پچھلا فوکس لوٹتا ہے۔ تصاویر فرضی ڈیَو مثالیں ہیں، آپ کے کام کی کامیابی کا ثبوت نہیں۔",
    ],
  ),
};

export const foundationJourney: {
  title: Bilingual;
  steps: Bilingual[];
  recovery: Bilingual;
  glossary: Bilingual[];
} = {
  title: [
    "A day in your workspace · foundation tasks",
    "آپ کی کام کی جگہ کا دن · بنیادی کام",
  ],
  steps: [
    [
      "Start: confirm the hospital and terminal location, sign in with your own account and select the workspace for your duty. Check the connection, licence and maintenance notices before starting work.",
      "آغاز: ہسپتال اور ٹرمینل کا مقام چیک کریں، اپنے اکاؤنٹ سے لاگ اِن کرکے ڈیوٹی کی جگہ چنیں۔ کام سے پہلے رابطہ، لائسنس اور دیکھ بھال کے پیغامات دیکھیں۔",
    ],
    [
      "Prepare: open Settings to choose your language, readable display size and document preference. Open Help · F1 on an unfamiliar screen; the task index below includes only this account's supported foundation work.",
      "تیاری: ترتیبات میں زبان، پڑھنے کے قابل سائز اور دستاویز کی ترجیح چنیں۔ نئے صفحے پر مدد · F1 کھولیں؛ نیچے صرف اس اکاؤنٹ کے نافذ بنیادی کام ہیں۔",
    ],
    [
      "During duty: read Notifications and follow the related record. Report a safety incident promptly using facts and a verified affected person. If you can decide approvals, read the frozen request and its consequences before confirming; a requester follows My requests instead.",
      "ڈیوٹی میں: اطلاعات پڑھ کر متعلقہ ریکارڈ دیکھیں۔ حفاظتی واقعہ جلد حقائق اور تصدیق شدہ فرد کے ساتھ رپورٹ کریں۔ منظوری کی اجازت ہو تو تصدیق سے پہلے مقفل درخواست اور اثرات پڑھیں؛ بھیجنے والا اپنی درخواستیں دیکھتا ہے۔",
    ],
    [
      "Hand over: tell the responsible approver about pending work; a notification or read marker does not replace the decision. Re-open the record to see the confirmed outcome. Establishment managers preview and apply profile/service changes, then check other windows and recorded history.",
      "حوالگی: منتظر کام متعلقہ منظوری دینے والے کو بتائیں؛ اطلاع یا پڑھنے کا نشان فیصلے کا متبادل نہیں۔ ریکارڈ دوبارہ کھول کر مصدقہ نتیجہ دیکھیں۔ ہسپتال منتظم پروفائل/خدمت کا پیش منظر لاگو کرکے دوسری ونڈوز اور تاریخ چیک کرتے ہیں۔",
    ],
    [
      "Finish: resolve or explicitly hand over pending tasks, save or discard drafts, and Sign out. Financial shift closing and clinical work belong to their own screen guides; the foundation guide does not claim those later-phase journeys are complete.",
      "اختتام: منتظر کام مکمل یا واضح حوالے کریں، مسودہ محفوظ یا ترک کرکے سائن آؤٹ کریں۔ مالی شفٹ اور طبی کام اپنے صفحات کی رہنمائی میں ہیں؛ بنیادی رہنما بعد کے مراحل کی تکمیل کا دعویٰ نہیں کرتا۔",
    ],
  ],
  recovery: [
    "On an outage keep the window open and follow the hospital's approved downtime procedure. A lost reply may have committed a write: inspect the saved record before retrying the unchanged action. On a stale version reread and review instead of overwriting. Give IT or the responsible supervisor the visible error/reference; do not invent a replacement ID or claim success.",
    "رابطہ منقطع ہو تو ونڈو کھلی رکھیں اور ہسپتال کے منظور شدہ متبادل طریقے پر عمل کریں۔ جواب گم ہونے پر عمل محفوظ ہو سکتا ہے: وہی عمل دہرانے سے پہلے ریکارڈ دیکھیں۔ پرانا نسخہ ہو تو دوبارہ پڑھ کر جائزہ لیں، اندھا لکھنا نہیں۔ نظر آنے والی خطا/حوالہ آئی ٹی یا نگران کو دیں؛ متبادل نمبر یا کامیابی نہ گھڑیں۔",
  ],
  glossary: [
    [
      "Workspace: the task area offered for your permissions and active hospital services.",
      "کام کی جگہ: آپ کی اجازت اور فعال خدمات کے مطابق کام کا حصہ۔",
    ],
    [
      "Pending approval: a request awaiting an authorized decision; its proposed effect has not yet been approved.",
      "منتظر منظوری: مجاز فیصلے کی منتظر درخواست؛ مجوزہ اثر ابھی منظور نہیں ہوا۔",
    ],
    [
      "Revision: the server's version of the establishment configuration; a newer one requires another review.",
      "ترمیم: ہسپتال کی ترتیب کا سرور نسخہ؛ نیا نسخہ دوبارہ جائزہ مانگتا ہے۔",
    ],
    [
      "Idempotent retry: retrying the same action with its original identity, so an uncertain reply must not create a second record.",
      "محفوظ دوبارہ کوشش: اصل شناخت کے ساتھ وہی عمل دہرانا، تاکہ غیر یقینی جواب سے دوسرا ریکارڈ نہ بنے۔",
    ],
  ],
};

export const workspaceFocus: Record<string, Bilingual> = {
  reception: [
    "Receptionists: check counter/printer and your own cash shift, find/register the patient, then follow the actual doctor/department queue. Verify slip/MRN before deferral, reactivation or an unpaid cancellation. Refund/waiver/credit requests lock the visit until an eligible approver decides; credit can collect its stated amount immediately. Cash-back is a separate exact physical handover from your own drawer, confirmed only after cash is given. Follow each screen's guide, original-key recovery and Status history/My requests. Human fresh-data, detailed role journey and Urdu approval remain pending.",
    "استقبالیہ: کاؤنٹر، پرنٹر اور اپنی کیش شفٹ چیک، مریض تلاش یا درج، پھر اصل ڈاکٹر یا شعبے کی قطار دیکھیں۔ مؤخر، بحال یا غیر ادا منسوخی سے پہلے پرچی اور ایم آر این چیک کریں۔ واپسی، رعایت اور ادھار منظوری تک وزٹ بند کرتے؛ ادھار میں لکھی رقم فوراً وصول ہو سکتی ہے۔ نقد واپسی اپنی دراز سے عین الگ عمل ہے، اصل رقم دینے کے بعد تصدیق۔ ہر صفحے کی مدد، اصل کلید اور تاریخ یا اپنی درخواستیں دیکھیں۔ تازہ انسانی، کردار اور اردو جائزہ باقی ہیں۔",
  ],
  doctor: [
    "Doctors, clinical specialists and surgeons: verify the hospital/workspace before your duty. Use foundation help for alerts, incident reporting, preferences and permitted approvals. Clinical documentation and prescribing are separate journeys; acknowledging a notice does not record treatment.",
    "ڈاکٹر، ماہر اور سرجن: ڈیوٹی سے پہلے ہسپتال اور جگہ چیک کریں۔ بنیاد میں اطلاعات، واقعہ، ذاتی ترتیب اور مجاز منظوری دیکھیں۔ طبی نوٹ اور نسخہ الگ کام ہیں؛ اطلاع کی تصدیق علاج کا اندراج نہیں۔",
  ],
  admissions: [
    "Admissions officers: confirm the admissions terminal's identity and printer mapping. Report safety incidents against the verified affected person; pending approvals go to their eligible approver. This guide does not authorize an admission or assign a bed.",
    "داخلہ افسر: داخلے کے ٹرمینل اور پرنٹر کی شناخت چیک کریں۔ درست متاثرہ فرد کے ساتھ حفاظتی واقعہ دیں؛ منتظر درخواست مجاز فرد کو دیں۔ یہ رہنما داخلے یا بیڈ کی تعیناتی نہیں کرتا۔",
  ],
  triage: [
    "Triage nurses: follow immediate hospital response procedures before administrative incident reporting. Reading or dismissing an alert does not complete triage. Use the verified patient lookup and hand the report to Quality for review.",
    "ٹرائیج نرس: انتظامی رپورٹ سے پہلے ہسپتال کے فوری ردعمل پر عمل کریں۔ اطلاع پڑھنا یا بند کرنا ٹرائیج کی تکمیل نہیں۔ درست مریض تلاش کرکے رپورٹ کوالٹی کے جائزے کو دیں۔",
  ],
  ward_nurse: [
    "Ward nurses: confirm the ward terminal before work, read incoming notices and link an incident to the verified patient or staff member. A report is not a medication administration record; follow the separate ward workflow for clinical care.",
    "وارڈ نرس: وارڈ ٹرمینل چیک، آنے والی اطلاعات پڑھیں اور واقعے میں درست مریض یا عملہ جوڑیں۔ رپورٹ دوا دینے کا ریکارڈ نہیں؛ طبی نگہداشت کے لیے الگ وارڈ طریقہ اپنائیں۔",
  ],
  head_nurse: [
    "Head nurses: read notices for your duty area and follow pending incident/approval handovers. Decide only where the server offers eligibility, and arrange an independent decision where required. Staff & duties is read-only here and does not change a roster.",
    "ہیڈ نرس: ڈیوٹی کے شعبے کی اطلاعات اور منتظر واقعہ/منظوری کی حوالگی دیکھیں۔ سرور کی اہلیت پر ہی فیصلہ اور ضرورت پر آزاد فرد مقرر کریں۔ یہاں عملہ اور ذمہ داریاں صرف پڑھنے کے لیے ہیں، روسٹر نہیں بدلتا۔",
  ],
  pharmacy: [
    "Pharmacists: for a medication-error report verify the medicine and stage; track your charity request in My requests and await the authorized decision. A read notification does not approve charity or record dispensing.",
    "فارماسسٹ: دوا کی غلطی میں دوا اور مرحلہ چیک کریں؛ اپنی فلاحی درخواست دیکھ کر مجاز فیصلے کا انتظار کریں۔ اطلاع پڑھنے سے فلاحی منظوری یا دوا کی فراہمی درج نہیں ہوتی۔",
  ],
  pharmacy_admin: [
    "Pharmacy administrators: inspect permitted pharmacy-related approvals and notifications, and use incident reporting for safety facts. This foundation does not provide medicine-stock setup or authorize undocumented dispensing.",
    "فارمیسی ایڈمن: مجاز منظوری اور اطلاعات دیکھیں اور حفاظتی حقائق واقعے میں دیں۔ بنیاد دوا اسٹاک کی ترتیب یا غیر دستاویزی فراہمی کی اجازت نہیں دیتی۔",
  ],
  lab_tech: [
    "Lab technicians: confirm the lab terminal, read notifications and report safety incidents without blame. Opening a related item does not process a specimen or publish a result; those tasks belong to their lab screens.",
    "لیب ٹیکنیشن: لیب ٹرمینل چیک، اطلاعات پڑھیں اور الزام کے بغیر واقعہ دیں۔ متعلقہ اندراج کھولنا نمونہ پراسیس یا نتیجہ جاری نہیں کرتا؛ وہ لیب کے صفحات کے کام ہیں۔",
  ],
  lab_verifier: [
    "Lab verifiers: distinguish a notification from a verified laboratory result. Foundation approvals use the request's actual permission and are not a substitute for result verification; use the proper result screen for that handover.",
    "لیب تصدیق کرنے والے: اطلاع اور تصدیق شدہ نتیجے میں فرق رکھیں۔ بنیادی منظوری اصل درخواست کی اجازت پر ہے، لیب نتیجے کی تصدیق کا متبادل نہیں؛ اس کے لیے متعلقہ صفحہ لیں۔",
  ],
  lab_admin: [
    "Lab administrators: check terminal identity and use granted foundation settings and approvals. Catalogue and diagnostic setup are later workflows; a foundation setting must not be used to invent a missing test.",
    "لیب ایڈمن: ٹرمینل کی شناخت اور مجاز ترتیبات و منظوری دیکھیں۔ ٹیسٹ فہرست اور تشخیصی ترتیب بعد کے کام ہیں؛ غائب ٹیسٹ گھڑنے کے لیے بنیادی ترتیب نہ بدلیں۔",
  ],
  radiology: [
    "Radiographers and radiologists: use the current account's foundation notices and safety reports. Confirm affected identifiers before linking a report; acknowledgement of a notice does not publish imaging findings or complete a radiology handover.",
    "ریڈیوگرافر اور ریڈیالوجسٹ: موجودہ اکاؤنٹ کی بنیادی اطلاع اور حفاظتی رپورٹ لیں۔ ریکارڈ جوڑنے سے پہلے شناخت چیک کریں؛ اطلاع کی تصدیق سے تصویری نتیجہ یا ریڈیالوجی حوالگی مکمل نہیں ہوتی۔",
  ],
  ot_admin: [
    "OT administrators: theatre incidents require the operation and phase, selected through the permitted lookup. The incident goes to Quality; submitting it does not alter an operation schedule or settlement.",
    "او ٹی ایڈمن: تھیٹر کے واقعے میں مجاز تلاش سے آپریشن اور مرحلہ لازم ہے۔ رپورٹ کوالٹی کو جاتی ہے؛ ارسال سے آپریشن کا وقت یا حساب نہیں بدلتا۔",
  ],
  anaesthesia: [
    "Anaesthetists: follow immediate clinical response first, then record safety facts with the correct operation/phase where required. Foundation reporting does not create or sign an anaesthesia record.",
    "اینستھیزیا کے ماہر: پہلے فوری طبی ردعمل، پھر ضرورت پر درست آپریشن/مرحلے کے ساتھ حقائق دیں۔ بنیادی رپورٹ اینستھیزیا ریکارڈ بناتی یا دستخط نہیں کرتی۔",
  ],
  ot_nurse: [
    "OT nurses: verify the operation and phase for a theatre report, and keep the report number for follow-up. The foundation report is separate from the theatre checklist and does not release sterile supplies.",
    "او ٹی نرس: رپورٹ کے آپریشن اور مرحلے کی تصدیق اور نمبر محفوظ کریں۔ بنیادی رپورٹ تھیٹر چیک لسٹ سے الگ ہے اور جراثیم سے پاک سامان جاری نہیں کرتی۔",
  ],
  hr: [
    "HR administrators: foundation staff lookup shows badge facts, not a personnel file. Use permitted notifications/settings and hand over privileged-access requests to their authorized decision maker; own-role changes are forbidden.",
    "ایچ آر ایڈمن: بنیادی عملہ تلاش صرف بیج کی معلومات ہے، ذاتی فائل نہیں۔ مجاز اطلاع/ترتیب لیں اور خصوصی رسائی کی درخواست متعلقہ مجاز فرد کو دیں؛ اپنا کردار بدلنا منع ہے۔",
  ],
  finance_accountant: [
    "Accountants: review frozen approval amounts and consequences before deciding where eligible. Your own large cash drop needs an independent decider. A notification or generic approval does not record physical cash collection; use the finance workflow for that.",
    "اکاؤنٹنٹ: مجاز فیصلے سے پہلے مقفل رقم اور اثر پڑھیں۔ اپنا بڑا کیش ڈراپ آزاد فرد مانگتا ہے۔ اطلاع یا عام منظوری نقد کی عملی وصولی درج نہیں کرتی؛ متعلقہ مالی طریقہ لیں۔",
  ],
  finance_cashier: [
    "Cashiers: track your own requests and confirm the outcome before the next cash action. Never treat Pending or Mark as read as permission to pay. Shift closing and cash handover use their finance screens and independent checks.",
    "کیشیئر: اگلے نقد عمل سے پہلے اپنی درخواست اور مصدقہ نتیجہ دیکھیں۔ منتظر یا پڑھا ہوا کو ادائیگی کی اجازت نہ سمجھیں۔ شفٹ بندش اور نقد حوالگی اپنے مالی صفحات اور آزاد جانچ سے ہیں۔",
  ],
  billing_admin: [
    "Billing administrators: use granted policy/approval access and distinguish requested changes from applied ones. This foundation does not edit finalized bills or provide an alternate refund path; hand over to the responsible finance role.",
    "بلنگ ایڈمن: مجاز پالیسی/منظوری لیں اور درخواست و نافذ تبدیلی کا فرق رکھیں۔ بنیاد حتمی بل کی ترمیم یا دوسرا ریفنڈ راستہ نہیں دیتی؛ متعلقہ مالی کردار کو حوالہ دیں۔",
  ],
  owner_dashboard: [
    "Owners, Hospital Admins, Clinic Directors and Hospital Directors: preview PHC profile/service changes against the real licence before applying. Hospital Admin control-setting requests can wait for an Owner; the server decides whether an Owner's request applies immediately. Decide requests only when can-decide eligibility permits; a role label is not sufficient. Review affected menus and History after changes.",
    "مالک، ہسپتال ایڈمن اور کلینک/ہسپتال ڈائریکٹر: اصل لائسنس کے مطابق پروفائل/خدمت کا پیش منظر دیکھیں۔ ایڈمن کی کنٹرول درخواست مالک کی منتظر ہو سکتی ہے؛ مالک کی فوری تبدیلی سرور طے کرتا ہے۔ صرف سرور کی اہلیت پر فیصلہ کریں؛ کردار کا نام کافی نہیں۔ بعد میں فہرست اور تاریخ دیکھیں۔",
  ],
  inspection: [
    "PHC inspectors: inspect only the records and help pages offered to the read-only account. Have an authorized upstream colleague create fresh synthetic review records. Do not use an administrator's login to enable controls absent from your account.",
    "پی ایچ سی انسپکٹر: صرف اکاؤنٹ کے مجاز ریکارڈ اور مدد دیکھیں۔ نئے فرضی جائزہ ریکارڈ مجاز ساتھی سے بنوائیں۔ غائب بٹن لانے کو ایڈمن کا لاگ اِن نہ لیں۔",
  ],
  ops_admin: [
    "Operations administrators: verify terminal/location facts, read notifications and follow service-change handovers. Only establishment-permitted accounts can apply profile or service changes; read-only staffing facts do not assign duties.",
    "آپریشنز ایڈمن: ٹرمینل/مقام، اطلاعات اور خدمت کی حوالگی دیکھیں۔ صرف مجاز اکاؤنٹ پروفائل یا خدمت لاگو کرتا ہے؛ عملے کی صرف پڑھنے کی معلومات تعیناتی نہیں کرتیں۔",
  ],
  maintenance: [
    "Maintenance administrators: a maintenance notice is a hospital-wide operational restriction, not a repair order. Check again only rechecks it. Coordinate with authorized IT; this foundation does not expose the maintenance switch or equipment repair workflow.",
    "مینٹیننس ایڈمن: دیکھ بھال کا پیغام ہسپتال کی عملی روک ہے، مرمت کا حکم نہیں۔ دوبارہ چیک صرف حالت دیکھتا ہے۔ مجاز آئی ٹی سے رابطہ کریں؛ بنیاد مینٹیننس سوئچ یا آلات کی مرمت نہیں دیتی۔",
  ],
  super_admin: [
    "IT Super Admins: use Settings > System for the submitted HR provisioning queue, actual users and access requests, role matrix, devices and server health. Give ordinary authorized roles first and send privileged changes to the Owner; Pending is not completed access. Deliver once-only credentials privately and change temporary passwords on first sign-in. Confirm the actual target before deactivate/reset/revoke/rotate; reconcile a lost reply without repeating these effects. Coordinate maintenance/emergency logout with staff. Ward/ICD and other IT workspace journeys still need separate implementation/review. Never accept a changed certificate without independent verification.",
    "آئی ٹی سپر ایڈمن: ترتیبات > نظام میں ایچ آر کی جمع شدہ قطار، اصل صارف، رسائی کی درخواست، کردار، آلات اور سرور صحت کھولیں۔ پہلے مجاز عام کردار اور خصوصی تبدیلی مالک کو بھیجیں؛ منتظر کا مطلب مکمل رسائی نہیں۔ ایک بار کے کوائف نجی دیں اور پہلے سائن اِن پر پاس ورڈ بدلوائیں۔ غیر فعال، ری سیٹ، سیشن یا کلید سے پہلے ہدف دیکھیں؛ گم جواب پر یہی اثر دوبارہ نہ دہرائیں۔ دیکھ بھال یا ہنگامی سائن آؤٹ سے پہلے عملے سے رابطہ کریں۔ وارڈ، آئی سی ڈی اور دیگر آئی ٹی کام الگ تعمیر و جائزہ چاہتے ہیں۔ بدلا سرٹیفکیٹ آزاد تصدیق کے بغیر قبول نہ کریں۔",
  ],
  zakat: [
    "Zakat officers: open Charity approvals for pharmacy charity overrides. Check the frozen request, eligibility and note before Confirm; My requests is for requests you raised. A decision applies the server-returned effect, not a separate cash payout. Notify the requester of the confirmed outcome.",
    "زکوٰۃ افسر: فارمیسی کی فلاحی استثنا کے لیے فلاحی منظوری کھولیں۔ تصدیق سے پہلے مقفل درخواست، اہلیت اور نوٹ دیکھیں؛ اپنی درخواستیں آپ کی بھیجی ہوئی ہیں۔ فیصلہ سرور کا اثر لاگو کرتا ہے، الگ نقد ادائیگی نہیں۔ بھیجنے والے کو مصدقہ نتیجہ بتائیں۔",
  ],
  quality: [
    "Quality officers: reporters submit immutable incident facts and receive a number; read their status through the authorized register. Investigation, analysis and closure are separate Quality workflows. A reporter's confidentiality request must not be described as anonymity.",
    "کوالٹی افسر: رپورٹ کنندہ ناقابل ترمیم حقائق دے کر نمبر لیتا ہے؛ مجاز رجسٹر میں حالت دیکھیں۔ تفتیش، تجزیہ اور بندش الگ کوالٹی کام ہیں۔ نام خفیہ رکھنے کو بے نام رپورٹ نہ کہیں۔",
  ],
  infection_control: [
    "IPC nurses: report safety facts using the appropriate active incident type and verified affected person. Infection surveillance and rate calculations belong to their own screens; the foundation incident form does not replace them.",
    "انفیکشن کنٹرول نرس: مناسب فعال قسم اور درست متاثرہ فرد سے حفاظتی حقائق دیں۔ انفیکشن نگرانی اور شرح اپنے صفحات کے کام ہیں؛ بنیادی واقعہ ان کا بدل نہیں۔",
  ],
  cssd: [
    "CSSD technicians: confirm the sterile-supply terminal and read foundation notices. Acknowledgement or an incident report does not release a sterilization load or issue a pack; use the authorized CSSD workflow for those records.",
    "سی ایس ایس ڈی ٹیکنیشن: سامان کے ٹرمینل اور بنیادی اطلاع چیک کریں۔ تصدیق یا واقعے کی رپورٹ لوڈ جاری یا پیک فراہم نہیں کرتی؛ اس کے لیے مجاز سی ایس ایس ڈی طریقہ لیں۔",
  ],
  self_service: [
    "Employees: use your own preferences, permitted help and notifications, and report incidents only if the account offers that action. Foundation help does not expose another employee's private personnel data or grant administrative access.",
    "ملازم: اپنی ترتیب، مجاز مدد اور اطلاعات لیں؛ اکاؤنٹ اجازت دے تو واقعہ دیں۔ بنیادی مدد دوسرے کی نجی فائل یا انتظامی رسائی نہیں دیتی۔",
  ],
  badge_station: [
    "Badge-station operators: this staff guide does not add a kiosk login. Ask authorized setup staff about station identity or downtime, and use the separate operator job aid for badge tapping. No kiosk workflow is claimed complete by this foundation guide.",
    "بیج اسٹیشن آپریٹر: یہ رہنما کیوسک لاگ اِن نہیں بڑھاتا۔ شناخت یا بندش مجاز ترتیب کے عملے سے حل اور بیج کے لیے الگ ہدایت لیں۔ بنیادی رہنما کیوسک تکمیل کا دعویٰ نہیں کرتا۔",
  ],
};
