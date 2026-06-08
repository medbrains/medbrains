type MobileAppointmentTextValues = Record<string, string | number | boolean>;

const MOBILE_APPOINTMENT_MESSAGES: Record<string, string> = {
  "appointments.action.book": "Book",
  "appointments.action.bookAppointment": "Book Appointment",
  "appointments.action.cancel": "Cancel",
  "appointments.action.confirmCancel": "Yes, Cancel",
  "appointments.action.dismissCancel": "No, Keep It",
  "appointments.action.reschedule": "Reschedule",
  "appointments.action.trackQueue": "Track Queue Position",
  "appointments.dialog.cancelPrompt": "Are you sure you want to cancel this appointment?",
  "appointments.dialog.cancelTitle": "Cancel Appointment",
  "appointments.empty.cancelled": "No cancelled appointments",
  "appointments.empty.noAppointments": "No appointments",
  "appointments.empty.past": "No past appointments found",
  "appointments.empty.upcoming": "You have no upcoming appointments",
  "appointments.fallback.department": "General",
  "appointments.fallback.doctor": "Doctor",
  "appointments.filter.cancelled": "Cancelled",
  "appointments.filter.past": "Past",
  "appointments.filter.upcoming": "Upcoming",
  "appointments.loading.list": "Loading appointments...",
  "appointments.snackbar.cancelFailed": "Failed to cancel appointment",
  "appointments.snackbar.cancelled": "Appointment cancelled",
  "appointments.status.cancelled": "Cancelled",
  "appointments.status.checked_in": "Checked in",
  "appointments.status.completed": "Completed",
  "appointments.status.confirmed": "Confirmed",
  "appointments.status.in_consultation": "In consultation",
  "appointments.status.no_show": "No show",
  "appointments.status.pending": "Pending",
  "appointments.status.scheduled": "Scheduled",
};

const APPOINTMENT_STATUS_KEYS: Partial<Record<string, string>> = {
  cancelled: "appointments.status.cancelled",
  checked_in: "appointments.status.checked_in",
  completed: "appointments.status.completed",
  confirmed: "appointments.status.confirmed",
  in_consultation: "appointments.status.in_consultation",
  no_show: "appointments.status.no_show",
  pending: "appointments.status.pending",
  scheduled: "appointments.status.scheduled",
};

function interpolate(template: string, values?: MobileAppointmentTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobileAppointmentText(key: string, values?: MobileAppointmentTextValues): string {
  const template = MOBILE_APPOINTMENT_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}

export function mobileAppointmentStatusText(status: string): string {
  const key = APPOINTMENT_STATUS_KEYS[status];
  return key ? mobileAppointmentText(key) : status;
}
