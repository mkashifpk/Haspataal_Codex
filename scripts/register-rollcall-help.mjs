import fs from "node:fs";
import assert from "node:assert/strict";
const steps = [
  [
    "Open Head Nurse → Roll call. Today and running night shift reads today's duties plus yesterday's still-running night shift. Read a roster date → Open date reads that day only. Refresh sheet rereads real arrivals; no polling. Ward filter, Shift filter and Find rostered staff only narrow this sheet.",
    "ہیڈ نرس سے حاضری کی فہرست کھولیں۔ آج اور جاری رات کی شفٹ آج کے ساتھ گزشتہ رات کی جاری ڈیوٹی لاتا ہے۔ روسٹر تاریخ پڑھیں و تاریخ کھولیں صرف وہ دن۔ فہرست تازہ کریں اصل آمد دوبارہ پڑھتا ہے؛ پولنگ نہیں۔ وارڈ، شفٹ و عملہ تلاش صرف فہرست محدود کرتے ہیں۔",
  ],
  [
    "Duty date to record chooses ONE actual start date. Overnight duties keep their own date, even after midnight. Changing the read or duty date asks before discarding an unsent selection. Filters preserve selected hidden rows; review lists them all.",
    "اندراج کی ڈیوٹی تاریخ ایک اصل آغاز کی تاریخ چنتی ہے۔ رات کی ڈیوٹی نصف شب کے بعد بھی اپنی ابتدا کی تاریخ رکھتی۔ تاریخ بدلنے پر غیر ارسال انتخاب ختم کرنے سے پہلے سوال۔ فلٹر چھپا انتخاب رکھتے؛ جائزے میں سب دکھیں۔",
  ],
  [
    "Check staff name, employee number, designation, shift, ward/department and zone. Present ticks only people actually seen arriving. Already arrived displays the server's first time and Badge, Roll call or HR correction source; it cannot be ticked again. Closed earlier shifts require HR; future duties are unavailable.",
    "نام، ملازم نمبر، عہدہ، شفٹ، وارڈ/شعبہ و زون چیک کریں۔ حاضر صرف واقعی پہنچے افراد۔ آمد درج ہے سرور کا پہلا وقت و بیج، حاضری یا ایچ آر تصحیح دکھاتا؛ دوبارہ نشان نہیں۔ بند پچھلی شفٹ ایچ آر کے لیے؛ آئندہ ڈیوٹی دستیاب نہیں۔",
  ],
  [
    "For each selected person enter Actual arrival time in the displayed hospital timezone, including date. Use the true late-arrival time, not the shift's start. It must fall within that shift; an overnight duty ends next day. This screen requests an explicit actual time for every arrival and refuses future arrival times.",
    "ہر منتخب فرد کا آمد کا اصل وقت دکھائے ہسپتال کے وقت میں تاریخ سمیت درج کریں۔ دیر سے آنے کا اصل وقت، شفٹ کی ابتدا نہیں۔ اسی شفٹ کے اندر؛ رات کی ڈیوٹی اگلے دن ختم۔ یہاں ہر آمد کا واضح اصل وقت لازم، آئندہ آمد منع۔",
  ],
  [
    "Review arrivals freezes the people, duty date and actual times. Check every row, tick I checked these people, duty dates and actual arrival times, then Confirm arrivals once. Closing the review preserves the unsent form. Clear unsent selection discards only the draft after confirmation. Before saving the screen checks the live duty version and existing arrivals again.",
    "آمد کا جائزہ فرد، ڈیوٹی تاریخ و اصل وقت منجمد کرتا۔ سب دیکھ کر چیک کا نشان، پھر آمد کی تصدیق ایک بار۔ جائزہ بند کرنے سے مسودہ رہتا۔ غیر ارسال انتخاب ختم صرف تصدیق سے مسودہ نکالتا۔ محفوظ کرنے سے پہلے اصل ڈیوٹی نسخہ اور آمد دوبارہ چیک۔",
  ],
  [
    "Server-confirmed arrivals shows actual attendance record numbers, times and sources, plus Skipped reasons for those already punched in. This is an append-only attendance record; no edit, delete or undo is offered. Ask HR for a justified correction. HR receives attendance flags; this screen prints nothing and needs no scanner.",
    "سرور سے تصدیق شدہ آمد اصل حاضری نمبر، وقت و ذریعہ اور پہلے درج کے چھوڑنے کی وجہ دکھاتی۔ ریکارڈ مستقل؛ ترمیم، حذف یا واپس نہیں۔ درست وجہ والی تصحیح ایچ آر سے۔ ایچ آر کو حاضری جانچ؛ یہاں پرنٹ/اسکینر نہیں۔",
  ],
  [
    "A changed duty or concurrent arrival stops a stale confirmation: close it, Refresh sheet, compare and select again. ROLL_CALL_NOT_ROSTERED, ROSTER_DATE_CLOSED, ROSTER_OUT_OF_SCOPE and VALIDATION_ERROR show the exact server error and reference; correct the date/scope/time or ask HR. Loading, failed reads and reconnecting disable saving; roster.changed and reconnect resync refresh without erasing your selection.",
    "بدلی ڈیوٹی یا ساتھ درج آمد پر پرانی تصدیق رکے؛ بند، تازہ، موازنہ و دوبارہ انتخاب۔ روسٹر نہیں، تاریخ بند، دائرے سے باہر یا غلط وقت میں اصل سرور خرابی/حوالہ؛ تاریخ، دائرہ یا وقت درست یا ایچ آر۔ لوڈ، ناکام مطالعہ و دوبارہ رابطہ میں محفوظ بند؛ واقعہ و دوبارہ رابطہ انتخاب مٹائے بغیر تازہ۔",
  ],
  [
    "A lost reply locks the original request and navigation. Retry original request explicitly reuses exactly the same key/body within 24 hours; never submit replacement attendance. Read original duty date is inspection only and cannot unlock a replacement: a first arrival alone does not prove the original write. Outside retention ask HR/IT. F1 works from fields/dialogs and restores focus; shared Settings/keyboard zoom is100–250%. Urdu wording awaits a named language review.",
    "گم جواب اصل درخواست و جگہ بدلنا مقفل کرتا۔ اصل درخواست کی دوبارہ کوشش24گھنٹے میں عین کلید/مواد، متبادل حاضری نہیں۔ اصل ڈیوٹی تاریخ پڑھیں صرف جائزہ، متبادل نہیں کھولتا؛ پہلی آمد اصل ارسال کا ثبوت نہیں۔ مدت بعد ایچ آر/آئی ٹی۔ ایف1 خانے/مکالمے میں، فوکس واپس؛ مشترک ترتیبات/کی بورڈ زوم100–250٪۔ اردو نامزد جائزے تک مسودہ۔",
  ],
];
const faqs = [
  [
    "How do I record a late arrival?",
    "Tick the actual person, enter the true date/time within their shift in the hospital timezone, review and confirm once. Do not use the shift start to hide lateness. HR's flag is computed by the server.",
    "دیر سے آنے کی حاضری کیسے؟",
    "اصل فرد چنیں، ہسپتال کے وقت میں شفٹ کے اندر آمد کی صحیح تاریخ/وقت، جائزہ و ایک تصدیق۔ تاخیر چھپانے کو آغاز نہیں۔ سرور ایچ آر کی جانچ کرتا۔",
  ],
  [
    "Why is yesterday in today's sheet?",
    "A night shift still running after midnight belongs to yesterday. Select its own Duty date to record and send that date; confirm today's duties separately.",
    "آج کی فہرست میں کل کیوں؟",
    "نصف شب بعد جاری رات کی ڈیوٹی کل کی ہے۔ اس کی اپنی ڈیوٹی تاریخ چنیں، وہی بھیجیں؛ آج الگ تصدیق۔",
  ],
  [
    "Can I tick somebody who tapped their badge?",
    "No. Already arrived shows the first arrival and its source. Refresh if another terminal recorded it. A racing submission is authoritatively skipped or refused by the server.",
    "بیج لگانے والے کو چن سکتے؟",
    "نہیں۔ آمد درج ہے پہلا وقت و ذریعہ دکھاتا۔ دوسرے ٹرمینل پر درج ہو تو تازہ؛ ساتھ ارسال کو سرور چھوڑ یا منع کرتا۔",
  ],
  [
    "Who can record a closed earlier shift?",
    "Only HR with the server's all-roster management permission. They must enter the actual arrival within that earlier shift. Other users can read it but cannot mark attendance.",
    "بند گزشتہ شفٹ کون درج کرے؟",
    "سرور کی تمام روسٹر اجازت والا ایچ آر، گزشتہ شفٹ کا اصل اندرونی وقت لازم۔ دوسرے پڑھ سکتے، درج نہیں۔",
  ],
  [
    "Can I fix or remove a punch here?",
    "No. Ask HR for an audited correction with its reason. Clearing a selection only clears an unsent draft; it never reverses recorded attendance.",
    "حاضری درست یا ہٹا سکتے؟",
    "نہیں۔ ایچ آر سے وجہ والی تصحیح۔ انتخاب ختم صرف غیر ارسال مسودہ، اصل حاضری واپس نہیں۔",
  ],
  [
    "What if the result is unknown?",
    "Keep the original request. Explicit original-key retry within24hours returns the same result. Read original duty date does not unlock replacement. Ask HR/IT after retention; never create a second request just because a reply was lost.",
    "نتیجہ نامعلوم ہو؟",
    "اصل درخواست رکھیں۔24گھنٹے عین اصل کوشش وہی نتیجہ۔ اصل تاریخ پڑھنا متبادل نہیں کھولتا۔ مدت بعد ایچ آر/آئی ٹی؛ گم جواب پر دوسرا ارسال نہیں۔",
  ],
  [
    "Does filtering clear selected staff?",
    "No. Selected includes hidden rows. Review lists everyone; Clear unsent selection or changing date asks before discarding. Check the entire confirmation.",
    "فلٹر انتخاب ختم کرے؟",
    "نہیں۔ چھپی سطریں بھی منتخب۔ جائزہ سب دکھائے؛ انتخاب ختم یا تاریخ بدلنا پہلے پوچھے۔ پوری تصدیق دیکھیں۔",
  ],
];
const page = {
  title: "Roll call",
  titleUr: "حاضری کی فہرست",
  purpose:
    "The Head Nurse records actual arrivals of rostered staff where no badge station is available. Verify person, duty start date and hospital time before committing permanent attendance.",
  purposeUr:
    "ہیڈ نرس بیج اسٹیشن نہ ہونے پر ڈیوٹی عملے کی اصل آمد درج کرتی ہے۔ مستقل حاضری سے پہلے فرد، ڈیوٹی ابتدا و ہسپتال کا وقت چیک۔ اردو مسودہ ہے۔",
  steps: steps.map((x) => x[0]),
  stepsUr: steps.map((x) => x[1]),
  faq: faqs.map((x) => x.slice(0, 2)),
  faqUr: faqs.map((x) => x.slice(2)),
};
let h = fs.readFileSync("src/help.ts", "utf8");
assert(!h.includes("roll_call: {"));
h = h.replace(
  "export const help: Record<string, HelpPage> = {",
  "export const help: Record<string, HelpPage> = {\n roll_call: " +
    JSON.stringify(page, null, 2).replace(/"([A-Za-z_]\w*)":/g, "$1:") +
    ",",
);
fs.writeFileSync("src/help.ts", h);
const groups = {
  refresh: [0, "Refresh the roll-call sheet", "حاضری فہرست تازہ"],
  period: [
    0,
    "Read today's or another date's duties",
    "آج یا دوسری تاریخ پڑھیں",
  ],
  "duty-date": [
    1,
    "Keep each duty's original date",
    "ڈیوٹی کی اصل تاریخ رکھیں",
  ],
  filter: [1, "Filter without losing selected staff", "انتخاب رکھ کر فلٹر"],
  present: [2, "Mark only actual arrivals", "صرف اصل آمد چنیں"],
  arrival: [3, "Enter the true arrival time", "آمد کا صحیح وقت دیں"],
  review: [4, "Review selected arrivals", "منتخب آمد کا جائزہ"],
  clear: [4, "Discard unsent selections only", "صرف غیر ارسال انتخاب ختم"],
  confirm: [4, "Confirm permanent attendance once", "مستقل حاضری ایک تصدیق"],
  recovery: [
    7,
    "Recover the original attendance request",
    "اصل حاضری درخواست بحال",
  ],
};
h = fs
  .readFileSync("src/foundation-help.ts", "utf8")
  .replace(
    "export const deliveredHelpScreens = [",
    'export const deliveredHelpScreens = [\n "roll_call",',
  );
h = h.replace(
  "export const controlGuides: Record<string, ControlGuide> = {",
  "export const controlGuides: Record<string, ControlGuide> = {\n" +
    Object.entries(groups)
      .map(
        ([k, [i, en, ur]]) =>
          JSON.stringify("rollcall." + k) +
          ': g(["roll_call"],' +
          JSON.stringify([en, ur]) +
          "," +
          JSON.stringify(steps[i]) +
          "),",
      )
      .join("\n"),
);
// Append Roll Call to the existing complete Head Nurse guidance.
h = h.replace(/head_nurse: \[([\s\S]*?)\n\],/, (_, body) => {
  const entries = JSON.parse("[" + body + "]");
  entries[0] += " " + page.steps.join(" ");
  entries[1] += " " + page.stepsUr.join(" ");
  return "head_nurse: " + JSON.stringify(entries, null, 2) + ",";
});
fs.writeFileSync("src/foundation-help.ts", h);
const c = JSON.parse(fs.readFileSync("src/foundation-catalogue.json"));
c.screens.roll_call = {
  taskCalls: ["GET /rosters/roll-call", "POST /rosters/roll-call"],
};
fs.writeFileSync(
  "src/foundation-catalogue.json",
  JSON.stringify(c, null, 2) + "\n",
);
const m = JSON.parse(fs.readFileSync("src/foundation-task-map.json"));
m.roll_call = {
  "GET /rosters/roll-call": "rollcall.refresh",
  "POST /rosters/roll-call": "rollcall.confirm",
};
fs.writeFileSync(
  "src/foundation-task-map.json",
  JSON.stringify(m, null, 2) + "\n",
);
let a = fs
  .readFileSync("src/App.tsx", "utf8")
  .replace(
    "import { DutyRoster }",
    "import { RollCall } from './screens/RollCall';\nimport { DutyRoster }",
  )
  .replace(
    "  duty_roster: [",
    '  roll_call: ["Roll call", "حاضری کی فہرست", "☑"],\n  duty_roster: [',
  )
  .replaceAll("'duty_roster',", "'roll_call',\n  'duty_roster',")
  .replace(
    "{screen === 'duty_roster'",
    "{screen === 'roll_call' && <RollCall key={user.user_id} user={user} connected={connected} stream={stream} timeZone={meta?.hospital_timezone}/>}\n              {screen === 'duty_roster'",
  );
fs.writeFileSync("src/App.tsx", a);
let checker = fs
  .readFileSync("scripts/check-help.mjs", "utf8")
  .replace('"DutyRoster",', '"DutyRoster",\n      "RollCall",');
fs.writeFileSync("scripts/check-help.mjs", checker);
let tests = fs
  .readFileSync("tests/help-coverage.test.mjs", "utf8")
  .replace("result.screens, 49", "result.screens, 50");
tests +=
  '\ntest("Roll Call cannot ship an unmapped attendance confirmation",()=>{assert.throws(()=>checkHelp({media:false,read:file=>file==="src/screens/RollCall.tsx"?read(file).replace(\'data-help="rollcall.confirm"\',\'\'):read(file)}),/missing\\/broken control help mapping/)});\n';
fs.writeFileSync("tests/help-coverage.test.mjs", tests);
let screen = fs
  .readFileSync("src/screens/RollCall.tsx", "utf8")
  .replaceAll("<Empty text={", "<Empty>{")
  .replaceAll("}/>:", "}</Empty>:")
  .replaceAll(
    '}/>:<div className="roll-call-scroll">',
    '}</Empty>:<div className="roll-call-scroll">',
  );
fs.writeFileSync("src/screens/RollCall.tsx", screen);
fs.appendFileSync(
  "src/style.css",
  "\n.roll-call {min-width:0}.roll-call .toolbar{flex-wrap:wrap;align-items:end}.roll-call-scroll{overflow:auto;max-width:100%}.roll-call table{width:100%;min-width:640px}.roll-call td{vertical-align:top}.roll-call td:first-child{width:4rem}.roll-call td input[type=checkbox]{width:1.3rem;height:1.3rem}.roll-call td input[type=datetime-local]{max-width:100%;min-width:0}.roll-call small{display:block}.roll-call aside button{margin:.4rem}\n",
);
