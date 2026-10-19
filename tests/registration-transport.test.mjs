import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { request } = require("../electron/transport.cjs");
const { slipHtml } = require("../electron/opd-print.cjs");
test("patient-file transport sends multipart metadata and binary bytes without JSON encoding the file", async () => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0xff]);
  let received;
  const server = http.createServer((req, res) => {
    const parts = [];
    req.on("data", (chunk) => parts.push(chunk));
    req.on("end", () => {
      received = { headers: req.headers, body: Buffer.concat(parts) };
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: { document_id: 1 } }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await request(`http://127.0.0.1:${server.address().port}/upload`, {
      method: "POST",
      headers: { "Idempotency-Key": "one-file-action" },
      body: {
        __multipart: [
          { name: "doc_type", value: "Photo" },
          { name: "file", filename: "demo.png", type: "image/png", bytes },
        ],
      },
    });
    assert.match(
      received.headers["content-type"],
      /^multipart\/form-data; boundary=/,
    );
    assert.equal(received.headers["idempotency-key"], "one-file-action");
    assert(received.body.includes(bytes));
    assert.match(
      received.body.toString("latin1"),
      /name="doc_type"\r\n\r\nPhoto\r\n/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("OPD printing preserves server text as escaped text and isolates SVG as image data", () => {
  const html = slipHtml(
    {
      paper_width_mm: 80,
      text: 'OPD-TEST\n<script>alert("patient")</script>',
      barcode_svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      qr_svg: null,
    },
    "",
  );
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes("width:74mm"));
  assert(html.includes("data:image/svg+xml;base64,"));
  assert.throws(
    () => slipHtml({ paper_width_mm: 80, text: null }, ""),
    /did not provide/,
  );
});
