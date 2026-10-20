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
export const deliveredHelpScreens = [...phase1Screens, "my_cash_shift"];
const g = (
  screens: string[],
  title: Bilingual,
  body: Bilingual,
): ControlGuide => ({ screens, title, body });
// IDs are also attached to the actual controls. The build rejects missing
// mappings and empty translations instead of treating a page as coverage.
export const controlGuides: Record<string, ControlGuide> = {
  "cash.refresh": g(
    ["my_cash_shift"],
    ["Refresh / Show my current shift", "تازہ کریں / میری موجودہ شفٹ"],
    [
      "Refresh reads the shift, its ledger and terminal counter again; it never opens or closes a drawer. Show my current shift returns from a reviewed closed shift to the current server result. Review the shift number, cashier, counter, business date, hospital time and transaction amounts. Empty collections mean no entries were returned, not a zero balance inferred after an error. There is no cash-shift event guarantee: use Refresh before decisions.",
      "تازہ کریں شفٹ، کھاتہ اور ٹرمینل کاؤنٹر دوبارہ پڑھتا ہے؛ دراز کھولتا یا بند نہیں کرتا۔ میری موجودہ شفٹ سے جائزہ شدہ بند شفٹ کے بجائے موجودہ نتیجہ دکھتا ہے۔ نمبر، کیشیئر، کاؤنٹر، کاروباری تاریخ، ہسپتال کا وقت اور رقوم چیک کریں۔ خالی کھاتہ خطا کے بعد فرضی صفر نہیں ہے۔ فیصلے سے پہلے تازہ کریں۔",
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
      "On your open shift at the mapped counter, count physical cash excluding the opening float. Enter Counted cash in drawer (zero is allowed), choose Close shift, compare shift/counter and amounts, then Confirm & Close Shift. Go back or Close dismisses confirmation without saving and keeps the amount. PendingCollection is server-confirmed closure, not accountant verification. A refused or lost close answer must be checked against the original shift; it is never blindly repeated. Another counter or missing identity blocks closing here.",
      "مقررہ کاؤنٹر کی اپنی کھلی شفٹ میں ابتدائی فلوٹ نکال کر نقد گنیں۔ دراز میں گنی ہوئی نقدی درج کریں، صفر بھی درست ہے۔ شفٹ بند کریں، نمبر، کاؤنٹر اور رقم دیکھیں پھر تصدیق کریں۔ واپس یا بند سے کچھ محفوظ نہیں ہوتا اور رقم رہتی ہے۔ وصولی کا انتظار اکاؤنٹنٹ کی تصدیق نہیں۔ انکار یا گم جواب پر اصل شفٹ چیک کریں، اندھا دوبارہ ارسال نہ کریں۔ دوسرے کاؤنٹر یا نامعلوم شناخت پر بندش رکے گی۔",
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
      "Use the sidebar or a home card to open its named task; Skip to content moves keyboard focus to the work area. The notification badge counts unread items. Navigation does not save a form. If a draft warning appears, Cancel keeps your input; accepting discards it. A running submission must finish before switching screens.",
      "فہرست یا ابتدائی کارڈ سے مطلوبہ کام کھولیں؛ مواد پر جائیں سے کی بورڈ کا فوکس کام کے حصے میں جاتا ہے۔ اطلاعات کا عدد غیر پڑھی اطلاعات ہے۔ صفحہ بدلنے سے فارم محفوظ نہیں ہوتا۔ مسودے کی تنبیہ پر منسوخ کریں سے اندراج باقی رہتا ہے؛ قبول کرنے سے ضائع ہوتا ہے۔ جاری ارسال مکمل ہونے دیں۔",
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
      "Finish or deliberately discard drafts before signing out. Pending actions block sign-out; resolve uncertain cash-shift requests while their window stays open. Unsaved drafts require confirmation before being discarded. The avatar or Sign out opens a confirmation: Keep working closes it, Sign out ends this shared terminal session, and Sign out everywhere revokes your other sessions too. All windows sharing this session return to login. Signing out never saves unfinished forms.",
      "سائن آؤٹ سے پہلے مسودہ مکمل کریں یا جان بوجھ کر چھوڑیں۔ جاری عمل پر سائن آؤٹ رکتا ہے؛ غیر یقینی کیش شفٹ اسی کھلی ونڈو میں واضح کریں۔ مسودہ ختم کرنے سے پہلے تصدیق لازم ہے۔ نام کا بٹن یا سائن آؤٹ تصدیق کھولتا ہے: کام جاری رکھیں سے بند ہوتا ہے، سائن آؤٹ سے یہ ٹرمینل سیشن ختم ہوتا ہے، ہر جگہ سائن آؤٹ سے دوسرے سیشن بھی ختم ہوتے ہیں۔ اس سیشن کی تمام ونڈوز لاگ اِن پر لوٹتی ہیں۔ نامکمل فارم محفوظ نہیں ہوتے۔",
    ],
  ),
  "shell.maintenance": g(
    ["app_shell"],
    [
      "Maintenance: Check again and Sign out",
      "دیکھ بھال: دوبارہ چیک کریں اور سائن آؤٹ",
    ],
    [
      "When maintenance interrupts work, keep unsaved input in this window and follow the hospital's downtime procedure. Check again rechecks the server; it does not switch maintenance off. Sign out opens the normal sign-out confirmation. Contact IT if the notice persists.",
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
      "Use your own hospital account: enter Username and Password, then Sign in once. The button waits during submission, a lockout countdown or loss of connection. On refusal the password is cleared; check the message before deliberately trying again. Success opens your workspace or the workspace picker. Never retry an unanswered login automatically.",
      "اپنا ہسپتال اکاؤنٹ استعمال کریں: صارف نام اور پاس ورڈ درج کرکے ایک بار سائن اِن کریں۔ ارسال، عارضی پابندی یا رابطہ نہ ہونے پر بٹن رکتا ہے۔ انکار پر پاس ورڈ صاف ہوتا ہے؛ دوبارہ کوشش سے پہلے پیغام دیکھیں۔ کامیابی پر کام کی جگہ یا انتخاب کھلتا ہے۔ جواب نہ ملنے پر خودکار بار بار لاگ اِن نہ کریں۔",
    ],
  ),
  "login.password": g(
    ["login", "settings"],
    [
      "Current password, New password, Confirm new password, Change password",
      "موجودہ پاس ورڈ، نیا پاس ورڈ، تصدیق اور پاس ورڈ بدلیں",
    ],
    [
      "For a temporary password, complete this screen before other work; otherwise open Settings → Password. Enter the current password, a new password of 8–256 characters and the same new password again. Change password submits once. A mismatch is refused locally; the server also enforces hospital policy. Fields clear after a submitted attempt; use the shown error before retrying. Do not share the new password.",
      "عارضی پاس ورڈ ہو تو دوسرے کام سے پہلے یہ صفحہ مکمل کریں؛ ورنہ ترتیبات ← پاس ورڈ کھولیں۔ موجودہ پاس ورڈ، ۸ تا ۲۵۶ حروف کا نیا پاس ورڈ اور اسی کی تصدیق درج کریں۔ پاس ورڈ بدلیں ایک بار بھیجتا ہے۔ عدم مطابقت مقامی طور پر رکتی ہے؛ سرور ہسپتال کی پالیسی بھی لاگو کرتا ہے۔ ارسال کی کوشش کے بعد خانے صاف ہوتے ہیں؛ خطا دیکھ کر دوبارہ کوشش کریں۔ نیا پاس ورڈ کسی کو نہ دیں۔",
    ],
  ),
  "settings.sections": g(
    ["settings"],
    ["Settings sections", "ترتیبات کے حصے"],
    [
      "Choose a section in the Settings sidebar. This terminal shows connection and printer/location facts; My settings changes your account; Facility is offered only with permission. Sections assigned to a later workspace explicitly say they are outside this build. Changing section warns before discarding a policy or password draft. It does not itself save anything.",
      "ترتیبات کی فہرست سے حصہ منتخب کریں۔ یہ ٹرمینل رابطے، پرنٹر اور مقام کی معلومات دکھاتا ہے؛ میری ترتیبات اکاؤنٹ بدلتی ہیں؛ ہسپتال کا حصہ اجازت سے ملتا ہے۔ بعد کے کام کی جگہ والے حصے اس تعمیر سے باہر بتائے جاتے ہیں۔ حصہ بدلنے پر پالیسی یا پاس ورڈ کا مسودہ چھوڑنے سے پہلے تنبیہ آتی ہے۔ اس سے کچھ محفوظ نہیں ہوتا۔",
    ],
  ),
  "settings.display": g(
    ["settings"],
    ["Language and Theme", "زبان اور تھیم"],
    [
      "Choose English or Urdu, or Light or Dark · high contrast. Each selection saves immediately; wait for it to finish. Before login this changes only the terminal display. After login it saves to your account and all this session's windows update. A failed save shows an error and must not be assumed applied. Urdu wording remains a draft awaiting language review.",
      "انگریزی یا اردو، یا روشن یا گہرا زیادہ تضاد والا تھیم منتخب کریں۔ ہر انتخاب فوراً محفوظ ہوتا ہے؛ مکمل ہونے دیں۔ لاگ اِن سے پہلے صرف ٹرمینل بدلتا ہے۔ بعد میں اکاؤنٹ میں محفوظ اور سیشن کی تمام ونڈوز میں ظاہر ہوتا ہے۔ ناکام محفوظ کرنے پر خطا آتی ہے؛ کامیابی فرض نہ کریں۔ اردو متن لسانی جائزے تک مسودہ ہے۔",
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
      "Read the item first, then mark that item or the whole inbox as read. The unread badge decreases after server confirmation. This acknowledges reading only: it does not decide an approval, deliver treatment or resolve an alert. Already read items have no single-item action.",
      "پہلے اطلاع پڑھیں، پھر ایک یا پوری فہرست کو پڑھا ہوا کریں۔ سرور کی تصدیق کے بعد غیر پڑھے کا عدد کم ہوتا ہے۔ یہ صرف پڑھنے کی تصدیق ہے؛ منظوری، علاج یا ہنگامی حل نہیں۔ پہلے پڑھی اطلاع میں انفرادی بٹن نہیں ہوتا۔",
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
    ["report_incident"],
    [
      "Staff member / Find staff member / Select staff member",
      "عملے کا فرد / تلاش کریں / فرد منتخب کریں",
    ],
    [
      "For Affected = Staff, type 2–80 characters of a name or badge number, select Find staff member (or Enter), then choose the verified staff result. Only badge facts are shown; HR access is not required. Editing the search clears the selected person; select again before submitting. Do not assume the first result is the intended person.",
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
    "Receptionists: check the counter and printer before front-desk work. In this foundation, read notifications, report incidents and follow My requests; another eligible person decides your requests. Cash shifts and registration have separate guides.",
    "استقبالیہ: کام سے پہلے کاؤنٹر اور پرنٹر چیک کریں۔ بنیاد میں اطلاعات، واقعات اور اپنی درخواستیں دیکھیں؛ دوسرا مجاز فرد فیصلہ کرتا ہے۔ کیش شفٹ اور رجسٹریشن الگ رہنمائی ہیں۔",
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
    "IT Super Admins: inspect connection, pinned certificate, terminal location and printers; route licence or session problems to the authorized owner/vendor. System setup sections clearly marked outside this build have no implemented editor here. Never accept a changed certificate without independent verification.",
    "آئی ٹی سپر ایڈمن: رابطہ، مقررہ سرٹیفکیٹ، ٹرمینل مقام اور پرنٹر دیکھیں؛ لائسنس یا سیشن مسئلہ مجاز مالک/وینڈر کو دیں۔ تعمیر سے باہر سسٹم حصوں کا یہاں مدیر نہیں۔ بدلا سرٹیفکیٹ آزاد تصدیق کے بغیر قبول نہ کریں۔",
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
