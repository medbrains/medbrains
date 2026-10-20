import type { BillingLaneName } from "@medbrains/types";

/** What each billing lane is called on screen. */
export const LANE_LABELS: Record<BillingLaneName, string> = {
  registration: "Registration",
  opd: "OPD",
  lab: "Laboratory",
  radiology: "Radiology",
  emergency: "Emergency",
  ipd: "Inpatient",
  pharmacy: "Pharmacy",
};
