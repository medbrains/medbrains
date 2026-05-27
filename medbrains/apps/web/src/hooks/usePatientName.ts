// usePatientName — shared, cached fetch of patient display name.
// 5min stale (names rarely change), keeps tables consistent across the app.

import type { Gender } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { patientsService } from "../services/patients.service";

export interface PatientNameInfo {
  id: string;
  uhid: string;
  full_name: string;
  gender: Gender;
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
      const p = await patientsService.getPatient(patientId);
      const nameParts = [p.prefix, p.first_name, p.middle_name, p.last_name].filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      );
      return {
        id: p.id,
        uhid: p.uhid,
        full_name: nameParts.join(" "),
        gender: p.gender,
      };
    },
    enabled: Boolean(patientId),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
