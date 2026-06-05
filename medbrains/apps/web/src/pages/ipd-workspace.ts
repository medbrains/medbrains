export type IpdActionRailSection =
  | "handoffs"
  | "orders"
  | "mrd"
  | "admission"
  | "finance"
  | "discharge";

export function ipdActionRailSectionsForTab(tab: string): readonly IpdActionRailSection[] {
  switch (tab) {
    case "prescriptions":
    case "investigations":
    case "mar":
      return ["orders", "handoffs"];
    case "billing-tab":
    case "insurance-pa":
      return ["finance", "handoffs"];
    case "clinical-docs":
    case "checklist":
    case "mlc-tab":
      return ["mrd", "handoffs"];
    case "discharge-summary":
    case "discharge":
    case "discharge-tat":
    case "death-summary":
    case "birth-records":
      return ["discharge", "admission", "handoffs"];
    case "transfer":
    case "attenders":
    case "diet-tab":
    case "consents-tab":
      return ["admission", "handoffs"];
    default:
      return ["handoffs", "admission"];
  }
}
