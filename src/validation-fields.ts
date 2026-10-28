export type ValidationField = { field: string; message: string };
export function validationFields(
  error: { code?: string; details?: Record<string, unknown> } | undefined,
): ValidationField[] {
  if (error?.code !== "VALIDATION_ERROR") return [];
  const details = error.details || {},
    fields = details.fields;
  if (Array.isArray(fields))
    return fields.flatMap((v: any) => {
      const loc = Array.isArray(v.loc)
        ? v.loc
            .filter(
              (p: unknown) => !["body", "query", "path"].includes(String(p)),
            )
            .join(".")
        : String(v.field || v.path || "");
      return loc
        ? [
            {
              field: loc,
              message: String(v.msg || v.message || "Check this field."),
            },
          ]
        : [];
    });
  if (fields && typeof fields === "object")
    return Object.entries(fields).map(([field, value]) => ({
      field,
      message: typeof value === "string" ? value : JSON.stringify(value),
    }));
  return typeof details.field === "string"
    ? [
        {
          field: details.field,
          message: String(details.message || "Check this field."),
        },
      ]
    : [];
}
