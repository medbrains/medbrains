import { useEffect, useState } from "react";
import { probeBiometricCapability } from "./expo-local-auth.js";
import type { BiometricCapability } from "./types.js";

const INITIAL: BiometricCapability = {
  available: false,
  enrolled: false,
  kind: null,
};

/**
 * Hook returning the device's biometric capability. Re-runs once on
 * mount; capability rarely changes mid-session, but when the user
 * navigates to Settings and enrolls a face, hosts can call
 * `refresh()` from a focus listener if they care.
 */
export function useBiometricCapability(): {
  capability: BiometricCapability;
  loading: boolean;
  refresh: () => void;
} {
  const [capability, setCapability] = useState<BiometricCapability>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    probeBiometricCapability()
      .then((cap) => {
        if (!cancelled) {
          setCapability(cap);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCapability(INITIAL);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { capability, loading, refresh: () => setTick((t) => t + 1) };
}
