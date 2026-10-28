import contracts from "./refusal-contracts.json" with { type: "json" };
import stateCodes from "./refusal-state-codes.json" with { type: "json" };
export const isStateRefusal = (code: string) => stateCodes.includes(code);
export function refusalReadPath(method: string, path: string, code: string, explicit?: string): string | undefined {
  if (!isStateRefusal(code) && !["PACS_NOT_CONFIGURED", "IMAGING_STUDY_NOT_FOUND"].includes(code)) return;
  if (path.startsWith("/rosters/swaps") && ["SWAP_EXISTS", "SWAP_DUTY_STARTED", "SWAP_TRANSITION_INVALID"].includes(code)) return "/rosters/swaps";
  if (explicit) {
    if (explicit.split("?")[0] === "/rosters") {
      const query = new URLSearchParams(explicit.split("?")[1]);
      query.set("include_cancelled", "true");
      return "/rosters?" + query;
    }
    return explicit;
  }
  const parts = path.split("?")[0].split("/");
  const contract = contracts.find(c => c.method === method && c.codes.includes(code) && c.path.split("/").length === parts.length && c.path.split("/").every((p, i) => /^\{.+\}$/.test(p) || p === parts[i]));
  if (contract && path.startsWith("/opd-queues/")) return "/opd-queues/me";
  if (!contract?.read) return;
  const values: Record<string, string> = {};
  contract.path.split("/").forEach((p, i) => { if (p.startsWith("{")) values[p.slice(1, -1)] = parts[i]; });
  const read = contract.read.replace(/^GET /, "").replace(/\{([^}]+)\}/g, (_, k) => values[k] ?? "{" + k + "}");
  return read.includes("{") ? undefined : read;
}
