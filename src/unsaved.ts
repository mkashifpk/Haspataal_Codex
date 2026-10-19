// React controlled fields do not retain a dependable DOM defaultValue. Forms
// mark their draft state explicitly; native fields remain a fallback.
export function hasUnsavedChanges(root: ParentNode = document): boolean {
  if (root.querySelector('[data-unsaved="true"]')) return true;
  return [
    ...root.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("main input, main textarea, main select"),
  ].some((field) => {
    if (field.closest("[data-unsaved]")) return false;
    if (
      !field.name ||
      ["password", "username", "current", "new", "confirm"].includes(field.name)
    )
      return false;
    if (field instanceof HTMLSelectElement)
      return [...field.options].some(
        (option, index) =>
          option.selected !==
          (option.defaultSelected ||
            (!field.multiple &&
              index === 0 &&
              ![...field.options].some((o) => o.defaultSelected))),
      );
    return field.type === "checkbox" || field.type === "radio"
      ? (field as HTMLInputElement).checked !==
          (field as HTMLInputElement).defaultChecked
      : field.value !== field.defaultValue;
  });
}
