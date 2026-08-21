/**
 * Doctor module — OPD queue → token state machine + (future)
 * consultation editor + prescription composer. Mirrors the web's
 * `pages/opd.tsx` surface; handheld focus is fast consult intake.
 */

import type { Module } from "@medbrains/mobile-shell";
import { P } from "@medbrains/types";
import type { ReactNode } from "react";
import type { AdmissionRow } from "../api/ipd.js";
import type { WorklistToken } from "../api/queue.js";
import { listOpdWorklistCount } from "../api/queue.js";
import { useModuleCount } from "../components/module-count.js";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { DoctorIpdRoundDetailScreen, DoctorIpdRoundsScreen } from "./doctor/ipd-rounds.js";
import { MyClinicScreen } from "./doctor/my-clinic.js";
import { QueueDetailScreen } from "./doctor/queue-detail.js";
import { QueueListScreen } from "./doctor/queue-list.js";

function DoctorHome(): ReactNode {
  const router = useModuleRouter();
  const opdQueue = useModuleCount(listOpdWorklistCount, (q) => q.status === "waiting");
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Doctor"
      description="Consultations, prescriptions, clinical notes."
      tags={["Mobile-Doctor", "OPD", "IPD", "offline-ready"]}
      summaries={[
        { eyebrow: "QUEUE", count: opdQueue.count, title: "OPD queue (today)" },
        { eyebrow: "VITALS", count: "—", title: "Pending review" },
      ]}
      actions={[
        {
          id: "queue",
          label: "OPD queue",
          description: "Call next, view tokens, mark consult complete.",
          permission: P.OPD.QUEUE_LIST,
          onPress: () => router.push("queue"),
        },
        {
          id: "visit",
          label: "Start consultation",
          description: "Capture chief complaint, vitals, diagnosis.",
          permission: P.OPD.VISIT_CREATE,
          onPress: () => router.push("queue"),
        },
        {
          id: "rx",
          label: "Prescription",
          description: "Write a prescription with INN, dose, frequency.",
          permission: P.OPD.VISIT_UPDATE,
          onPress: () => router.push("queue"),
        },
        {
          id: "labs",
          label: "Lab orders",
          description: "Order panels or individual tests.",
          permission: P.LAB.ORDERS_CREATE,
          onPress: () => router.push("queue"),
        },
        {
          id: "ipd-rounds",
          label: "IPD rounds",
          description: "Ward patients with mini EMR review context.",
          permission: P.IPD.ADMISSIONS_LIST,
          onPress: () => router.push("ipd-rounds"),
        },
        {
          id: "appointments",
          label: "Appointments",
          description: "View today's schedule and reschedule.",
          permission: P.OPD.APPOINTMENT.LIST,
          onPress: () => router.push("my-clinic"),
        },
      ]}
    />
  );
}

function DoctorScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{
        home: <DoctorHome />,
        queue: <QueueListScreen />,
        "queue-detail": (payload) => <QueueDetailScreen entry={payload as WorklistToken} />,
        "ipd-rounds": <DoctorIpdRoundsScreen />,
        "ipd-round-detail": (payload) => (
          <DoctorIpdRoundDetailScreen admission={payload as AdmissionRow} />
        ),
        "my-clinic": <MyClinicScreen />,
      }}
    />
  );
}

export const doctorModule: Module = {
  id: "doctor",
  displayName: "Doctor",
  icon: () => null,
  // Not opd.queue.list: nurse holds that too, so this module captured every
  // nurse who signed in — and because the shell mounts one screen per permitted
  // module and opens on the first with no switcher, a nurse could not then
  // reach the Nurse module at all. Found by the Detox suite on its first run.
  //
  // opd.visit.update is what this module is for: recording into a consultation.
  // Doctor holds it; nurse and receptionist do not. The gate now matches the
  // permission its actions require, which is the same rule the API follows.
  requiredPermissions: [P.OPD.VISIT_UPDATE],
  navigator: DoctorScreen,
  appCodes: ["Mobile-Doctor"],
  tags: ["clinical", "opd", "ipd-rounds", "prescription", "offline-ready"],
  offlineDocTypes: ["opd_visit", "prescription"],
};
