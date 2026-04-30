/**
 * Doctor module — OPD queue, prescriptions, clinical notes.
 * Mirrors the web's `pages/opd.tsx` surface; handheld variant
 * focuses on quick consult intake.
 */

import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function DoctorScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Doctor"
      description="Consultations, prescriptions, clinical notes."
      summaries={[
        { eyebrow: "QUEUE", count: "—", title: "OPD queue (today)" },
        { eyebrow: "VITALS", count: "—", title: "Pending review" },
      ]}
      actions={[
        {
          id: "queue",
          label: "OPD queue",
          description: "Call next, view tokens, mark consult complete.",
          permission: P.OPD.QUEUE_LIST,
        },
        {
          id: "visit",
          label: "Start consultation",
          description: "Capture chief complaint, vitals, diagnosis.",
          permission: P.OPD.VISIT_CREATE,
        },
        {
          id: "rx",
          label: "Prescription",
          description: "Write a prescription with INN, dose, frequency.",
          permission: P.OPD.VISIT_UPDATE,
        },
        {
          id: "labs",
          label: "Lab orders",
          description: "Order panels or individual tests.",
          permission: P.LAB.ORDERS_CREATE,
        },
        {
          id: "appointments",
          label: "Appointments",
          description: "View today's schedule and reschedule.",
          permission: P.OPD.APPOINTMENT.LIST,
        },
      ]}
    />
  );
}

export const doctorModule: Module = {
  id: "doctor",
  displayName: "Doctor",
  icon: () => null,
  requiredPermissions: [P.OPD.QUEUE_LIST],
  navigator: DoctorScreen,
  offlineDocTypes: ["opd_visit", "prescription"],
};
