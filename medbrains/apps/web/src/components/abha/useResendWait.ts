import { useState } from "react";
import { useInterval } from "react-use";

/**
 * Seconds left before ABDM will send another OTP, counting down once a
 * second while above zero; set it from each step's `resend_after_seconds`.
 */
export function useResendWait() {
  const [wait, setWait] = useState(0);
  useInterval(() => setWait((w) => w - 1), wait > 0 ? 1000 : null);
  return [wait, setWait] as const;
}
