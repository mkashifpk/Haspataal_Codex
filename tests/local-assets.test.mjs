import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
const { assetUrl } = createRequire(import.meta.url)(
  "../electron/local-assets.cjs",
);
test("local app assets stay inside the bundled directory and terminal origin", () => {
  const root = path.resolve("dist");
  assert.match(assetUrl("app://terminal/index.html", root), /index\.html$/);
  assert.match(
    assetUrl("app://terminal/handbook/login-en.png", root),
    /handbook\/login-en\.png$/,
  );
  for (const value of [
    "https://terminal/index.html",
    "app://other/index.html",
    "app://terminal/%2e%2e%5csecret",
    "app://terminal/%00secret",
    "app://u:p@terminal/index.html",
  ])
    assert.throws(() => assetUrl(value, root));
});
