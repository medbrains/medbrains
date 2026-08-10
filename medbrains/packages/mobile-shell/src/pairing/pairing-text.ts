type MobileShellPairingTextValues = Record<string, string | number | boolean>;

const MOBILE_SHELL_PAIRING_MESSAGES: Record<string, string> = {
  "mobileShell.pairing.action.scanQr": "Scan pairing QR",
  "mobileShell.pairing.body":
    "Ask an administrator to generate a one-time QR. Scanning issues a device certificate stored in the OS keychain.",
  "mobileShell.pairing.error.failed": "Pairing failed",
  "mobileShell.pairing.title": "Pair this device",
  "mobileShell.sync.action.create": "Create sync key",
  "mobileShell.sync.action.done": "Done",
  "mobileShell.sync.body":
    "This device can already sync on the hospital network. To let it sync from a camp, on mobile data, or directly with another device, an administrator needs to add the key below.",
  "mobileShell.sync.loading": "Checking this device",
  "mobileShell.sync.nodeId.help":
    "Read this out to an administrator. They add it under Admin, Paired devices. Until they do, this device syncs on the hospital network only.",
  "mobileShell.sync.nodeId.label": "This device's sync key",
  "mobileShell.sync.title": "Sync away from the hospital",
};

function interpolate(template: string, values?: MobileShellPairingTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobileShellPairingText(key: string, values?: MobileShellPairingTextValues): string {
  const template = MOBILE_SHELL_PAIRING_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}
