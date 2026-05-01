/**
 * Security module — access control, CCTV catalog, incidents,
 * patient-safety events, debriefs. MLC overlap on serious incidents.
 */

import type { ReactNode } from "react";
import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import type { IntentTone } from "@medbrains/ui-mobile";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { listSecurityIncidents } from "../api/security.js";

const STATUS_TONE: Record<string, IntentTone> = {
  open: "warn",
  investigating: "info",
  closed: "success",
  resolved: "success",
  escalated: "alert",
};
const SEVERITY_ALERT = new Set(["critical", "high"]);

function SecurityHome(): ReactNode {
  const router = useModuleRouter();
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
          onPress: () => router.push("incidents"),
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

function IncidentsScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="SECURITY"
      title="Incidents"
      description="High & critical severity get the copper border."
      fetcher={() => listSecurityIncidents()}
      rowKey={(i) => i.id}
      renderRow={(i) => (
        <EntityRow
          title={`${i.incident_number} · ${i.category}`}
          subtitle={`${new Date(i.reported_at).toLocaleString()} · ${i.location ?? "unknown loc"}`}
          badge={{ label: i.status, tone: STATUS_TONE[i.status] ?? "neutral" }}
          accent={SEVERITY_ALERT.has(i.severity)}
        />
      )}
      emptyTitle="No incidents"
    />
  );
}

function SecurityScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{ home: <SecurityHome />, incidents: <IncidentsScreen /> }}
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
