type Handbook = {
  shared_screens: Array<{ id: string }>;
  workspaces: Array<{ screens: Array<{ id: string }> }>;
};
type Views = { views: { screens: Array<{ screen_id: string; view: string }> } };
// The server's every_employee flag describes My Workspace independently of roles.
export function directWorkspace<T extends { every_employee: boolean }>(available: T[]): T | undefined {
  const primary = available.filter(w => !w.every_employee);
  return primary.length === 1 ? primary[0] : primary.length === 0 && available.length === 1 ? available[0] : undefined;
}
export function handbookPermits(
  handbook: Handbook | undefined,
  id: string,
): boolean {
  return (
    !!handbook &&
    [
      ...handbook.shared_screens,
      ...handbook.workspaces.flatMap((w) => w.screens),
    ].some((s) => s.id === id)
  );
}
// Delivery inventory prevents advertising unfinished catalogue pages; the server
// handbook and establishment views remain the permission/service authorities.
export function screenNavigation(
  preferred: string[],
  handbook: Handbook | undefined,
  establishment: Views | undefined,
  delivered: readonly string[],
  ready: boolean,
): string[] {
  if (!ready || !handbook || !establishment) return [];
  const allowed = [
    ...handbook.shared_screens,
    ...handbook.workspaces.flatMap((w) => w.screens),
  ].map((s) => s.id);
  const publicPages = new Set([
    "connect_server",
    "login",
    "help_center",
    "badge_station_kiosk",
  ]);
  return [...new Set([...preferred, ...allowed])].filter((id) => {
    if (publicPages.has(id) || !delivered.includes(id) || !allowed.includes(id))
      return false;
    const view = establishment.views.screens.find(
      (s) => s.screen_id === id,
    )?.view;
    if (["er_register","er_statistics","er_statistics_owner","lab_quality","radiology_quality","diagnostics_quality","owner_diagnostics","diagnostic_correlation","surgical_statistics","surgical_statistics_owner"].includes(id))
      return view === "full" || view === "open_work" || view === "records";
    if (view === "hidden") return false;
    // Facility-profile configuration owns this setup-only entry.
    return view !== "setup" || !["imaging_quality_setup", "preventive_programmes_setup", "labour_register_columns"].includes(id);
  });
}
