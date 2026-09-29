/**
 * The hospital code the last sign-in in this browser used (a username several
 * hospitals share needs one). Cleared, it is forgotten. A convenience only:
 * the server decides, and an unreadable store simply asks again.
 */
const KEY = "medbrains.hospital_code";

export function getRememberedHospitalCode(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberHospitalCode(code: string): void {
  try {
    if (code) window.localStorage.setItem(KEY, code);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private windows and blocked storage: the next sign-in asks again.
  }
}
