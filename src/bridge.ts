export type Reply<T = unknown> = {
  ok: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retry_after_seconds?: number;
  };
  request_id?: string;
  status?: number;
  meta?: {server_time:string};
};
declare global {
  interface Window {
    terminal: {
      call: (action: string, args?: unknown) => Promise<Reply<any>>;
      subscribe: (fn: (event: any) => void) => () => void;
    };
  }
}
export class ApiError extends Error {
  constructor(public response: Reply<any>) {
    super(response.error?.message || "Request failed");
  }
}
// Clinical date checks use the authenticated server clock, never a guessed visit time.
export async function getWithClock<T>(path:string):Promise<{data:T;now:string}> {
  if(!window.terminal)throw new Error("Open Haspataal in the desktop terminal.");
  const reply=await window.terminal.call("api",{method:"GET",path}) as Reply<T>;
  if(!reply.ok){
    if(reply.error?.code === "MAINTENANCE")window.dispatchEvent(new CustomEvent("haspataal-maintenance",{detail:reply.error.message}));
    throw new ApiError(reply);
  }
  const now=reply.meta?.server_time;
  if(!now || !/^\d{4}-\d{2}-\d{2}T/.test(now) || !Number.isFinite(Date.parse(now)))throw new Error("The server clock is unavailable. Refresh before recording a clinical time.");
  return {data:reply.data,now};
}
export async function call<T = any>(
  action: string,
  args?: unknown,
): Promise<T> {
  if (!window.terminal)
    throw new Error(
      "Open Haspataal in the desktop terminal. A browser has no secure terminal connection.",
    );
  const r = await window.terminal.call(action, args);
  if (!r.ok) {
    if (r.error?.code === "MAINTENANCE") window.dispatchEvent(new CustomEvent("haspataal-maintenance", { detail: r.error.message }));
    throw new ApiError(r);
  }
  return r.data as T;
}
const pending = new Map<string, string>();
export async function api<T = any>(
  method: string,
  path: string,
  body?: unknown,
  options?: { idempotent?: boolean; key?: string },
): Promise<T> {
  if (body instanceof FormData) {
    const parts = [];
    for (const [name, value] of body.entries()) {
      parts.push(
        typeof value === "string"
          ? { name, value }
          : {
              name,
              filename: value.name,
              type: value.type,
              bytes: new Uint8Array(await value.arrayBuffer()),
            },
      );
    }
    body = { __multipart: parts };
  }
  const signature =
    method + " " + path + " " + (options?.key || JSON.stringify(body));
  let key: string | undefined;
  if (method !== "GET") {
    key = options?.key || pending.get(signature) || crypto.randomUUID();
    pending.set(signature, key);
  }
  try {
    const data = await call<T>("api", { method, path, body, key });
    pending.delete(signature);
    return data;
  } catch (e) {
    if (
      e instanceof ApiError &&
      e.response.status &&
      e.response.status >= 400 &&
      e.response.status < 500
    )
      pending.delete(signature);
    throw e;
  }
}
export function resetRequests() {
  pending.clear();
}
