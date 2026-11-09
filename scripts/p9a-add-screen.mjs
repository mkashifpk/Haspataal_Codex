import fs from "node:fs";

const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const {screen, component, title, purpose, guides, tasks, shared, props = ""} = input;
const directory = "docs/phase-p9a-2026-11-06/";
const contract = JSON.parse(fs.readFileSync(`contracts/${screen}.json`, "utf8"));
if (JSON.stringify(Object.keys(tasks).sort()) !== JSON.stringify(contract.endpoints.map(e=>e.endpoint).sort())) throw Error(`Task mappings differ from ${screen} contract`);
const read = path => fs.readFileSync(path, "utf8");
const edit = (path, change) => fs.writeFileSync(path,change(read(path)));
const json = (path, change) => {const value = JSON.parse(read(path));change(value);fs.writeFileSync(path, JSON.stringify(value,null,2)+"\n");};
const sharedGuides = {
  "p9.help": [["Contextual help","مقامی مدد"],["Open Help or press F1 from the current control. Close it to resume the task. Use Settings or keyboard shortcuts for the shared 100–250% zoom.","مدد یا موجودہ خانے سے ایف ون۔ بند کر کے کام جاری۔ ترتیبات یا کی بورڈ سے مشترک سو تا ڈھائی سو فیصد زوم۔"]],
  "p9.period": [["Period dates","مدت کی تاریخیں"],["Choose the start and end dates and select Read period. The register shows the selected period and an empty result when no records match. Correct the dates or retry a failed read.","شروع اور آخر کی تاریخ چنیں اور مدت پڑھیں۔ رجسٹر منتخب مدت دکھاتا ہے۔ نتیجہ خالی ہو تو اس مدت میں ریکارڈ نہیں۔ تاریخ درست یا ناکام پڑھائی دوبارہ کریں۔"]],
  "p9.page": [["Register pages","رجسٹر کے صفحات"],["Older records continues from the last server record. Newest records returns to the first page with the same filters.","پرانے ریکارڈ آخری سرور ریکارڈ سے جاری۔ تازہ ریکارڈ انہی فلٹر کے پہلے صفحے پر۔"]],
};
let source = read("src/foundation-help.ts");
if (source.includes(`  "${screen}",`)) throw Error(`Screen already registered: ${screen}`);
source = source.replace("export const deliveredHelpScreens = [",`export const deliveredHelpScreens = [\n  "${screen}",`);
const additions = [];
for (const key of shared ?? []) {
  const marker = `  "${key}": g([`;
  if (source.includes(marker)) source = source.replace(marker,`${marker}"${screen}",`);
  else if (sharedGuides[key]) additions.push([key,sharedGuides[key]]);
  else throw Error(`Unknown shared guide ${key}`);
}
additions.push(...Object.entries(guides));
source = source.replace('  "fb.help":',additions.map(([key,[title,body]])=>`  ${JSON.stringify(key)}: g(["${screen}"],${JSON.stringify(title)},${JSON.stringify(body)}),\n`).join("")+'  "fb.help":');
fs.writeFileSync("src/foundation-help.ts",source);
const page = {
  title:title[0],titleUr:title[1],purpose:purpose[0],purposeUr:purpose[1],
  steps:[...Object.values(guides).map(([label,body])=>`${label[0]}. ${body[0]}`),sharedGuides["p9.help"][1][0]],
  stepsUr:[...Object.values(guides).map(([label,body])=>`${label[1]}۔ ${body[1]}`),sharedGuides["p9.help"][1][1]],
  faq:Object.values(guides).map(([label,body])=>[label[0],body[0]]),
  faqUr:Object.values(guides).map(([label,body])=>[label[1],body[1]]),
};
edit("src/help.ts",s=>s.replace("export const help: Record<string, HelpPage> = {",`export const help: Record<string, HelpPage> = {\n  ${screen}: {\n${Object.entries(page).map(([key,value])=>`    ${key}: ${JSON.stringify(value)},`).join("\n")}\n  },`));
json("src/foundation-catalogue.json",j=>{j.screens[screen]={taskCalls:Object.keys(tasks)};});
json("src/foundation-task-map.json",j=>{j[screen]=tasks;});
edit("src/App.tsx",s=>{
  const marker = s.split("\n").find(line=>line.includes("screen==='patient_feedback'&&"));
  if (!marker) throw Error("Missing P9A screen mount marker");
  return `import { ${component} } from "./screens/${component}";\n`+s.replace(marker,marker+"\n"+marker.replace("screen==='patient_feedback'",`screen==='${screen}'`).replace("<PatientFeedback",`<${component}${props?` ${props}`:""}`));
});
edit("scripts/check-help.mjs",s=>{
  const names = [component,...(input.additionalComponents??[])].filter(n=>!s.includes(`      "${n}",`));
  return s.replace('      "PatientFeedback",','      "PatientFeedback",\n'+names.map(name=>`      "${name}",`).join("\n"));
});
edit("tests/help-coverage.test.mjs",s=>s.replace(/assert\.equal\(result\.screens, (\d+)\);/,(_,n)=>`assert.equal(result.screens, ${Number(n)+1});`));
