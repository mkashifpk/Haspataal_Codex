import { parse } from "@babel/parser";
import fs from "node:fs";
const found = new Set();
const files = fs
  .readdirSync("src/screens")
  .map((f) => "src/screens/" + f)
  .concat(["src/components.tsx"]);
for (const file of files) {
  if (!file.endsWith(".tsx")) continue;
  const source = fs.readFileSync(file, "utf8");
  const tree = parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  const edits = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXText") {
      const s = node.value.replace(/\s+/g, " ").trim();
      if (s && /[A-Za-z]/.test(s)) {
        found.add(s);
        edits.push({
          start: node.start,
          end: node.end,
          value: "{tr(" + JSON.stringify(s) + ")}",
        });
      }
    }
    if (
      node.type === "JSXAttribute" &&
      ["label", "hint", "placeholder", "aria-label", "title"].includes(
        node.name.name,
      ) &&
      node.value?.type === "StringLiteral"
    ) {
      const s = node.value.value;
      found.add(s);
      edits.push({
        start: node.value.start,
        end: node.value.end,
        value: "{tr(" + JSON.stringify(s) + ")}",
      });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "loc" || key === "extra") continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  visit(tree);
  if (process.argv.includes("--apply")) {
    let out = source;
    for (const e of edits.sort((a, b) => b.start - a.start))
      out = out.slice(0, e.start) + e.value + out.slice(e.end);
    if (edits.length)
      out =
        `import {tr} from '${file.includes("/screens/") ? "../" : "./"}i18n';\n` +
        out;
    fs.writeFileSync(file, out);
  }
}
console.log(JSON.stringify([...found], null, 2));
