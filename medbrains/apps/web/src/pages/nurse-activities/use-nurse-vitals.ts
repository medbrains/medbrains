import { useQuery } from "@tanstack/react-query";
import { nurseActivitiesService } from "@/services/nurseActivities.service";

/** One vitals-capture schedule on an encounter. */
export interface VitalsScheduleRow {
  id: string;
  encounter_id: string;
  frequency_minutes: number;
  next_due_at: string;
  last_captured_at?: string | null;
}

/**
 * The encounter's vitals schedules and charted vitals for the nurse's vitals
 * tab. Neither is fetched without the view permission or an encounter.
 */
export function useNurseVitals(encounterId: string, canView: boolean) {
  const enabled = canView && encounterId.length > 0;
  const schedules = useQuery({
    queryKey: ["nurse-vitals-schedules", encounterId],
    queryFn: () =>
      nurseActivitiesService.listVitalsSchedules({ encounter_id: encounterId }) as Promise<
        VitalsScheduleRow[]
      >,
    enabled,
  });
  const vitals = useQuery({
    queryKey: ["nurse-vitals", encounterId],
    queryFn: () => nurseActivitiesService.listNurseVitals(encounterId),
    enabled,
  });
  return { schedules, vitals };
}
