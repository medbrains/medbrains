/** The start of the server's answer when the last wrong code refused the request outright. */
const REFUSED_PREFIX = "Three wrong codes.";

/** Whether an approve error means the request is gone, so Approve must not be offered again. */
export function isRefusedAfterWrongCodes(message: string): boolean {
  return message.startsWith(REFUSED_PREFIX);
}
