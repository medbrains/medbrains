/**
 * Patient → prescriptions. View current Rx, request a renewal, find
 * a nearby pharmacy. Backed by `/api/portal/prescriptions`.
 */

import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function PrescriptionsScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Prescriptions"
      description="Active medications and renewal requests."
      summaries={[
        { eyebrow: "ACTIVE", count: "—", title: "Current Rx" },
        { eyebrow: "EXPIRING", count: "—", title: "Renewal due soon" },
      ]}
      actions={[
        {
          id: "active",
          label: "Active prescriptions",
          description: "Drug, dose, frequency, duration.",
        },
        {
          id: "renew",
          label: "Request renewal",
          description: "Ask your provider to renew a Rx.",
        },
        {
          id: "history",
          label: "Prescription history",
          description: "Past medications.",
        },
        {
          id: "pharmacy",
          label: "Pharmacy locator",
          description: "Find a nearby empanelled pharmacy.",
        },
      ]}
    />
  );
}

export const prescriptionsModule: Module = {
  id: "prescriptions",
  displayName: "Prescriptions",
  icon: () => null,
  requiredPermissions: [],
  navigator: PrescriptionsScreen,
};
