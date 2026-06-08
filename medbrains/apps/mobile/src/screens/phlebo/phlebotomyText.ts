type MobilePhlebotomyTextValues = Record<string, string | number | boolean>;

const MOBILE_PHLEBOTOMY_MESSAGES: Record<string, string> = {
  "phlebotomy.action.navigate": "Navigate",
  "phlebotomy.collection.addressNotProvided": "Address not provided",
  "phlebotomy.collection.collectionId": "Collection #{{id}}",
  "phlebotomy.collection.flexible": "Flexible",
  "phlebotomy.collection.empty.all": "No collections assigned",
  "phlebotomy.collection.empty.collected": "No samples collected yet",
  "phlebotomy.collection.empty.pending": "No pending collections for today",
  "phlebotomy.collection.empty.title": "No collections",
  "phlebotomy.collection.filter.all": "All",
  "phlebotomy.collection.filter.collected": "Collected",
  "phlebotomy.collection.filter.pending": "Pending",
  "phlebotomy.collection.loading": "Loading collections...",
  "phlebotomy.collection.stats.collected": "Collected",
  "phlebotomy.collection.stats.pending": "Pending",
  "phlebotomy.collection.stats.total": "Total",
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
