import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import { P, type SignableTypeInfo } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { signoffService } from "@/services/signoff.service";

/** The record types the server signs, keyed by `record_type`. */
export type SignableTypes = ReadonlyMap<string, SignableTypeInfo>;

/** What the signer may sign, as the server's signing permissions allow. */
export interface SignRights {
  canSignAsDoctor: boolean;
  canSignAsNurse: boolean;
}

/**
 * Whether these rights sign `info`: a nursing entry takes the nurse or the
 * doctor signing right (doctors chart too), anything else the doctor's. The
 * same rule as `signable::require_sign_permission` on the server.
 */
export function canSignType(info: SignableTypeInfo | undefined, rights: SignRights): boolean {
  if (!info) return false;
  if (info.signer === "nurse") return rights.canSignAsDoctor || rights.canSignAsNurse;
  return rights.canSignAsDoctor;
}

/**
 * Whether the signed-in user is the record's author, the only person the
 * server lets sign it as author. An unknown user or author is not a match.
 */
export function isRecordAuthor(
  authorId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  return Boolean(authorId && userId && authorId === userId);
}

/**
 * The server's list of signable types (`GET /api/signatures/types`), read once
 * per session. The query only runs for someone who may sign or verify, and a
 * failed read is reported as `isError`, never as "nothing is signable".
 */
export function useSignableTypes(): {
  types: SignableTypes | undefined;
  isError: boolean;
  rights: SignRights;
} {
  const canSignAsDoctor = useHasPermission(P.DOCTOR.SIGNATURE.SIGN);
  const canSignAsNurse = useHasPermission(P.NURSE.SIGNATURE.SIGN);
  const mayRead = useHasAnyPermission([
    P.DOCTOR.SIGNATURE.SIGN,
    P.NURSE.SIGNATURE.SIGN,
    P.DOCTOR.SIGNATURE.VERIFY,
  ]);
  const { data, isError } = useQuery({
    queryKey: ["signable-types"],
    queryFn: () => signoffService.listSignableTypes(),
    enabled: mayRead,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const types = useMemo(
    () => (data ? new Map(data.map((t) => [t.record_type, t])) : undefined),
    [data],
  );
  return { types, isError, rights: { canSignAsDoctor, canSignAsNurse } };
}
