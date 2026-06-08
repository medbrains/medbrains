type MobileLoginTextValues = Record<string, string | number | boolean>;

const MOBILE_LOGIN_MESSAGES: Record<string, string> = {
  "auth.login.action.forgotPassword": "Forgot Password?",
  "auth.login.action.signIn": "Sign In",
  "auth.login.brand.initials": "MB",
  "auth.login.brand.name": "MedBrains",
  "auth.login.errors.invalidCredentials": "Invalid username or password. Please try again.",
  "auth.login.errors.passwordMin": "Password must be at least 4 characters",
  "auth.login.errors.passwordRequired": "Password is required",
  "auth.login.errors.usernameMin": "Username must be at least 3 characters",
  "auth.login.errors.usernamePattern":
    "Username must start with a letter and contain only lowercase letters, digits, and underscores",
  "auth.login.errors.usernameRequired": "Username is required",
  "auth.login.footer.poweredBy": "Powered by Alagappa Group of Institutions",
  "auth.login.footer.version": "v0.1.0",
  "auth.login.form.password": "Password",
  "auth.login.form.username": "Username",
  "auth.login.product.subtitle": "Hospital Management System",
};

function interpolate(template: string, values?: MobileLoginTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobileLoginText(key: string, values?: MobileLoginTextValues): string {
  const template = MOBILE_LOGIN_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}
