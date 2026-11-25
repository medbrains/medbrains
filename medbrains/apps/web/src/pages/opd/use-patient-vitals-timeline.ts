import { useHasAllPermissions } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { opdService } from "@/services/opd.service";

/**
 * The patient's twelve most recent vitals across visits, newest first, for
 * the OPD vitals timeline. Not fetched without both permissions the endpoint
 * needs: the visit's vitals and the patient's record.
 */
export function usePatientVitalsTimeline(patientId: string) {
  const canReadHistory = useHasAllPermissions([P.OPD.VITALS_LIST, P.PATIENTS.VIEW]);
  const { data: patientVitals = [] } = useQuery({
    queryKey: ["patient-vitals-history", patientId, "timeline"],
    queryFn: () => opdService.listPatientVitalsHistory(patientId),
    enabled: canReadHistory,
  });
  return useMemo(
    () =>
      [...patientVitals].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)).slice(0, 12),
    [patientVitals],
  );
}
