import { useCallback } from "react";
import { useOfflineHandles } from "./offline-provider.js";

export function useRevocationCache(): {
  isRevoked: (userId: string, jwtIatUnix: number) => boolean;
  recordRevocation: (userId: string, revokedAtUnix: number) => void;
  pullWindowMax: () => number;
  forget: (userId: string) => void;
} {
  const { revocations } = useOfflineHandles();

  const isRevoked = useCallback(
    (userId: string, iat: number) => revocations.isRevoked(userId, iat),
    [revocations],
  );
  const recordRevocation = useCallback(
    (userId: string, revokedAt: number) =>
      revocations.recordRevocation(userId, revokedAt),
    [revocations],
  );
  const pullWindowMax = useCallback(
    () => revocations.pullWindowMax(),
    [revocations],
  );
  const forget = useCallback(
    (userId: string) => revocations.forget(userId),
    [revocations],
  );

  return { isRevoked, recordRevocation, pullWindowMax, forget };
}
