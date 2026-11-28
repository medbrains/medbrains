import { useHasAnyPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { signoffService } from "@/services/signoff.service";

/** The query key of the caller's own signature; invalidate it after a change. */
export const OWN_SIGNATURE_KEY = ["my-signature-credentials"] as const;

/**
 * Whether the caller has a signature to sign with. Three answers and a wait:
 * `unknown` is a failed check, which must never read as `missing`: an outage
 * would otherwise ask a doctor who has a signature to set one up again.
 */
export type OwnSignatureStatus = "checking" | "ready" | "missing" | "unknown";

/**
 * The caller's own signature, for every screen that signs or shows it. The
 * check is only issued for a holder of a signing permission, and only while
 * `enabled`; anyone else has none to look for.
 */
export function useOwnSignature(enabled = true) {
  const canSign = useHasAnyPermission([P.DOCTOR.SIGNATURE.SIGN, P.NURSE.SIGNATURE.SIGN]);
  const query = useQuery({
    queryKey: OWN_SIGNATURE_KEY,
    queryFn: () => signoffService.getMySignatureCredentials(),
    enabled: enabled && canSign,
    staleTime: 30_000,
  });
  const current = query.data?.find((credential) => credential.is_default);
  let status: OwnSignatureStatus = current ? "ready" : "missing";
  if (canSign && query.isError) status = "unknown";
  else if (canSign && query.isPending) status = "checking";
  return { status, current, recheck: () => void query.refetch() };
}
