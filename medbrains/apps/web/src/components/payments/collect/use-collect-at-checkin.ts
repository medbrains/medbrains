import { useHasAnyPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQueryClient } from "@tanstack/react-query";
import { billingService } from "@/services/billing.service";
import { billsDue, focusBills } from "./collect-math";
import { useCollect } from "./collect-store";
import { duesKey } from "./use-dues";

/**
 * After a check-in: when the hospital charges the registration or
 * consultation fee at check-in, the desk collects it right there. Opens the
 * drawer for this visit's bills only when something is due on them.
 */
export function useCollectAtCheckIn() {
  const canCollect = useHasAnyPermission([
    P.BILLING.COLLECT_REGISTRATION,
    P.BILLING.COLLECT_OPD,
    P.BILLING.COLLECT_CROSS,
  ]);
  const queryClient = useQueryClient();
  const open = useCollect((s) => s.open);
  return async (patientId: string, encounterId: string) => {
    if (!canCollect) return;
    const dues = await queryClient
      .fetchQuery({
        queryKey: duesKey(patientId),
        queryFn: () => billingService.getPatientDues(patientId),
        staleTime: 0,
      })
      // The check-in stands either way; the banner's chip shows dues it could not read.
      .catch(() => null);
    if (!dues || billsDue(focusBills(dues.bills, { encounterId })) <= 0) return;
    open({ patientId, encounterId, focusLabel: "This visit" });
  };
}
