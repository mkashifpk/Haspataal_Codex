// DEV only. One process-wide value, independent of account, workspace and window.
// Intentionally not read from disk, environment, provisioning or test configuration.
const { validateHeaderValue } = require("node:http");
function createDevReview() {
  let code = "";
  return {
    get: () => code,
    set(value) {
      // Do not silently alter a portal code or allow HTTP header injection.
      if (typeof value !== "string")
        throw new Error("Review code must be text.");
      try {
        validateHeaderValue("X-Haspataal-Review", value);
      } catch {
        throw new Error(
          "Use the review code exactly as shown on the portal, without line breaks.",
        );
      }
      code = value;
    },
    headers: () => ({
      "X-Haspataal-Developer": "mkashif",
      "X-Haspataal-Implementation": "1",
      ...(code ? { "X-Haspataal-Review": code } : {}),
    }),
  };
}
module.exports = { createDevReview };
