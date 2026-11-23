import { useHasAnyPermission } from "@medbrains/stores";
import { P, type SignatureCredential } from "@medbrains/types";
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

/** Neither withdrawn nor ended: a signature that still signs. */
function isUsable(credential: SignatureCredential): boolean {
  const ended = credential.valid_until !== null && new Date(credential.valid_until) <= new Date();
  return !credential.revoked_at && !ended;
}

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
  const current = query.data?.find((credential) => credential.is_default && isUsable(credential));
  // The newest one, when an administrator withdrew it and nothing replaced it.
  const newest = query.data?.[0];
  const withdrawn = !current && newest?.revoked_at ? newest : undefined;
  let status: OwnSignatureStatus = current ? "ready" : "missing";
  if (canSign && query.isError) status = "unknown";
  else if (canSign && query.isPending) status = "checking";
  // Every earlier one, newest first: replaced by the signer, or withdrawn.
  const past = (query.data ?? []).filter((credential) => credential !== current);
  return { status, canSign, current, past, withdrawn, recheck: () => void query.refetch() };
}
