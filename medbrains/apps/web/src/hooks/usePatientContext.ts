// usePatientContext — single source of truth for cross-module
// patient context blob. Renders alert chips, feeds form defaults.
// 30 s stale, keeps prior data while refetching to avoid banner flicker.

import { api } from "@medbrains/api";
import type { PatientContext } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";

export function patientContextQueryKey(patientId: string | null | undefined) {
  return ["patient-context", patientId] as const;
}

export function usePatientContext(patientId: string | null | undefined) {
  return useQuery<PatientContext>({
    queryKey: patientContextQueryKey(patientId),
    queryFn: () => {
      if (!patientId) {
        throw new Error("patientId is required");
      }
      return api.getPatientContext(patientId);
    },
    enabled: Boolean(patientId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
