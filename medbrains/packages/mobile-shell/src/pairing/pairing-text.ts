type MobileShellPairingTextValues = Record<string, string | number | boolean>;

const MOBILE_SHELL_PAIRING_MESSAGES: Record<string, string> = {
  "mobileShell.pairing.action.scanQr": "Scan pairing QR",
  "mobileShell.pairing.body":
    "Ask an administrator to generate a one-time QR. Scanning issues a device certificate stored in the OS keychain.",
  "mobileShell.pairing.error.failed": "Pairing failed",
  "mobileShell.pairing.title": "Pair this device",
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
