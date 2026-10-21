const https = require("node:https");
const http = require("node:http");
const { X509Certificate } = require("node:crypto");

function checkedRoot(pem, fingerprint) {
  const cert = new X509Certificate(pem);
  const normalize = (x) => String(x).replace(/:/g, "").toUpperCase();
  if (!cert.ca || normalize(cert.fingerprint256) !== normalize(fingerprint))
    throw new Error(
      "This is not your hospital server. Ask IT to confirm the certificate.",
    );
  if (
    Date.now() < Date.parse(cert.validFrom) ||
    Date.now() > Date.parse(cert.validTo)
  )
    throw new Error(
      "Hospital root certificate is outside its validity period. Ask IT.",
    );
  return pem;
}
function request(
  url,
  {
    ca,
    method = "GET",
    headers = {},
    body,
    bootstrap = false,
    binary = false,
    timeoutMs = 10000,
  } = {},
) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    if (!["https:", "http:"].includes(target.protocol))
      return reject(new Error("Unsupported server protocol"));
    let contentType = "application/json";
    let data;
    if (body?.__multipart) {
      const boundary = "haspataal-" + require("node:crypto").randomUUID();
      contentType = `multipart/form-data; boundary=${boundary}`;
      const parts = [];
      for (const part of body.__multipart) {
        if (!/^[a-z_]+$/.test(part.name))
          throw new Error("Invalid upload field");
        const filename = part.filename?.replace(/[\r\n"\\]/g, "_");
        if (
          filename &&
          !["image/jpeg", "image/png", "application/pdf"].includes(part.type)
        )
          throw new Error("Only PDF, JPEG and PNG patient files are supported");
        parts.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"${filename ? `; filename="${filename}"` : ""}\r\n${filename ? `Content-Type: ${part.type}\r\n` : ""}\r\n`,
          ),
        );
        parts.push(
          filename ? Buffer.from(part.bytes) : Buffer.from(String(part.value)),
        );
        parts.push(Buffer.from("\r\n"));
      }
      parts.push(Buffer.from(`--${boundary}--\r\n`));
      data = Buffer.concat(parts);
      if (data.length > 32 * 1024 * 1024)
        throw new Error("Upload exceeds the terminal's 32 MB limit");
    } else data = body === undefined ? undefined : JSON.stringify(body);
    const req = (target.protocol === "https:" ? https : http).request(
      target,
      {
        method,
        ca,
        rejectUnauthorized: !bootstrap,
        timeout: timeoutMs,
        headers: {
          ...headers,
          ...(data
            ? {
                "Content-Type": contentType,
                "Content-Length": Buffer.byteLength(data),
              }
            : {}),
        },
      },
      (res) => {
        res.on("error", reject);
        res.on("aborted", () =>
          reject(new Error("Server reply was interrupted")),
        );
        const parts = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 32 * 1024 * 1024)
            req.destroy(new Error("Response exceeds 32 MB"));
          else parts.push(chunk);
        });
        res.on("end", () => {
          const bytes = Buffer.concat(parts),
            text = bytes.toString("utf8");
          if (binary)
            return resolve({
              status: res.statusCode,
              bytes,
              headers: res.headers,
            });
          let body;
          try {
            body = JSON.parse(text);
          } catch {
            body = text;
          }
          resolve({ status: res.statusCode, body, headers: res.headers });
        });
      },
    );
    req.on("timeout", () =>
      req.destroy(new Error("Server connection timed out")),
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}
module.exports = { request, checkedRoot };
