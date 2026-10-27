import type { Bilingual } from "./foundation-help";
// Recovery guidance, not a substitute for server validation or authorization.
export const foundationErrors: Record<string, Bilingual> = {
  PATIENT_IDENTITY_REQUIRED: ["Identify the actual patient: check wristband or ask and match name with MRN/date of birth. Emergency exception needs a factual note and actual emergency. Do not begin before identity is confirmed.","اصل مریض پٹی یا نام و ایم آر این/تاریخ پوچھ کر ملائیں۔ ہنگامی استثنا کو اصل ہنگامی حالت و نوٹ۔ شناخت سے پہلے شروع نہیں۔"],
  PATIENT_IDENTITY_MISMATCH: ["STOP: this band is not this patient. Check actual person, MRN and order, then scan the correct band; do not override with a guessed ID.","رکیں: پٹی اسی مریض کی نہیں۔ اصل مریض، ایم آر این و آرڈر چیک، صحیح پٹی اسکین؛ فرضی نمبر سے نہیں بدلتے۔"],
  IMAGING_SAFETY_CHECK_REQUIRED: ["Complete the actual site/side, required pregnancy decision or contrast/PMDC doctor-present check named in the refusal. Review the same order again; do not fabricate a check or repeat the examination.","انکار میں مطلوب اصل جگہ/سمت، حمل فیصلہ یا کانٹراسٹ/موجود پی ایم ڈی سی ڈاکٹر چیک مکمل کریں۔ عین آرڈر پھر جائزہ، جانچ فرض یا معائنہ دوبارہ نہیں۔"],
  IMAGING_REPORTER_NOT_AUTHORIZED: ["Only the server-authorised PMDC radiologist holding RadiologyReporting signs this report. Ask the responsible radiologist or administrator to check privileges; never impersonate another clinician.","صرف مجاز پی ایم ڈی سی ریڈیالوجسٹ رپورٹنگ استحقاق سے مہر کرتا۔ ذمہ دار ریڈیالوجسٹ/منتظم سے اہلیت چیک؛ کسی کا روپ نہیں۔"],
  IMAGING_ORDER_STATE_INVALID: ["Refresh the actual order: only permitted stages can progress, and a final report cannot be edited or replayed. Inspect current status and reporter stamp before another reviewed action.","اصل آرڈر تازہ: صرف مجاز مرحلے، حتمی رپورٹ ترمیم/دوبارہ نہیں۔ مزید جائزہ عمل سے پہلے اصل حالت و مہر دیکھیں۔"],
  IMAGING_REPORT_NOT_READY: ["Nothing has been reported yet. Keep the actual order selected and wait for the authorised radiologist; a study link alone is not a signed report. Refresh reads only, never repeats reporting.","ابھی رپورٹ نہیں۔ عین آرڈر رکھ کر مجاز ریڈیالوجسٹ کا انتظار؛ مطالعہ ربط دستخط شدہ رپورٹ نہیں۔ تازہ صرف پڑھتا، رپورٹ دوبارہ نہیں۔"],
  imaging_order: ["Ordered/Scheduled can start or cancel; InProgress completes; Completed is reported once. Link during InProgress completes after checks; Reported/Cancelled is final. Outsourcing is a separate documented workflow. A lost reply needs original-key replay or exact-order reconciliation.","آرڈر/وقت مقرر سے شروع/منسوخ، جاری سے مکمل، مکمل سے ایک رپورٹ۔ جاری میں اصل ربط جانچ بعد مکمل، شائع/منسوخ حتمی۔ بیرونی الگ طریقہ۔ گم جواب اصل کلید یا عین آرڈر پڑھ/جائزہ۔"],
  OTC_PRESCRIPTION_REQUIRED: [
    "Prescription required. Cannot sell via OTC. This medicine must go through the authorised prescription/dispensing workflow. Do not change its name, schedule or flags to bypass the refusal; ask the prescriber or Pharmacy Admin. The refused sale is not confirmed.",
    "اس دوا کو مجاز نسخے و فراہمی طریقے سے دیں۔ ممانعت کو نام، درجہ یا نشان بدل کر نہ توڑیں؛ معالج یا فارمیسی منتظم سے کہیں۔ مسترد فروخت کی کامیابی نہیں ہوئی۔ اصل انگریزی ممانعت بعینہ دکھائی جاتی ہے۔",
  ],
  DEMO_ACCOUNT_PROTECTED: [
    "This shared DEV demo account keeps its seeded password, roles and active state for everyone. Use an individually provisioned test account for password, role and deactivation checks. Ask the backend team to restore a broken demo login; do not reset shared demo accounts or reseed the server yourself.",
    "مشترکہ ڈیو ڈیمو اکاؤنٹ کا ابتدائی پاس ورڈ، کردار اور فعال حالت سب کے لیے محفوظ ہیں۔ پاس ورڈ، کردار یا غیر فعالیت کی جانچ اپنے الگ بنائے گئے اکاؤنٹ پر کریں۔ خراب ڈیمو لاگ اِن کی بحالی بیک اینڈ ٹیم سے کرائیں؛ خود مشترکہ اکاؤنٹ ری سیٹ یا سرور دوبارہ سیڈ نہ کریں۔",
  ],
  PASSWORD_CHANGE_REQUIRED: [
    "Your temporary password must change first. Complete Current password, New password and Confirm new password, then Change password. Other work opens only after server confirmation; contact IT if the supplied current password fails.",
    "عارضی پاس ورڈ پہلے بدلنا لازم ہے۔ موجودہ، نیا اور نئے کی تصدیق درج کرکے پاس ورڈ بدلیں۔ سرور کی تصدیق کے بعد دوسرا کام کھلتا ہے؛ دیا گیا موجودہ پاس ورڈ ناکام ہو تو آئی ٹی سے رابطہ کریں۔",
  ],
  INVALID_CREDENTIALS: [
    "The username or password was refused. Check your own account name, keyboard language and caps lock; the password field is cleared. Try again deliberately after correcting it. Ask IT for account recovery; never use a colleague's login.",
    "صارف نام یا پاس ورڈ مسترد ہوا۔ اپنا نام، کی بورڈ کی زبان اور بڑے حروف کی کلید چیک کریں؛ پاس ورڈ صاف ہوتا ہے۔ درست کرکے جان بوجھ کر کوشش کریں۔ اکاؤنٹ بحالی کے لیے آئی ٹی سے رابطہ کریں؛ ساتھی کا لاگ اِن نہ لیں۔",
  ],
  ACCOUNT_LOCKED: [
    "Too many failed attempts temporarily locked this account. Wait for the displayed countdown before trying the correct credentials. Repeated clicks do not unlock it. If no countdown is available or the lock remains, contact IT.",
    "زیادہ ناکام کوششوں سے اکاؤنٹ عارضی بند ہے۔ درست معلومات آزمانے سے پہلے دکھائی گئی مدت پوری ہونے دیں۔ بار بار کلک سے نہیں کھلتا۔ مدت نہ ہو یا بندش برقرار رہے تو آئی ٹی سے رابطہ کریں۔",
  ],
  ACCOUNT_DISABLED: [
    "This account is disabled. Stop login attempts and ask the authorized hospital administrator to review access. Another person's credentials are not a permitted workaround.",
    "اکاؤنٹ غیر فعال ہے۔ کوشش روک کر مجاز ہسپتال ایڈمن سے رسائی کا جائزہ مانگیں۔ دوسرے کی معلومات استعمال کرنا درست متبادل نہیں۔",
  ],
  PASSWORD_POLICY: [
    "The server refused the new password under hospital policy. Re-enter the current password and a different matching new password; use the displayed requirements, not a guessed policy. Ask IT if the reason is unclear.",
    "سرور نے ہسپتال کی پالیسی کے تحت نیا پاس ورڈ مسترد کیا۔ موجودہ پاس ورڈ اور مختلف مگر یکساں نیا پاس ورڈ دوبارہ دیں؛ دکھائی شرائط پر عمل کریں، قیاس نہ کریں۔ وجہ واضح نہ ہو تو آئی ٹی سے پوچھیں۔",
  ],
  LICENSE_INVALID: [
    "The hospital server's licence no longer permits this login. Contact the displayed vendor/IT contact. Only the authorized Super Admin can resolve licensing; changing the clock or reinstalling the terminal does not authorize work. Follow the hospital's approved downtime procedure.",
    "ہسپتال سرور کا لائسنس یہ لاگ اِن اجازت نہیں دیتا۔ دکھائے گئے وینڈر یا آئی ٹی سے رابطہ کریں۔ صرف مجاز سپر ایڈمن مسئلہ حل کر سکتا ہے؛ گھڑی بدلنا یا دوبارہ نصب کرنا کام کی اجازت نہیں۔ منظور شدہ متبادل طریقے پر عمل کریں۔",
  ],
  TOKEN_EXPIRED: [
    "The terminal normally refreshes your session. If it returns to login, sign in again with your own account and reread the affected record before retrying a write. An expired session does not prove a submitted action failed; drafts are not automatically submitted offline.",
    "ٹرمینل عموماً سیشن تازہ کرتا ہے۔ لاگ اِن پر آئے تو اپنے اکاؤنٹ سے دوبارہ داخل ہوں اور عمل دہرانے سے پہلے ریکارڈ پڑھیں۔ سیشن ختم ہونا ارسال کی ناکامی کا ثبوت نہیں؛ مسودے آف لائن خود نہیں بھیجے جاتے۔",
  ],
  TOKEN_REVOKED: [
    "This session was revoked. All its windows return to login. Sign in again only if you are still authorized; check any outstanding action's saved record before repeating it. Ask IT if you did not request sign-out.",
    "سیشن واپس لے لیا گیا۔ اس کی تمام ونڈوز لاگ اِن پر آتی ہیں۔ اجازت برقرار ہو تو دوبارہ لاگ اِن کریں؛ باقی عمل دہرانے سے پہلے محفوظ ریکارڈ دیکھیں۔ آپ نے سائن آؤٹ نہ کیا ہو تو آئی ٹی سے پوچھیں۔",
  ],
  REFRESH_TOKEN_REUSED: [
    "The server detected reuse of a session credential and revoked that login's sessions. Sign in afresh, inspect pending work and tell IT if this recurs. Do not copy tokens or retry stored credentials manually.",
    "سرور نے سیشن کی شناخت دوبارہ استعمال ہوتے دیکھی اور متعلقہ سیشن ختم کیے۔ نئے سرے سے لاگ اِن، منتظر کام کا جائزہ اور تکرار پر آئی ٹی کو اطلاع دیں۔ ٹوکن نقل یا دستی دوبارہ استعمال نہ کریں۔",
  ],
  POLICY_CHANGE_APPROVAL_REQUIRED: [
    "This control setting needs an Owner's decision. In Hospital policy enter the requested value and Reason, then Save policy to raise the supported change request. Check Recent change requests; Pending is not applied. Hand over to an authorized Owner and reread the value after the decision.",
    "کنٹرول ترتیب مالک کا فیصلہ مانگتی ہے۔ ہسپتال پالیسی میں نئی قدر اور وجہ لکھ کر محفوظ کریں تاکہ مجاز درخواست بنے۔ حالیہ درخواستیں دیکھیں؛ منتظر کا مطلب نافذ نہیں۔ مجاز مالک کو حوالہ دیں اور فیصلے کے بعد قدر دوبارہ پڑھیں۔",
  ],
  ICD_SYSTEM_NOT_LOADED: [
    "The selected classification has no code list loaded. Ask the authorized administrator to load the hospital's licensed list through its setup workflow. This foundation does not supply substitute clinical codes; do not change the policy just to hide the refusal.",
    "منتخب درجہ بندی کی فہرست لوڈ نہیں۔ مجاز ایڈمن سے ہسپتال کی لائسنس یافتہ فہرست مقررہ ترتیب سے لوڈ کرائیں۔ بنیادی نظام متبادل طبی کوڈ نہیں گھڑتا؛ خطا چھپانے کو پالیسی نہ بدلیں۔",
  ],
  SELF_ROLE_CHANGE_FORBIDDEN: [
    "You cannot change your own roles. Ask a different authorized administrator to handle the access request. Role assignment is outside this foundation's policy-value editor; a setting change cannot grant it.",
    "اپنے کردار خود نہیں بدل سکتے۔ مختلف مجاز ایڈمن سے رسائی کی درخواست حل کرائیں۔ کردار کی تعیناتی بنیادی پالیسی قدر کے مدیر سے باہر ہے؛ ترتیب بدلنا یہ اجازت نہیں دیتا۔",
  ],
  LAST_OWNER: [
    "The last active Owner must retain that role. Another authorized Owner must exist before an allowed removal can be considered. Ask the access administrator to review; this foundation does not provide role removal.",
    "آخری فعال مالک کا کردار برقرار رہنا لازم ہے۔ مجاز ہٹانے سے پہلے دوسرا مجاز مالک موجود ہو۔ رسائی کے منتظم سے جائزہ لیں؛ یہ بنیاد کردار حذف نہیں کرتی۔",
  ],
  SELF_APPROVAL_FORBIDDEN: [
    "The server does not permit you to decide this request. Keep it pending for another authorized approver, or withdraw your own pending request with a Decision note if appropriate. Only a server-eligible solo exception can enable a noted self-decision; an own large cash drop still needs an independent decider. Do not change accounts to pretend to be another person.",
    "سرور آپ کو یہ فیصلہ کرنے نہیں دیتا۔ دوسرے مجاز فرد کے لیے منتظر رکھیں، یا مناسب ہو تو نوٹ کے ساتھ اپنی منتظر درخواست واپس لیں۔ صرف سرور کا مجاز اکیلا استثنا نوٹ کے ساتھ اپنا فیصلہ دے سکتا ہے؛ اپنا بڑا کیش ڈراپ الگ فرد مانگتا ہے۔ دوسرے شخص بننے کے لیے اکاؤنٹ نہ بدلیں۔",
  ],
  APPROVAL_ALREADY_DECIDED: [
    "Another decision already completed this request. Reopen it and check Approved, Rejected or Cancelled plus its effect before any follow-up. Do not create a duplicate request to make the old button work. Tell the requester the confirmed outcome.",
    "درخواست کا فیصلہ پہلے ہو چکا۔ دوبارہ کھول کر منظور، نامنظور یا واپس حالت اور اثر دیکھیں۔ پرانا بٹن چلانے کو نقل درخواست نہ بنائیں۔ بھیجنے والے کو مصدقہ نتیجہ بتائیں۔",
  ],
  DUAL_CONTROL_SAME_PERSON: [
    "The required independent decision cannot be supplied by the same person. Stop and hand over to a different authorized approver. The current queue has no second-credential field; do not type someone else's credentials into your note.",
    "مطلوبہ آزاد فیصلہ اسی فرد سے نہیں ہو سکتا۔ رک کر مختلف مجاز فرد کو حوالہ دیں۔ موجودہ قطار میں دوسرے پاس ورڈ کا خانہ نہیں؛ نوٹ میں دوسرے کی معلومات نہ لکھیں۔",
  ],
  INCIDENT_DETAILS_REQUIRED: [
    "Keep the draft and complete the fields required by the selected type: medication errors need stage and the linked medicine; theatre events need the operation and phase. Verify real results in the lookups, then resubmit the corrected report once.",
    "مسودہ رکھ کر قسم کے مطلوبہ خانے مکمل کریں: دوا کی غلطی میں مرحلہ اور متعلقہ دوا؛ تھیٹر میں آپریشن اور مرحلہ۔ تلاش سے اصل ریکارڈ چیک کرکے درست رپورٹ ایک بار بھیجیں۔",
  ],
  INCIDENT_SCREENING_DECIDED: [
    "This screening item is no longer eligible or was handled already. Inspect the existing incident/review before any new report; ask the Quality Officer if uncertain. Screening decisions are not offered in this foundation form; never recreate a handled screening item to bypass the refusal.",
    "اسکریننگ اندراج اہل نہیں یا پہلے حل ہوا۔ نئی رپورٹ سے پہلے موجودہ واقعہ/جائزہ دیکھیں؛ شک ہو تو کوالٹی آفیسر سے پوچھیں۔ اس بنیادی فارم میں اسکریننگ فیصلے نہیں؛ انکار ہٹانے کے لیے حل شدہ اندراج دوبارہ نہ بنائیں۔",
  ],
  INCIDENT_TYPE_INACTIVE: [
    "The hospital retired that incident type after the form loaded. Keep the factual draft, refresh the type list and select the appropriate active type. Ask Quality if none fits; do not invent a type or omit required safety information.",
    "فارم کھلنے کے بعد ہسپتال نے قسم غیر فعال کر دی۔ حقائق کا مسودہ رکھیں، فہرست تازہ کرکے مناسب فعال قسم چنیں۔ مناسب قسم نہ ہو تو کوالٹی سے پوچھیں؛ قسم گھڑیں یا ضروری معلومات نہ چھوڑیں۔",
  ],
  incident: [
    "Reported means submitted for review; UnderReview means Quality is reviewing; Analysed records completed analysis; Closed completes the review; Withdrawn records withdrawal. The reporter reads the server's state in My reports. Review, analysis and closure belong to the authorized Quality workflow; this form has no edit/delete or state-change shortcut.",
    "رپورٹ شدہ جائزے کو بھیجی، زیر جائزہ کوالٹی دیکھ رہی، تجزیہ شدہ تجزیہ مکمل، بند جائزہ مکمل، واپس شدہ واپسی ہے۔ بھیجنے والا میری رپورٹیں میں سرور کی حالت پڑھتا ہے۔ جائزہ، تجزیہ اور بندش مجاز کوالٹی کے کام ہیں؛ یہاں ترمیم، حذف یا حالت بدلنے کا مختصر راستہ نہیں۔",
  ],
  ESTABLISHMENT_CHANGE_REFUSED: [
    "The server refused the proposed change. Read the listed problems, correct the draft and Preview change again. Nothing should be assumed applied from a refusal. For an unanswered apply, inspect History and the current revision before retrying.",
    "سرور نے تجویز مسترد کی۔ مسائل پڑھ کر مسودہ درست اور نیا پیش منظر دیکھیں۔ انکار سے نافذ ہونا فرض نہ کریں۔ جواب نہ آئے تو دوبارہ کوشش سے پہلے تاریخ اور موجودہ ترمیم دیکھیں۔",
  ],
  CONFIRMATION_REQUIRED: [
    "Read each acknowledgement in Review before applying and check the ones you understand. Apply reviewed change stays disabled until all required confirmations are checked. Editing the draft invalidates the preview and its confirmations; preview again.",
    "لاگو سے پہلے ہر تصدیق پڑھ کر سمجھنے پر نشان لگائیں۔ تمام مطلوبہ تصدیقات تک بٹن بند ہے۔ مسودہ بدلنے سے پیش منظر اور تصدیقات پرانی ہوتی ہیں؛ دوبارہ پیش منظر دیکھیں۔",
  ],
  CAPABILITY_WORK_OUTSTANDING: [
    "The service still has open work. Review the outstanding counts and move to Retiring through a preview if permitted; the responsible teams finish existing work before retirement. Do not delete or fabricate completion to switch it off.",
    "خدمت میں کام باقی ہے۔ تعداد دیکھیں اور اجازت ہو تو پیش منظر سے بندش کے مرحلے میں لائیں؛ متعلقہ ٹیمیں بند ہونے سے پہلے کام مکمل کریں۔ بند کرنے کے لیے ریکارڈ حذف یا جھوٹی تکمیل نہ کریں۔",
  ],
  CAPABILITY_TRANSITION_NOT_ALLOWED: [
    "This state change is not allowed from the current server state. Reread the current state and choose a permitted transition, then preview it. An available selector value is not a promise that every transition is legal.",
    "موجودہ سرور حالت سے یہ تبدیلی جائز نہیں۔ موجودہ حالت دوبارہ پڑھ کر مجاز تبدیلی اور پیش منظر چنیں۔ انتخاب میں قدر ہونا ہر منتقلی کی اجازت نہیں۔",
  ],
  CAPABILITY_DEPENDENCY: [
    "Another service is required or still depends on this one. Read Requires and the preview's problems; coordinate with the responsible service manager, adjust the proposed services and preview again. Do not bypass the dependency locally.",
    "دوسری خدمت لازم ہے یا اس پر منحصر ہے۔ مطلوبہ خدمات اور پیش منظر کے مسائل پڑھیں؛ متعلقہ منتظم سے رابطہ کرکے تجویز درست اور نیا پیش منظر لیں۔ مقامی طور پر انحصار نہ ہٹائیں۔",
  ],
  CAPABILITY_NOT_PERMITTED: [
    "The server says the licensed profile does not permit this service. Verify the actual PHC licence and category with the authorized manager. Only a legitimate documented profile change may alter eligibility; do not choose a larger category to unlock a screen.",
    "سرور کے مطابق لائسنس کا زمرہ خدمت اجازت نہیں دیتا۔ مجاز منتظم سے اصل پی ایچ سی لائسنس اور زمرہ چیک کریں۔ صرف جائز دستاویزی تبدیلی اہلیت بدل سکتی ہے؛ صفحہ کھولنے کو بڑا زمرہ نہ چنیں۔",
  ],
  CAPABILITY_NOT_IMPLEMENTED: [
    "This service is named by the server but cannot be enabled in this release. Keep its present state and contact the backend/vendor team with the visible reference. No local mock service can make it available.",
    "سرور میں خدمت کا نام ہے مگر اس اجرا میں فعال نہیں ہو سکتی۔ حالت برقرار رکھیں اور حوالہ بیک اینڈ/وینڈر کو دیں۔ مقامی فرضی خدمت اسے دستیاب نہیں بناتی۔",
  ],
  critical_result: [
    "Open is a released critical result waiting for responsible-clinician communication. Record each actual completed conversation; Communicated still awaits the physician's separate acknowledgement and action taken. Acknowledged is the physician's final state, not a laboratory button. Priority disease health-authority notification is a separate duty: check authority_pending. Follow hospital urgent escalation procedures if nobody answers; never invent a communication, read-back or acknowledgement.",
    "کھلا جاری اہم نتیجہ ہے جس کی ذمہ دار معالج کو اطلاع باقی۔ ہر اصل مکمل گفتگو درج کریں؛ اطلاع دیا میں معالج کی الگ تسلیم اور کارروائی باقی۔ تسلیم شدہ معالج کی آخری حالت، لیب کا بٹن نہیں۔ ترجیحی بیماری کی ادارۂ صحت اطلاع الگ، بقایا دیکھیں۔ جواب نہ آئے تو ہسپتال فوری اگلی سطح طریقہ؛ اطلاع، دہرانا یا تسلیم فرض نہ کریں۔",
  ],
  CRITICAL_RESULT_ACKNOWLEDGER_INVALID: [
    "The server says this doctor may not treat this patient for acknowledgement. Keep the exact patient/result visible and hand over promptly to an authorised treating doctor. Do not guess ownership from names, change roles or fabricate an action. No acknowledgement is confirmed by this refusal.",
    "سرور کے مطابق یہ معالج اس مریض کی تسلیم کا مجاز نہیں۔ عین مریض/نتیجہ رکھ کر فوری مجاز معالج کو حوالہ دیں۔ نام سے ملکیت، کردار بدلنا یا فرضی کارروائی نہیں۔ انکار تسلیم کی تصدیق نہیں۔",
  ],
  CRITICAL_RESULT_STATE_INVALID: [
    "This critical result is final or cannot move that way. Refresh its exact detail and inspect acknowledgement author/time/action. Close the old confirmation; never edit/delete or acknowledge a final result again. For a lost reply use read-only reconciliation, never replay or assume success from a missing queue row.",
    "اہم نتیجہ حتمی یا یہ تبدیلی مجاز نہیں۔ عین تفصیل تازہ کرکے اصل تسلیم مصنف/وقت/کارروائی دیکھیں۔ پرانا جائزہ بند؛ حتمی کی ترمیم/حذف/دوبارہ تسلیم نہیں۔ گم جواب میں صرف پڑھ کر چیک، نہ دوبارہ ارسال نہ قطار غائب سے کامیابی۔",
  ],
  DIAGNOSTIC_PARTNER_INVALID: [
    "This partner is not active for the service or the server says its MOU expired. Refresh the actual partner list, check name/service/MOU period/PHC details and choose a valid partner for this service. Ask diagnostic administration to correct the agreement/setup. Never extend the period locally, invent an ID, or claim that a refused dispatch saved.",
    "شریک خدمت کے لیے فعال نہیں یا سرور کے مطابق معاہدہ ختم۔ اصل فہرست تازہ کرکے نام/خدمت/معاہدہ/پی ایچ سی دیکھیں، اس خدمت کا مجاز شریک چنیں۔ تشخیصی منتظم سے ترتیب درست۔ مقامی مدت توسیع، فرضی نمبر یا انکار پر محفوظ دعویٰ نہیں۔",
  ],
  CRITICAL_RESULT_READ_BACK_REQUIRED: [
    "Telephone or in-person communication requires the actual recipient to repeat the result back. Do that first, then tick read-back and the completed-communication statement, review and confirm once. The refusal saved no communication. Do not choose Written/Electronic merely to bypass the real means. Changing the recipient or means clears prior assertions; a lost reply requires original-key recovery, not a new record.",
    "فون یا روبرو میں اصل وصول کنندہ نتیجہ دہرائے۔ پہلے یہ عمل، پھر دہرانا اور مکمل اطلاع نشان، جائزہ اور ایک تصدیق۔ انکار پر اطلاع محفوظ نہیں۔ اصل طریقہ چھوڑ کر تحریری/برقی سے شرط نہ ٹالیں۔ وصول کنندہ/طریقہ بدلنے سے نشان صاف؛ گم جواب اصل کلید سے بحال، نیا ریکارڈ نہیں۔",
  ],
  MSDS_CATEGORY_REASON_REQUIRED: [
    "The entered category differs from the bed-count suggestion. Check the category on the actual PHC licence and complete Reason if category differs from bed suggestion, then preview again. The licence decides; do not alter bed counts to silence the warning.",
    "درج زمرہ بیڈ کی تجویز سے مختلف ہے۔ اصل پی ایچ سی لائسنس چیک کرکے اختلاف کی وجہ لکھیں، پھر نیا پیش منظر لیں۔ لائسنس فیصلہ کرتا ہے؛ تنبیہ ختم کرنے کو بیڈ کی تعداد نہ بدلیں۔",
  ],
};
