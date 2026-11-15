/**
 * NHA's M1 rules for what the desk types, and NHA's exact words when it is
 * wrong. The server's `medbrains_abdm::rules` is the authority and refuses
 * the same; this mirror lets the screen say so before anything is sent. iOS
 * (`MedBrainsKit/AbhaRules.swift`) and Android (`com.medbrains.kit.AbhaRules`)
 * keep identical copies — change all four together.
 */

/** NHA's words (CRT_ABHA_104, 106, 112, VRFY_ABHA_301, 307), verbatim. */
export const ABHA_MESSAGES = {
  aadhaarInvalid: "Aadhaar Number is not valid",
  mobileInvalid: "Please enter a valid mobile number.",
  otpInvalid: "Invalid OTP. Please enter a valid OTP.",
  resendLocked: "Maximum OTP resend attempts reached. Please try again after 30 mins",
  addressTaken: "ABHA address already exists.",
} as const;

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 3, 2, 7, 6, 5, 8, 1, 0, 9],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 5, 8, 3, 2],
];

/** Whether `digits` (check digit last) passes Verhoeff, UIDAI's Aadhaar check. */
export function verhoeffOk(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  [...digits].reverse().forEach((ch, i) => {
    c = D[c]?.[P[i % 8]?.[Number(ch)] ?? 0] ?? 0;
  });
  return c === 0;
}

const withoutSpaces = (typed: string) => typed.replace(/\s/g, "");

/** A valid Aadhaar number: 12 digits (spaces allowed) passing Verhoeff (CRT_ABHA_104). */
export function isValidAadhaar(typed: string): boolean {
  const d = withoutSpaces(typed);
  return d.length === 12 && verhoeffOk(d);
}

/** A valid mobile: exactly 10 digits, spaces allowed, nothing else (VRFY_ABHA_301). */
export function isValidMobile(typed: string): boolean {
  return /^\d{10}$/.test(withoutSpaces(typed));
}

/** The part before the `@`, whether or not the desk typed `@{domain}`. */
export function addressName(typed: string, domain: string): string {
  const t = typed.trim();
  return t.endsWith(`@${domain}`) ? t.slice(0, -(domain.length + 1)) : t;
}

export interface AddressRule {
  label: string;
  met: boolean;
}

const special = (c: string | undefined) => c === "." || c === "_";

/** Each CRT_ABHA_112 rule for `name@{domain}`, in the words and order shown. */
export function addressChecklist(name: string, domain: string): AddressRule[] {
  const total = [...name].length + 1 + domain.length;
  const count = (c: string) => name.split(c).length - 1;
  return [
    { label: `8–18 characters, including @${domain}`, met: total >= 8 && total <= 18 },
    {
      label: "Letters and numbers only, besides . and _",
      met: /^[A-Za-z0-9._]*$/.test(name) && /[A-Za-z0-9]/.test(name),
    },
    { label: "At most one dot (.)", met: count(".") <= 1 },
    { label: "At most one underscore (_)", met: count("_") <= 1 },
    { label: "No . or _ at the start or end", met: !special(name[0]) && !special(name.at(-1)) },
  ];
}

/** Whether every address rule is met. */
export const isValidAddress = (name: string, domain: string) =>
  addressChecklist(name, domain).every((r) => r.met);

/**
 * ABDM's refusal as the server words it: ABDM's own message, then on the
 * next line our hint (with the code). Shown as the message and a hint beneath.
 */
export function splitAbdmMessage(detail: string): { message: string; hint: string | null } {
  const at = detail.indexOf("\n");
  return at < 0
    ? { message: detail, hint: null }
    : { message: detail.slice(0, at), hint: detail.slice(at + 1) };
}
