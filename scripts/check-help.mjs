import fs from "node:fs";
import assert from "node:assert/strict";
import { parse } from "@babel/parser";
import {
  controlGuides,
  foundationJourney,
  deliveredHelpScreens,
  workspaceFocus,
} from "../src/foundation-help.ts";
import { foundationErrors } from "../src/foundation-errors.ts";

export function checkHelp({
  media = true,
  read = (file) => fs.readFileSync(file, "utf8"),
} = {}) {
  const catalogue = JSON.parse(read("src/foundation-catalogue.json"));
  const taskMap = JSON.parse(read("src/foundation-task-map.json"));
  const pages = parse(read("src/help.ts"), {
    sourceType: "module",
    plugins: ["typescript"],
  })
    .program.body.find(
      (n) =>
        n.type === "ExportNamedDeclaration" &&
        n.declaration?.declarations?.some((d) => d.id.name === "help"),
    )
    .declaration.declarations.find((d) => d.id.name === "help").init.properties;
  for (const id of deliveredHelpScreens) {
    const page = pages.find((p) => p.key.name === id);
    assert(page, `Missing page ${id}`);
    if (id === "registration" && page.value.type === "Identifier" && page.value.name === "registrationHelp") {
      page.value = parse(read("src/registration-help.ts"), {sourceType:"module",plugins:["typescript"]})
        .program.body.find(n=>n.type === "ExportNamedDeclaration" && n.declaration?.declarations?.some(d=>d.id.name === "registrationHelp"))
        ?.declaration.declarations.find(d=>d.id.name === "registrationHelp")?.init;
      assert(page.value?.type === "ObjectExpression", "Missing authored registration help");
    }
    for (const key of [
      "title",
      "titleUr",
      "purpose",
      "purposeUr",
      "steps",
      "stepsUr",
      "faq",
      "faqUr",
    ]) {
      const value = page.value.properties.find(
        (p) => p.key.name === key,
      )?.value;
      assert(value, `${id}: missing ${key}`);
      assert(
        value.type === "StringLiteral"
          ? value.value.trim().length > 0
          : value.type === "ArrayExpression" && value.elements.length > 0,
        `${id}: empty ${key}`,
      );
      function nonempty(node) {
        if (node.type === "StringLiteral")
          assert(node.value.trim(), `${id}.${key} empty text`);
        else if (node.type === "ArrayExpression")
          node.elements.forEach(nonempty);
        else assert.fail(`${id}.${key} unsupported content`);
      }
      nonempty(value);
    }
    for (const [a, b] of [
      ["steps", "stepsUr"],
      ["faq", "faqUr"],
    ])
      assert.equal(
        page.value.properties.find((p) => p.key.name === a).value.elements
          .length,
        page.value.properties.find((p) => p.key.name === b).value.elements
          .length,
        `${id}: translation count ${a}`,
      );
    assert(
      catalogue.screens[id]?.taskCalls.length,
      `${id}: missing backend task inventory`,
    );
    for (const call of catalogue.screens[id].taskCalls) {
      const guide = controlGuides[taskMap[id]?.[call]];
      assert(
        guide?.screens.includes(id),
        `${id}: uncovered backend task ${call}`,
      );
    }
    const bundle = JSON.parse(read(`contracts/${id}.json`));
    for (const endpoint of bundle.endpoints)
      assert(
        taskMap[id]?.[endpoint.endpoint],
        `${id}: saved contract task missing from coverage ${endpoint.endpoint}`,
      );
    if (media)
      for (const lang of ["en", "ur"]) {
        const filename = `public/handbook/${id}-${lang}.png`;
        assert(fs.existsSync(filename), `${id}: missing ${lang} screenshot`);
        const png = fs.readFileSync(filename);
        assert.equal(
          png.subarray(0, 8).toString("hex"),
          "89504e470d0a1a0a",
          `Invalid image ${filename}`,
        );
        assert(
          png.readUInt32BE(16) >= 1000 && png.readUInt32BE(20) >= 650,
          `Unreadable example ${filename}`,
        );
      }
  }
  if (media)
    for (const lang of ["en", "ur"]) {
      const filename = `public/handbook/settings-it-${lang}.png`;
      const png = fs.readFileSync(filename);
      assert.equal(
        png.subarray(0, 8).toString("hex"),
        "89504e470d0a1a0a",
        `Invalid image ${filename}`,
      );
      assert(
        png.readUInt32BE(16) >= 1000 && png.readUInt32BE(20) >= 650,
        `Unreadable example ${filename}`,
      );
    }
  const bilingual = (pair, label) => {
    assert.equal(pair.length, 2, label);
    assert(
      pair.every((x) => typeof x === "string" && x.trim().length > 0),
      `${label}: missing bilingual content`,
    );
    assert(/[\u0600-\u06ff]/.test(pair[1]), `${label}: no Urdu text`);
  };
  for (const [id, guide] of Object.entries(controlGuides)) {
    bilingual(guide.title, id);
    bilingual(guide.body, id);
    assert(
      guide.screens.every((s) => deliveredHelpScreens.includes(s)),
      `${id}: broken screen link`,
    );
  }
  for (const seed of catalogue.faq)
    bilingual(
      foundationErrors[seed.code || seed.entity] || [],
      `Unanswered FAQ ${seed.id}`,
    );
  for (const role of catalogue.roles)
    bilingual(
      workspaceFocus[role.workspace] || [],
      `Missing role journey ${role.workspace}`,
    );
  foundationJourney.steps.forEach((p, i) => bilingual(p, `journey step ${i}`));
  bilingual(foundationJourney.recovery, "journey recovery");
  foundationJourney.glossary.forEach((p, i) => bilingual(p, `glossary ${i}`));
  const files = [
    "src/App.tsx",
    "src/components.tsx",
    "src/StaffPicker.tsx",
    "src/clinical-context.tsx",
    "src/clinical-write.tsx",
    "src/clinical-patient.tsx",
    "src/referral-record.tsx",
    ...[
      "Connection",
      "Login",
      "Settings",
      "ITConsole",
      "Notifications",
      "Approvals",
      "Incidents",
      "Facility",
      "Help",
      "CashShift",
      "QueueManagement",
      "RefundRequests",
      "CashBack",
      "TicketDesk",
      "PatientSearch",
      "Registration",
      "RegistrationActions",
      "RegistrationDocuments",
      "PatientDocuments",
      "Tariff",
      "Receivables",
      "DoctorQueue",
      "ICDPicker",
      "Consultation",
      "EPrescription",
      "LabOrdersResults",
      "ExternalReferral",
      "ReferralRegister",
      "PatientEducation",
      "PatientProgrammes",
      "HomeVisitRecord",
      "PrescriptionQueue",
      "Dispense",
      "OrderQueries",
      "OTCMode",
      "CharityOverride",
    ].map((n) => `src/screens/${n}.tsx`),
  ];
  const used = new Set(),
    inventory = [];
  for (const file of files) {
    const ast = parse(read(file), {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });
    function walk(n) {
      if (!n || typeof n !== "object") return;
      if (
        n.type === "JSXOpeningElement" &&
        ["button", "input", "select", "textarea", "a", "summary"].includes(
          n.name.name,
        )
      ) {
        const key = n.attributes.find(
          (a) => a.type === "JSXAttribute" && a.name.name === "data-help",
        )?.value?.value;
        assert(
          key && controlGuides[key],
          `${file}:${n.loc.start.line} ${n.name.name}: missing/broken control help mapping`,
        );
        used.add(key);
        inventory.push({
          file,
          line: n.loc.start.line,
          control: n.name.name,
          help: key,
        });
      }
      for (const [k, v] of Object.entries(n))
        if (!["loc", "comments"].includes(k))
          Array.isArray(v) ? v.forEach(walk) : walk(v);
    }
    walk(ast);
  }
  for (const id of Object.keys(controlGuides))
    assert(used.has(id), `Orphaned control guide ${id}`);
  // Screenshots and sections are referenceable by screen ID, never unrestricted
  // server page titles. Check the runtime permission boundary remains explicit.
  return {
    screens: deliveredHelpScreens.length,
    controls: inventory.length,
    controlGroups: used.size,
    faqSeeds: catalogue.faq.length,
    workspaceGuides: catalogue.roles.length,
    inventory,
  };
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/check-help.mjs")) {
  const r = checkHelp();
  console.log(
    `Handbook coverage passed: ${r.screens} screens, ${r.controls} controls, ${r.controlGroups} groups, ${r.faqSeeds} FAQ seeds, ${r.workspaceGuides} workspace guides.`,
  );
}
