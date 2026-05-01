/**
 * Patient → lab reports. View own results, share via family-link
 * with a per-relation grant. Backed by `/api/portal/lab-reports`.
 */

import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function LabReportsScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Lab reports"
      description="Your test results, with critical-value alerts highlighted."
      summaries={[
        { eyebrow: "PENDING", count: "—", title: "Awaiting results" },
        { eyebrow: "FINAL", count: "—", title: "Reports available" },
      ]}
      actions={[
        {
          id: "available",
          label: "Available reports",
          description: "Final, signed reports from the lab.",
        },
        {
          id: "pending",
          label: "Pending results",
          description: "Tests in progress.",
        },
        {
          id: "share",
          label: "Share with family",
          description: "Time-bounded link to a specific relation.",
        },
        {
          id: "download",
          label: "Download PDF",
          description: "Save a signed copy of the report.",
        },
      ]}
    />
  );
}

export const labReportsModule: Module = {
  id: "lab-reports",
  displayName: "Lab reports",
  icon: () => null,
  requiredPermissions: [],
  navigator: LabReportsScreen,
};
