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
  tariff_display: {
    title: "Tariff", titleUr: "نرخ نامہ",
    purpose: "At reception, staff explain the hospital's published prices to patients and save the official tariff for display; done means the correct dated prices are visible and the requested PDF is saved without changing any bill.",
    purposeUr: "استقبالیہ عملہ مریض کو شائع شدہ نرخ بتاتا اور اصل نرخ نامہ آویزاں کرنے کے لیے محفوظ کرتا ہے؛ درست تاریخ کے نرخ دیکھنا اور بل بدلے بغیر مطلوبہ پی ڈی ایف محفوظ کرنا مقصد ہے۔",
    steps: [
      "Open Reception → Tariff. Check the hospital name, Prices as of date and Currency. Services are grouped by category; Ward daily charges lists each ward's price per day, and Lab test prices lists its code and section. Price not listed is not a free bed or a zero charge.",
      "Choose Price category or type into Find a service, ward or test to narrow this screen. The search matches names, codes and department/section text. Show all prices clears both filters. These controls never change stored prices or the PDF. No match means clear the filters or ask the responsible billing/lab administrator about an absent price.",
      "Refresh tariff reads current published prices. Loading and errors hide the older display so it cannot be mistaken for a fresh quote. Try again retries the read only. This screen does not poll or create patients, visits, estimates, invoices or payments; tariff corrections belong to the authorized setup workspace.",
      "Print / save tariff PDF retrieves the full official PDF, independently of screen filters, and opens the native Save dialog. Choose a location or Cancel. Only Tariff PDF saved confirms saving; cancellation saves nothing. Open the saved file in your PDF reader and choose Print there. A download/print failure means retry that read or printer, never repeat a patient or financial transaction.",
      "F1 or Help opens this page, retains filters and returns focus when closed. Shared keyboard/Settings zoom stays100–250%. English/Urdu help and demo screenshots are bundled; native Urdu, physical printing, full role journeys and named human worksheet review remain pending."
    ],
    stepsUr: [
      "استقبالیہ سے نرخ نامہ کھولیں۔ ہسپتال، نرخ کی تاریخ اور کرنسی چیک کریں۔ خدمات قسم کے لحاظ سے، وارڈ کا یومیہ خرچ اور لیب ٹیسٹ الگ دکھتے ہیں۔ نرخ درج نہیں کا مطلب مفت بستر یا صفر رقم نہیں۔",
      "نرخ کی قسم یا خدمت، وارڈ یا ٹیسٹ تلاش کریں سے فہرست محدود کریں۔ نام، کوڈ، شعبہ یا سیکشن تلاش ہوتا ہے۔ تمام نرخ دکھائیں دونوں صاف کرتا ہے۔ اس سے محفوظ قیمت یا پی ڈی ایف نہیں بدلتی۔ نرخ غائب ہو تو متعلقہ بلنگ یا لیب منتظم سے پوچھیں۔",
      "نرخ تازہ کریں اصل شائع شدہ فہرست پڑھتا ہے۔ لوڈ یا خرابی پر پرانے نرخ چھپتے ہیں؛ دوبارہ کوشش صرف پڑھتی ہے۔ یہاں مریض، وزٹ، تخمینہ، بل یا رقم نہیں بنتی۔ نرخ درست کرنے کا اختیار متعلقہ ترتیب کے صفحے پر ہے۔",
      "نرخ نامہ چھاپیں یا پی ڈی ایف محفوظ کریں سے مکمل اصل فائل آتی ہے، تلاش اس کو نہیں بدلتی۔ محفوظ کرنے کی جگہ چنیں یا منسوخ کریں۔ صرف محفوظ ہونے کا پیغام کامیابی ہے۔ محفوظ فائل پی ڈی ایف ریڈر میں کھول کر چھاپیں۔ ناکامی پر صرف پڑھنا یا پرنٹر دہرائیں، مریض یا رقم نہیں۔",
      "ایف۱ یا مدد فلٹر برقرار رکھتے ہیں اور بند کرنے پر توجہ واپس آتی ہے۔ کی بورڈ اور ترتیب کا زوم ۱۰۰ تا ۲۵۰ فیصد ہے۔ اردو، اصل پرنٹر، مکمل کردار اور نامزد انسانی جائزہ باقی ہے۔"
    ],
    faq: [
      ["Does this quote the patient's final bill?", "No. It shows published unit prices, dated by the server. Actual treatment and the patient's billing workflow determine the bill; this screen collects no money."],
      ["Why does a ward show Price not listed?", "The server has not supplied a daily price. Never call it zero or free. Ask the authorized billing administrator to check the tariff setup, then Refresh tariff."],
      ["Will my filter print just one category?", "No. Print / save tariff PDF fetches the complete official server PDF. Save it and print from your PDF reader. Show all prices only changes the on-screen filters."],
      ["What if the connection, Save dialog or printer fails?", "Read the visible error/reference, then retry Refresh or the PDF download. Cancel saves no file; only the saved message confirms it. Printing is separate and never repeats a bill or payment."],
      ["Can I edit prices here?", "No. Any logged-in user can read the tariff endpoint, while the server's permitted screen navigation controls where it appears. Ask authorized billing/lab setup staff to correct the source prices."]
    ],
    faqUr: [
      ["کیا یہ مریض کا حتمی بل ہے؟", "نہیں؛ یہ سرور کی تاریخ والے شائع شدہ فی خدمت نرخ ہیں۔ علاج اور بلنگ کا اصل عمل بل طے کرتا ہے؛ یہاں رقم وصول نہیں ہوتی۔"],
      ["وارڈ کا نرخ درج نہ ہو تو؟", "سرور نے روزانہ نرخ نہیں دیا۔ اسے صفر یا مفت نہ کہیں۔ مجاز بلنگ منتظم سے ترتیب چیک کرا کر نرخ تازہ کریں۔"],
      ["کیا فلٹر صرف ایک قسم چھاپے گا؟", "نہیں؛ اصل مکمل پی ڈی ایف آتی ہے۔ محفوظ کرکے پی ڈی ایف ریڈر سے چھاپیں۔ فلٹر صرف اسکرین بدلتا ہے۔"],
      ["رابطہ، محفوظ کرنا یا پرنٹر ناکام ہو تو؟", "اصل خرابی پڑھ کر نرخ یا پی ڈی ایف دوبارہ پڑھیں۔ منسوخی فائل محفوظ نہیں کرتی؛ محفوظ ہونے کا پیغام دیکھیں۔ بل یا رقم دوبارہ نہ بھیجیں۔"],
      ["نرخ یہاں بدل سکتے ہیں؟", "نہیں؛ مجاز بلنگ یا لیب ترتیب کے عملے سے اصل قیمت درست کرائیں۔ سرور کی اجازت کے مطابق صفحہ ملتا ہے۔"]
    ]
  },
  patient_documents: {
    title: "Patient document vault", titleUr: "مریض کی دستاویزات",
    purpose: "At the reception counter, staff verify a returning patient's identity, attach optional photos or documents separately, and open a stored file only on request; done means the server lists the correct file under the correct patient.",
    purposeUr: "استقبالیہ عملہ مریض کی شناخت چیک کرکے اختیاری تصویر یا دستاویز الگ منسلک کرتا ہے۔ صرف درخواست پر فائل کھولیں؛ کامیابی اصل سرور پر درست مریض کی فائل ظاہر ہونے سے ہے۔",
    steps: [
      "Open Reception → Patient document vault. Search by name, mobile, CNIC or MRN, then select the matching result. Check name, MRN, age/date of birth, allergies, medico-legal/death and dues flags. This screen creates no patient, visit or payment. Clear patient selection changes context only after unsent-file confirmation; pending uploads block it.",
      "Photo is optional: ask consent first. Choose photo accepts JPEG/PNG; Take photo asks camera permission, Capture photo creates a preview, Close camera stops capture. Choose another file or retake before uploading; Skip photo needs no reason. Never delay urgent care. Upload patient photo is separate from registration/payment; wait for Photo uploaded. Reopen the vault to take another saved photo.",
      "Choose outside reports adds one draft per PDF/JPEG/PNG. Enter Report type, Report title, Issued by facility and Document date. Outside reports need facility/date and are not hospital test results. For an ID copy or hospital attachment clear Outside document and select CNIC, PanelCard or its actual type. Each Upload report sends only that file. Remove discards only an unsent, unlocked draft; it never deletes a stored file.",
      "Wait for Report uploaded. Unknown upload freezes its exact file, metadata, patient and key: retry that original Upload report within24hours. Refresh documents only reads the list and never resubmits. After the safe retry window ask IT to reconcile; never repeat registration, admission or payment. Errors show the server code and reference; repair refused file/type/facility/date/size before a deliberate new attempt.",
      "Stored patient documents lists type, ID, size, media and Outside: facility,date separately from Hospital document. No files are prefetched. Choose the document or View current patient photo to open an image; PDF opens the native Save dialog. Cancel that dialog saves nothing. Close returns from image preview. Download failure retries only the read. Every download is audited. There is no edit/delete/verification action here.",
      "F1 or Help opens this page without losing unsaved files and returns focus on close. Shared Settings/keyboard zoom is100–250%. English and Urdu pages and synthetic screenshots are bundled; native Urdu, camera/device, full role journey and named human acceptance remain pending."
    ],
    stepsUr: [
      "استقبالیہ سے مریض کی دستاویزات کھولیں۔ نام، موبائل، شناختی کارڈ یا ایم آر این تلاش کرکے درست مریض چنیں۔ نام، ایم آر این، عمر، الرجی، میڈیکو لیگل، وفات اور واجبات چیک کریں۔ یہاں مریض، وزٹ یا ادائیگی نہیں بنتی۔ غیر ارسال فائل چھوڑنے کی تصدیق اور غیر یقینی اپ لوڈ کی روک موجود ہے۔",
      "تصویر اختیاری ہے؛ پہلے اجازت لیں۔ جے پیگ یا پی این جی منتخب کریں، یا کیمرے کی اجازت سے تصویر لیں۔ پیش منظر دیکھ کر فائل بدلیں یا دوبارہ لیں؛ بلا وجہ تصویر چھوڑ سکتے ہیں۔ ہنگامی علاج نہ روکیں۔ تصویر الگ اپ لوڈ اور اصل تصدیق دیکھیں۔ محفوظ تصویر کے بعد نئی تصویر کے لیے صفحہ دوبارہ کھولیں۔",
      "بیرونی رپورٹس میں پی ڈی ایف، جے پیگ یا پی این جی چنیں۔ ہر فائل کی قسم، عنوان، جاری ادارہ اور تاریخ لکھیں۔ بیرونی رپورٹ ہسپتال کا اپنا نتیجہ نہیں ہے۔ شناختی نقل یا ہسپتال کی دستاویز کے لیے بیرونی کا نشان ہٹا کر اصل قسم چنیں۔ ہر فائل الگ اپ لوڈ ہوتی ہے۔ ہٹائیں صرف غیر ارسال مسودہ ہٹاتا ہے۔",
      "اصل اپ لوڈ کی تصدیق کا انتظار کریں۔ غیر یقینی جواب پر وہی فائل، معلومات، مریض اور کلید برقرار ہیں؛ ۲۴ گھنٹے میں اسی اپ لوڈ کی دوبارہ کوشش کریں۔ دستاویزات تازہ کرنا صرف پڑھتا ہے۔ وقت ختم ہو تو آئی ٹی سے نتیجہ چیک کرائیں؛ رجسٹریشن، داخلہ یا رقم دوبارہ نہ بھیجیں۔ غلط قسم، ادارہ، تاریخ یا حجم سرور کے پیغام کے مطابق درست کریں۔",
      "محفوظ فہرست میں نمبر، قسم، حجم اور بیرونی ادارہ و تاریخ الگ نظر آتے ہیں۔ فائل خود نہیں کھلتی۔ منتخب تصویر پیش منظر اور پی ڈی ایف محفوظ کرنے کا مکالمہ کھولتی ہے؛ منسوخی پر محفوظ نہیں ہوتی۔ ہر ڈاؤن لوڈ کا آڈٹ ہوتا ہے۔ یہاں محفوظ فائل میں ترمیم، حذف یا تصدیق نہیں ہوتی۔",
      "ایف۱ مسودہ برقرار رکھ کر مدد کھولتا ہے؛ بند کرنے سے توجہ واپس آتی ہے۔ زوم ۱۰۰ تا ۲۵۰ فیصد ہے۔ اردو، کیمرہ، مکمل کردار اور انسانی جائزہ باقی ہے۔"
    ],
    faq: [
      ["What if the patient refuses a photo?", "Choose Skip photo; no reason is required and care continues. Uploading files never repeats registration, payment or admission."],
      ["Can I attach an outside result as our hospital result?", "No. Leave Outside document checked, record facility/date/title/type, upload separately and hand it over as an attachment. It is not counted as a hospital lab or imaging result."],
      ["Did a lost upload reply save the file?", "It may have. Keep the exact frozen draft and retry its original Upload action within24hours; do not start a replacement. Refresh reads only. Outside retention or after losing the key, ask IT to reconcile original records."],
      ["Who can open or attach documents?", "Only the actual document permissions enable each action. Search and profile need their own permissions. A download is an audited patient-data read, so open only when required. No stored document edit/delete is offered."],
      ["How do I change patients safely?", "Verify MRN/name first. Clear patient selection or select another hit, then confirm discarding unsent drafts. An upload in flight or with an uncertain outcome blocks switching. Resolve its original request first."]
    ],
    faqUr: [
      ["مریض تصویر نہ دے تو؟", "بلا وجہ تصویر چھوڑیں، علاج جاری رکھیں۔ اپ لوڈ سے رجسٹریشن، رقم یا داخلہ نہیں دہرایا جاتا۔"],
      ["بیرونی رپورٹ ہسپتال کا نتیجہ ہے؟", "نہیں؛ بیرونی کا نشان، ادارہ، تاریخ، عنوان اور قسم درج کریں۔ یہ الگ منسلک فائل ہے، ہسپتال کا لیب یا امیجنگ نتیجہ نہیں۔"],
      ["اپ لوڈ کا جواب گم ہو تو؟", "محفوظ ہو سکتی ہے۔ وہی مقفل مسودہ اور کلید رکھ کر ۲۴ گھنٹے میں اسی اپ لوڈ کی کوشش کریں۔ نئی فائل نہ بھیجیں؛ وقت ختم یا کلید گم ہو تو آئی ٹی سے اصل ریکارڈ چیک کرائیں۔"],
      ["فائل کون دیکھ یا منسلک کرسکتا ہے؟", "اصل الگ اجازت سے ہر عمل ملتا ہے۔ ہر ڈاؤن لوڈ آڈٹ ہوتا ہے، صرف ضرورت پر کھولیں۔ محفوظ فائل میں ترمیم یا حذف یہاں نہیں ہے۔"],
      ["مریض کیسے بدلیں؟", "نام اور ایم آر این چیک کریں؛ انتخاب صاف یا دوسرا نتیجہ چنیں، غیر ارسال مسودہ چھوڑنے کی تصدیق کریں۔ غیر یقینی اپ لوڈ پہلے حل کرنا لازم ہے۔"]
    ]
  },
  queue_management: {
    title: "Queue management",
    titleUr: "قطاروں کا انتظام",
    purpose:
      "Reception staff follow live doctor/department queues and safely defer, reactivate or cancel an eligible unpaid slip.",
    purposeUr:
      "استقبالیہ ڈاکٹر اور شعبے کی اصل قطار دیکھتا اور مجاز پرچی مؤخر، بحال یا غیر ادا منسوخ کرتا ہے۔",
    steps: [
      "Open Queue management. Refresh queues reads actual data; live events and reconnect update it without polling. All queues includes department queues, while Doctor queue reads one real doctor's calling order.",
      "Scan the physical OPD barcode then Enter/Open slip, or Open slip from a queue, Deferred slips or Awaiting approval. Verify patient, MRN, ticket, token, payment, validity and Status history before acting.",
      "Defer slip requires a factual reason and keeps the slip without refund. Reactivate slip retains its token with no new payment while valid. Cancel unpaid slip is only for an eligible unpaid, unlocked visit. Review the patient and Confirm ticket action; Close leaves the reason unsaved.",
      "Expired — new visit needs a new slip means never reactivate or charge the old token. Pending approval locks the visit. A cash-back prompt blocks other work until its separate authorized handover; follow the Cash-back guide.",
      "A lost answer blocks new work. Check latest slip/history. Only an idempotent original action may explicitly retry the same key within24 hours; deferral never replays. Close reviewed action requires your own review and asserts no success. F1 preserves the reason and restores focus; English/Urdu zoom remains100–250%.",
    ],
    stepsUr: [
      "قطاروں کا انتظام کھولیں۔ تازہ کریں اصل سرور پڑھتا ہے؛ واقعات اور دوبارہ رابطہ خود تازہ کرتے ہیں۔ تمام قطاروں میں شعبہ بھی، ڈاکٹر چننے سے اس کی اصل ترتیب آتی ہے۔",
      "اصل او پی ڈی بارکوڈ اسکین اور انٹر یا پرچی کھولیں دبائیں، یا قطار، مؤخر یا منظوری والے اندراج سے کھولیں۔ مریض، ایم آر این، نمبر، ٹوکن، ادائیگی، میعاد اور تاریخ دیکھیں۔",
      "مؤخر کرنے کی حقیقی وجہ دیں؛ پرچی رہتی، ریفنڈ نہیں۔ جائز میعاد میں بحالی اصل ٹوکن اور بغیر نئی ادائیگی ہے۔ غیر ادا غیر بند وزٹ ہی منسوخ ہو سکتا ہے۔ مریض دیکھ کر تصدیق کریں؛ بند کرنے سے وجہ غیر محفوظ رہتی ہے۔",
      "میعاد ختم پر نیا وزٹ نئی پرچی مانگتا ہے، پرانے ٹوکن کو وصولی یا بحالی نہ دیں۔ منظوری وزٹ بند کرتی ہے۔ واپسی کی لازمی اطلاع پر الگ مجاز نقد عمل مکمل کریں۔",
      "گم جواب نئے کام روکتا ہے۔ تازہ پرچی اور تاریخ دیکھیں۔ صرف اصل قابل تکرار عمل اپنی کلید سے چوبیس گھنٹے کے اندر، مؤخر کرنا دوبارہ نہیں۔ جائزے کے بعد بند کرنا کامیابی نہیں کہتا۔ ایف ون وجہ اور فوکس رکھتا ہے؛ دونوں زبانوں میں زوم سو تا ڈھائی سو فیصد ہے۔",
    ],
    faq: [
      [
        "Does reactivation charge or issue a new token?",
        "No. It reuses the original token within the server's validity window. An expired visit needs a new slip; do not register/pay again merely because a queue action lost its reply.",
      ],
      [
        "What if another terminal changes the ticket?",
        "The server can refuse the transition. Read the visible error, refresh the slip and history, and decide from current status. Your reason stays a draft; no automatic write follows a live refresh.",
      ],
      [
        "Why is a doctor queue empty?",
        "It has no entries in the actual read, or an error/loading message means the read is incomplete. A locked visit is excluded from the doctor's active queue. Check Awaiting approval; do not invent or reroute a patient.",
      ],
    ],
    faqUr: [
      [
        "بحالی نئی رقم یا ٹوکن ہے؟",
        "نہیں، سرور کی میعاد میں اصل ٹوکن رہتا ہے۔ ختم وزٹ نئی پرچی مانگتا ہے؛ گم جواب پر دوبارہ رجسٹریشن یا ادائیگی نہ کریں۔",
      ],
      [
        "دوسرے ٹرمینل نے پرچی بدلی تو؟",
        "سرور عمل مسترد کر سکتا ہے۔ خطا، تازہ پرچی اور تاریخ دیکھ کر موجودہ حالت سے فیصلہ کریں۔ وجہ مسودہ رہتی، خودکار تبدیلی نہیں ہوتی۔",
      ],
      [
        "ڈاکٹر کی قطار خالی کیوں؟",
        "اصل پڑھنے میں اندراج نہیں، یا خطا اور انتظار کا مطلب نامکمل پڑھنا ہے۔ بند وزٹ فعال ڈاکٹر قطار سے خارج ہے۔ منظوری والے دیکھیں؛ فرضی مریض یا منتقلی نہ کریں۔",
      ],
    ],
  },
  refund_waiver_credit: {
    title: "Refund / waiver / credit requests",
    titleUr: "واپسی، رعایت اور ادھار کی درخواستیں",
    purpose:
      "Authorized staff request a change on an actual visit; an eligible approver decides and any cash handover is a separate action.",
    purposeUr:
      "مجاز عملہ اصل وزٹ کی تبدیلی مانگتا، اہل منظور کنندہ فیصلہ کرتا اور نقد کی واپسی الگ عمل ہے۔",
    steps: [
      "Open Refund / waiver / credit, scan the slip, and verify patient/MRN, payment, clinical activity and pending approval. Refresh requests reads the current ticket and up to100 of your own requests without discarding the reason.",
      "Choose the permitted Request type and a factual Reason. Refund: reason code plus optional positive amount (blank requests the remaining refundable amount). Pre-consult waiver: percentage greater than0 up to100. Void unpaid slip is risk-monitored, never a way to undo payment.",
      "Only an authorized doctor can request post-consult waiver after a finalized note; the server uses the latest finalized note. It ends Waivered, not Refunded. A refund after clinical activity requires elevated approval and carries a risk flag; discuss the appropriate waiver with the doctor.",
      "Credit collects Amount paid now immediately using the selected Payment method; cash requires your own open shift. Enter an optional due date. The remaining balance waits for authorization and can become outstanding dues. Check these values in Review request before Confirm request.",
      "Pending approval freezes the visit and removes it from the doctor's queue. My requests shows actual status/decision notes; request submission is not approval or a cash handover. After a lost reply, check current slip/requests and only deliberately retry the original retained action within24 hours; never a new payment key.",
    ],
    stepsUr: [
      "واپسی، رعایت اور ادھار کھول کر اصل پرچی اسکین کریں۔ مریض، ایم آر این، ادائیگی، طبی کام اور منظوری دیکھیں۔ تازہ کریں وجہ رکھ کر پرچی اور اپنی سو تک درخواستیں پڑھتا ہے۔",
      "مجاز قسم اور حقیقی وجہ چنیں۔ ریفنڈ میں وجہ کا انتخاب اور مثبت اختیاری رقم، خالی پر باقی قابل واپسی رقم۔ پہلے معائنے کی رعایت صفر سے زیادہ سو تک۔ غیر ادا پرچی کی منسوخی نگرانی میں، ادائیگی واپس کرنے کا راستہ نہیں۔",
      "مجاز ڈاکٹر حتمی نوٹ کے بعد رعایت مانگتا، سرور تازہ حتمی نوٹ لیتا ہے۔ نتیجہ رعایت ہے، ریفنڈ نہیں۔ طبی کام کے بعد ریفنڈ بڑی منظوری اور خطرے کا نشان رکھتا؛ مناسب رعایت ڈاکٹر سے پوچھیں۔",
      "ادھار میں ابھی ادا رقم اصل طریقے سے فوراً وصول ہوتی، نقد پر اپنی کھلی شفٹ لازم۔ تاریخ اختیاری ہے۔ باقی رقم منظوری اور بعد میں بقایا بن سکتی ہے۔ جائزے میں قدریں چیک کرکے تصدیق کریں۔",
      "زیر التوا منظوری وزٹ بند اور ڈاکٹر کی قطار سے خارج کرتی ہے۔ میری درخواستیں اصل فیصلہ دکھاتی، جمع کرانا منظوری یا رقم دینا نہیں۔ گم جواب پر پرچی اور درخواستیں دیکھ کر اصل محفوظ عمل ہی جان بوجھ کر دوبارہ کریں، نئی ادائیگی کی کلید نہیں۔",
    ],
    faq: [
      [
        "Can I hand money back after submitting a refund?",
        "No. Wait for actual approval and the exact mandatory cash-back prompt. Only the authorized cashier with their own open drawer confirms a physical handover, once.",
      ],
      [
        "Why is my request action missing?",
        "Your permissions, ticket/payment state, a pending approval, cash-back or records-only service can prevent new requests. Refresh and inspect the current state; a role name alone never authorizes a change.",
      ],
      [
        "Does a failed refresh undo a submitted request?",
        "No. Saved on the server confirms its write. Refresh reads the pending ticket and own requests; never repeat a confirmed request or immediate credit collection merely to clear a read error.",
      ],
    ],
    faqUr: [
      [
        "ریفنڈ بھیج کر رقم دے سکتا ہوں؟",
        "نہیں، اصل منظوری اور لازمی عین رقم کے پیغام کا انتظار کریں۔ اپنی کھلی دراز کا مجاز کیشیئر حقیقی واپسی ایک بار تصدیق کرتا ہے۔",
      ],
      [
        "درخواست کا عمل غائب کیوں؟",
        "اجازت، پرچی اور ادائیگی کی حالت، زیر التوا منظوری، باقی واپسی یا صرف ریکارڈ خدمت نیا عمل روک سکتی ہے۔ تازہ حالت دیکھیں؛ صرف کردار کا نام اختیار نہیں۔",
      ],
      [
        "تازہ کرنے کی خطا درخواست واپس کرتی ہے؟",
        "نہیں، سرور پر محفوظ پیغام اصل تبدیلی کی تصدیق ہے۔ پرچی اور درخواستیں دوبارہ پڑھیں؛ خطا دور کرنے کو تصدیق شدہ درخواست یا فوری ادھار وصولی نہ دہرائیں۔",
      ],
    ],
  },
  cash_back_prompts: {
    title: "Mandatory cash-back",
    titleUr: "رقم کی لازمی واپسی",
    purpose:
      "Cashiers complete approved refunds/waivers using the exact server prompt and their own open drawer.",
    purposeUr:
      "کیشیئر منظور شدہ ریفنڈ اور رعایت سرور کے عین پیغام اور اپنی کھلی دراز سے مکمل کرتے ہیں۔",
    steps: [
      "Open Cash-back and scan the actual OPD slip. Staff with queue permission can also Open slip from Cash-back waiting. Verify patient/MRN/ticket before cash; list amounts are pending obligations, not completed payments.",
      "The mandatory modal shows the exact server message and amount. It stays blocking until confirmed. Use Open another window for My cash shift to manage your own drawer separately, return, then Refresh slip; no handover succeeds without the required server permission/open shift.",
      "Physically verify and hand over the exact cash before ticking I have verified the patient and handed over this exact cash amount, then Confirm cash handed back. Refund and waiver cash-back use separate actions/keys. Do not confirm a planned or refused physical handover.",
      "A lost reply must not cause another cash payment. Check latest slip, and deliberately Retry original action with the frozen original key within24 hours if appropriate. A saved write cannot be repeated because a read failed. Sign out; leave cash-back pending ends this session without claiming cash was handed over.",
      "When the actual server ticket has no prompt, No cash-back is pending for this slip is shown. F1 reads the contextual guide without dismissing an outstanding prompt. Urdu is a review draft; both themes and shared zoom remain100–250%.",
    ],
    stepsUr: [
      "رقم کی واپسی کھول کر اصل او پی ڈی پرچی اسکین کریں۔ قطار کی اجازت والا باقی واپسی سے بھی کھول سکتا ہے۔ نقد سے پہلے مریض، ایم آر این اور پرچی چیک کریں؛ فہرست کی رقم باقی ذمہ داری ہے، مکمل ادائیگی نہیں۔",
      "لازمی مکالمہ سرور کا عین پیغام اور رقم دکھاتا اور تصدیق تک کام روکتا ہے۔ دوسری ونڈو میں اپنی کیش شفٹ سنبھالیں، پھر پرچی تازہ کریں۔ اجازت اور کھلی شفٹ کے بغیر فرضی کامیابی نہیں۔",
      "اصل مریض کو عین نقد دینے کے بعد بیان کا نشان اور نقد کی تصدیق کریں۔ ریفنڈ اور رعایت کی الگ کارروائی اور کلید ہے۔ منصوبہ یا انکار شدہ نقد کو مکمل نہ کہیں۔",
      "گم جواب پر نقد دوبارہ نہ دیں۔ تازہ پرچی چیک اور مناسب ہو تو چوبیس گھنٹے میں محفوظ اصل عمل اپنی کلید سے دوبارہ کریں۔ محفوظ عمل پڑھنے کی خطا پر نہیں دہرتا۔ سائن آؤٹ باقی واپسی برقرار رکھتا، رقم دینے کا دعویٰ نہیں۔",
      "اصل سرور پر اطلاع نہ ہو تو اسی پرچی کی واپسی باقی نہیں۔ ایف ون لازم پیغام بند کیے بغیر متعلقہ مدد کھولتا ہے۔ اردو جائزے کا مسودہ اور زوم دونوں تھیم میں سو تا ڈھائی سو فیصد ہے۔",
    ],
    faq: [
      [
        "Can the approver's drawer fund my refund?",
        "No. Cash leaves the caller's own open shift at this counter. Open your own shift; a missing drawer returns SHIFT_NOT_OPEN. Ask the authorized cashier if you lack access.",
      ],
      [
        "What if the cash was already handed over but the answer was lost?",
        "Do not hand it over again. Read the slip; an explicit retry reuses the original key and confirms the original server result. Review any uncertain outcome before closing it; closing asserts no payment or reversal.",
      ],
      [
        "Does closing Help remove a cash-back prompt?",
        "No. Help returns to the same blocking handover. A prompt disappears only when a current server read shows it fulfilled; signing out leaves it outstanding for the authorized staff member.",
      ],
    ],
    faqUr: [
      [
        "منظور کنندہ کی دراز سے ریفنڈ؟",
        "نہیں، اسی کاؤنٹر پر عمل کرنے والے کی اپنی کھلی شفٹ سے نقد نکلتا ہے۔ اپنی شفٹ کھولیں؛ نہ ہو تو خطا ملتی ہے۔ اختیار نہ ہو تو مجاز کیشیئر سے کہیں۔",
      ],
      [
        "نقد دیا مگر جواب گم؟",
        "نقد دوبارہ نہ دیں۔ پرچی پڑھیں؛ اصل کلید سے جان بوجھ کر تکرار پہلی اصل تبدیلی کا جواب لیتی ہے۔ غیر یقینی کو بند کرنے سے پہلے جائزہ لیں؛ بند کرنا ادائیگی یا الٹانے کا دعویٰ نہیں۔",
      ],
      [
        "مدد بند کرنے سے اطلاع ہٹے گی؟",
        "نہیں، مدد اسی لازمی واپسی پر لوٹتی ہے۔ اصل سرور کی تازہ حالت پوری ہونے پر ہی اطلاع ختم؛ سائن آؤٹ اسے مجاز عملے کے لیے باقی رکھتا ہے۔",
      ],
    ],
  },
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
      "IT policy takes priority over a provisioning file, then this Windows user's saved choice. An IT-managed server cannot be replaced here; ask IT to correct its settings.",
      "During an outage the terminal tries its saved addresses with the same pinned certificate, then retries after 1, 2, 5, 10 and 30 seconds (continuing every 30 seconds). Keep the window open: input stays in memory and writes are blocked while offline. Reconnecting never repeats a payment or other submission; check its outcome before deliberately retrying. Closing the app loses unsaved input.",
    ],
    stepsUr: [
      "نیٹ ورک پر سرور تلاش کریں اور آئی ٹی کا بتایا ہوا ہسپتال منتخب کریں، یا اس کا HTTPS پتہ درج کریں۔",
      "سرور کی شناخت چیک کریں۔ مکمل فنگرپرنٹ کو کنٹرول سینٹر سے آئی ٹی کے فراہم کردہ فنگرپرنٹ سے ملائیں۔ مطابقت کے بعد رابطہ قائم کریں۔",
      "سرور نہ ملے تو آئی ٹی سے پتہ یا terminal.json فائل لیں۔ سرٹیفکیٹ بدلنے پر آئی ٹی سے تصدیق کرائیں۔",
      "آئی ٹی پالیسی کو ترتیب کی فائل، پھر اس ونڈوز صارف کے محفوظ انتخاب پر ترجیح ہے۔ آئی ٹی کا مقرر کردہ سرور یہاں تبدیل نہیں ہوتا؛ درست ترتیب کے لیے آئی ٹی سے رابطہ کریں۔",
      "رابطہ ٹوٹنے پر ٹرمینل اسی محفوظ سرٹیفکیٹ کے ساتھ متبادل پتے آزماتا ہے، پھر 1، 2، 5، 10 اور 30 سیکنڈ بعد اور اس کے بعد ہر 30 سیکنڈ کوشش کرتا ہے۔ ونڈو کھلی رکھیں؛ اندراج میموری میں رہتا اور محفوظ کرنا رکتا ہے۔ رابطہ بحال ہونے سے ادائیگی یا ارسال خود نہیں دہرایا جاتا؛ نتیجہ چیک کرکے دوبارہ کوشش کریں۔ ایپ بند کرنے سے غیر محفوظ اندراج ضائع ہوتا ہے۔",
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
      [
        "The connection failed while I was saving. Should I save again?",
        "Wait for reconnection and check the record or the screen's recovery instructions. The server may have saved it before the reply was lost. Never start a replacement payment or registration just to fix a connection error.",
      ],
      [
        "Why can I not replace an IT-managed server?",
        "Policy and provisioning keep shared terminals at the correct hospital. Ask IT to update the policy or terminal.json. Discovery only suggests addresses and never changes the pinned identity.",
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
      [
        "محفوظ کرتے وقت رابطہ ٹوٹا، کیا دوبارہ محفوظ کروں؟",
        "رابطہ بحال ہونے دیں، پھر ریکارڈ یا صفحے کی بحالی کی ہدایات دیکھیں۔ جواب کھونے سے پہلے سرور محفوظ کر چکا ہو سکتا ہے۔ رابطے کی خطا کے لیے نئی ادائیگی یا رجسٹریشن نہ شروع کریں۔",
      ],
      [
        "آئی ٹی کا مقرر کردہ سرور کیوں نہیں بدل سکتا؟",
        "پالیسی اور ترتیب مشترکہ ٹرمینل کو درست ہسپتال سے جوڑتے ہیں۔ آئی ٹی سے پالیسی یا terminal.json درست کروائیں۔ تلاش صرف پتے بتاتی ہے، محفوظ شناخت نہیں بدلتی۔",
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
      "Facility profile and services opens a separate administrator screen. System (IT) opens the server-permitted user/access, hardware, health, maintenance and emergency panels. Review target and values before any change. See the detailed system instructions below for Owner requests, once-only credentials and uncertain replies.",
    ],
    stepsUr: [
      "ترتیبات کھولیں یا Ctrl/Cmd comma دبائیں۔ حصے آپ کی سرور اجازت کے مطابق ہیں۔",
      "زبان، تھیم، سائز اور الگ یا مشترک PDF منتخب کریں۔ سائن اِن کے بعد ذاتی ترتیبات اکاؤنٹ میں محفوظ ہوتی ہیں؛ پہلے صرف اس ٹرمینل میں۔",
      "پاس ورڈ بدلنے کے لیے موجودہ اور یکساں نئے اندراج درکار ہیں۔ کوشش کے بعد پاس ورڈ صاف ہو جاتے ہیں۔",
      "سرور رابطہ میں صحت، پتے اور لائسنس چیک ہوتے ہیں۔ ٹرمینل میں مقام اور پرنٹر کی معلومات ہیں۔",
      "پالیسی منتخب کریں، قدر کی قسم برقرار رکھیں، وجہ لکھیں اور محفوظ کریں۔ Applied محفوظ ہے؛ Pending مالک کی منظوری کا منتظر ہے۔",
      "پروفائل اور خدمات منتظم کا الگ صفحہ ہے۔ نظام (آئی ٹی) میں سرور کی مجاز صارف، رسائی، آلات، صحت، دیکھ بھال اور ہنگامی ترتیب کھلتی ہے۔ تبدیلی سے پہلے ہدف اور کوائف دیکھیں۔ نیچے مالک کی درخواست، ایک بار کے کوائف اور غیر یقینی جواب کی مفصل ہدایات ہیں۔",
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
      "Open Notifications. Refresh inbox reads the latest first page and total unread count. Use Unread only to narrow the list; Load older notifications appends earlier records.",
      "Read the title, message, severity and time. Mark as read affects your inbox only.",
      "Mark all as read asks you to confirm every current notification in your account, including older and filtered-out items. Go back changes nothing; Confirm mark all as read saves once.",
      "Read status saved confirms the change even if its following refresh fails. If the result is uncertain, refresh successfully before deciding on another action; nothing is retried automatically and newer notifications may still be unread.",
      "Open related item navigates only to supported local screens; a destination outside this build is explained. Critical notices remain until you dismiss them.",
    ],
    stepsUr: [
      "اطلاعات کھولیں۔ اطلاعات تازہ کریں پہلا صفحہ اور کل غیر پڑھا عدد پڑھتا ہے۔ صرف غیر پڑھی سے فہرست محدود اور پرانی اطلاعات سے پہلے اندراجات شامل کریں۔",
      "عنوان، پیغام، شدت اور وقت پڑھیں۔ پڑھا ہوا نشان صرف آپ کے ان باکس پر اثر کرتا ہے۔",
      "سب کو پڑھا ہوا نشان لگانے سے اکاؤنٹ کی تمام موجودہ، پرانی اور فلٹر سے باہر اطلاعات کی تصدیق مانگی جاتی ہے۔ واپس جائیں کچھ نہیں بدلتا؛ تصدیق ایک بار محفوظ کرتی ہے۔",
      "پڑھنے کی حالت محفوظ ہونے کا پیغام اصل تبدیلی کی تصدیق ہے، چاہے بعد میں تازہ کرنے میں خطا ہو۔ نتیجہ غیر یقینی ہو تو اگلا قدم چننے سے پہلے کامیابی سے تازہ کریں؛ خودکار تکرار نہیں ہوتی اور نئی اطلاع غیر پڑھی رہ سکتی ہے۔",
      "متعلقہ چیز کھولنے سے دستیاب مقامی صفحہ کھلتا ہے؛ اس بلڈ سے باہر منزل کی وضاحت ہوتی ہے۔ اہم اطلاع بند کرنے تک رہتی ہے۔",
    ],
    faq: [
      [
        "Does marking read approve a request?",
        "No. Open Approvals and review the request before making a decision.",
      ],
      [
        "What if a read-status request loses its answer?",
        "Use Refresh inbox and inspect the current unread status before choosing another action. Do not repeatedly mark all: a later attempt would also affect newer notices. A saved message with a refresh error means the write already succeeded.",
      ],
      [
        "Does Dismiss acknowledge a critical result?",
        "No. Dismiss closes only the local persistent notice; Open notifications retains it while you read the real message. Use the permitted clinical or approval screen for its actual required action.",
      ],
    ],
    faqUr: [
      [
        "پڑھنے کا نشان منظوری ہے؟",
        "نہیں۔ منظوریوں میں درخواست کا جائزہ لے کر فیصلہ کریں۔",
      ],
      [
        "پڑھنے کی حالت بدلنے کا جواب گم ہو تو؟",
        "اطلاعات تازہ کرکے موجودہ غیر پڑھی حالت دیکھیں، پھر اگلا قدم چنیں۔ سب کو بار بار پڑھا نشان نہ لگائیں، بعد کا عمل نئی اطلاعات کو بھی بدلتا ہے۔ محفوظ ہونے کے ساتھ تازہ کرنے کی خطا ہو تو اصل تبدیلی ہو چکی ہے۔",
      ],
      [
        "اہم اطلاع بند کرنا طبی تصدیق ہے؟",
        "نہیں۔ بند کریں صرف مقامی مستقل اطلاع ہٹاتا ہے؛ اطلاعات کھولیں اسے قائم رکھتے ہوئے اصل پیغام دکھاتا ہے۔ مطلوبہ طبی یا منظوری کا عمل اس کے مجاز صفحے پر کریں۔",
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
      "Read the server decision eligibility. Approve and Reject are shown only when can_decide is true. Reject and Cancel require a note in this UI; an allowed solo-practice self-decision also requires a note.",
      "Review the confirmation dialog. Confirm sends the decision; success shows the effects returned by the server. Another person may already have decided: reload and inspect the current state.",
      "Your own request usually awaits another approver. The server may allow a solo-practice self-decision with a note. No co-signer is entered in this queue; the server enforces type-specific separation of duties.",
    ],
    stepsUr: [
      "منتظر، منظور، مسترد یا منسوخ حالت منتخب کریں۔ میری درخواستیں آپ کے اپنے کام کی حالت دکھاتی ہیں۔",
      "درخواست کھول کر درخواست کنندہ، رقم اور تفصیل پڑھیں۔ پالیسی اور رسائی کی درخواست میں موجودہ اور مطلوبہ قدر دیکھیں۔",
      "سرور کی بتائی اہلیت دیکھیں۔ اجازت ہونے پر ہی منظور اور مسترد کے بٹن دکھتے ہیں۔ مسترد، منسوخ اور مجاز تنہا پریکٹس میں اپنے فیصلے کے لیے نوٹ لازم ہے۔",
      "تصدیق کے مکالمے کا جائزہ لیں۔ کامیابی پر سرور کے بتائے اثرات دکھتے ہیں۔ پہلے فیصلہ ہو چکا ہو تو تازہ حالت دیکھیں۔",
      "اپنی درخواست عموماً دوسرے منظوری کنندہ کی منتظر ہوتی ہے۔ سرور مخصوص تنہا پریکٹس میں نوٹ کے ساتھ اجازت دے سکتا ہے۔ اس قطار میں شریک دستخط کنندہ درج نہیں ہوتا؛ الگ ذمہ داری کے قواعد سرور نافذ کرتا ہے۔",
    ],
    faq: [
      [
        "Can I approve my own request?",
        "Ordinarily no. Only when the server returns can_decide and self_decision allowed_with_note may a solo-practice requester decide with a note. The decision is audited. Otherwise wait for another approver.",
      ],
      [
        "What if a decision response is lost?",
        "Read the request again before another action. A decision is not undone by closing the dialog.",
      ],
    ],
    faqUr: [
      [
        "کیا اپنی درخواست منظور کر سکتا ہوں؟",
        "عام طور پر نہیں۔ صرف سرور کی واضح اجازت اور تنہا پریکٹس میں نوٹ کی شرط کے ساتھ اپنی درخواست پر فیصلہ ہو سکتا ہے۔ فیصلے کا آڈٹ ہوتا ہے۔ ورنہ دوسرے منظوری کنندہ کا انتظار کریں۔",
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
        "How do I select affected staff?",
        "Search active staff by name or employee number, then select the matching badge identity. Every signed-in reporter can use this minimal lookup without access to confidential HR records.",
      ],
    ],
    faqUr: [
      [
        "دوبارہ کوشش سے نقل بنے گی؟",
        "اسی سیشن میں بالکل یکساں غیر یقینی درخواست وہی کلید استعمال کرتی ہے۔ ایپ دوبارہ کھولنے کے بعد پہلے میری رپورٹس دیکھیں۔",
      ],
      [
        "متاثرہ ملازم کیسے منتخب کروں؟",
        "نام یا ملازم نمبر سے فعال عملہ تلاش کرکے درست شناخت منتخب کریں۔ ہر لاگ ان رپورٹر خفیہ ایچ آر ریکارڈ کی اجازت کے بغیر یہ محدود تلاش استعمال کر سکتا ہے۔",
      ],
    ],
  },
  facility_profile: {
    title: "Facility profile & services",
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
      "For counter staff: verify your mapped counter, open the drawer, review its ledger and close with counted cash for the accountant.",
    purposeUr:
      "کاؤنٹر عملہ: مقررہ کاؤنٹر چیک کریں، دراز کھولیں، کھاتہ دیکھیں اور گنی ہوئی نقدی کے ساتھ اکاؤنٹنٹ کے لیے بند کریں۔",
    steps: [
      "Open Reception > My cash shift. Check Terminal cash counter, shift number and cashier. If the counter is missing or wrong, ask IT; it cannot be changed here.",
      "With no open shift, enter Opening float (a nonnegative amount) and choose Open cash shift once. Wait for the confirmed shift number. An error is not a successful opening.",
      "Use Refresh to read the current shift and drawer ledger. Check cash totals separately from non-cash collections. Times use the hospital timezone; business dates already belong to the hospital. The screen does not promise a cash-shift event.",
      "To close your shift at this counter, count cash excluding the opening float. Enter Counted cash in drawer, choose Close shift and review shift/counter/amounts. The confirmation keeps the reviewed shift, counter and amounts fixed. If a refresh changes the shift or expected cash, Go back, Refresh and review again. Go back keeps the amount without closing; Confirm & Close Shift submits once.",
      "Server-confirmed PendingCollection means the accountant must still verify the handover. Show my current shift returns from a reviewed closed shift to current server state.",
      "If an answer is uncertain, keep the window open and use Check original shift. Only an opening has Retry original opening, with its original identity/body within 24 hours. Never blindly retry closure. With your supervisor review the original shift, then Close reviewed attempt only after reconciliation.",
      "F1 from a field or confirmation opens this page without losing the draft. Closing Help restores focus. Ctrl +/−/0 and Settings share 100–250% zoom. Urdu wording and fresh-record human review remain pending.",
    ],
    stepsUr: [
      "استقبالیہ سے میری کیش شفٹ کھولیں۔ ٹرمینل کاؤنٹر، شفٹ نمبر اور کیشیئر دیکھیں۔ غلط یا غائب ترتیب آئی ٹی درست کرے، یہاں نہیں بدل سکتی۔",
      "کھلی شفٹ نہ ہو تو غیر منفی ابتدائی فلوٹ درج کرکے ایک بار کیش شفٹ کھولیں۔ سرور کے تصدیق شدہ نمبر کا انتظار کریں۔ خطا کامیابی نہیں۔",
      "تازہ کریں سے موجودہ شفٹ اور کھاتہ پڑھیں۔ نقد اور غیر نقد وصولیاں الگ دیکھیں۔ وقت ہسپتال کے ٹائم زون میں ہے اور کاروباری تاریخ پہلے سے ہسپتال کی ہے۔ خودکار نقد واقعے کی ضمانت نہیں۔",
      "اسی کاؤنٹر پر بندش کے لیے فلوٹ نکال کر نقد گنیں۔ دراز میں گنی ہوئی نقدی درج کرکے شفٹ بند کریں۔ نمبر، کاؤنٹر اور رقم دیکھیں۔ تصدیق میں شفٹ، کاؤنٹر اور رقم کا جائزہ برقرار رہتا ہے۔ شفٹ یا متوقع نقد بدل جائے تو واپس جائیں، تازہ کریں اور دوبارہ جائزہ لیں۔ واپس سے رقم رہتی ہے اور شفٹ بند نہیں ہوتی؛ تصدیق سے ایک بار ارسال ہوتا ہے۔",
      "سرور کی وصولی کے انتظار کی حالت کے بعد بھی اکاؤنٹنٹ کو حوالگی چیک کرنا ہے۔ میری موجودہ شفٹ جائزہ شدہ بند شفٹ سے موجودہ حالت پر لاتی ہے۔",
      "جواب غیر یقینی ہو تو ونڈو کھلی رکھ کر اصل شفٹ چیک کریں۔ صرف افتتاح چوبیس گھنٹے میں وہی شناخت اور مواد کے ساتھ دوبارہ ہو سکتا ہے۔ بندش اندھا دوبارہ نہ کریں۔ نگران کے ساتھ اصل شفٹ کا نتیجہ واضح کرکے جائزہ شدہ کوشش بند کریں۔",
      "خانے یا تصدیق میں F1 یہ مدد کھولتا اور مسودہ رکھتا ہے۔ مدد بند ہونے پر فوکس لوٹتا ہے۔ Ctrl +/−/0 اور ترتیب کا زوم ایک ہی سو سے ڈھائی سو فیصد ہے۔ اردو اور تازہ ریکارڈ کا انسانی جائزہ باقی ہے۔",
    ],
    faq: [
      [
        "What if my terminal has no cash counter?",
        "Opening is blocked. Ask IT to map the correct terminal counter, then Refresh. Do not choose another counter or borrow a colleague's account.",
      ],
      [
        "What do I count at closing?",
        "Count the physical cash excluding the opening float, including zero when appropriate. Compare the correct shift and counter. The accountant independently verifies later; this screen does not approve the cash drop.",
      ],
      [
        "What if opening or closing times out?",
        "Keep this window open. Check original shift only reads. Missing open-shift data is not proof the request failed. Opening retries retain the exact original key/body for 24 hours; closure must be reconciled by the original shift number and is never automatically repeated. Close reviewed attempt requires a server read and your deliberate confirmation after supervisor review.",
      ],
      [
        "Can I cancel or delete a saved shift?",
        "This screen has no delete, undo or accountant verification action. Go back cancels an unsubmitted close confirmation. A saved close is read back by its original shift number. Use the accountant's authorized workflow for verification.",
      ],
      [
        "Does the ledger refresh automatically?",
        "No cash-shift update event is promised by this contract. Use Refresh before deciding; a read failure stays visible and does not imply an empty drawer. Cash rows and non-cash totals are separate.",
      ],
    ],
    faqUr: [
      [
        "ٹرمینل کا کاؤنٹر نہ ہو تو؟",
        "افتتاح رکتا ہے۔ آئی ٹی سے درست ترتیب کروا کر تازہ کریں۔ دوسرا کاؤنٹر یا ساتھی کا اکاؤنٹ نہ لیں۔",
      ],
      [
        "بندش پر کیا گنیں؟",
        "ابتدائی فلوٹ نکال کر اصل نقد گنیں، درست صورت میں صفر بھی۔ صحیح نمبر اور کاؤنٹر ملائیں۔ اکاؤنٹنٹ بعد میں آزاد تصدیق کرتا ہے؛ یہ صفحہ کیش ڈراپ منظور نہیں کرتا۔",
      ],
      [
        "افتتاح یا بندش کا جواب نہ ملے تو؟",
        "ونڈو کھلی رکھیں۔ اصل شفٹ چیک صرف پڑھتا ہے۔ کھلی شفٹ نہ ملنا ناکامی کا ثبوت نہیں۔ افتتاح وہی شناخت اور مواد کے ساتھ چوبیس گھنٹے تک دوبارہ ہو سکتا ہے؛ بندش اصل نمبر سے واضح کریں، خودکار دوبارہ نہیں۔ نگران کے جائزے کے بعد سرور پڑھ کر کوشش بند کرنے کی تصدیق کریں۔",
      ],
      [
        "محفوظ شفٹ منسوخ یا حذف ہو سکتی ہے؟",
        "اس صفحے پر حذف، واپسی یا اکاؤنٹنٹ کی تصدیق نہیں۔ واپس غیر ارسال شدہ بندش روکتا ہے۔ محفوظ بندش اصل نمبر سے پڑھی جاتی ہے۔ تصدیق اکاؤنٹنٹ کے مجاز طریقے سے ہوگی۔",
      ],
      [
        "کیا کھاتہ خود تازہ ہوتا ہے؟",
        "معاہدہ نقد شفٹ واقعے کی ضمانت نہیں دیتا۔ فیصلے سے پہلے تازہ کریں۔ پڑھنے کی خطا خالی دراز نہیں ہے۔ نقد اندراج اور غیر نقد مجموعے الگ ہیں۔",
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
      "After a VERSION_CONFLICT or uncertain save, the draft stays open and Save is blocked. Read current record, compare it with your draft, then explicitly discard/reload and re-enter only still-needed changes. Never automatically repeat PATCH.",
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
