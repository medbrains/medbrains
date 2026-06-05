export type PatientDetailOrderBasketTab = "drug" | "lab" | "radiology";

export function patientDetailTabForOrderBasket(
  tab: PatientDetailOrderBasketTab,
): "prescriptions" | "lab" | "imaging" {
  if (tab === "drug") return "prescriptions";
  return tab === "lab" ? "lab" : "imaging";
}
