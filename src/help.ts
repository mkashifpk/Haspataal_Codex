import { registrationHelp } from "./registration-help";
export type HelpPage = {
  title: string;
  titleUr: string;
  purpose: string;
  purposeUr: string;
  steps: string[];
  stepsUr: string[];
  faq: [string, string][];
  faqUr: [string, string][];
};
export const help: Record<string, HelpPage> = {
  registration: registrationHelp,
  connect_server: {
    title: "Connect to your hospital",
    titleUr: "ہسپتال سے رابطہ",
    purpose:
      "For terminal staff starting a shift: finish with a verified connection to the right hospital.",
    purposeUr:
      "ڈیوٹی شروع کرنے والے عملے کے لیے: درست ہسپتال سے تصدیق شدہ رابطہ قائم کریں۔",
    steps: [
      "Select Find servers on this network. Select the hospital supplied by IT, or type its HTTPS address.",
      "Select Check server identity. Compare the complete fingerprint with the one IT supplies from the Control Center. Enter that fingerprint and select They match — connect.",
      "If no server is found, ask IT for the address or terminal.json provisioning file. A changed certificate must be checked by IT; never accept it just to reconnect.",
      "During an outage your form remains in memory. Wait for connection recovery before saving. Closing the app loses unsaved input.",
    ],
    stepsUr: [
      "نیٹ ورک پر سرور تلاش کریں اور آئی ٹی کا بتایا ہوا ہسپتال منتخب کریں، یا اس کا HTTPS پتہ درج کریں۔",
      "سرور کی شناخت چیک کریں۔ مکمل فنگرپرنٹ کو کنٹرول سینٹر سے آئی ٹی کے فراہم کردہ فنگرپرنٹ سے ملائیں۔ مطابقت کے بعد رابطہ قائم کریں۔",
      "سرور نہ ملے تو آئی ٹی سے پتہ یا terminal.json فائل لیں۔ سرٹیفکیٹ بدلنے پر آئی ٹی سے تصدیق کرائیں۔",
      "رابطہ منقطع ہونے پر فارم میموری میں رہتا ہے۔ محفوظ کرنے سے پہلے رابطہ بحال ہونے کا انتظار کریں۔ ایپ بند کرنے سے غیر محفوظ اندراج ضائع ہوتا ہے۔",
    ],
    faq: [
      [
        "Does discovery prove a server is safe?",
        "No. Confirm its certificate fingerprint with IT before connecting.",
      ],
      [
        "What if the server address changes?",
        "The terminal tries the saved alternate addresses with the same pinned hospital certificate.",
      ],
    ],
    faqUr: [
      [
        "کیا تلاش سے سرور کی تصدیق ہو جاتی ہے؟",
        "نہیں۔ رابطے سے پہلے آئی ٹی سے سرٹیفکیٹ کا فنگرپرنٹ ملائیں۔",
      ],
      [
        "سرور کا پتہ بدل جائے تو؟",
        "ٹرمینل اسی ہسپتال کے سرٹیفکیٹ کے ساتھ محفوظ متبادل پتے آزماتا ہے۔",
      ],
    ],
  },
  login: {
    title: "Sign in",
    titleUr: "سائن اِن",
    purpose:
      "For every staff member: enter your own account and reach your permitted workspace.",
    purposeUr: "ہر ملازم کے لیے: اپنے اکاؤنٹ سے مجاز کام کی جگہ کھولیں۔",
    steps: [
      "Enter your username and password and select Sign in. A failed attempt clears the password; type it again deliberately.",
      "If the server asks for a password change, enter your current password, a new password and its confirmation. Follow any policy message returned by the server.",
      "If a countdown appears, wait until it ends. Login attempts are never retried automatically.",
      "Use Settings before login for connection diagnostics, terminal information, language and zoom. Use the information button for the terminal’s location, address and printers.",
    ],
    stepsUr: [
      "صارف نام اور پاس ورڈ درج کر کے سائن اِن کریں۔ ناکام کوشش کے بعد پاس ورڈ دوبارہ درج کریں۔",
      "پاس ورڈ بدلنے کی ہدایت آئے تو موجودہ اور نیا پاس ورڈ اور اس کی تصدیق درج کریں۔ سرور کی پالیسی ہدایات پر عمل کریں۔",
      "الٹی گنتی ہو تو ختم ہونے کا انتظار کریں۔ سائن اِن خودکار طور پر نہیں دہرایا جاتا۔",
      "سائن اِن سے پہلے ترتیبات میں رابطہ، ٹرمینل کی معلومات، زبان اور زوم دیکھیں۔",
    ],
    faq: [
      [
        "Why can I not sign in?",
        "Read the error. Check the hospital connection, wait out a lock countdown, or ask IT about a disabled account. Do not use someone else’s account.",
      ],
      [
        "What does a licence banner mean?",
        "Contact the vendor listed in the banner. During grace the hospital continues working; a locked licence restricts sign-in as the server explains.",
      ],
    ],
    faqUr: [
      [
        "سائن اِن کیوں نہیں ہو رہا؟",
        "خطا کا پیغام پڑھیں۔ رابطہ چیک کریں، لاک کی مدت ختم ہونے دیں یا آئی ٹی سے مدد لیں۔ کسی اور کا اکاؤنٹ استعمال نہ کریں۔",
      ],
      [
        "لائسنس کا پیغام کیا بتاتا ہے؟",
        "پیغام میں درج فراہم کنندہ سے رابطہ کریں۔ مہلت میں کام جاری رہتا ہے؛ لاک ہونے پر سرور رسائی محدود کرتا ہے۔",
      ],
    ],
  },
  workspace_picker: {
    title: "Choose a workspace",
    titleUr: "کام کی جگہ منتخب کریں",
    purpose:
      "For staff with several duties: open the right workspace before starting work.",
    purposeUr:
      "متعدد ذمہ داریوں والے عملے کے لیے: کام شروع کرنے سے پہلے درست جگہ کھولیں۔",
    steps: [
      "Choose a workspace card. With one workspace the terminal opens it directly.",
      "Select Open in new window to keep another duty open alongside this window. Both windows use your session, but each keeps its own workspace context.",
      "A Records badge means history access. Open work means a retiring service can finish existing work but cannot start new work.",
      "The facility controls available workspaces. Changes appear when the server notifies the terminal.",
    ],
    stepsUr: [
      "کام کی جگہ کا کارڈ منتخب کریں۔ صرف ایک جگہ ہو تو وہ خود کھلتی ہے۔",
      "دوسری ذمہ داری کے لیے نئی ونڈو کھولیں۔ دونوں میں ایک سیشن مگر الگ کام کا سیاق ہوتا ہے۔",
      "ریکارڈز کا مطلب سابقہ معلومات تک رسائی ہے۔ جاری کام کا مطلب موجودہ کام مکمل کرنا ہے، نیا کام شروع کرنا نہیں۔",
      "دستیاب جگہیں ہسپتال کی ترتیبات سے طے ہوتی ہیں۔ سرور کی اطلاع پر تبدیلی ظاہر ہوتی ہے۔",
    ],
    faq: [
      [
        "Why is a workspace missing?",
        "Your permissions or the facility’s service state may have changed. Contact the administrator; the terminal does not override them.",
      ],
    ],
    faqUr: [
      [
        "کام کی جگہ غائب کیوں ہے؟",
        "آپ کی اجازت یا سروس کی حالت بدل سکتی ہے۔ منتظم سے رابطہ کریں؛ ٹرمینل اسے تبدیل نہیں کرتا۔",
      ],
    ],
  },
  app_shell: {
    title: "Your daily workspace",
    titleUr: "روزمرہ کام کی جگہ",
    purpose:
      "For staff during a shift: keep identity, workspace, connection and shared tools visible.",
    purposeUr:
      "ڈیوٹی کے دوران عملے کے لیے: شناخت، کام کی جگہ، رابطہ اور مشترکہ سہولیات واضح رکھیں۔",
    steps: [
      "Check your name and current workspace in the header before working. Use Workspaces to switch duties.",
      "Use the side navigation for notifications, approvals, incident reporting and settings. Facility configuration is a separate administrator entry.",
      "Live means the event stream has caught up. Reconnecting means displayed information may be stale. An unreachable-server banner blocks writes while keeping your input.",
      "F1 or Help opens the current screen’s handbook without clearing your form. Close Help to return to the same control.",
      "Sign out when you finish. Sign out everywhere also ends your other sessions. A revoked session clears every open window.",
    ],
    stepsUr: [
      "کام سے پہلے اوپر اپنا نام اور موجودہ کام کی جگہ دیکھیں۔ ذمہ داری بدلنے کے لیے کام کی جگہیں کھولیں۔",
      "اطلاعات، منظوریوں، واقعہ رپورٹ اور ترتیبات کے لیے سائیڈ مینو استعمال کریں۔ ہسپتال کی ترتیب منتظم کا الگ حصہ ہے۔",
      "لائیو کا مطلب تازہ اطلاعات مکمل ہیں۔ دوبارہ رابطے کے دوران معلومات پرانی ہو سکتی ہیں۔ رابطہ نہ ہو تو اندراج محفوظ نہیں ہوتا مگر فارم برقرار رہتا ہے۔",
      "F1 یا مدد سے موجودہ صفحے کی رہنمائی کھولیں۔ مدد بند کرنے پر اسی کنٹرول پر واپس آئیں۔",
      "کام ختم ہونے پر سائن آؤٹ کریں۔ ہر جگہ سے سائن آؤٹ دوسری نشستیں بھی ختم کرتا ہے۔",
    ],
    faq: [
      [
        "Is my work saved during an outage?",
        "Only confirmed server responses establish a save. Unsaved input remains in memory, not on disk. Never assume an uncertain payment or write failed; follow its recovery message.",
      ],
      [
        "How do I enlarge the screen?",
        "Use Ctrl/Cmd + or −, or Display size in Settings. Ctrl/Cmd 0 resets to 100%. All routes stay between 100% and 250%.",
      ],
    ],
    faqUr: [
      [
        "رابطہ بند ہو تو کام محفوظ ہوتا ہے؟",
        "صرف سرور کی تصدیق محفوظ ہونے کا ثبوت ہے۔ غیر محفوظ اندراج میموری میں رہتا ہے، ڈسک پر نہیں۔ غیر یقینی نتیجے پر بحالی کی ہدایت پڑھیں۔",
      ],
      [
        "صفحہ بڑا کیسے کریں؟",
        "Ctrl/Cmd + یا − یا ترتیبات میں سائز استعمال کریں۔ Ctrl/Cmd 0 سے 100٪ ہوتا ہے۔ حد 100٪ سے 250٪ ہے۔",
      ],
    ],
  },
  settings: {
    title: "Settings",
    titleUr: "ترتیبات",
    purpose:
      "For staff adjusting display and authorized administrators changing policy: save the intended preference or reviewed request.",
    purposeUr:
      "عملے اور مجاز منتظمین کے لیے: مطلوبہ ذاتی ترتیب یا جائزہ شدہ پالیسی درخواست محفوظ کریں۔",
    steps: [
      "Open Settings or press Ctrl/Cmd comma. Its sections come from your server permissions.",
      "Choose language, theme, display size and separate or combined PDFs. Your signed-in preferences are saved to your account. Before login, display preferences belong only to this terminal.",
      "Change password requires your current password and matching new entries. Passwords are cleared after the attempt.",
      "Server connection runs health, address and licence checks. This terminal shows the server’s location and printer mapping.",
      "Hospital policy: select a setting, preserve its value type, enter a reason for control settings, and Save policy. Read the result: Applied is saved; Pending waits for an Owner. Review recent requests below.",
      "Facility profile and services opens a separate administrator screen. System configuration sections belong to the later IT workspace.",
    ],
    stepsUr: [
      "ترتیبات کھولیں یا Ctrl/Cmd comma دبائیں۔ حصے آپ کی سرور اجازت کے مطابق ہیں۔",
      "زبان، تھیم، سائز اور الگ یا مشترک PDF منتخب کریں۔ سائن اِن کے بعد ذاتی ترتیبات اکاؤنٹ میں محفوظ ہوتی ہیں؛ پہلے صرف اس ٹرمینل میں۔",
      "پاس ورڈ بدلنے کے لیے موجودہ اور یکساں نئے اندراج درکار ہیں۔ کوشش کے بعد پاس ورڈ صاف ہو جاتے ہیں۔",
      "سرور رابطہ میں صحت، پتے اور لائسنس چیک ہوتے ہیں۔ ٹرمینل میں مقام اور پرنٹر کی معلومات ہیں۔",
      "پالیسی منتخب کریں، قدر کی قسم برقرار رکھیں، وجہ لکھیں اور محفوظ کریں۔ Applied محفوظ ہے؛ Pending مالک کی منظوری کا منتظر ہے۔",
      "پروفائل اور خدمات منتظم کا الگ صفحہ ہے۔ سسٹم کی ترتیب بعد کے آئی ٹی حصے میں ہے۔",
    ],
    faq: [
      [
        "Why does a policy say Waiting for an Owner?",
        "It is a control setting. The server created an approval request; the original policy remains until approval.",
      ],
      [
        "Why did my display change after sign-in?",
        "The signed-in user’s preferences replace the login screen’s terminal preferences.",
      ],
    ],
    faqUr: [
      [
        "پالیسی مالک کی منتظر کیوں ہے؟",
        "یہ کنٹرول ترتیب ہے۔ سرور نے منظوری کی درخواست بنائی ہے؛ منظوری تک اصل پالیسی برقرار ہے۔",
      ],
      [
        "سائن اِن کے بعد منظر کیوں بدلا؟",
        "صارف کی ذاتی ترتیبات ٹرمینل کی ابتدائی ترتیبات کی جگہ لیتی ہیں۔",
      ],
    ],
  },
  notifications: {
    title: "Notifications",
    titleUr: "اطلاعات",
    purpose:
      "For staff receiving handovers: read the update and follow its permitted next action.",
    purposeUr:
      "اطلاع پانے والے عملے کے لیے: پیغام پڑھیں اور مجاز اگلا قدم اٹھائیں۔",
    steps: [
      "Open Notifications. Use Unread only to narrow the list.",
      "Read the title, message, severity and time. Mark as read affects your inbox only.",
      "Mark all as read marks your notifications together. Load older notifications retrieves the next page.",
      "Open related item navigates only to supported local screens; a destination outside this build is explained. Critical notices remain until you dismiss them.",
    ],
    stepsUr: [
      "اطلاعات کھولیں۔ صرف غیر پڑھی ہوئی کے فلٹر سے فہرست محدود کریں۔",
      "عنوان، پیغام، شدت اور وقت پڑھیں۔ پڑھا ہوا نشان صرف آپ کے ان باکس پر اثر کرتا ہے۔",
      "سب کو پڑھا ہوا نشان اکٹھا لگایا جا سکتا ہے۔ پرانی اطلاعات اگلا صفحہ لاتی ہیں۔",
      "متعلقہ چیز کھولنے سے دستیاب مقامی صفحہ کھلتا ہے؛ اس بلڈ سے باہر منزل کی وضاحت ہوتی ہے۔ اہم اطلاع بند کرنے تک رہتی ہے۔",
    ],
    faq: [
      [
        "Does marking read approve a request?",
        "No. Open Approvals and review the request before making a decision.",
      ],
    ],
    faqUr: [
      [
        "پڑھنے کا نشان منظوری ہے؟",
        "نہیں۔ منظوریوں میں درخواست کا جائزہ لے کر فیصلہ کریں۔",
      ],
    ],
  },
  approval_queue: {
    title: "Approvals",
    titleUr: "منظوریاں",
    purpose:
      "For requesters and approvers: see who is waiting and record an informed decision.",
    purposeUr:
      "درخواست کنندہ اور منظوری دینے والے کے لیے: منتظر کام دیکھیں اور باخبر فیصلہ درج کریں۔",
    steps: [
      "Choose Pending, Approved, Rejected or Cancelled. My requests shows your own requests and their awaiting-approval state.",
      "Select a request to load its current details. Read the requester, amount and payload. Policy and access requests show current and requested values.",
      "Enter a decision note. Reject and Cancel require a note in this UI. Approve is shown only when your permission matches and you are not the requester.",
      "Review the confirmation dialog. Confirm sends the decision; success shows the effects returned by the server. Another person may already have decided: reload and inspect the current state.",
      "Self-approval and AP-payment approval are disabled pending backend issue #2. The client does not infer the solo-practice exception or co-signer rules.",
    ],
    stepsUr: [
      "منتظر، منظور، مسترد یا منسوخ حالت منتخب کریں۔ میری درخواستیں آپ کے اپنے کام کی حالت دکھاتی ہیں۔",
      "درخواست کھول کر درخواست کنندہ، رقم اور تفصیل پڑھیں۔ پالیسی اور رسائی کی درخواست میں موجودہ اور مطلوبہ قدر دیکھیں۔",
      "فیصلے کا نوٹ لکھیں۔ مسترد اور منسوخ کرنے کے لیے نوٹ لازم ہے۔ مناسب اجازت اور دوسرے درخواست کنندہ کی صورت میں منظوری دکھتی ہے۔",
      "تصدیق کے مکالمے کا جائزہ لیں۔ کامیابی پر سرور کے بتائے اثرات دکھتے ہیں۔ پہلے فیصلہ ہو چکا ہو تو تازہ حالت دیکھیں۔",
      "اپنی درخواست اور AP ادائیگی کی منظوری بیک اینڈ مسئلہ 2 تک بند ہیں۔ کلائنٹ قواعد کا اندازہ نہیں لگاتا۔",
    ],
    faq: [
      [
        "Can I approve my own request?",
        "Ordinarily no. The server documents a solo-practice exception but does not yet expose eligibility before deciding. That action is disabled until issue #2 is resolved.",
      ],
      [
        "What if a decision response is lost?",
        "Read the request again before another action. A decision is not undone by closing the dialog.",
      ],
    ],
    faqUr: [
      [
        "کیا اپنی درخواست منظور کر سکتا ہوں؟",
        "عام طور پر نہیں۔ سرور کی مخصوص تنہا پریکٹس رعایت کی اہلیت ابھی نہیں ملتی۔ مسئلہ 2 حل ہونے تک یہ عمل بند ہے۔",
      ],
      [
        "فیصلے کا جواب نہ ملے تو؟",
        "دوسری کارروائی سے پہلے درخواست دوبارہ پڑھیں۔ مکالمہ بند کرنا فیصلہ واپس نہیں کرتا۔",
      ],
    ],
  },
  charity_approvals: {
    title: "Charity approvals",
    titleUr: "فلاحی منظوری",
    purpose:
      "For the charity officer: review permitted welfare requests and return a recorded decision.",
    purposeUr:
      "فلاحی افسر کے لیے: مجاز فلاحی درخواست کا جائزہ لے کر فیصلہ درج کریں۔",
    steps: [
      "Open Charity approvals in your workspace. The queue is limited to charity override requests you may decide.",
      "Select a request, read its details, add a note and Approve or Reject. A rejection needs a note.",
      "Confirm the decision and read the server-confirmed effect. Never decide your own request.",
    ],
    stepsUr: [
      "اپنے کام کی جگہ میں فلاحی منظوری کھولیں۔ قطار میں مجاز فلاحی درخواستیں ہیں۔",
      "درخواست کی تفصیل پڑھیں، نوٹ لکھیں اور منظور یا مسترد کریں۔ مسترد کرنے کے لیے نوٹ لازم ہے۔",
      "فیصلے کی تصدیق اور سرور کا نتیجہ پڑھیں۔ اپنی درخواست کا فیصلہ نہ کریں۔",
    ],
    faq: [
      [
        "Why is a request absent?",
        "The server limits the queue by permission and current status. Check the status filter or ask the requester for the current state.",
      ],
    ],
    faqUr: [
      [
        "درخواست کیوں نہیں ہے؟",
        "سرور اجازت اور حالت کے مطابق قطار دکھاتا ہے۔ فلٹر یا درخواست کنندہ سے موجودہ حالت چیک کریں۔",
      ],
    ],
  },
  report_incident: {
    title: "Report an incident",
    titleUr: "واقعے کی رپورٹ",
    purpose:
      "For any staff member who sees an incident or near miss: report facts and immediate actions on the same day.",
    purposeUr:
      "واقعہ یا قریب الوقوع حادثہ دیکھنے والے ہر ملازم کے لیے: اسی دن حقائق اور فوری اقدامات درج کریں۔",
    steps: [
      "Select an incident type from the hospital’s list. Sentinel types are marked. Choose incident or near miss and the harm.",
      "Record when and where it happened. Choose who was affected. Search and select a patient or staff member; never guess a record number.",
      "Medication incidents need a medicine and medication stage. Theatre events need the operation and phase. Link a death record when relevant.",
      "Describe what happened and what was done at once. Keep my name confidential restricts reporter identity to incident managers.",
      "Submit once. On confirmation note the incident number and next step. My reports shows your reports; select one for its detail.",
      "What to report downloads the hospital’s sentinel-event PDF. If an identity lookup is unavailable for your account, that path is blocked and must be resolved with the backend team.",
    ],
    stepsUr: [
      "ہسپتال کی فہرست سے واقعے کی قسم، قریب الوقوع حادثہ یا واقعہ اور نقصان منتخب کریں۔ سنگین اقسام پر نشان ہے۔",
      "وقت اور مقام لکھیں۔ متاثرہ شخص منتخب کریں۔ مریض یا ملازم تلاش کر کے منتخب کریں؛ ریکارڈ نمبر کا اندازہ نہ لگائیں۔",
      "دوائی کے واقعے میں دوا اور مرحلہ، آپریشن کے واقعے میں آپریشن اور مرحلہ درکار ہے۔ متعلقہ موت کا ریکارڈ بھی جوڑیں۔",
      "حقائق اور فوری اقدامات لکھیں۔ نام خفیہ رکھنے سے صرف واقعہ منتظم شناخت دیکھتا ہے۔",
      "ایک بار جمع کریں۔ تصدیق پر رپورٹ نمبر اور اگلا قدم پڑھیں۔ میری رپورٹس سے تفصیل کھولیں۔",
      "کیا رپورٹ کریں سے ہسپتال کی PDF حاصل کریں۔ شناخت تلاش کی اجازت نہ ہو تو بیک اینڈ ٹیم سے راستہ درست کرائیں۔",
    ],
    faq: [
      [
        "Will a retry create a duplicate?",
        "An uncertain retry with exactly the same payload reuses its action key during this app session. After closing the app, read My reports before submitting again.",
      ],
      [
        "Why can I not select affected staff?",
        "The current backend requires HR-directory permission for staff search. This is reported as issue #3; the app does not substitute a name or invent an ID.",
      ],
    ],
    faqUr: [
      [
        "دوبارہ کوشش سے نقل بنے گی؟",
        "اسی سیشن میں بالکل یکساں غیر یقینی درخواست وہی کلید استعمال کرتی ہے۔ ایپ دوبارہ کھولنے کے بعد پہلے میری رپورٹس دیکھیں۔",
      ],
      [
        "متاثرہ ملازم منتخب کیوں نہیں ہوتا؟",
        "بیک اینڈ ملازم تلاش کے لیے ایچ آر اجازت مانگتا ہے۔ مسئلہ 3 رپورٹ ہے؛ ایپ فرضی شناخت نہیں دیتی۔",
      ],
    ],
  },
  facility_profile: {
    title: "Facility profile and services",
    titleUr: "ہسپتال کا پروفائل اور خدمات",
    purpose:
      "For authorized facility administrators: preview and apply the category and service changes recorded on the licence.",
    purposeUr:
      "مجاز ہسپتال منتظمین کے لیے: لائسنس کے مطابق پروفائل اور خدمات کی تبدیلی کا جائزہ لے کر لاگو کریں۔",
    steps: [
      "Read the current profile, registration number, effective date and inspection framework. Review the ward-count suggestion; it never changes the licence category automatically.",
      "Record or change profile opens category, licence number, effective date, licensed beds, licence document and a reason if the category differs from the bed suggestion. Selecting a category proposes its preset services; review them.",
      "For each service read its current state, requirements, open work and PHC-declaration note. Select the proposed state and enter a reason for the overall change.",
      "Select Preview change. Read every move, prerequisite, outstanding item, warning, problem and framework change. Apply stays disabled when the server refuses the plan.",
      "Tick every required acknowledgement, then Apply reviewed change. Changing the form invalidates the preview. A version conflict requires a new preview.",
      "Staff & duties shows missing staffing and second-person requirements. History shows who changed what and why; reversals are new changes, not edits to history.",
    ],
    stepsUr: [
      "موجودہ پروفائل، رجسٹریشن، تاریخ اور معائنہ فریم ورک پڑھیں۔ وارڈ گنتی کی تجویز خود لائسنس کی قسم نہیں بدلتی۔",
      "پروفائل بدلنے میں قسم، لائسنس نمبر، تاریخ، بستر، دستاویز اور ضرورت پر وجہ لکھیں۔ قسم منتخب کرنے پر مجوزہ خدمات کا جائزہ لیں۔",
      "ہر سروس کی حالت، ضروریات، جاری کام اور پی ایچ سی اعلان کا نوٹ پڑھیں۔ مطلوبہ حالت اور مجموعی وجہ درج کریں۔",
      "پیش منظر میں ہر تبدیلی، شرط، جاری کام، انتباہ، مسئلہ اور فریم ورک پڑھیں۔ سرور انکار کرے تو اطلاق بند رہتا ہے۔",
      "ہر ضروری تصدیق ٹک کریں پھر جائزہ شدہ تبدیلی لاگو کریں۔ فارم بدلنے سے نیا پیش منظر لازم ہے۔ ورژن اختلاف پر دوبارہ پیش منظر بنائیں۔",
      "عملہ اور ذمہ داریاں میں کمی اور دوسرے شخص کی ضرورت دیکھیں۔ تاریخ میں کس نے کیا اور کیوں بدلا درج ہے۔ واپسی بھی نئی تبدیلی ہے۔",
    ],
    faq: [
      [
        "Can a service with open work be retired?",
        "Follow the server’s preview. It may need Retiring first so existing work finishes. The app never strands records or bypasses prerequisites.",
      ],
      [
        "Does changing category need another app?",
        "The app follows server views and service states. This foundation build is still under development; the later clinical workspaces are not delivered yet.",
      ],
    ],
    faqUr: [
      [
        "جاری کام والی سروس بند ہو سکتی ہے؟",
        "سرور کے پیش منظر پر عمل کریں۔ پہلے Retiring درکار ہو سکتا ہے تاکہ جاری کام مکمل ہو۔ ایپ شرائط نہیں چھوڑتی۔",
      ],
      [
        "قسم بدلنے کے لیے نئی ایپ چاہیے؟",
        "ایپ سرور کی سروس حالت کے مطابق چلتی ہے۔ یہ بنیادی بلڈ زیرِ تعمیر ہے؛ بعد کے طبی حصے ابھی فراہم نہیں ہوئے۔",
      ],
    ],
  },
  help_center: {
    title: "Help and handbook",
    titleUr: "مدد اور رہنما",
    purpose:
      "For staff needing an answer during work: find the permitted instructions and return without losing input.",
    purposeUr:
      "کام کے دوران رہنمائی کے لیے: مجاز ہدایات تلاش کریں اور اندراج ضائع کیے بغیر واپس جائیں۔",
    steps: [
      "Press F1 from a screen or a dialog. Help opens the current screen page.",
      "Search matches only locally bundled pages that the server permits for this workspace. Select a result to read its steps and questions.",
      "Print opens the system print dialog. Close returns focus to your previous control. Help works offline after the permitted contents have loaded.",
      "Urdu text is a draft pending native-speaker review. Tell the reviewer about unclear wording.",
    ],
    stepsUr: [
      "صفحے یا مکالمے میں F1 دبائیں۔ اسی صفحے کی مدد کھلتی ہے۔",
      "تلاش صرف اس کام کی جگہ کے مجاز مقامی صفحات میں ہوتی ہے۔ نتیجہ منتخب کر کے مراحل اور سوالات پڑھیں۔",
      "پرنٹ سے نظام کا پرنٹ مکالمہ کھلتا ہے۔ بند کرنے پر سابقہ کنٹرول پر واپس آئیں۔ مجاز مواد لوڈ ہونے کے بعد مدد آف لائن بھی چلتی ہے۔",
      "اردو متن مقامی ماہر کے جائزے تک مسودہ ہے۔ غیر واضح الفاظ کی نشاندہی کریں۔",
    ],
    faq: [
      [
        "Why can I not find another workspace’s guide?",
        "Help is restricted to the current workspace and your permissions. Open that permitted workspace in its own window.",
      ],
    ],
    faqUr: [
      [
        "دوسری جگہ کا رہنما کیوں نہیں ملتا؟",
        "مدد موجودہ کام اور اجازت تک محدود ہے۔ مجاز دوسری جگہ اپنی ونڈو میں کھولیں۔",
      ],
    ],
  },
  my_cash_shift: {
    title: "My cash shift",
    titleUr: "میری کیش شفٹ",
    purpose:
      "For front desk and counter staff: open/close the drawer, monitor collections by type, and hand over the cash drop.",
    purposeUr:
      "کاؤنٹر اور استقبالیہ عملے کے لیے: دراز کھولیں اور بند کریں، وصولیوں کا جائزہ لیں، اور کیش ڈراپ حوالے کریں۔",
    steps: [
      "Before taking cash payments, open your shift: select your cash counter node and enter the initial opening float in the drawer.",
      "During your shift, review collections by type (Sale, AR collection, etc.) and non-cash totals. Drawer ledger updates with each transaction.",
      "At the end of your shift, count the physical cash in your drawer (excluding the opening float), enter it into Counted cash in drawer, and select Close shift.",
      "Review the confirmation summary and confirm closure. The shift enters PendingCollection status for the accountant to verify.",
      "If a cash handling action is refused with 'Open a cash shift before handling cash' (SHIFT_NOT_OPEN), open a shift at this counter before proceeding.",
    ],
    stepsUr: [
      "نقد وصولی شروع کرنے سے پہلے شفٹ کھولیں: اپنا کیش کاؤنٹر نوڈ منتخب کریں اور دراز میں موجود ابتدائی فلوٹ درج کریں۔",
      "شفٹ کے دوران لین دین کی قسم (فروخت، بقایا وصولی وغیرہ) اور غیر نقد رقوم کا جائزہ لیں۔ دراز کا کھاتہ خودکار طور پر اپ ڈیٹ ہوتا ہے۔",
      "شفٹ کے اختتام پر دراز میں موجود نقد رقم گنیں (ابتدائی فلوٹ نکال کر)، اسے شمار کردہ نقد کے خانے میں درج کریں اور شفٹ بند کریں منتخب کریں۔",
      "تصدیقی خلاصہ دیکھیں اور بندش کی تصدیق کریں۔ شفٹ وصولی کے انتظار کی حالت (PendingCollection) میں چلی جائے گی جسے بعد میں اکاؤنٹنٹ چیک کرے گا۔",
      "اگر نقد لین دین کے دوران 'نقد کام سے پہلے کیش شفٹ کھولیں' کا پیغام آئے تو پہلے کاؤنٹر پر شفٹ کھولیں۔",
    ],
    faq: [
      [
        "Can I handle cash or dispense medicine without an open shift?",
        "No. Every cash action (OPD ticket payment, OTC sale, AR collection, refund payout) requires an active open shift at this counter node. Attempting cash actions without an open shift will be refused with SHIFT_NOT_OPEN.",
      ],
      [
        "What should I enter as Counted cash when closing a shift?",
        "Enter the actual cash counted in the drawer, excluding the initial opening float. The accountant will independently verify the physical cash drop later.",
      ],
      [
        "What happens after closing my shift?",
        "The shift status transitions to PendingCollection. You cannot record further transactions on this shift. The physical cash is handed over to the accountant who verifies the cash drop.",
      ],
    ],
    faqUr: [
      [
        "کیا بغیر کھلی شفٹ کے نقد رقم یا دوا وصول کی جا سکتی ہے؟",
        "نہیں۔ ہر نقد لین دین (او پی ڈی پرچی، او ٹی سی فروخت، بقایا وصولی، ریفنڈ ادائیگی) کے لیے اس کاؤنٹر پر کھلی شفٹ لازم ہے۔ بغیر شفٹ کے کارروائی SHIFT_NOT_OPEN خطا کے ساتھ رک جائے گی۔",
      ],
      [
        "شفٹ بند کرتے وقت شمار شدہ نقد رقم میں کیا درج کریں؟",
        "دراز میں گنی گئی اصل رقم درج کریں، جس میں ابتدائی فلوٹ شامل نہ ہو۔ بعد میں اکاؤنٹنٹ اس کیش ڈراپ کی آزادانہ تصدیق کرے گا۔",
      ],
      [
        "شفٹ بند کرنے کے بعد کیا ہوتا ہے؟",
        "شفٹ کی حالت 'وصولی کا انتظار' (PendingCollection) ہو جاتی ہے۔ اس شفٹ پر مزید نقد کام نہیں ہو سکتا۔ رقم اکاؤنٹنٹ کے حوالے کی جاتی ہے جو تصدیق کرتا ہے۔",
      ],
    ],
  },
  patient_search: {
    title: "Patient search",
    titleUr: "مریض کی تلاش",
    purpose:
      "Find returning patients by MRN, mobile, CNIC or name; show outstanding dues banner.",
    purposeUr:
      "ایم آر این، موبائل، شناختی کارڈ یا نام سے مریض تلاش کریں؛ بقایا جات کا بینر دیکھیں۔",
    steps: [
      "Type at least two characters into the search field (name, phone, CNIC, or MRN), or scan the patient's MRN barcode with a handheld scanner.",
      "The system searches with a 250ms debounce. Select the patient from the results to view their complete profile.",
      "Check the patient banners: an outstanding dues banner indicates unpaid balances (reception may block new OPD slips until cleared); a Medico-Legal banner marks an active MLC (MSDS 154); a Deceased banner prohibits new visits.",
      "To update demographics (address, phone, contact, etc.), click 'Edit demographics'. Save changes with optimistic locking protection.",
      "If a 409 VERSION_CONFLICT occurs, another terminal modified the patient concurrently: verify the refreshed data and re-apply changes.",
      "Click 'View dues & invoices' to inspect outstanding receivables and past invoices across the patient's whole merge chain.",
    ],
    stepsUr: [
      "تلاش کے خانے میں کم از کم دو حروف (نام، فون، شناختی کارڈ یا ایم آر این) درج کریں، یا بارکوڈ سکینر سے ایم آر این سکین کریں۔",
      "نظام 250 ملی سیکنڈ کے وقفے سے خودکار تلاش کرتا ہے۔ مکمل پروفائل دیکھنے کے لیے نتائج میں سے مریض منتخب کریں۔",
      "مریض کے بینرز دیکھیں: سرخ بینر بقایا رقم ظاہر کرتا ہے (جس سے نئی او پی ڈی پرچی رک سکتی ہے)؛ میڈیکو لیگل بینر ایم ایل سی کیس ظاہر کرتا ہے؛ اور وفات یافتہ کا بینر نئی وزٹ سے روکتا ہے۔",
      "معلومات (پتہ، فون، رابطہ وغیرہ) تبدیل کرنے کے لیے 'معلومات میں ترمیم' پر کلک کریں اور تبدیلی محفوظ کریں۔",
      "اگر ورژن کا تنازع (VERSION_CONFLICT) پیش آئے تو سرور سے تازہ ترین ڈیٹا دیکھ کر دوبارہ محفوظ کریں۔",
      "مریض کے تمام سابقہ بل اور واجب الادا رقوم دیکھنے کے لیے 'واجبات اور انوائس دیکھیں' پر کلک کریں۔",
    ],
    faq: [
      [
        "Can I issue an OPD slip if the patient has outstanding dues?",
        "If outstanding.ar_block_applies is true, reception blocks regular ticket issuance until the balance is settled or an authorized waiver/bypass is granted.",
      ],
      [
        "What should I do if a patient has multiple merged profiles?",
        "Merged records automatically resolve to the master profile. The system displays all merged MRNs under the master record so historical visits and billing are retained.",
      ],
      [
        "Why is a Deceased banner displayed?",
        "When a death record is officially logged on the hospital server, the patient profile is marked Deceased. The terminal strictly forbids starting new clinical encounters for deceased patients.",
      ],
    ],
    faqUr: [
      [
        "کیا بقایا جات والے مریض کی او پی ڈی پرچی بن سکتی ہے؟",
        "اگر واجبات کی روک (ar_block_applies) لاگو ہو تو پرچی جاری کرنے سے پہلے رقم وصول کرنا یا مجاز رعایت حاصل کرنا لازم ہے۔",
      ],
      [
        "اگر مریض کے ایک سے زیادہ ریکارڈ ضم (Merge) ہوئے ہوں؟",
        "تمام ضم شدہ ریکارڈ خودکار طور پر مرکزی (Master) ریکارڈ سے جڑ جاتے ہیں۔ نظام تمام پرانے ایم آر این مرکزی پروفائل کے نیچے ظاہر کرتا ہے۔",
      ],
      [
        "وفات یافتہ کا بینر کیا ظاہر کرتا ہے؟",
        "جب ہسپتال سرور پر موت کا اندراج ہو جائے تو پروفائل پر وفات کا بینر آ جاتا ہے۔ وفات یافتہ مریض کے لیے نیا طبی وزٹ شروع کرنا ممنوع ہے۔",
      ],
    ],
  },
};
