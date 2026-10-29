export type EstimateScreenId =
  "cost_estimates_admissions" | "cost_estimates_billing" | "explain_estimate";
// Billing's catalogue entry is not service-scoped. Honour an explicit view if
// supplied; the inpatient work screen always requires its declared service view.
export function estimateView(
  screenId: EstimateScreenId,
  est: { views: { screens: { screen_id: string; view: string }[] } },
) {
  return (
    est.views.screens.find((s) => s.screen_id === screenId)?.view ??
    (screenId !== "cost_estimates_admissions" ? "full" : undefined)
  );
}
