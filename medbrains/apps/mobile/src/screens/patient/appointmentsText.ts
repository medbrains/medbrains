type MobileAppointmentTextValues = Record<string, string | number | boolean>;

const MOBILE_APPOINTMENT_MESSAGES: Record<string, string> = {
  "appointments.action.book": "Book",
  "appointments.action.bookAppointment": "Book Appointment",
  "appointments.action.cancel": "Cancel",
  "appointments.action.confirmCancel": "Yes, Cancel",
  "appointments.action.dismissCancel": "No, Keep It",
  "appointments.action.directions": "Get Directions",
  "appointments.action.goBack": "Go Back",
  "appointments.action.refreshStatus": "Refresh Status",
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
  "appointments.fallback.reason": "General Consultation",
  "appointments.filter.cancelled": "Cancelled",
  "appointments.filter.past": "Past",
  "appointments.filter.upcoming": "Upcoming",
  "appointments.loading.list": "Loading appointments...",
  "appointments.loading.queue": "Loading queue status...",
  "appointments.queue.appointmentNotFound": "Appointment not found",
  "appointments.queue.estimatedWaitTime": "Estimated Wait Time",
  // Shown when the queue has never been measured. Not "0 minutes", which a
  // patient reads as "you are next".
  "appointments.queue.waitUnknown": "Not yet known",
  "appointments.queue.lastUpdated": "Last updated: {{time}}",
  "appointments.queue.minutesWait": "Minutes Wait",
  "appointments.queue.patientsAhead": "Patients Ahead",
  "appointments.queue.position": "Position: #{{position}}",
  "appointments.queue.progressTitle": "Queue Progress",
  "appointments.queue.status.checkedInSubtitle": "Waiting to be called",
  "appointments.queue.status.checkedInTitle": "Checked In",
  "appointments.queue.status.completedSubtitle": "Thank you for visiting",
  "appointments.queue.status.completedTitle": "Visit Complete",
  "appointments.queue.status.confirmedSubtitle": "Please check in on arrival",
  "appointments.queue.status.confirmedTitle": "Confirmed",
  "appointments.queue.status.consultationSubtitle": "Doctor is with you now",
  "appointments.queue.status.consultationTitle": "In Consultation",
  "appointments.queue.status.waitingSubtitlePlural": "{{count}} patients ahead of you",
  "appointments.queue.status.waitingSubtitleSingular": "{{count}} patient ahead of you",
  "appointments.queue.status.waitingTitle": "Waiting",
  "appointments.queue.tokenNumber": "Your Token Number",
  "appointments.queue.verySoon": "Very soon!",
  "appointments.queue.waitMinutes": "~{{minutes}} minutes",
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
  "appointments.type.consultation": "Consultation",
  "appointments.type.follow_up": "Follow-up",
  "appointments.type.new_visit": "New visit",
  "appointments.type.procedure": "Procedure",
  "appointments.type.walk_in": "Walk-in",
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

const APPOINTMENT_TYPE_KEYS: Partial<Record<string, string>> = {
  consultation: "appointments.type.consultation",
  follow_up: "appointments.type.follow_up",
  new_visit: "appointments.type.new_visit",
  procedure: "appointments.type.procedure",
  walk_in: "appointments.type.walk_in",
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

export function mobileAppointmentTypeText(appointmentType: string): string {
  const key = APPOINTMENT_TYPE_KEYS[appointmentType];
  return key ? mobileAppointmentText(key) : appointmentType;
}
