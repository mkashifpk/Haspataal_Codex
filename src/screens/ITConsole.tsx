import { useRef, useState } from "react";
import { api, call } from "../bridge";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { tr } from "../i18n";
import {
  canRetryWrite,
  definiteWriteRefusal,
  writeAttempt,
  type WriteAttempt,
} from "../write-attempt";
import bundle from "../it-system-contract.json";

const contract = bundle as any;
const operation = (endpoint: string) =>
  contract.endpoints.find((e: any) => e.endpoint === endpoint);
const permits = (endpoint: string, permissions: string[]) => {
  const access = operation(endpoint)?.access;
  if (!access) return false;
  const p: string[] = access.permissions;
  return access.permissions_mode === "any"
    ? p.some((x) => permissions.includes(x))
    : p.every((x) => permissions.includes(x));
};
type Action = {
  endpoint: string;
  path: string;
  label: string;
  body?: Record<string, any>;
  baseline?: any;
  list?: string;
  identity?: string;
  target?: string;
};
type Attempt = WriteAttempt<Action>;
const shape = (endpoint: string) => {
  const request = operation(endpoint)?.request_body;
  const ref = request?.content?.["application/json"]?.schema?.$ref;
  return ref
    ? contract.schemas[ref.split("/").at(-1)!]
    : { properties: {}, required: [] };
};
const fieldsOnly = (endpoint: string, value: any) =>
  Object.fromEntries(
    Object.keys(shape(endpoint).properties)
      .filter((k) => value[k] !== undefined)
      .map((k) => [k, value[k]]),
  );
const sectionReads: Record<string, string[]> = {
  users_and_access: [
    "/admin/first-owner",
    "/admin/provisioning-queue",
    "/admin/users",
    "/meta/roles",
    "/meta/permissions",
    "/admin/role-matrix",
    "/admin/login-events",
    "/admin/change-requests",
  ],
  hardware: [
    "/admin/terminals",
    "/admin/printers",
    "/admin/badge-stations",
    "/admin/departments",
  ],
  server_health: ["/admin/server-health"],
  maintenance: ["/admin/server-health"],
  kill_switch: [],
};
const names: Record<string, string> = {
  "/admin/provisioning-queue": "Staff awaiting login",
  "/admin/users": "Users",
  "/admin/login-events": "Sign-in audit",
  "/admin/role-matrix": "Roles and permissions",
  "/admin/terminals": "Terminals",
  "/admin/printers": "Printers",
  "/admin/badge-stations": "Badge stations",
  "/admin/server-health": "Server health",
  "/admin/change-requests": "Access change requests",
};

// These are Settings' server-selected system sections. The complete IT workspace
// also has independent ward/department/ICD journeys; it is not claimed here.
export function ITConsole({
  section,
  permissions,
  userId,
  revision,
}: {
  section: string;
  permissions: string[];
  userId: number;
  revision: number;
}) {
  const allowed = (endpoint: string) => permits(endpoint, permissions);
  const [searchDraft, setSearchDraft] = useState(""),
    [userSearch, setUserSearch] = useState(""),
    [activeFilter, setActiveFilter] = useState(""),
    [failuresOnly, setFailuresOnly] = useState(false);
  const r = useLoad(async () => {
    const paths = sectionReads[section].filter((path) =>
      allowed("GET " + path),
    );
    const reads = await Promise.allSettled(
      paths.map((path) =>
        api(
          "GET",
          path === "/admin/users"
            ? path +
                "?limit=100&q=" +
                encodeURIComponent(userSearch) +
                (activeFilter ? "&active=" + activeFilter : "")
            : path === "/admin/login-events"
              ? path + "?limit=200&failures_only=" + failuresOnly
              : path,
        ),
      ),
    );
    return paths.map((path, i) => {
      const read = reads[i];
      return {
        path,
        value: read.status === "fulfilled" ? read.value : undefined,
        error: read.status === "rejected" ? read.reason : undefined,
      };
    });
  }, [
    section,
    revision,
    permissions.join(","),
    userSearch,
    activeFilter,
    failuresOnly,
  ]);
  const data = (path: string): any =>
    r.data?.find((x) => x.path === path)?.value;
  const [action, setAction] = useState<Action>(),
    [error, setError] = useState<unknown>(),
    [result, setResult] = useState<any>(),
    [secret, setSecret] = useState<any>(),
    [pending, setPending] = useState<Attempt>(),
    [busy, setBusy] = useState(false),
    [confirming, setConfirming] = useState<Attempt>();
  const flight = useRef(false),
    detailGeneration = useRef(0);
  const roles = data("/meta/roles") || [],
    permissionsList = data("/meta/permissions") || [];
  const open = (a: Action) => {
    setError(undefined);
    setResult(undefined);
    setAction(a);
  };
  async function submit(attempt: Attempt) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setPending(attempt);
    setConfirming(undefined);
    try {
      const a = attempt.body,
        op = operation(a.endpoint);
      // Unversioned replacement: detect already-changed data before submitting.
      // This is not an atomic server version guarantee and is never auto-retried.
      if (a.list && a.baseline) {
        const current = (await api<any[]>("GET", a.list)).find(
          (row) => row[a.identity!] === a.baseline[a.identity!],
        );
        if (
          !current ||
          JSON.stringify(fieldsOnly(a.endpoint, current)) !==
            JSON.stringify(fieldsOnly(a.endpoint, a.baseline))
        ) {
          setPending(undefined);
          throw new Error(
            tr("This record changed. Reload it before editing again."),
          );
        }
      }
      const [method] = a.endpoint.split(" ");
      const saved = await api<any>(
        method,
        a.path,
        a.body,
        op.idempotency_key ? { key: attempt.key } : undefined,
      );
      setPending(undefined);
      setAction(undefined);
      const { temporary_password, api_key, ...safe } = saved || {};
      setResult(safe);
      if (temporary_password || api_key)
        setSecret({ ...safe, target: a.target, temporary_password, api_key });
      await r.reload(); // A failed read does not resubmit the confirmed write.
    } catch (cause) {
      setError(cause);
      if (definiteWriteRefusal(cause)) setPending(undefined);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function detail(id: number) {
    const generation = ++detailGeneration.current;
    try {
      const user = await api("GET", `/admin/users/${id}`);
      if (generation === detailGeneration.current) setResult(user);
    } catch (cause) {
      if (generation === detailGeneration.current) setError(cause);
    }
  }
  const edit = (
    endpoint: string,
    row: any,
    list: string,
    identity: string,
    label: string,
  ) =>
    open({
      endpoint,
      path: endpoint
        .split(" ")[1]
        .replace(/\{[^}]+\}/, encodeURIComponent(row[identity])),
      body: fieldsOnly(endpoint, row),
      baseline: structuredClone(row),
      list,
      identity,
      label,
      target:
        (row.location_label || row.name || row.label) + " · " + row[identity],
    });
  const button = (
    endpoint: string,
    label: string,
    fn: () => void,
    disabled = false,
  ) =>
    allowed(endpoint) && (
      <button
        data-help="settings.it.actions"
        disabled={busy || !!pending || !!secret || disabled}
        onClick={fn}
      >
        {tr(label)}
      </button>
    );
  const firstOwner = data("/admin/first-owner");
  return (
    <div data-write-pending={busy || !!pending || !!secret}>
      <h2>{tr("System (IT)")}</h2>
      <p className="muted">
        {tr(
          "Changes affect hospital access and devices. Review the selected person or device before confirming.",
        )}
      </p>
      <LoadState {...r} retry={r.reload} />
      <ErrorBox error={error} />
      {r.data
        ?.filter((x) => x.error)
        .map((x) => (
          <section key={x.path}>
            <h3>{tr(names[x.path] || "Read failed")}</h3>
            <ErrorBox error={x.error} />
          </section>
        ))}
      {firstOwner?.needed && (
        <section className="notice">
          <h3>{tr("Create the first Owner")}</h3>
          <p>{firstOwner.explanation}</p>
          {button("POST /admin/first-owner", "Create the first Owner", () =>
            open({
              endpoint: "POST /admin/first-owner",
              path: "/admin/first-owner",
              label: "Create the first Owner",
            }),
          )}
        </section>
      )}
      {section === "users_and_access" && (
        <>
          <h3>{tr("Staff awaiting login")}</h3>
          {data("/admin/provisioning-queue")?.length === 0 && (
            <Empty>
              {tr(
                "No submitted staff are awaiting a login. HR must submit the personnel file first.",
              )}
            </Empty>
          )}
          {data("/admin/provisioning-queue")?.map((employee: any) => (
            <article className="card" key={employee.employee_id}>
              <h4>
                {employee.full_name} · {employee.emp_number}
              </h4>
              <p>
                {employee.designation} · {employee.department_name}
              </p>
              {button("POST /admin/users", "Provision login", () =>
                open({
                  endpoint: "POST /admin/users",
                  path: "/admin/users",
                  label: "Provision login",
                  target: employee.full_name + " · " + employee.emp_number,
                  body: { employee_id: employee.employee_id },
                }),
              )}
            </article>
          ))}
          <h3>{tr("Users")}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setUserSearch(searchDraft);
            }}
          >
            <Field label={tr("Find user")}>
              <input
                data-help="settings.it.read"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            </Field>
            <Field label={tr("Account state")}>
              <select
                data-help="settings.it.read"
                value={activeFilter}
                disabled={busy || !!pending}
                onChange={(e) => setActiveFilter(e.target.value)}
              >
                <option value="">{tr("All")}</option>
                <option value="true">{tr("Active")}</option>
                <option value="false">{tr("Inactive")}</option>
              </select>
            </Field>
            <button data-help="settings.it.read" disabled={busy || !!pending}>
              {tr("Search users")}
            </button>
          </form>
          <p className="muted">
            {tr(
              "Up to 100 matching users are shown. Refine the search if the list is full.",
            )}
          </p>
          {data("/admin/users")?.length === 0 && (
            <Empty>{tr("No users match this search.")}</Empty>
          )}
          {data("/admin/users")?.map((user: any) => (
            <article className="card" key={user.user_id}>
              <h4>
                {user.display_name} · {user.username}
              </h4>
              <p>
                {user.roles.join(", ")} ·{" "}
                {tr(user.is_active ? "Active" : "Inactive")}
              </p>
              <div className="actions">
                {button(
                  "GET /admin/users/{user_id}",
                  "Open user",
                  () => void detail(user.user_id),
                )}
                {button(
                  "POST /admin/change-requests",
                  "Request role change",
                  () =>
                    open({
                      endpoint: "POST /admin/change-requests",
                      path: "/admin/change-requests",
                      label: "Request role change",
                      target: user.display_name + " · " + user.username,
                      body: {
                        kind: "UserRoles",
                        target_user_id: user.user_id,
                        requested_value: user.roles,
                      },
                    }),
                  user.user_id === userId,
                )}
                {button(
                  "POST /admin/users/{user_id}/active",
                  user.is_active ? "Deactivate user" : "Reactivate user",
                  () =>
                    open({
                      endpoint: "POST /admin/users/{user_id}/active",
                      path: `/admin/users/${user.user_id}/active`,
                      label: user.is_active
                        ? "Deactivate user"
                        : "Reactivate user",
                      target: user.display_name + " · " + user.username,
                      body: { active: !user.is_active },
                    }),
                  user.user_id === userId,
                )}
                {button(
                  "POST /admin/users/{user_id}/reset-password",
                  "Issue temporary password",
                  () =>
                    open({
                      endpoint: "POST /admin/users/{user_id}/reset-password",
                      path: `/admin/users/${user.user_id}/reset-password`,
                      label: "Issue temporary password",
                      target:
                        user.display_name +
                        " · " +
                        user.username +
                        " (#" +
                        user.user_id +
                        ")",
                    }),
                  user.user_id === userId,
                )}
                {button(
                  "POST /admin/users/{user_id}/revoke-sessions",
                  "End user's sessions",
                  () =>
                    open({
                      endpoint: "POST /admin/users/{user_id}/revoke-sessions",
                      path: `/admin/users/${user.user_id}/revoke-sessions`,
                      label: "End user's sessions",
                      target:
                        user.display_name +
                        " · " +
                        user.username +
                        " (#" +
                        user.user_id +
                        ")",
                    }),
                  user.user_id === userId,
                )}
              </div>
            </article>
          ))}
          <h3>{tr("Roles and permissions")}</h3>
          {data("/admin/role-matrix")?.roles.map((role: any) => (
            <details key={role.code}>
              <summary data-help="settings.it.access">{role.name}</summary>
              <p>{role.description}</p>
              <ul>
                {data("/admin/role-matrix").matrix[role.code].map(
                  (code: string) => (
                    <li key={code}>{code}</li>
                  ),
                )}
              </ul>
              {button(
                "POST /admin/change-requests",
                "Request permission change",
                () =>
                  open({
                    endpoint: "POST /admin/change-requests",
                    path: "/admin/change-requests",
                    label: "Request permission change",
                    body: {
                      kind: "RolePermissions",
                      target_role_code: role.code,
                      requested_value:
                        data("/admin/role-matrix").matrix[role.code],
                    },
                  }),
              )}
            </details>
          ))}
          <label className="check">
            <input
              data-help="settings.it.read"
              type="checkbox"
              checked={failuresOnly}
              disabled={busy || !!pending}
              onChange={(e) => setFailuresOnly(e.target.checked)}
            />
            {tr("Sign-in failures only (latest 200)")}
          </label>
          {["/admin/login-events", "/admin/change-requests"].map(
            (path) =>
              data(path) && (
                <details key={path}>
                  <summary data-help="settings.it.read">
                    {tr(names[path])}
                  </summary>
                  <Details value={data(path)} />
                </details>
              ),
          )}
        </>
      )}
      {section === "hardware" &&
        [
          {
            path: "/admin/terminals",
            name: "Terminals",
            id: "terminal_id",
            post: "POST /admin/terminals",
            put: "PUT /admin/terminals/{terminal_id}",
          },
          {
            path: "/admin/printers",
            name: "Printers",
            id: "printer_id",
            post: "POST /admin/printers",
            put: "PUT /admin/printers/{printer_id}",
          },
          {
            path: "/admin/badge-stations",
            name: "Badge stations",
            id: "station_id",
            post: "PUT /admin/badge-stations/{station_id}",
            put: "PUT /admin/badge-stations/{station_id}",
          },
        ].map((group) => (
          <section key={group.path}>
            <h3>{tr(group.name)}</h3>
            {button(group.post, "Add " + group.name.toLowerCase(), () =>
              open({
                endpoint: group.post,
                path: group.post.split(" ")[1],
                label: "Add " + group.name.toLowerCase(),
                body:
                  group.id === "station_id"
                    ? { device_type: "BarcodeScanner" }
                    : {},
              }),
            )}
            {data(group.path)?.length === 0 && (
              <Empty>{tr("No devices are registered in this list.")}</Empty>
            )}
            {data(group.path)?.map((row: any) => (
              <article className="card" key={row[group.id]}>
                <h4>
                  {row.location_label || row.name || row.label} ·{" "}
                  {row[group.id]}
                </h4>
                <Details value={row} />
                <div className="actions">
                  {button(group.put, "Edit device", () =>
                    edit(group.put, row, group.path, group.id, "Edit device"),
                  )}
                  {group.id === "station_id" &&
                    button(
                      "POST /admin/badge-stations/{station_id}/rotate-key",
                      "Rotate station key",
                      () =>
                        open({
                          endpoint:
                            "POST /admin/badge-stations/{station_id}/rotate-key",
                          path: `/admin/badge-stations/${encodeURIComponent(row.station_id)}/rotate-key`,
                          label: "Rotate station key",
                        }),
                    )}
                </div>
              </article>
            ))}
          </section>
        ))}
      {data("/admin/server-health") && (
        <section>
          <h3>{tr("Server health")}</h3>
          <Details value={data("/admin/server-health")} />
        </section>
      )}
      {section === "maintenance" && (
        <section className="notice">
          <h3>{tr("Maintenance mode")}</h3>
          <p>
            {tr(
              "Coordinate with hospital staff before changing maintenance. Non-admin work is blocked while enabled.",
            )}
          </p>
          {button("PUT /admin/maintenance", "Change maintenance", () =>
            open({
              endpoint: "PUT /admin/maintenance",
              path: "/admin/maintenance",
              label: "Change maintenance",
            }),
          )}
        </section>
      )}
      {section === "kill_switch" && (
        <section className="error">
          <h3>{tr("Emergency only: force global logout")}</h3>
          <p>
            {tr(
              "This ends every hospital session. Coordinate the emergency response before continuing.",
            )}
          </p>
          {button("POST /admin/kill-switch", "Force global logout", () =>
            open({
              endpoint: "POST /admin/kill-switch",
              path: "/admin/kill-switch",
              label: "Force global logout",
            }),
          )}
        </section>
      )}
      {result && (
        <section role="status">
          <h3>
            {tr(
              result.status === "Pending"
                ? "Waiting for an Owner"
                : "Confirmed server result",
            )}
          </h3>
          <Details value={result} />
        </section>
      )}
      {action && !pending && (
        <AdminForm
          key={JSON.stringify([action.endpoint, action.path, action.body])}
          action={action}
          roles={roles}
          permissionsList={permissionsList}
          departments={data("/admin/departments") || []}
          printers={data("/admin/printers") || []}
          onCancel={() => setAction(undefined)}
          onSubmit={(body) => {
            const path = action.path.replace(
              "{station_id}",
              encodeURIComponent(body.station_id),
            );
            setConfirming(writeAttempt({ ...action, path, body }));
          }}
        />
      )}
      {confirming && (
        <Modal
          title={tr("Confirm system change")}
          onClose={() => !busy && setConfirming(undefined)}
        >
          <p>{tr(confirming.body.label)}</p>
          <strong>{confirming.body.target}</strong>
          <p>
            {tr(
              "Check the selected target and values. A lost reply will require reconciliation; the action is never repeated automatically.",
            )}
          </p>
          <Details value={confirming.body.body} />
          <button
            data-help="settings.it.actions"
            onClick={() => setConfirming(undefined)}
          >
            {tr("Go back")}
          </button>
          <button
            data-help="settings.it.actions"
            className="danger"
            disabled={busy}
            onClick={() => void submit(confirming)}
          >
            {tr("Confirm system change")}
          </button>
        </Modal>
      )}
      {pending && !busy && (
        <section className="notice">
          <h3>{tr("System change outcome needs checking")}</h3>
          <p>
            {tr(
              operation(pending.body.endpoint).write?.on_lost_answer ||
                "Check the record before any new action.",
            )}
          </p>
          <button
            data-help="settings.it.recovery"
            onClick={() => void r.reload()}
          >
            {tr("Reload system records")}
          </button>
          {operation(pending.body.endpoint).idempotency_key && (
            <button
              data-help="settings.it.recovery"
              disabled={!canRetryWrite(pending)}
              onClick={() => void submit(pending)}
            >
              {tr("Retry original request")}
            </button>
          )}
          <button
            data-help="settings.it.recovery"
            onClick={() => {
              if (
                window.confirm(
                  tr(
                    "Only clear this hold after the responsible supervisor has reconciled the original request. This does not report success or undo anything. Continue?",
                  ),
                )
              ) {
                setPending(undefined);
                setAction(undefined);
              }
            }}
          >
            {tr("Close reviewed attempt")}
          </button>
        </section>
      )}
      {secret && (
        <Modal
          title={tr("Shown once — keep the slip secure")}
          onClose={() => setSecret(undefined)}
        >
          <p>
            {tr(
              "Deliver this credential privately. It is held only in this open dialog; closing it clears it. A print failure must never repeat provisioning, password reset or key rotation.",
            )}
          </p>
          <ErrorBox error={error} />
          <Details value={secret} />
          <button
            data-help="settings.it.secret"
            onClick={() =>
              navigator.clipboard
                .writeText(secret.temporary_password || secret.api_key)
                .catch(setError)
            }
          >
            {tr("Copy credential")}
          </button>
          <button
            data-help="settings.it.secret"
            onClick={() =>
              call("print-admin-slip", {
                target:
                  secret.target ||
                  secret.username ||
                  secret.station_id ||
                  String(secret.user_id),
                credential: secret.temporary_password || secret.api_key,
                kind: secret.api_key ? "Station key" : "Temporary password",
              }).catch(setError)
            }
          >
            {tr("Print credential slip")}
          </button>
          <button
            data-help="settings.it.secret"
            onClick={() => setSecret(undefined)}
          >
            {tr("I have secured the credential")}
          </button>
          <p>
            {tr(
              "The Owner's personnel file still needs the CNIC copy where applicable.",
            )}
          </p>
        </Modal>
      )}
    </div>
  );
}

function AdminForm({
  action,
  roles,
  permissionsList,
  departments,
  printers,
  onSubmit,
  onCancel,
}: {
  action: Action;
  roles: any[];
  permissionsList: any[];
  departments: any[];
  printers: any[];
  onSubmit: (body: Record<string, any>) => void;
  onCancel: () => void;
}) {
  const schema = shape(action.endpoint);
  const [body, setBody] = useState<Record<string, any>>(() =>
    Object.fromEntries(
      Object.entries(schema.properties)
        .filter(
          ([k, s]: any) =>
            action.body?.[k] !== undefined || s.default !== undefined,
        )
        .map(([k, s]: any) => [
          k,
          action.body?.[k] !== undefined ? action.body[k] : s.default,
        ]),
    ),
  );
  const set = (key: string, value: any) =>
    setBody((old) => {
      const next = { ...old };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  const isRequest = action.endpoint === "POST /admin/change-requests";
  const requestKind = body.kind;
  return (
    <form
      data-unsaved="true"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(structuredClone(body));
      }}
    >
      <h3>{tr(action.label)}</h3>
      <p className="muted">
        {tr(
          "Only the server can confirm this change. Privileged access may wait for Owner approval.",
        )}
      </p>
      {Object.entries(schema.properties).map(([key, raw]: any) => {
        if (
          isRequest &&
          [
            "kind",
            "setting_key",
            "target_user_id",
            "target_role_code",
          ].includes(key)
        )
          return body[key] === undefined ? null : (
            <p key={key}>
              {tr(raw.title)}: {String(body[key])}
            </p>
          );
        const s = raw.anyOf?.find((s: any) => s.type !== "null") || raw,
          required = schema.required?.includes(key),
          label = tr(raw.title || key),
          value = body[key];
        const roleField =
          key === "role_codes" ||
          key === "roles" ||
          (key === "requested_value" && requestKind === "UserRoles");
        const permissionField =
          key === "requested_value" && requestKind === "RolePermissions";
        if (roleField || permissionField) {
          const options = permissionField
            ? permissionsList
            : roles.filter(
                (r) =>
                  key !== "roles" ||
                  !["owner", "super_admin", "phc_inspector"].includes(r.code),
              );
          return (
            <fieldset key={key}>
              <legend>{label}</legend>
              {options.map((option) => (
                <label className="check" key={option.code}>
                  <input
                    data-help="settings.it.access"
                    type="checkbox"
                    checked={(value || []).includes(option.code)}
                    onChange={(e) =>
                      set(
                        key,
                        e.target.checked
                          ? [...(value || []), option.code]
                          : (value || []).filter(
                              (x: string) => x !== option.code,
                            ),
                      )
                    }
                  />
                  {option.name || option.description || option.code}
                  <small>{option.code}</small>
                </label>
              ))}
            </fieldset>
          );
        }
        const reference =
          key === "department_id"
            ? departments.map((d) => ({
                value: d.department_id,
                label: d.name,
              }))
            : key.endsWith("_printer_id")
              ? printers.map((p) => ({ value: p.printer_id, label: p.name }))
              : undefined;
        const readonly =
          key === "employee_id" || (key === "station_id" && !!action.baseline);
        return (
          <Field
            key={key}
            label={label}
            hint={raw.description ? tr(raw.description) : undefined}
          >
            {s.type === "boolean" ? (
              <select
                data-help="settings.it.fields"
                value={value === undefined ? "" : String(value)}
                required={required}
                onChange={(e) =>
                  set(
                    key,
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true",
                  )
                }
              >
                <option value="">{tr("Choose")}</option>
                <option value="true">{tr("Yes")}</option>
                <option value="false">{tr("No")}</option>
              </select>
            ) : s.enum || reference ? (
              <select
                data-help="settings.it.fields"
                value={value ?? ""}
                required={required}
                onChange={(e) =>
                  set(
                    key,
                    e.target.value === ""
                      ? undefined
                      : reference
                        ? Number(e.target.value)
                        : e.target.value,
                  )
                }
              >
                <option value="">{tr("Not recorded")}</option>
                {(
                  reference ||
                  s.enum.map((v: any) => ({ value: v, label: tr(v) }))
                ).map((o: any) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                data-help="settings.it.fields"
                value={value ?? ""}
                readOnly={readonly}
                required={required}
                type={
                  s.type === "integer"
                    ? "number"
                    : s.format === "date"
                      ? "date"
                      : "text"
                }
                min={s.minimum}
                max={s.maximum}
                step={s.type === "integer" ? 1 : undefined}
                minLength={s.minLength}
                maxLength={s.maxLength}
                pattern={s.const || s.pattern}
                onChange={(e) =>
                  set(
                    key,
                    e.target.value === ""
                      ? undefined
                      : s.type === "integer"
                        ? Number(e.target.value)
                        : e.target.value,
                  )
                }
              />
            )}
          </Field>
        );
      })}
      <div className="actions">
        <button
          data-help="settings.it.actions"
          type="button"
          onClick={onCancel}
        >
          {tr("Cancel")}
        </button>
        <button
          data-help="settings.it.actions"
          className="primary"
          disabled={
            (schema.required?.includes("role_codes") &&
              !body.role_codes?.length) ||
            (isRequest &&
              requestKind === "UserRoles" &&
              !body.requested_value?.length)
          }
        >
          {tr("Review system change")}
        </button>
      </div>
    </form>
  );
}
