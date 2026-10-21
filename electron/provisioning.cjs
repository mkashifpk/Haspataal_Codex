const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

function parsePolicy(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s+(\S+)\s+REG_(?:SZ|DWORD)\s+(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  if (!values.ServerUrls) return null;
  return {
    server_urls: values.ServerUrls.split(";")
      .map((url) => url.trim())
      .filter(Boolean),
    ca_fingerprint_sha256: values.CaFingerprintSha256,
    hospital_name: values.HospitalName,
    discovery_port: values.DiscoveryPort ? Number(values.DiscoveryPort) : 47632,
    source: "policy",
  };
}
function readPolicy() {
  if (process.platform !== "win32") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    execFile(
      "reg",
      ["query", "HKLM\\SOFTWARE\\Policies\\Haspataal\\Terminal", "/reg:64"],
      { windowsHide: true },
      (error, output) => {
        // An absent key is expected. Other registry errors must not override policy.
        if (error) {
          if (
            error.code === 1 &&
            /unable to find|cannot find/i.test(error.message + output)
          )
            return resolve(null);
          return reject(
            new Error(
              "Cannot read terminal policy. Ask IT to check registry access.",
            ),
          );
        }
        resolve(parsePolicy(output));
      },
    );
  });
}
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
async function selectConfiguration({
  policy = readPolicy,
  read = readJson,
  programData = process.env.ProgramData || "C:\\ProgramData",
  savedPath,
  developmentFile,
} = {}) {
  const managed = await policy();
  if (managed) return managed;
  // In an unpackaged regression run this explicit file stands in for ProgramData.
  const file = read(
    developmentFile ||
      path.join(programData, "Haspataal Terminal", "terminal.json"),
  );
  if (file) {
    if (file.schema !== "haspataal.terminal/1")
      throw new Error("Unsupported terminal provisioning schema");
    return { ...file, source: "file" };
  }
  return savedPath ? read(savedPath) : null;
}
function serverAddresses(urls) {
  if (!Array.isArray(urls) || !urls.length)
    throw new Error("No hospital server addresses were supplied");
  return [
    ...new Set(
      urls.map((value) => {
        const url = new URL(value);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        )
          throw new Error(
            "Hospital server addresses must be HTTPS origins without a path",
          );
        return url.origin;
      }),
    ),
  ];
}
function discoveryPort(value = 47632) {
  if (!Number.isInteger(value) || value < 1 || value > 65535)
    throw new Error("Invalid terminal discovery port");
  return value;
}
module.exports = {
  parsePolicy,
  selectConfiguration,
  serverAddresses,
  discoveryPort,
};
