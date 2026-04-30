/**
 * Reception module — patient registration, queue, appointments,
 * visitor passes. The shell variant for reception is intentionally
 * close to OPD admin staff workflow. Uses the Phase E ModuleRouter
 * sub-stack for drill-downs.
 */

import type { ReactNode } from "react";
import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { PatientListScreen } from "./reception/patient-list.js";
import { PatientDetailScreen } from "./reception/patient-detail.js";
import { RegisterPatientScreen } from "./reception/register-patient.js";
import type { PatientRow } from "../api/patients.js";

function ReceptionHome(): ReactNode {
  const router = useModuleRouter();
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Reception"
      description="Registration, queue, appointments, visitor passes."
      summaries={[
        { eyebrow: "WAIT", count: "—", title: "OPD queue length" },
        { eyebrow: "TODAY", count: "—", title: "Registrations so far" },
      ]}
      actions={[
        {
          id: "register",
          label: "Register patient",
          description: "UHID issue + Aadhaar / ABHA capture.",
          permission: P.PATIENTS.CREATE,
          onPress: () => router.push("register"),
        },
        {
          id: "directory",
          label: "Patient directory",
          description: "Search by UHID / name / phone.",
          permission: P.PATIENTS.LIST,
          onPress: () => router.push("directory"),
        },
        {
          id: "queue",
          label: "OPD queue",
          description: "Token issue + call.",
          permission: P.OPD.QUEUE_LIST,
        },
        {
          id: "appointments",
          label: "Appointments",
          description: "Book, reschedule, cancel.",
          permission: P.OPD.APPOINTMENT.LIST,
        },
        {
          id: "passes",
          label: "Visitor passes",
          description: "Issue, check-in, revoke.",
          permission: P.FRONT_OFFICE.PASSES_LIST,
        },
        {
          id: "enquiry",
          label: "Enquiry desk",
          description: "Log enquiries + resolve.",
          permission: P.FRONT_OFFICE.ENQUIRY_LIST,
        },
      ]}
    />
  );
}

function ReceptionScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{
        home: <ReceptionHome />,
        register: <RegisterPatientScreen />,
        directory: <PatientListScreen />,
        "patient-detail": (payload) => (
          <PatientDetailScreen patient={payload as PatientRow} />
        ),
      }}
    />
  );
}

export const receptionModule: Module = {
  id: "reception",
  displayName: "Reception",
  icon: () => null,
  requiredPermissions: [P.PATIENTS.LIST],
  navigator: ReceptionScreen,
  offlineDocTypes: ["patient_registration", "visitor_pass"],
};
