/**
 * Nurse module — bedside MAR, vitals entry, handoff, I/O. Maps to
 * web's nurse-activities + IPD bedside surfaces. Heaviest offline
 * usage — the AuthzCache + Loro append paths flow through here.
 */

import type { ReactNode } from "react";
import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { AdmissionsListScreen } from "./nurse/admissions-list.js";
import { MarScheduleScreen } from "./nurse/mar-schedule.js";
import type { AdmissionRow } from "../api/ipd.js";

function NurseHome(): ReactNode {
  const router = useModuleRouter();
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
          onPress: () => router.push("admissions"),
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

function NurseScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{
        home: <NurseHome />,
        admissions: <AdmissionsListScreen />,
        mar: (payload) => <MarScheduleScreen admission={payload as AdmissionRow} />,
      }}
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
