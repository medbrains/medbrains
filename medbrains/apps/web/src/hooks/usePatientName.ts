// usePatientName — shared, cached fetch of patient display name.
// 5min stale (names rarely change), keeps tables consistent across the app.

import { api } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";

export interface PatientNameInfo {
  id: string;
  uhid: string;
  full_name: string;
}

export function patientNameQueryKey(patientId: string | null | undefined) {
  return ["patient-name", patientId] as const;
}

export function usePatientName(patientId: string | null | undefined) {
  return useQuery<PatientNameInfo>({
    queryKey: patientNameQueryKey(patientId),
    queryFn: async () => {
      if (!patientId) {
        throw new Error("patientId is required");
      }
      const p = await api.getPatient(patientId);
      const nameParts = [p.prefix, p.first_name, p.middle_name, p.last_name].filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      );
      return {
        id: p.id,
        uhid: p.uhid,
        full_name: nameParts.join(" "),
      };
    },
    enabled: Boolean(patientId),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
