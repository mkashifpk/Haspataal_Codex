export const bmiSuggestion = (weight: string, height: string) => {
  const w = Number(weight),
    h = Number(height);
  if (
    !weight ||
    !height ||
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w < 0.5 ||
    w > 400 ||
    h < 30 ||
    h > 250
  )
    return undefined;
  const bmi = w / (h / 100) ** 2;
  return { bmi, score: bmi > 20 ? 0 : bmi >= 18.5 ? 1 : 2 };
};
export const nutritionRisk = (scores: number[]) => {
  const total = scores.reduce((a, b) => a + b, 0);
  return {
    total,
    risk: total === 0 ? "Low" : total === 1 ? "Medium" : "High",
    needsPlan: total > 0,
  };
};
export const nursingWriteAllowed = (
  view: string,
  state: string,
  permissions: string[],
) =>
  ["full", "open_work"].includes(view) &&
  ["Admitted", "CodeRedActive", "DischargeInProgress"].includes(state) &&
  permissions.includes("ipd.nursing_assessment.record");
