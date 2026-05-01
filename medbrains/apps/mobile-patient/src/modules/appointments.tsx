/**
 * Patient → appointments. Book new, view upcoming, reschedule,
 * cancel. Backed by `/api/portal/appointments` (subject-locked at
 * the backend per the patient's tenant + sub).
 */

import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function AppointmentsScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Appointments"
      description="Book, view, reschedule, or cancel your visits."
      summaries={[
        { eyebrow: "UPCOMING", count: "—", title: "Next 14 days" },
        { eyebrow: "PAST", count: "—", title: "Last 30 days" },
      ]}
      actions={[
        {
          id: "book",
          label: "Book new appointment",
          description: "Find a doctor and pick a slot.",
        },
        {
          id: "upcoming",
          label: "Upcoming visits",
          description: "View confirmed appointments.",
        },
        {
          id: "history",
          label: "Visit history",
          description: "Past visits with the same provider.",
        },
        {
          id: "cancel",
          label: "Reschedule / cancel",
          description: "Change the time of an upcoming visit.",
        },
      ]}
    />
  );
}

export const appointmentsModule: Module = {
  id: "appointments",
  displayName: "Appointments",
  icon: () => null,
  requiredPermissions: [],
  navigator: AppointmentsScreen,
};
