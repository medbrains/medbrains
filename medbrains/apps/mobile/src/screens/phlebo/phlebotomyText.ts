type MobilePhlebotomyTextValues = Record<string, string | number | boolean>;

const MOBILE_PHLEBOTOMY_MESSAGES: Record<string, string> = {
  "phlebotomy.action.navigate": "Navigate",
  "phlebotomy.action.addSample": "Add Sample",
  "phlebotomy.action.cancel": "Cancel",
  "phlebotomy.action.completeCollection": "Complete Collection",
  "phlebotomy.action.confirm": "Confirm",
  "phlebotomy.action.goBack": "Go Back",
  "phlebotomy.action.call": "Call",
  "phlebotomy.action.scan": "Scan",
  "phlebotomy.action.patientNotAvailable": "Patient Not Available",
  "phlebotomy.action.startCollection": "Start Collection",
  "phlebotomy.collection.addressNotProvided": "Address not provided",
  "phlebotomy.collection.addressTitle": "Collection Address",
  "phlebotomy.collection.barcodeLabel": "Barcode / Sample ID",
  "phlebotomy.collection.barcodeScanned": "Barcode scanned: {{barcode}}",
  "phlebotomy.collection.checklist.labeled": "All samples labeled correctly",
  "phlebotomy.collection.checklist.patientVerified": "Patient identity verified",
  "phlebotomy.collection.checklist.stored": "Samples stored properly",
  "phlebotomy.collection.checklistTitle": "Pre-submission Checklist",
  "phlebotomy.collection.collectionId": "Collection #{{id}}",
  "phlebotomy.collection.collectedAt": "Collected At",
  "phlebotomy.collection.confirmMessagePlural":
    "You are about to submit {{count}} samples for collection #{{id}}.",
  "phlebotomy.collection.confirmMessageSingular":
    "You are about to submit {{count}} sample for collection #{{id}}.",
  "phlebotomy.collection.confirmTitle": "Confirm Collection",
  "phlebotomy.collection.details.collectionId": "Collection ID",
  "phlebotomy.collection.details.date": "Date",
  "phlebotomy.collection.details.section": "Collection Details",
  "phlebotomy.collection.details.timeSlot": "Time Slot",
  "phlebotomy.collection.flexible": "Flexible",
  "phlebotomy.collection.empty.all": "No collections assigned",
  "phlebotomy.collection.empty.collected": "No samples collected yet",
  "phlebotomy.collection.empty.pending": "No pending collections for today",
  "phlebotomy.collection.empty.title": "No collections",
  "phlebotomy.collection.filter.all": "All",
  "phlebotomy.collection.filter.collected": "Collected",
  "phlebotomy.collection.filter.pending": "Pending",
  "phlebotomy.collection.loading": "Loading collections...",
  "phlebotomy.collection.loadingDetails": "Loading collection details...",
  "phlebotomy.collection.notesPlaceholder": "Any observations or issues during collection...",
  "phlebotomy.collection.notesTitle": "Collection Notes",
  "phlebotomy.collection.notFound": "Collection not found",
  "phlebotomy.collection.progress": "{{collected}} / {{total}} samples collected",
  "phlebotomy.collection.sampleCollected": "Sample collected",
  "phlebotomy.collection.sampleTitle": "Sample {{number}}",
  "phlebotomy.collection.samplesSection": "Samples to Collect",
  "phlebotomy.collection.snackbar.completed": "Collection completed successfully",
  "phlebotomy.collection.snackbar.failed": "Failed to submit collection",
  "phlebotomy.collection.specialInstructions": "Special Instructions",
  "phlebotomy.collection.stats.collected": "Collected",
  "phlebotomy.collection.stats.pending": "Pending",
  "phlebotomy.collection.stats.total": "Total",
  "phlebotomy.collection.statusScheduled": "Scheduled: {{date}}",
  "phlebotomy.collection.submitWarning":
    "Please ensure all samples are correctly labeled and stored.",
  "phlebotomy.status.arrived": "Arrived",
  "phlebotomy.status.assigned": "Assigned",
  "phlebotomy.status.cancelled": "Cancelled",
  "phlebotomy.status.collected": "Collected",
  "phlebotomy.status.in_transit": "In transit",
  "phlebotomy.status.returned_to_lab": "Returned to lab",
  "phlebotomy.status.scheduled": "Scheduled",
};

function interpolate(template: string, values?: MobilePhlebotomyTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobilePhlebotomyText(key: string, values?: MobilePhlebotomyTextValues): string {
  const template = MOBILE_PHLEBOTOMY_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}

export function mobilePhlebotomyStatusText(status: string): string {
  const key = `phlebotomy.status.${status}`;
  const translated = mobilePhlebotomyText(key);
  return translated === key ? status : translated;
}
