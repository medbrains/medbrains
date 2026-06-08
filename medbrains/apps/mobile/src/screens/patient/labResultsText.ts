type MobileLabResultsTextValues = Record<string, string | number | boolean>;

const MOBILE_LAB_RESULTS_MESSAGES: Record<string, string> = {
  "patientLabResults.action.downloadReport": "Download Report",
  "patientLabResults.action.share": "Share",
  "patientLabResults.date.line": "{{date}} at {{time}}",
  "patientLabResults.empty.all": "You have no lab orders",
  "patientLabResults.empty.completed": "No completed lab results",
  "patientLabResults.empty.pending": "No pending lab orders",
  "patientLabResults.empty.title": "No lab results",
  "patientLabResults.fallback.testName": "Lab Test",
  "patientLabResults.filter.all": "All",
  "patientLabResults.filter.completed": "Completed",
  "patientLabResults.filter.pending": "Pending",
  "patientLabResults.loading.list": "Loading lab results...",
  "patientLabResults.preview.available": "Results Available",
  "patientLabResults.preview.resultReadyPlural": "{{count}} results ready",
  "patientLabResults.preview.resultReadySingular": "{{count}} result ready",
  "patientLabResults.priority.routine": "Routine",
  "patientLabResults.priority.stat": "STAT",
  "patientLabResults.priority.urgent": "Urgent",
  "patientLabResults.search.placeholder": "Search lab tests...",
  "patientLabResults.stats.pending": "Pending",
  "patientLabResults.stats.ready": "Ready",
  "patientLabResults.stats.total": "Total",
  "patientLabResults.status.collected": "Collected",
  "patientLabResults.status.completed": "Completed",
  "patientLabResults.status.pending": "Pending",
  "patientLabResults.status.processing": "Processing",
  "patientLabResults.status.verified": "Verified",
};

const LAB_STATUS_KEYS: Partial<Record<string, string>> = {
  collected: "patientLabResults.status.collected",
  completed: "patientLabResults.status.completed",
  pending: "patientLabResults.status.pending",
  processing: "patientLabResults.status.processing",
  verified: "patientLabResults.status.verified",
};

const LAB_PRIORITY_KEYS: Partial<Record<string, string>> = {
  routine: "patientLabResults.priority.routine",
  stat: "patientLabResults.priority.stat",
  urgent: "patientLabResults.priority.urgent",
};

function interpolate(template: string, values?: MobileLabResultsTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobileLabResultsText(key: string, values?: MobileLabResultsTextValues): string {
  const template = MOBILE_LAB_RESULTS_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}

export function mobileLabOrderStatusText(status: string): string {
  const key = LAB_STATUS_KEYS[status];
  return key ? mobileLabResultsText(key) : status;
}

export function mobileLabPriorityText(priority: string): string {
  const key = LAB_PRIORITY_KEYS[priority];
  return key ? mobileLabResultsText(key) : priority;
}
