// Renewing authentication is distinct from replaying the refused operation.
// Even after renewal, replay needs the server's explicit retryable=true.
const mayReplayAfterRefresh=response=>response?.body?.error?.retryable===true;
module.exports={mayReplayAfterRefresh};
