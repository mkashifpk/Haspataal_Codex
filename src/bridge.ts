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
export async function call<T = any>(
  action: string,
  args?: unknown,
): Promise<T> {
  if (!window.terminal)
    throw new Error(
      "Open Haspataal in the desktop terminal. A browser has no secure terminal connection.",
    );
  const r = await window.terminal.call(action, args);
  if (!r.ok) throw new ApiError(r);
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
