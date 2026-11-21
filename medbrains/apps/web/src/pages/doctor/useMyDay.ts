import type { MyDayResponse } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { doctorService } from "@/services/doctor.service";

/** The doctor's day, refreshed every 30 seconds, with its tile numbers. */
export function useMyDay() {
  const query = useQuery<MyDayResponse>({
    queryKey: ["my-day"],
    queryFn: () => doctorService.getMyDay(),
    refetchInterval: 30_000,
  });
  return {
    myDay: query.data,
    isLoading: query.isLoading,
    shown: dayCounts(query.data, query.isError),
  };
}

/** A count as shown, or "—" when it could not be read. */
type Shown = number | "—";

/**
 * The tile numbers. A failed load shows "—", never 0: a zero on a fault
 * tells a doctor their day is empty (#6009). The shell banner says why.
 */
function dayCounts(myDay: MyDayResponse | undefined, isError: boolean) {
  /** One tile's number, or "—" when the load failed. */
  const show = (n: number | undefined): Shown => (isError ? "—" : (n ?? 0));
  return {
    appointments: show(myDay?.today.appointments_total),
    signoffs: show(myDay?.pending_signoffs.total),
    otCases: show(myDay?.today.ot_cases),
    criticalAlerts: show(myDay?.today.critical_alerts),
    signoffBadge: isError ? undefined : myDay?.pending_signoffs.total,
  };
}
