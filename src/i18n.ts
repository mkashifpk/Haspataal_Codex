import { registrationUr } from "./registration-i18n";
let language = "en";
export function setLanguage(value: string) {
  language = value;
}
const ur: Record<string, string> = {
  "Review recent server history": "سرور کی حالیہ تاریخ کا جائزہ لیں",
  "Cannot reach or check the hospital server. This is not a password error.":
    "ہسپتال سرور تک رسائی یا جانچ ممکن نہیں۔ یہ پاس ورڈ کی خطا نہیں۔",
  "Checking the hospital server…": "ہسپتال سرور کی جانچ جاری ہے…",
  "The server is starting or has a problem: ask IT. Its database is unavailable.":
    "سرور شروع ہو رہا ہے یا مسئلہ ہے: آئی ٹی سے رابطہ کریں۔ ڈیٹابیس دستیاب نہیں۔",
  "Hospital maintenance is in progress. Sign-in restrictions are enforced by the server.":
    "ہسپتال میں دیکھ بھال جاری ہے۔ لاگ اِن کی پابندی سرور نافذ کرتا ہے۔",
  "Hospital server ready.": "ہسپتال سرور تیار ہے۔",
  "Hospital timezone unavailable": "ہسپتال کا ٹائم زون دستیاب نہیں",
  "Hospital timezone is unavailable. Refresh before recording a time.":
    "ہسپتال کا ٹائم زون دستیاب نہیں۔ وقت درج کرنے سے پہلے تازہ کریں۔",
  "The hospital supplied an invalid timezone. Contact IT.":
    "ہسپتال نے غیر درست ٹائم زون دیا ہے۔ آئی ٹی سے رابطہ کریں۔",
  "Enter a valid hospital date and time.":
    "ہسپتال کی درست تاریخ اور وقت درج کریں۔",
  "This time does not exist in the hospital timezone. Check the date and time.":
    "یہ وقت ہسپتال کے ٹائم زون میں موجود نہیں۔ تاریخ اور وقت چیک کریں۔",
  "This time is ambiguous in the hospital timezone. Ask IT to confirm the correct occurrence before reporting.":
    "ہسپتال کے ٹائم زون میں یہ وقت دو بار آتا ہے۔ رپورٹ سے پہلے آئی ٹی سے درست وقت کی تصدیق کرائیں۔",
  "The hospital timezone changed. Reopen this form and review its time before submitting.":
    "ہسپتال کا ٹائم زون بدل گیا۔ فارم دوبارہ کھول کر ارسال سے پہلے وقت چیک کریں۔",
  "Facility change outcome needs checking":
    "ہسپتال کی تبدیلی کا نتیجہ چیک کرنا ہے",
  "The original request is retained. Do not submit a new change until its outcome is known.":
    "اصل درخواست محفوظ ہے۔ نتیجہ معلوم ہونے تک نئی تبدیلی نہ بھیجیں۔",
  "Previewed revision": "پیش منظر کی ترمیم",
  "Check server status and history": "سرور کی حالت اور تاریخ چیک کریں",
  "Current server revision": "سرور کی موجودہ ترمیم",
  "History is for review; matching text alone does not prove which request completed. Retry uses only the original request.":
    "تاریخ جائزے کے لیے ہے؛ صرف ملتا متن درخواست کی تکمیل ثابت نہیں کرتا۔ دوبارہ کوشش صرف اصل درخواست بھیجتی ہے۔",
  "Retry original request": "اصل درخواست دوبارہ بھیجیں",
  "Close reviewed attempt": "جائزہ شدہ کوشش بند کریں",
  "Only close after verifying the outcome in server history or with your administrator. This does not undo a change. Continue?":
    "سرور کی تاریخ یا ایڈمن سے نتیجہ چیک کرکے ہی بند کریں۔ اس سے تبدیلی واپس نہیں ہوتی۔ جاری رکھیں؟",
  "Attempt closed after manual review. Preview again before any new change.":
    "دستی جائزے کے بعد کوشش بند ہوئی۔ نئی تبدیلی سے پہلے پیش منظر دوبارہ دیکھیں۔",
  "The safe retry period has ended or the clock changed. Review history with your administrator; do not resend this request.":
    "محفوظ دوبارہ کوشش کی مدت ختم یا گھڑی بدل گئی ہے۔ ایڈمن کے ساتھ تاریخ دیکھیں؛ یہ درخواست دوبارہ نہ بھیجیں۔",
  "The saved Facility attempt is invalid. Ask IT to reconcile it before changing the facility.":
    "ہسپتال کی محفوظ کوشش درست نہیں۔ تبدیلی سے پہلے آئی ٹی سے نتیجہ چیک کرائیں۔",
  "Wait for the pending action to finish.": "جاری عمل مکمل ہونے دیں۔",
  "Discard unsaved input and change section?":
    "غیر محفوظ اندراج چھوڑ کر حصہ بدلیں؟",
  "Review the request and its consequences before deciding.":
    "فیصلے سے پہلے درخواست اور اس کے اثرات کا جائزہ لیں۔",
  "My requests": "میری درخواستیں",
  "Approval status": "منظوری کی حالت",
  "Decision recorded": "فیصلہ درج ہو گیا",
  No: "کوئی نہیں",
  "requests in this queue.": "درخواستیں اس قطار میں۔",
  "Requested by": "درخواست کنندہ",
  "Decision note": "فیصلے کا نوٹ",
  "A note is required when rejecting or cancelling.":
    "مسترد یا منسوخ کرنے کے لیے نوٹ لازم ہے۔",
  "Awaiting another approver.": "دوسرے منظوری کنندہ کا انتظار ہے۔",
  "You do not have permission to decide this request.":
    "آپ کو اس درخواست پر فیصلہ کرنے کی اجازت نہیں۔",
  "The server allows a solo-practice self-decision. A note is required and the decision is audited.":
    "سرور نے تنہا پریکٹس میں اپنی درخواست پر فیصلے کی اجازت دی ہے۔ نوٹ لازم ہے اور فیصلے کا آڈٹ ہوگا۔",
  "Refreshing approval eligibility…": "فیصلے کی اہلیت تازہ کی جا رہی ہے…",
  "This request changed or you can no longer decide it. Review its current state.":
    "درخواست بدل گئی ہے یا آپ اب فیصلہ نہیں کر سکتے۔ موجودہ حالت دیکھیں۔",
  "Search active staff by name or employee number.":
    "نام یا ملازم نمبر سے فعال عملہ تلاش کریں۔",
  "Select a staff member": "ملازم منتخب کریں",
  "No active staff match this search.": "اس تلاش سے کوئی فعال ملازم نہیں ملا۔",
  "Cancel request": "درخواست منسوخ کریں",
  Reject: "مسترد کریں",
  Approve: "منظور کریں",
  "This applies the decision on the hospital server.":
    "یہ فیصلہ ہسپتال کے سرور پر لاگو ہوگا۔",
  "Go back": "واپس جائیں",
  Confirm: "تصدیق کریں",
  "FIRST CONNECTION": "پہلا رابطہ",
  "Your hospital, connected.": "آپ کا ہسپتال، رابطے میں۔",
  "Find your hospital on this network, then confirm its identity with IT.":
    "نیٹ ورک پر ہسپتال تلاش کریں، پھر آئی ٹی سے شناخت کی تصدیق کریں۔",
  "Find servers on this network": "نیٹ ورک پر سرور تلاش کریں",
  "No server found. Ask IT for the server address or provisioning file.":
    "سرور نہیں ملا۔ آئی ٹی سے پتہ یا ترتیب کی فائل لیں۔",
  "Hospital server address": "ہسپتال کے سرور کا پتہ",
  "https://HMS-SERVER": "https://HMS-SERVER",
  "Check server identity": "سرور کی شناخت چیک کریں",
  "Confirm with IT": "آئی ٹی سے تصدیق کریں",
  "Compare this fingerprint with the Control Center’s “Connect terminals” card.":
    "یہ فنگرپرنٹ کنٹرول سینٹر کے ٹرمینل رابطہ کارڈ سے ملائیں۔",
  "Fingerprint supplied by IT": "آئی ٹی کا فراہم کردہ فنگرپرنٹ",
  "They match — connect": "مطابقت ہے — رابطہ قائم کریں",
  "Facility profile & services": "ہسپتال کا پروفائل اور خدمات",
  "The PHC licence defines the category. The server checks every service change.":
    "قسم پی ایچ سی لائسنس کے مطابق ہے۔ سرور ہر سروس کی تبدیلی چیک کرتا ہے۔",
  Revision: "ترمیم",
  "Service and profile changes": "خدمات اور پروفائل کی تبدیلیاں",
  "Recorded PHC categories": "درج شدہ پی ایچ سی اقسام",
  "CURRENT PROFILE": "موجودہ پروفائل",
  "· Effective": "· مؤثر تاریخ",
  indicators: "اشاریے",
  "Record the category on your PHC licence.":
    "اپنے پی ایچ سی لائسنس کی قسم درج کریں۔",
  "Ward count and licence review": "وارڈ گنتی اور لائسنس کا جائزہ",
  "Category on the licence": "لائسنس پر درج قسم",
  "PHC category": "پی ایچ سی قسم",
  "PHC registration / licence number": "پی ایچ سی رجسٹریشن / لائسنس نمبر",
  "Effective date": "مؤثر تاریخ",
  "Licensed beds": "لائسنس میں درج بستر",
  "Licence document": "لائسنس کی دستاویز",
  "No document selected": "دستاویز منتخب نہیں",
  "Reason if category differs from bed suggestion":
    "بستروں کی تجویز سے قسم مختلف ہو تو وجہ",
  "Profile presets are suggestions. Review every service before previewing.":
    "پروفائل کی ابتدائی خدمات تجاویز ہیں۔ پیش منظر سے پہلے ہر سروس دیکھیں۔",
  Services: "خدمات",
  "Requires:": "ضروریات:",
  "Proposed state": "مجوزہ حالت",
  "Reason for change": "تبدیلی کی وجہ",
  "Preview change": "تبدیلی کا پیش منظر",
  "Review before applying": "اطلاق سے پہلے جائزہ",
  "Apply reviewed change": "جائزہ شدہ تبدیلی لاگو کریں",
  "Resolve the problems above and preview again.":
    "اوپر کے مسائل حل کر کے دوبارہ پیش منظر دیکھیں۔",
  "Search handbook": "رہنما تلاش کریں",
  "Search by name or number": "نام یا نمبر سے تلاش کریں",
  "Your account has no access to this lookup. This reporting gap is with the backend team; no substitute identity will be used.":
    "آپ کے اکاؤنٹ کو اس تلاش کی اجازت نہیں۔ مسئلہ بیک اینڈ ٹیم کو دیا گیا ہے؛ متبادل شناخت استعمال نہیں ہوگی۔",
  "Select from": "منتخب کریں",
  matches: "نتائج",
  "Report an incident": "واقعے کی رپورٹ",
  "Record the facts, without blame. The Quality Officer will review your report.":
    "بغیر الزام کے حقائق درج کریں۔ کوالٹی افسر رپورٹ کا جائزہ لے گا۔",
  "What to report · PDF": "کیا رپورٹ کریں · PDF",
  Report: "رپورٹ",
  "recorded. The Quality Officer will review it.":
    "درج ہو گئی۔ کوالٹی افسر جائزہ لے گا۔",
  "What happened": "کیا ہوا",
  "Incident type": "واقعے کی قسم",
  "Choose a type": "قسم منتخب کریں",
  "When it happened": "واقعے کا وقت",
  Department: "شعبہ",
  "Not recorded": "درج نہیں",
  "Ward / location": "وارڈ / مقام",
  "Ward, bed or place": "وارڈ، بستر یا جگہ",
  Patient: "مریض",
  "Staff member": "ملازم",
  Medicine: "دوا",
  Operation: "آپریشن",
  "Link a death record, if relevant": "متعلقہ موت کا ریکارڈ جوڑیں",
  "Death record": "موت کا ریکارڈ",
  "Facts, not opinions or blame.": "حقائق لکھیں، رائے یا الزام نہیں۔",
  "What was done at once": "فوری طور پر کیا کیا گیا",
  "Keep my name confidential (visible only to incident managers)":
    "میرا نام خفیہ رکھیں (صرف واقعہ منتظم دیکھیں)",
  "Submit incident report": "واقعے کی رپورٹ جمع کریں",
  "My reports": "میری رپورٹس",
  "You have no incident reports yet.": "آپ کی کوئی رپورٹ ابھی نہیں ہے۔",
  "HASPATAAL · HOSPITAL TERMINAL": "ہسپتال · ٹرمینل",
  "A clear start.": "واضح آغاز۔",
  "A calmer shift.": "پرسکون ڈیوٹی۔",
  "One place for your team’s daily work.": "ٹیم کے روزمرہ کام کے لیے ایک جگہ۔",
  "WELCOME BACK": "خوش آمدید",
  "Sign in to your workspace": "اپنی کام کی جگہ میں سائن اِن کریں",
  "Use the account provided by your hospital.":
    "ہسپتال کا فراہم کردہ اکاؤنٹ استعمال کریں۔",
  Username: "صارف نام",
  Password: "پاس ورڈ",
  "Need access? Contact your hospital’s IT team.":
    "رسائی کے لیے ہسپتال کی آئی ٹی ٹیم سے رابطہ کریں۔",
  "Change your password": "اپنا پاس ورڈ بدلیں",
  "Choose a new password before continuing.":
    "آگے بڑھنے سے پہلے نیا پاس ورڈ منتخب کریں۔",
  "Current password": "موجودہ پاس ورڈ",
  "New password": "نیا پاس ورڈ",
  "Confirm new password": "نئے پاس ورڈ کی تصدیق",
  "Change password": "پاس ورڈ بدلیں",
  Notifications: "اطلاعات",
  "Updates and requests from your hospital.":
    "ہسپتال کی اطلاعات اور درخواستیں۔",
  "Mark all as read": "سب کو پڑھا ہوا نشان لگائیں",
  "Unread only": "صرف غیر پڑھی ہوئی",
  "You’re all caught up.": "تمام اطلاعات پڑھ لی گئی ہیں۔",
  "Mark as read": "پڑھا ہوا نشان لگائیں",
  "Open related item": "متعلقہ چیز کھولیں",
  "Load older notifications": "پرانی اطلاعات لائیں",
  Language: "زبان",
  English: "English",
  Theme: "تھیم",
  Light: "روشن",
  "Dark · high contrast": "گہرا · نمایاں تضاد",
  "Ctrl/Cmd +, − and 0 use this same setting.":
    "Ctrl/Cmd +، − اور 0 یہی ترتیب استعمال کرتے ہیں۔",
  "Display size": "ڈسپلے سائز",
  "Reset to 100%": "100٪ پر واپس",
  "Download a set of documents": "دستاویزات کا مجموعہ حاصل کریں",
  "Separate PDFs, one per click": "الگ PDF، ہر کلک پر ایک",
  "One combined PDF": "ایک مشترک PDF",
  "This system section belongs to the IT workspace, outside this foundation build.":
    "یہ سسٹم حصہ آئی ٹی کی کام کی جگہ میں ہے، اس بنیادی بلڈ سے باہر۔",
  "Server connection": "سرور سے رابطہ",
  "Check server health, addresses, certificate identity and licence.":
    "سرور کی صحت، پتے، سرٹیفکیٹ اور لائسنس چیک کریں۔",
  "Test connection": "رابطہ آزمائیں",
  "This terminal": "یہ ٹرمینل",
  "Hospital policy": "ہسپتال کی پالیسی",
  "Control settings require owner approval. The server decides whether to apply or queue the request.":
    "کنٹرول ترتیبات کو مالک کی منظوری چاہیے۔ سرور درخواست لاگو یا منتظر کرتا ہے۔",
  "Owner approval": "مالک کی منظوری",
  "New value": "نئی قدر",
  "Use the same format as the current value: text in quotes, a number, true/false, or a list.":
    "موجودہ قدر کا فارمیٹ رکھیں: اقتباس میں متن، عدد، true/false یا فہرست۔",
  Reason: "وجہ",
  Cancel: "منسوخ",
  "Save policy": "پالیسی محفوظ کریں",
  "Recent change requests": "حالیہ تبدیلی کی درخواستیں",
  Close: "بند کریں",
  "Loading from the hospital server…": "ہسپتال کے سرور سے لوڈ ہو رہا ہے…",
  "Try again": "دوبارہ کوشش کریں",
  "Your display preferences": "آپ کی ڈسپلے ترتیبات",
  "Login display": "سائن اِن ڈسپلے",
  "Saved with your account on the hospital server.":
    "ہسپتال کے سرور پر آپ کے اکاؤنٹ میں محفوظ۔",
  "Saved only on this terminal. Signing in loads your own preferences.":
    "صرف اس ٹرمینل پر محفوظ۔ سائن اِن پر آپ کی ترتیبات آتی ہیں۔",
  "Profile & services": "پروفائل اور خدمات",
  "Staff & duties": "عملہ اور ذمہ داریاں",
  History: "تاریخ",
  "Keep current profile": "موجودہ پروفائل رکھیں",
  "Record or change profile": "پروفائل درج کریں یا بدلیں",
  Approvals: "منظوریاں",
  "Charity approvals": "فلاحی منظوری",
  Pending: "منتظر",
  Approved: "منظور",
  Rejected: "مسترد",
  Cancelled: "منسوخ",
  "Awaiting approval": "منظوری کا منتظر",
  "Incident or near miss": "واقعہ یا قریب الوقوع حادثہ",
  Harm: "نقصان",
  "Who was affected": "متاثرہ شخص",
  "Medication stage": "دوائی کا مرحلہ",
  "Phase of operation": "آپریشن کا مرحلہ",
  "My settings": "میری ترتیبات",
  Facility: "ہسپتال",
  "Display, language and zoom": "ڈسپلے، زبان اور زوم",
  "PHC profile and services": "پی ایچ سی پروفائل اور خدمات",
  "Hospital policy settings": "ہسپتال کی پالیسی ترتیبات",
  "Server connection and LAN diagnostics": "سرور رابطہ اور نیٹ ورک جانچ",
  "This terminal: its location and printers": "یہ ٹرمینل: مقام اور پرنٹر",
  "Language and zoom of the login screen": "سائن اِن صفحے کی زبان اور زوم",
  "COUNTER CASH & DRAWER": "کاؤنٹر کیش اور دراز",
  "My cash shift": "میری کیش شفٹ",
  "Open/close the drawer; see collections by type; hand over the cash drop.":
    "کاؤنٹر کی دراز کھولیں اور بند کریں؛ وصولیوں کا جائزہ لیں؛ اور کیش ڈراپ حوالے کریں۔",
  "Refresh shift details": "شفٹ کی تفصیلات تازہ کریں",
  Refresh: "تازہ کریں",
  "Access denied": "رسائی کی اجازت نہیں",
  "Your account does not have permission to operate a cash shift (finance.shift.operate).":
    "آپ کے اکاؤنٹ کو کیش شفٹ چلانے کی اجازت نہیں ہے (finance.shift.operate)۔",
  "Open cash shift": "کیش شفٹ کھولیں",
  "Every cash action needs an open shift at this counter (node from GET /terminals/whoami cash_node).":
    "ہر نقد لین دین کے لیے اس کاؤنٹر پر کھلی شفٹ لازم ہے (نوڈ whoami سے)۔",
  "Cash counter (Node)": "کیش کاؤنٹر (نوڈ)",
  "The designated service counter where you are collecting cash.":
    "وہ کاؤنٹر جہاں آپ نقد وصول کر رہے ہیں۔",
  "Opening float": "ابتدائی نقد رقم (فلوٹ)",
  "Cash in the drawer at shift start (e.g. for making change).":
    "شفٹ کے آغاز پر دراز میں رکھی رقم (بقایا دینے کے لیے)۔",
  "Opening…": "کھولی جا رہی ہے…",
  "Cash shift opened successfully.": "کیش شفٹ کامیابی سے کھل گئی۔",
  "Shift #": "شفٹ نمبر",
  Cashier: "کیشیئر",
  "Opened at": "کھولنے کا وقت",
  "Closed at": "بند کرنے کا وقت",
  Open: "کھلی ہوئی",
  "Pending collection": "وصولی کا انتظار",
  Verified: "تصدیق شدہ",
  "Awaiting second approval": "دوسری منظوری کا انتظار",
  "Expected cash": "متوقع نقد رقم",
  "Declared cash": "شمار کردہ نقد رقم",
  "Collections by transaction type": "لین دین کی قسم کے مطابق وصولیاں",
  "No transaction collections recorded yet.":
    "ابھی تک کوئی لین دین درج نہیں ہوا۔",
  transactions: "لین دین",
  "Non-cash collections": "غیر نقد وصولیاں",
  "No non-cash payments in this shift.":
    "اس شفٹ میں کوئی غیر نقد ادائیگی نہیں ہوئی۔",
  payments: "ادائیگیاں",
  "Cash drop details": "کیش ڈراپ کی تفصیلات",
  Status: "حالت",
  "Counted cash": "شمار شدہ نقد رقم",
  Variance: "فرق",
  "Drawer ledger of a shift": "دراز کا کھاتہ (لین دین)",
  "recorded entries": "درج شدہ اندراجات",
  "No drawer transactions recorded yet.":
    "اس شفٹ میں ابھی کوئی لین دین درج نہیں ہوا۔",
  Time: "وقت",
  "Txn Type": "لین دین کی قسم",
  "Receipt / Invoice": "رسید / انوائس",
  Note: "نوٹ",
  Amount: "رقم",
  "Close shift → PendingCollection": "شفٹ بند کریں → وصولی کا انتظار",
  "Closing asks for the counted cash; the Accountant verifies it later.":
    "شفٹ بند کرتے وقت گنی ہوئی نقد رقم پوچھی جاتی ہے؛ اکاؤنٹنٹ بعد میں تصدیق کرتا ہے۔",
  "Counted cash in drawer": "دراز میں شمار کردہ نقد رقم",
  "Cash the cashier counted in the drawer (excluding the opening float).":
    "دراز میں کیشیئر کی گنی ہوئی رقم (ابتدائی فلوٹ کے علاوہ)۔",
  "Close shift": "شفٹ بند کریں",
  "Confirm Shift Closure": "شفٹ بندش کی تصدیق",
  "Are you sure you want to close this cash shift?":
    "کیا آپ واقعی یہ کیش شفٹ بند کرنا چاہتے ہیں؟",
  "Counted cash (Declared)": "شمار کردہ نقد (اعلانیہ)",
  "Closing hands over the counted cash to the accountant. You will not be able to record further counter cash on this shift.":
    "شفٹ بند کرنے سے نقد رقم اکاؤنٹنٹ کے حوالے ہو جائے گی۔ آپ اس شفٹ پر مزید نقد کام نہیں کر سکیں گے۔",
  "Closing…": "بند کی جا رہی ہے…",
  "Confirm & Close Shift": "تصدیق اور شفٹ بند کریں",
  "Shift closed successfully. Pending collection by accountant.":
    "شفٹ کامیابی سے بند ہو گئی۔ اکاؤنٹنٹ کی تصدیق کا انتظار ہے۔",
  "Please enter a valid cash amount (0 or more).":
    "براہ کرم درست نقد رقم درج کریں (0 یا اس سے زیادہ)۔",
  "Main reception": "مرکزی استقبالیہ",
  "Pharmacy counter": "فارمیسی کاؤنٹر",
  "Lab reception": "لیب کا استقبالیہ",
  "IPD billing": "آئی پی ڈی بلنگ",
  "Emergency counter": "ایمرجنسی کاؤنٹر",
  "Cashier desk": "کیشیئر ڈیسک",
  Sale: "فروخت",
  "AR collection": "بقایا وصولی",
  Refund: "واپسی (ریفنڈ)",
  "Waiver dispensation": "رعایت کی ادائیگی",
  "AP payout": "ادائیگی (اے پی)",
  Adjustment: "ترمیم / مطابقت",
  "Cash drop": "کیش ڈراپ",
  Cash: "نقد",
  Card: "کارڈ",
  "Bank transfer": "بینک ٹرانسفر",
  "Panel credit": "پینل کریڈٹ",
  "Payroll deduction": "تنخواہ سے کٹوتی",
  Charity: "فلاحی امداد",
  "Patient search": "مریض کی تلاش",
  "Find returning patients by MRN, mobile, CNIC or name; show outstanding dues banner.":
    "ایم آر این، موبائل، شناختی کارڈ یا نام سے مریض تلاش کریں؛ بقایا جات کا بینر دیکھیں۔",
  "Type patient name, phone, CNIC, or MRN (barcode scanner + Enter)…":
    "مریض کا نام، فون، شناختی کارڈ یا ایم آر این درج کریں (یا بارکوڈ سکین کریں)…",
  "Patient search query": "مریض کی تلاش کا متن",
  "Searching…": "تلاش جاری ہے…",
  Search: "تلاش کریں",
  Clear: "صاف کریں",
  "Enter at least 2 characters to search (MRN barcode types automatically).":
    "تلاش کے لیے کم از کم 2 حروف درج کریں (ایم آر این بارکوڈ خودکار درج ہوتا ہے)۔",
  "Search results": "تلاش کے نتائج",
  match: "نتیجہ",
  "Searching the hospital records…": "ہسپتال کے ریکارڈ میں تلاش جاری ہے…",
  "No patients match this query. Check the MRN, mobile or spelling, or register a new patient.":
    "کوئی مریض نہیں ملا۔ ایم آر این، موبائل یا ہجے چیک کریں، یا نیا مریض رجسٹر کریں۔",
  "Search as you type (250 ms debounce). Or scan an MRN barcode with a handheld scanner.":
    "لکھتے ہی خودکار تلاش (250 ملی سیکنڈ)۔ یا بارکوڈ سکینر سے ایم آر این سکین کریں۔",
  "OUTSTANDING DUES": "واجب الادا بقایا جات",
  "OUTSTANDING BALANCE": "واجب الادا رقم",
  "MEDICO-LEGAL CASE": "میڈیکو لیگل کیس",
  "MEDICO-LEGAL RECORD": "میڈیکو لیگل ریکارڈ",
  DECEASED: "وفات یافتہ",
  "PATIENT DECEASED": "مریض کی وفات ہو چکی ہے",
  "No new visits or clinical orders may be started for a deceased patient.":
    "وفات یافتہ مریض کے لیے کوئی نئی وزٹ یا طبی احکامات شروع نہیں کیے جا سکتے۔",
  years: "سال",
  "Loading patient profile…": "مریض کا پروفائل لوڈ ہو رہا ہے…",
  "Select a patient from the search results to inspect their details, dues, and demographics.":
    "تفصیلات، بقایا جات اور معلومات دیکھنے کے لیے تلاش کے نتائج سے مریض منتخب کریں۔",
  "Merged Profiles": "ضم شدہ پروفائلز",
  "This master record includes identities merged from:":
    "اس مرکزی ریکارڈ میں درج ذیل ریکارڈ ضم کیے گئے ہیں:",
  "S/O, D/O, W/O": "ولدیت / زوجیت",
  "Edit demographics": "معلومات میں ترمیم",
  Gender: "جنس",
  "Age / DOB": "عمر / تاریخ پیدائش",
  "Mobile phone": "موبائل فون",
  CNIC: "شناختی کارڈ نمبر",
  "Blood group": "بلڈ گروپ",
  Allergies: "الرجی",
  "Billing category": "بلنگ کی قسم",
  Address: "پتہ",
  "Emergency contact": "ہنگامی رابطہ",
  "Registered on": "رجسٹریشن کی تاریخ",
  "Financials & Dues": "مالیات اور واجبات",
  "View dues & invoices": "واجبات اور انوائس دیکھیں",
  "Hide dues & invoices": "واجبات اور انوائس چھپائیں",
  "Loading financial summary…": "مالیاتی خلاصہ لوڈ ہو رہا ہے…",
  "Accounts Receivable (Dues)": "وصول طلب بقایا جات (اے آر)",
  "No outstanding accounts receivable for this patient.":
    "اس مریض کے کوئی واجب الادا بقایا جات نہیں ہیں۔",
  "Invoice #": "انوائس نمبر",
  Type: "قسم",
  "Amount due": "واجب رقم",
  Balance: "باقی رقم",
  "Recent Invoices": "حالیہ انوائسز",
  "No recent invoices recorded.": "کوئی حالیہ انوائس درج نہیں ہے۔",
  "Net payable": "قابل ادائیگی رقم",
  Paid: "ادا شدہ",
  "Edit patient demographics": "مریض کی معلومات میں ترمیم",
  "VERSION CONFLICT": "ورژن کا تنازع (VERSION CONFLICT)",
  "This patient record was updated by another terminal. The latest server data has been loaded. Please verify your edits and submit again.":
    "یہ ریکارڈ کسی دوسرے ٹرمینل سے تبدیل کیا گیا تھا۔ تازہ ترین ڈیٹا لوڈ ہو گیا ہے، براہ کرم تصدیق کر کے دوبارہ محفوظ کریں۔",
  "Full name": "پورا نام",
  "Patient's official name": "مریض کا سرکاری نام",
  "Father / Husband name": "والد / شوہر کا نام",
  "Age (Years)": "عمر (سال)",
  "Date of birth": "تاریخ پیدائش",
  "e.g. 03001234567": "مثلاً 03001234567",
  "e.g. 35202-1234567-1": "مثلاً 35202-1234567-1",
  "Known drug/food allergies": "معلوم ادویاتی یا غذائی الرجی",
  "Leave blank if none recorded": "اگر کوئی معلوم نہیں تو خالی چھوڑ دیں",
  "Panel ID": "پینل آئی ڈی",
  "Panel Member #": "پینل ممبر نمبر",
  "Emergency contact name": "ہنگامی رابطے کا نام",
  "Emergency contact phone": "ہنگامی رابطے کا فون",
  "Upgrade from LabOnly to Regular patient":
    "صرف لیب سے باقاعدہ مریض میں تبدیل کریں",
  "Saving…": "محفوظ ہو رہا ہے…",
  "Save changes": "تبدیلیاں محفوظ کریں",
  Regular: "باقاعدہ",
  LabOnly: "صرف لیب",
  TraumaTemp: "عارضی ٹراما",
  Merged: "ضم شدہ",
  male: "مرد",
  female: "عورت",
  other: "دیگر",
  unknown: "نامعلوم",
};
export function tr(text: string) {
  if (language === "ur" && registrationUr[text]) return registrationUr[text];
  const fixes: Record<string, string> = {
    "Discard draft and reload latest record":
      "مسودہ ختم کریں اور تازہ ریکارڈ دوبارہ لوڈ کریں",
    "Select cash counter": "کیش کاؤنٹر منتخب کریں",
    "This patient record was updated by another terminal. Your draft has been preserved. Discard it and reload the latest record before editing again.":
      "اس مریض کا ریکارڈ دوسرے ٹرمینل سے تبدیل ہوا ہے۔ آپ کا مسودہ محفوظ ہے۔ دوبارہ ترمیم سے پہلے مسودہ ختم کرکے تازہ ریکارڈ لوڈ کریں۔",
  };
  if (language === "ur" && fixes[text]) return fixes[text];
  return language === "ur" ? ur[text] || text : text;
}
export const translatedLabels = ur;
