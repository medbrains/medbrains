/**
 * Nurse module — bedside MAR, vitals entry, handoff, I/O. Maps to
 * web's nurse-activities + IPD bedside surfaces. Heaviest offline
 * usage — the AuthzCache + Loro append paths flow through here.
 */

import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function NurseScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Nurse"
      description="MAR, vitals, handoff, intake/output."
      summaries={[
        { eyebrow: "DUE", count: "—", title: "MAR doses (next hour)" },
        { eyebrow: "VITALS", count: "—", title: "Bedside rounds left" },
      ]}
      actions={[
        {
          id: "mar",
          label: "MAR — administer dose",
          description: "Five-rights check + barcode scan + signature.",
          permission: P.IPD.MAR_CREATE,
        },
        {
          id: "vitals",
          label: "Record vitals",
          description: "BP, HR, SpO₂, temp, pain — uses VitalSignField.",
          permission: P.IPD.ASSESSMENTS_CREATE,
        },
        {
          id: "handoff",
          label: "SBAR handoff",
          description: "Structured handoff for shift change.",
          permission: P.IPD.HANDOVER_CREATE,
        },
        {
          id: "io",
          label: "Intake / output",
          description: "Fluid balance and drain output capture.",
          permission: P.IPD.IO_CHART_CREATE,
        },
        {
          id: "fall-risk",
          label: "Fall risk assessment",
          description: "Morse scale + interventions.",
          permission: P.IPD.CLINICAL_DOCS_CREATE,
        },
      ]}
    />
  );
}

export const nurseModule: Module = {
  id: "nurse",
  displayName: "Nurse",
  icon: () => null,
  requiredPermissions: [P.IPD.MAR_LIST],
  navigator: NurseScreen,
  offlineDocTypes: ["mar_admin", "vitals", "io_event", "handoff"],
};
