type MobileHomeTextValues = Record<string, string | number | boolean>;

const MOBILE_HOME_MESSAGES: Record<string, string> = {
  "home.app.name": "MedBrains",
  "home.app.subtitle": "Hospital Management System",
  "home.error.apiUnavailable": "Unable to reach API server. Is the backend running?",
  "home.footer": "v{{version}} · {{organization}}",
  "home.health.overall": "Overall",
  "home.health.postgres": "PostgreSQL",
  "home.health.system": "System Health",
  "home.health.yottadb": "YottaDB",
  "home.organization": "Alagappa Group of Institutions",
  "home.status.connected": "Connected",
  "home.status.ok": "OK",
};

function interpolate(template: string, values?: MobileHomeTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobileHomeText(key: string, values?: MobileHomeTextValues): string {
  const template = MOBILE_HOME_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}

export function mobileHomeStatusText(status: string): string {
  const key = `home.status.${status}`;
  const translated = mobileHomeText(key);
  return translated === key ? status : translated;
}
