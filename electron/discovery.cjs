const dgram = require("node:dgram");
const os = require("node:os");
const { randomBytes } = require("node:crypto");
exports.discover = () =>
  new Promise((resolve) => {
    const sock = dgram.createSocket("udp4"),
      nonce = randomBytes(12).toString("hex"),
      found = new Map();
    const addresses = new Set(["255.255.255.255"]);
    for (const rows of Object.values(os.networkInterfaces()))
      for (const a of rows || []) {
        if (a.family === "IPv4" && !a.internal) {
          const ip = a.address.split(".").map(Number),
            mask = a.netmask.split(".").map(Number);
          addresses.add(ip.map((n, i) => n | (~mask[i] & 255)).join("."));
        }
      }
    sock.on("message", (raw) => {
      try {
        const r = JSON.parse(raw);
        if (
          r.protocol === "haspataal-discovery" &&
          r.v === 1 &&
          r.type === "server" &&
          r.nonce === nonce &&
          Array.isArray(r.urls)
        )
          found.set(r.server_name + "|" + r.ca_fingerprint_sha256, r);
      } catch {}
    });
    sock.on("error", () => {});
    sock.bind(0, () => {
      sock.setBroadcast(true);
      for (const a of addresses)
        sock.send(
          Buffer.from(
            JSON.stringify({
              protocol: "haspataal-discovery",
              v: 1,
              type: "discover",
              nonce,
            }),
          ),
          47632,
          a,
          () => {},
        );
    });
    setTimeout(() => {
      try {
        sock.close();
      } catch {}
      resolve([...found.values()]);
    }, 2000);
  });
