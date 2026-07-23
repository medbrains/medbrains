/**
 * Nurse module — bedside MAR, vitals entry, handoff, I/O. Maps to
 * web's nurse-activities + IPD bedside surfaces. Heaviest offline
 * usage — the AuthzCache + Loro append paths flow through here.
 */

import type { Module } from "@medbrains/mobile-shell";
import { P } from "@medbrains/types";
import type { ReactNode } from "react";
import type { AdmissionRow } from "../api/ipd.js";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { AdmissionsListScreen } from "./nurse/admissions-list.js";
import { BedsideActionScreen } from "./nurse/bedside-action.js";
import { MarScheduleScreen } from "./nurse/mar-schedule.js";
import { PatientWorkspaceScreen } from "./nurse/patient-workspace.js";
import { ShiftHandoverScreen } from "./nurse/shift-handover.js";

function NurseHome(): ReactNode {
  const router = useModuleRouter();
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Nurse"
      description="MAR, vitals, handoff, intake/output."
      tags={["Mobile-Nurse", "IPD", "eMAR", "offline-ready"]}
      summaries={[
        { eyebrow: "DUE", count: "—", title: "MAR doses (next hour)" },
        { eyebrow: "VITALS", count: "—", title: "Bedside rounds left" },
      ]}
      actions={[
        {
          id: "mar",
          label: "My shift",
          description: "Assigned beds with bedside MAR, vitals, I/O and risk actions.",
          permission: P.NURSE.DASHBOARD_VIEW,
          onPress: () => router.push("admissions"),
        },
        {
          id: "vitals",
          label: "Record vitals",
          description: "Select a patient, then capture BP, HR, SpO2 and temperature.",
          permission: P.NURSE.VITALS_RECORD,
          onPress: () => router.push("admissions"),
        },
        {
          id: "handoff",
          label: "SBAR handoff",
          description: "Structured handoff for shift change.",
          permission: P.NURSE.HANDOFF_RECORD,
          onPress: () => router.push("admissions"),
        },
        {
          id: "io",
          label: "Intake / output",
          description: "Fluid balance and drain output capture.",
          permission: P.NURSE.INTAKE_OUTPUT_RECORD,
          onPress: () => router.push("admissions"),
        },
        {
          id: "fall-risk",
          label: "Fall risk assessment",
          description: "Morse scale + interventions.",
          permission: P.NURSE.FALL_RISK_RECORD,
          onPress: () => router.push("admissions"),
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
        "patient-workspace": (payload) => (
          <PatientWorkspaceScreen admission={payload as AdmissionRow} />
        ),
        mar: (payload) => <MarScheduleScreen admission={payload as AdmissionRow} />,
        handover: (payload) => {
          const admission = payload as AdmissionRow;
          return (
            <ShiftHandoverScreen
              encounterId={admission.encounter_id}
              patientName={admission.patient_name}
              uhid={admission.uhid}
            />
          );
        },
        "bedside-action": (payload) => {
          const params = payload as {
            admission: AdmissionRow;
            mode: "vitals" | "io" | "pain" | "fall-risk";
          };
          return <BedsideActionScreen admission={params.admission} mode={params.mode} />;
        },
      }}
    />
  );
}

export const nurseModule: Module = {
  id: "nurse",
  displayName: "Nurse",
  icon: () => null,
  requiredPermissions: [P.NURSE.DASHBOARD_VIEW],
  navigator: NurseScreen,
  appCodes: ["Mobile-Nurse"],
  tags: ["clinical", "ipd", "emar", "vitals", "handoff", "offline-ready"],
  offlineDocTypes: ["mar_admin", "vitals", "io_event", "handoff"],
};
