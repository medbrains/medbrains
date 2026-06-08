type MobileShellBiometricTextValues = Record<string, string | number | boolean>;

const MOBILE_SHELL_BIOMETRIC_MESSAGES: Record<string, string> = {
  "mobileShell.biometric.action.cancel": "Cancel",
  "mobileShell.biometric.action.enable": "Enable",
  "mobileShell.biometric.action.skip": "Skip",
  "mobileShell.biometric.action.unlock": "Unlock",
  "mobileShell.biometric.enrollment.message.optional":
    "Quick unlock keeps your session in OS-managed secure storage. You can change this later in Settings.",
  "mobileShell.biometric.enrollment.message.required":
    "Your hospital policy requires biometric unlock. We'll prompt every time the app comes back to the foreground.",
  "mobileShell.biometric.enrollment.requiredNotice": "Required by hospital policy.",
  "mobileShell.biometric.enrollment.title.default": "Enable quick unlock",
  "mobileShell.biometric.enrollment.title.face": "Use Face ID to unlock",
  "mobileShell.biometric.enrollment.title.fingerprint": "Use fingerprint to unlock",
  "mobileShell.biometric.enrollment.title.iris": "Use iris scan to unlock",
  "mobileShell.biometric.enrollment.title.passcode": "Use device passcode to unlock",
  "mobileShell.biometric.unlock.action": "Unlock",
  "mobileShell.biometric.unlock.lockedTitle": "Locked",
  "mobileShell.biometric.unlock.prompt": "Unlock MedBrains",
};

function interpolate(template: string, values?: MobileShellBiometricTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobileShellBiometricText(
  key: string,
  values?: MobileShellBiometricTextValues,
): string {
  const template = MOBILE_SHELL_BIOMETRIC_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}
