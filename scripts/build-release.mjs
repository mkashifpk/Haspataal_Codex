// Compile the Electron DEV branch out and stage only distributable inputs.
// npm run build:release builds the renderer in release mode first.
import fs from "node:fs";
import path from "node:path";
import { build } from "rolldown";

const destination = path.resolve("artifacts/release-terminal");
// Only this fixed, generated directory under artifacts may be replaced.
if (destination !== path.join(process.cwd(), "artifacts", "release-terminal"))
  throw new Error("Unexpected release staging path");
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(path.join(destination, "electron"), { recursive: true });
await build({
  input: "electron/main.cjs",
  platform: "node",
  external: (id) => id === "electron" || id === "ws" || id.startsWith("node:"),
  transform: { define: { __BUILD_IS_DEV__: "false" } },
  output: {
    file: path.join(destination, "electron/main.cjs"),
    format: "cjs",
    minify: true,
  },
});
fs.copyFileSync(
  "electron/preload.cjs",
  path.join(destination, "electron/preload.cjs"),
);
fs.cpSync("dist", path.join(destination, "dist"), { recursive: true });
fs.cpSync("contracts", path.join(destination, "contracts"), {
  recursive: true,
});
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
fs.writeFileSync(
  path.join(destination, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      private: true,
      main: "electron/main.cjs",
      dependencies: { ws: pkg.dependencies.ws },
    },
    null,
    2,
  ),
);

// Fail closed if a future bundler/configuration change retains DEV material.
const forbidden =
  /X-Haspataal-(?:Developer|Implementation|Review)|dev-review|Review code|Apply review code/;
function verify(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) verify(file);
    else if (
      /\.(?:c?js|html)$/.test(file) &&
      forbidden.test(fs.readFileSync(file, "utf8"))
    )
      throw new Error(`DEV review material in release output: ${file}`);
  }
}
verify(path.join(destination, "electron"));
verify(path.join(destination, "dist"));
console.log(
  "Release terminal staged and DEV review exclusion verified: " + destination,
);
