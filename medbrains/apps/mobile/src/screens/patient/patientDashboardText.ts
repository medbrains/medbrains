type MobilePatientDashboardTextValues = Record<string, string | number | boolean>;

const MOBILE_PATIENT_DASHBOARD_MESSAGES: Record<string, string> = {
  "patientDashboard.appointments.empty": "No upcoming appointments",
  "patientDashboard.appointments.loading": "Loading appointments...",
  "patientDashboard.appointments.section": "Upcoming Appointments",
  "patientDashboard.appointments.seeAll": "See All",
  "patientDashboard.appointments.view": "View appointments",
  "patientDashboard.common.dateDayPending": "--",
  "patientDashboard.common.datePending": "Date pending",
  "patientDashboard.common.doctor": "Doctor",
  "patientDashboard.common.general": "General",
  "patientDashboard.common.initials": "PT",
  "patientDashboard.common.patient": "Patient",
  "patientDashboard.common.tbd": "TBD",
  "patientDashboard.common.timePending": "Time pending",
  "patientDashboard.header.welcome": "Welcome back,",
  "patientDashboard.quickActions.appointments": "Appointments",
  "patientDashboard.quickActions.billing": "Bills",
  "patientDashboard.quickActions.lab": "Lab Results",
  "patientDashboard.quickActions.prescriptions": "Prescriptions",
  "patientDashboard.quickActions.section": "Quick Actions",
  "patientDashboard.status.cancelled": "Cancelled",
  "patientDashboard.status.checked_in": "Checked in",
  "patientDashboard.status.completed": "Completed",
  "patientDashboard.status.confirmed": "Confirmed",
  "patientDashboard.status.in_consultation": "In consultation",
  "patientDashboard.status.no_show": "No show",
  "patientDashboard.status.pending": "Pending",
  "patientDashboard.status.scheduled": "Scheduled",
  "patientDashboard.summary.appointmentHint": "{{doctor}} on {{date}}",
  "patientDashboard.summary.billingHintPlural": "{{count}} pending bills",
  "patientDashboard.summary.billingHintSingular": "{{count}} pending bill",
  "patientDashboard.summary.billingLabel": "Outstanding",
  "patientDashboard.summary.careSummary": "Care Summary",
  "patientDashboard.summary.labHintPlural": "{{count}} lab orders total",
  "patientDashboard.summary.labHintSingular": "{{count}} lab order total",
  "patientDashboard.summary.labLabel": "Ready Labs",
  "patientDashboard.summary.medicationHint": "Medication items in the last 30 days",
  "patientDashboard.summary.medicationLabel": "Recent Meds",
  "patientDashboard.summary.noAppointments": "No appointments scheduled",
  "patientDashboard.summary.noPendingBills": "No pending bills",
  "patientDashboard.summary.upcomingLabel": "Upcoming",
  "patientDashboard.unavailable.message":
    "Sign in with a linked patient account to view dashboard details.",
  "patientDashboard.unavailable.title": "Patient context unavailable",
};

const APPOINTMENT_STATUS_KEYS: Partial<Record<string, string>> = {
  cancelled: "patientDashboard.status.cancelled",
  checked_in: "patientDashboard.status.checked_in",
  completed: "patientDashboard.status.completed",
  confirmed: "patientDashboard.status.confirmed",
  in_consultation: "patientDashboard.status.in_consultation",
  no_show: "patientDashboard.status.no_show",
  pending: "patientDashboard.status.pending",
  scheduled: "patientDashboard.status.scheduled",
};

function interpolate(template: string, values?: MobilePatientDashboardTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobilePatientDashboardText(
  key: string,
  values?: MobilePatientDashboardTextValues,
): string {
  const template = MOBILE_PATIENT_DASHBOARD_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}

export function mobilePatientDashboardAppointmentStatusText(status: string): string {
  const key = APPOINTMENT_STATUS_KEYS[status];
  return key ? mobilePatientDashboardText(key) : status;
}
