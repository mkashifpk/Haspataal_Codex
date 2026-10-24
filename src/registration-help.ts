import type { HelpPage } from "./help";
export const registrationHelp: HelpPage = {
  title: "New registration + OPD slip",
  titleUr: "نئی رجسٹریشن اور او پی ڈی پرچی",
  purpose:
    "For reception staff: identify the patient, record intake, issue or reopen an OPD ticket, collect payment, attach optional documents and print the slip.",
  purposeUr:
    "استقبالیہ عملے کے لیے: مریض کی شناخت اور معلومات درج کریں، او پی ڈی ٹکٹ جاری یا دوبارہ کھولیں، ادائیگی وصول کریں، اختیاری کاغذات منسلک کریں اور پرچی چھاپیں۔",
  steps: [
    "For a new patient enter name, gender, mobile and age or date of birth. CNIC, an issued UPMRN (Universal Patient Medical Record Number) and all other intake fields are optional. Never invent a UPMRN. Duplicate CNIC or UPMRN: this patient is already registered; search for them instead. Select Panel billing only with an active panel. Patient record only creates the patient without an OPD visit.",
    "For a returning patient search or scan the MRN into Search patient. Confirm name and MRN plus age or date of birth; review allergies, medico-legal status, death and outstanding-dues banners.",
    "Choose an active OPD service and source. Emergency is offered only when the hospital emergency service is active. Use emergency bypass only for the clinical emergency described by the option. Only permitted staff can override dues, and must record a reason.",
    "Enter a discount and reason if needed. If the server refuses a discount above your ceiling, reduce it to the allowed amount or issue unpaid, then request a VIP waiver with a reason and percentage. The ticket stays frozen while approval is pending.",
    "Choose Collect full payment now or issue unpaid. Cash needs your own open cash shift; open it in My cash shift. Card/bank payments need a reference. An unpaid ticket can be reopened by its number for later payment. The server decides whether it is queued.",
    "Ask permission before taking or choosing a photo. Preview, retake or Skip photo without a reason. Choose optional outside reports and enter each report's type, title, issuing facility and date. Upload after the patient exists; an upload failure never requires repeating registration or payment.",
    "After success keep the ticket number. Preview the slip, print to the mapped receipt printer or save its PDF. If printing fails, reprint the same ticket. If any write's answer is lost, retry the original action and payload; do not create another registration or payment.",
  ],
  stepsUr: [
    "نئے مریض کا نام، جنس، موبائل اور عمر یا تاریخ پیدائش درج کریں۔ شناختی کارڈ، جاری کردہ یونیورسل مریض نمبر اور باقی معلومات اختیاری ہیں۔ نمبر خود نہ بنائیں۔ شناختی کارڈ یا نمبر پہلے موجود ہو تو مریض دوبارہ درج کرنے کے بجائے تلاش کریں۔ پینل بلنگ کے لیے فعال پینل منتخب کریں۔ صرف مریض کا ریکارڈ بنانے سے او پی ڈی وزٹ نہیں بنتی۔",
    "واپس آنے والے مریض کو تلاش کریں یا تلاش کے خانے میں ایم آر این سکین کریں۔ نام، ایم آر این اور عمر یا تاریخ پیدائش سے شناخت کی تصدیق کریں۔ الرجی، میڈیکو لیگل حیثیت، وفات اور واجبات کی تنبیہ دیکھیں۔",
    "فعال او پی ڈی خدمت اور آمد کی قسم منتخب کریں۔ ایمرجنسی صرف ہسپتال کی ایمرجنسی خدمت فعال ہونے پر ملتی ہے۔ ہنگامی استثنا صرف حقیقی طبی ایمرجنسی کے لیے استعمال کریں۔ واجبات کا استثنا صرف مجاز عملہ وجہ لکھ کر دے سکتا ہے۔",
    "رعایت اور وجہ درج کریں۔ اگر رعایت اجازت سے زیادہ ہو تو اسے مجاز حد تک کم کریں یا بلا ادائیگی ٹکٹ جاری کرکے وجہ اور شرح کے ساتھ وی آئی پی رعایت کی درخواست دیں۔ منظوری تک ٹکٹ مقفل رہتا ہے۔",
    "ابھی پوری ادائیگی وصول کریں یا بلا ادائیگی ٹکٹ جاری کریں۔ نقد کے لیے اپنی کھلی کیش شفٹ ضروری ہے۔ کارڈ یا بینک کے لیے حوالہ درج کریں۔ ٹکٹ نمبر سے پرانا بلا ادائیگی ٹکٹ کھول کر ادائیگی وصول کی جا سکتی ہے۔ قطار کا فیصلہ سرور کرتا ہے۔",
    "تصویر لینے یا چننے سے پہلے اجازت لیں۔ پیش منظر دیکھیں، دوبارہ لیں یا بلا وجہ بتائے چھوڑ دیں۔ بیرونی رپورٹ کے لیے قسم، عنوان، جاری کرنے والا ادارہ اور تاریخ درج کریں۔ مریض بننے کے بعد اپ لوڈ کریں؛ ناکامی پر رجسٹریشن یا ادائیگی دوبارہ نہ کریں۔",
    "کامیابی پر ٹکٹ نمبر محفوظ رکھیں۔ پرچی کا پیش منظر دیکھیں، مقررہ پرنٹر پر چھاپیں یا پی ڈی ایف محفوظ کریں۔ پرنٹنگ ناکام ہو تو اسی ٹکٹ کو دوبارہ چھاپیں۔ جواب گم ہو تو اصل کارروائی اور وہی معلومات دوبارہ آزمائیں؛ دوسری رجسٹریشن یا ادائیگی نہ بنائیں۔",
  ],
  faq: [
    [
      "Is a patient photo required?",
      "Never. Ask permission and accept refusal, including privacy or purdah. Do not delay emergencies or patients unable to cooperate. Skip needs no reason. Photos are JPEG/PNG, at most 16 megapixels.",
    ],
    [
      "Can I attach reports from another clinic?",
      "Yes: PDF, JPEG or PNG. Record type, title, issuing facility and the date on the report. They are labelled Outside and never counted as this hospital's lab or imaging results.",
    ],
    [
      "Which fields are required?",
      "Regular patients need name, gender, mobile and age or DOB. CNIC is optional. Panel billing also needs a panel. Optional allergies left blank mean not recorded, never no known allergies.",
    ],
    [
      "Why did payment fail with SHIFT_NOT_OPEN?",
      "Open your own cash shift at the correct counter, then retry the same payment. Do not register the patient again.",
    ],
    [
      "How do I give a discount beyond my ceiling?",
      "Read the server's allowed amount/percentage. Issue within that ceiling, or issue unpaid, then Request VIP waiver for authorized approval. Do not collect an estimated amount or bypass approval.",
    ],
    [
      "What if there are outstanding dues?",
      "Read the server's banner. Ordinary visits may be blocked. Only authorized staff may record an override reason; an active emergency service supports the documented emergency bypass.",
    ],
    [
      "What if the printer fails?",
      "Use Print / reprint slip for the existing ticket. Ask IT to correct its Windows printer mapping, or save the slip PDF. Printing does not repeat a payment.",
    ],
    [
      "Can reception link staff payroll?",
      "Yes. Search active staff by name or employee number, then select the matching badge details. This lookup does not expose confidential HR records. Leave it unselected when the patient is not staff; never type or guess a database ID.",
    ],
  ],
  faqUr: [
    [
      "کیا مریض کی تصویر لازم ہے؟",
      "کبھی نہیں۔ اجازت لیں اور رازداری یا پردے کی وجہ سے انکار قبول کریں۔ ایمرجنسی یا تعاون نہ کر سکنے والے مریض کو تاخیر نہ دیں۔ چھوڑنے کی وجہ ضروری نہیں۔ تصویر جے پی ای جی یا پی این جی اور زیادہ سے زیادہ سولہ میگاپکسل ہو۔",
    ],
    [
      "کیا دوسرے کلینک کی رپورٹس منسلک کر سکتا ہوں؟",
      "جی ہاں۔ پی ڈی ایف، جے پی ای جی یا پی این جی میں قسم، عنوان، جاری کرنے والا ادارہ اور رپورٹ کی تاریخ درج کریں۔ بیرونی رپورٹس ہسپتال کے اپنے لیب یا امیجنگ نتائج میں شمار نہیں ہوتیں۔",
    ],
    [
      "کون سے خانے ضروری ہیں؟",
      "عام مریض کے لیے نام، جنس، موبائل اور عمر یا تاریخ پیدائش ضروری ہیں۔ شناختی کارڈ اختیاری ہے۔ پینل بلنگ کے لیے پینل ضروری ہے۔ خالی الرجی کا مطلب معلومات درج نہیں، الرجی نہ ہونا نہیں۔",
    ],
    [
      "ادائیگی پر شفٹ نہ کھلنے کی خطا کیوں آئی؟",
      "درست کاؤنٹر پر اپنی کیش شفٹ کھولیں اور وہی ادائیگی دوبارہ آزمائیں۔ مریض کی رجسٹریشن دوبارہ نہ کریں۔",
    ],
    [
      "اپنی حد سے زیادہ رعایت کیسے دوں؟",
      "سرور کی بتائی مجاز رقم یا شرح دیکھیں۔ حد کے اندر پرچی جاری کریں یا بلا ادائیگی جاری کرکے وی آئی پی رعایت کی مجاز منظوری مانگیں۔ تخمینی رقم وصول یا منظوری نظرانداز نہ کریں۔",
    ],
    [
      "اگر واجبات ہوں تو؟",
      "سرور کی تنبیہ پڑھیں۔ عام وزٹ رک سکتی ہے۔ صرف مجاز عملہ وجہ لکھ کر استثنا دے سکتا ہے۔ فعال ایمرجنسی خدمت میں مقررہ ہنگامی استثنا دستیاب ہے۔",
    ],
    [
      "پرنٹر ناکام ہو تو؟",
      "اسی ٹکٹ کو دوبارہ چھاپیں۔ آئی ٹی سے ونڈوز پرنٹر کی ترتیب درست کرائیں یا پرچی کی پی ڈی ایف محفوظ کریں۔ پرنٹنگ ادائیگی دوبارہ نہیں کرتی۔",
    ],
    [
      "کیا استقبالیہ تنخواہ کا ملازم جوڑ سکتا ہے؟",
      "جی ہاں۔ نام یا ملازم نمبر سے فعال عملہ تلاش کرکے درست شناخت منتخب کریں۔ اس تلاش میں خفیہ ایچ آر ریکارڈ نہیں آتا۔ غیر ملازم مریض کے لیے خانہ خالی چھوڑیں؛ ڈیٹابیس آئی ڈی درج یا اندازہ نہ کریں۔",
    ],
  ],
};
