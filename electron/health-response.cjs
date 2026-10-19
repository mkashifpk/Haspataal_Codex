// A degraded health read is a documented data envelope, not an API error.
// The caller must still validate the complete response against HealthOut.
function isDegradedHealthResponse(path, status, body) {
  return (
    path === "/health" && status === 503 && body?.data?.status === "degraded"
  );
}
module.exports = { isDegradedHealthResponse };
