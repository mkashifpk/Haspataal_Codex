// Structural checks against the saved MCP response schemas. No data is synthesized.
function validate(value, schema, schemas, at = "$") {
  if (!schema) return [];
  if (schema.$ref) {
    const name = schema.$ref.split("/").at(-1);
    return schemas[name] ? validate(value, schemas[name], schemas, at) : [];
  }
  if (schema.anyOf) {
    const choices = schema.anyOf.map((s) => validate(value, s, schemas, at));
    return choices.some((e) => !e.length)
      ? []
      : [`${at}: does not match any declared type`];
  }
  if (schema.const !== undefined && value !== schema.const)
    return [`${at}: invalid constant`];
  if (schema.enum && !schema.enum.includes(value))
    return [`${at}: value is outside the declared enum`];
  if (schema.type === "null")
    return value === null ? [] : [`${at}: expected null`];
  if (value === null) return schema.type ? [`${at}: unexpected null`] : [];
  if (schema.type === "array")
    return Array.isArray(value)
      ? value.flatMap((v, i) =>
          validate(v, schema.items, schemas, `${at}[${i}]`),
        )
      : [`${at}: expected array`];
  if (schema.type === "object") {
    if (typeof value !== "object" || Array.isArray(value))
      return [`${at}: expected object`];
    const errors = (schema.required || [])
      .filter((k) => !(k in value))
      .map((k) => `${at}.${k}: missing required field`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k])
        errors.push(
          ...validate(v, schema.properties[k], schemas, `${at}.${k}`),
        );
      else if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      )
        errors.push(
          ...validate(v, schema.additionalProperties, schemas, `${at}.${k}`),
        );
    }
    return errors;
  }
  if (schema.type === "integer")
    return Number.isInteger(value) ? [] : [`${at}: expected integer`];
  if (
    ["string", "number", "boolean"].includes(schema.type) &&
    typeof value !== schema.type
  )
    return [`${at}: expected ${schema.type}`];
  return [];
}
function permissionAllows(op, user) {
  const access = op?.access;
  if (access?.authentication === "public") return true;
  if (!user) return false;
  const p = access?.permissions || [];
  return access?.permissions_mode === "any"
    ? p.some((x) => user.permissions.includes(x))
    : p.every((x) => user.permissions.includes(x));
}
function workspaceView(est, code) {
  return est.views.workspaces.find((v) => v.workspace === code)?.view || "full";
}
function screenView(est, id) {
  return est.views.screens.find((v) => v.screen_id === id)?.view || "full";
}
module.exports = { validate, permissionAllows, workspaceView, screenView };
