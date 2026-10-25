export function prescriptionQueueAccess(permissions: string[], view: string) {
  const visible = ["full", "open_work", "records"].includes(view);
  return {
    visible,
    list: visible && view !== "records" && permissions.includes("pharmacy.queue.view"),
    detail: visible && permissions.includes("prescription.view"),
  };
}
