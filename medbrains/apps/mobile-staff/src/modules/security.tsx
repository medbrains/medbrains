/**
 * Security module — access control, CCTV catalog, incidents,
 * patient-safety events, debriefs. MLC overlap on serious incidents.
 */

import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function SecurityScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Security"
      description="Access, CCTV, incidents, patient safety."
      summaries={[
        { eyebrow: "OPEN", count: "—", title: "Active incidents" },
        { eyebrow: "TODAY", count: "—", title: "Visitor pass issued" },
      ]}
      actions={[
        {
          id: "incidents",
          label: "Incident log",
          description: "Open / classify / close.",
          permission: P.SECURITY.INCIDENTS_LIST,
        },
        {
          id: "log-incident",
          label: "Log new incident",
          description: "Time, place, parties, action taken.",
          permission: P.SECURITY.INCIDENTS_CREATE,
        },
        {
          id: "patient-safety",
          label: "Patient-safety events",
          description: "Falls, near-miss, MLC trigger flags.",
          permission: P.SECURITY.PATIENT_SAFETY_LIST,
        },
        {
          id: "debriefs",
          label: "Debriefs",
          description: "Post-incident review notes.",
          permission: P.SECURITY.DEBRIEFS_LIST,
        },
        {
          id: "cctv",
          label: "CCTV catalog",
          description: "Camera index + outage alerts.",
          permission: P.SECURITY.CCTV_LIST,
        },
      ]}
    />
  );
}

export const securityModule: Module = {
  id: "security",
  displayName: "Security",
  icon: () => null,
  requiredPermissions: [P.SECURITY.INCIDENTS_LIST],
  navigator: SecurityScreen,
  offlineDocTypes: ["security_incident"],
};
