import type { VerifyConsentResponse } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { consentService } from "@/services/consent.service";

/**
 * Three outcomes for a consent check, never two.
 *
 * `POST /consent/verify` answers `{ is_valid }`, which is a boolean, and a
 * boolean cannot carry the difference between "this patient has not consented"
 * and "we could not find out". Collapsing those is the failure this repo names
 * explicitly: a fault must not inherit the disguise a refusal wears. Told "no
 * consent on file" a clinician stops and goes to get one; told nothing, they
 * proceed. Told the check failed, they verify another way — which is the only
 * safe response to not knowing.
 *
 * Mirrors `medbrains_authz::decision::Outcome` on the Rust side, including its
 * deliberate refusal to offer a `boolean` conversion.
 */
export type ConsentGateOutcome = "checking" | "allow" | "deny" | "unknown";

export interface ConsentGate {
  outcome: ConsentGateOutcome;
  /** The consent that allowed it, when one did. Null in every other outcome. */
  consent: VerifyConsentResponse | null;
  /** Retry after an `unknown`. */
  recheck: () => void;
}

export function useConsentGate(args: {
  patientId: string | null | undefined;
  /** e.g. "surgery", "blood_transfusion", "contrast_administration" */
  procedureType?: string;
  consentType?: string;
  /** Skip the check entirely — the gate reports `checking` and blocks nothing. */
  enabled?: boolean;
}): ConsentGate {
  const { patientId, procedureType, consentType, enabled = true } = args;
  const active = enabled && !!patientId;

  const query = useQuery({
    queryKey: ["consent-gate", patientId, procedureType ?? null, consentType ?? null],
    queryFn: () =>
      consentService.verifyConsent({
        patient_id: patientId as string,
        procedure_type: procedureType,
        consent_type: consentType,
      }),
    enabled: active,
    // One retry, because a single transient blip should not put a clinician
    // into the unknown branch. More than that and we are hiding an outage.
    retry: 1,
    staleTime: 30_000,
  });

  let outcome: ConsentGateOutcome;
  if (!active || query.isPending) {
    outcome = "checking";
  } else if (query.isError) {
    outcome = "unknown";
  } else if (query.data?.is_valid) {
    outcome = "allow";
  } else {
    outcome = "deny";
  }

  return {
    outcome,
    consent: outcome === "allow" ? (query.data ?? null) : null,
    recheck: () => {
      void query.refetch();
    },
  };
}
