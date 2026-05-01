import { useCallback } from "react";
import { useOfflineHandles } from "./offline-provider.js";
import type { JwtOutcome } from "./edge-rn-contract.js";

const DEFAULT_CLOCK_SKEW = 300;

export function useJwtVerify(publicKey: Uint8Array): {
  verify: (token: string, nowUnix?: number, clockSkewSecs?: number) => JwtOutcome;
} {
  const { bindings } = useOfflineHandles();
  const verify = useCallback(
    (token: string, nowUnix?: number, clockSkewSecs?: number): JwtOutcome => {
      const now = nowUnix ?? Math.floor(Date.now() / 1000);
      return bindings.verifyJwt(
        token,
        publicKey,
        now,
        clockSkewSecs ?? DEFAULT_CLOCK_SKEW,
      );
    },
    [bindings, publicKey],
  );
  return { verify };
}
