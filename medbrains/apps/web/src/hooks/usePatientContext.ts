// usePatientContext — single source of truth for cross-module
// patient context blob. Renders alert chips, feeds form defaults.
// 30 s stale, keeps prior data while refetching to avoid banner flicker.

import { useModuleStore } from "@medbrains/stores";
import type { PatientContext } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { patientsService } from "@/services/patients.service";

export function patientContextQueryKey(patientId: string | null | undefined) {
  return ["patient-context", patientId] as const;
}

/** The context as shown: no outstanding balance where the hospital runs no Billing brick. */
function withoutBalance(context: PatientContext): PatientContext {
  return { ...context, outstanding_balance: "0" };
}

/**
 * The patient's cross-module context. With Billing switched off its balance
 * reads zero: draft lines no desk collects are not a debt, and no banner,
 * summary or chip should show one.
 */
export function usePatientContext(patientId: string | null | undefined) {
  const billingOn = useModuleStore((s) => !s.disabledModules.has("billing"));
  return useQuery<PatientContext>({
    queryKey: patientContextQueryKey(patientId),
    queryFn: () => {
      if (!patientId) {
        throw new Error("patientId is required");
      }
      return patientsService.getPatientContext(patientId);
    },
    enabled: Boolean(patientId),
    select: billingOn ? undefined : withoutBalance,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
