/**
 * Reception module — patient registration, queue, appointments,
 * visitor passes. The shell variant for reception is intentionally
 * close to OPD admin staff workflow. Uses the Phase E ModuleRouter
 * sub-stack for drill-downs.
 */

import type { Module } from "@medbrains/mobile-shell";
import { P } from "@medbrains/types";
import type { ReactNode } from "react";
import type { PatientRow } from "../api/patients.js";
import { listOpdWorklistCount } from "../api/queue.js";
import { useModuleCount } from "../components/module-count.js";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { EnquiryDeskScreen } from "./reception/enquiry-desk.js";
import { PatientDetailScreen } from "./reception/patient-detail.js";
import { PatientListScreen } from "./reception/patient-list.js";
import { QueueBoardScreen } from "./reception/queue-board.js";
import { RegisterPatientScreen } from "./reception/register-patient.js";
import { StartVisitScreen } from "./reception/start-visit.js";
import { VisitorDeskScreen } from "./reception/visitor-desk.js";

function ReceptionHome(): ReactNode {
  const router = useModuleRouter();
  const queueLength = useModuleCount(listOpdWorklistCount, (q) => q.status === "waiting");
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Reception"
      description="Registration, queue, appointments, visitor passes."
      tags={["Desktop-Kiosk", "Desktop-Workstation", "OPD", "ABHA"]}
      summaries={[
        { eyebrow: "WAIT", count: queueLength.count, title: "OPD queue length" },
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
          onPress: () => router.push("queue-board"),
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
          onPress: () => router.push("visitor-desk"),
        },
        {
          id: "enquiry",
          label: "Enquiry desk",
          description: "Log enquiries + resolve.",
          permission: P.FRONT_OFFICE.ENQUIRY_LIST,
          onPress: () => router.push("enquiry-desk"),
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
        "patient-detail": (payload) => <PatientDetailScreen patient={payload as PatientRow} />,
        "start-visit": (payload) => <StartVisitScreen patient={payload as PatientRow} />,
        "queue-board": <QueueBoardScreen />,
        "visitor-desk": <VisitorDeskScreen />,
        "enquiry-desk": <EnquiryDeskScreen />,
      }}
    />
  );
}

export const receptionModule: Module = {
  id: "reception",
  displayName: "Reception",
  icon: () => null,
  // Not patients.list: nurses and doctors hold that, and front_office_staff --
  // whose entire job is this desk -- does not, so the reception module was
  // visible to clinicians and invisible to the front office. That role opened
  // the app to no modules at all.
  //
  // front_office.queue.list means "works the front desk": held by receptionist
  // and front_office_staff, by neither nurse nor doctor.
  requiredPermissions: [P.FRONT_OFFICE.QUEUE_LIST],
  navigator: ReceptionScreen,
  appCodes: ["Desktop-Kiosk", "Desktop-Workstation", "Mobile-Admin", "Mobile-Security"],
  tags: ["front-office", "registration", "queue", "appointments", "visitor-pass"],
  offlineDocTypes: ["patient_registration", "visitor_pass"],
};
