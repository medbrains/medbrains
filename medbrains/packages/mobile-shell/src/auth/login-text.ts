type MobileShellLoginTextValues = Record<string, string | number | boolean>;

const MOBILE_SHELL_LOGIN_MESSAGES: Record<string, string> = {
  "mobileShell.auth.login.action.signIn": "Sign in",
  "mobileShell.auth.login.brandInitials": "MB",
  "mobileShell.auth.login.defaultIdentifierLabel": "Username or email",
  "mobileShell.auth.login.defaultPasswordLabel": "Password",
  "mobileShell.auth.login.defaultSubtitle": "Sign in to continue",
  "mobileShell.auth.login.defaultTitle": "MedBrains",
  "mobileShell.auth.login.errors.identifierMin": "Identifier must be at least 3 characters",
  "mobileShell.auth.login.errors.identifierRequired": "Identifier is required",
  "mobileShell.auth.login.errors.passwordMin": "Password must be at least 4 characters",
  "mobileShell.auth.login.errors.passwordRequired": "Password is required",
  "mobileShell.auth.login.errors.signInFailed": "Sign in failed",
};

function interpolate(template: string, values?: MobileShellLoginTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobileShellLoginText(key: string, values?: MobileShellLoginTextValues): string {
  const template = MOBILE_SHELL_LOGIN_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}

export function mobileShellLoginErrorText(message: string | undefined): string | undefined {
  if (!message) return undefined;

  const translated = mobileShellLoginText(message);
  return translated === message ? message : translated;
}
