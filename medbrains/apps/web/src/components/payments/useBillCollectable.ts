import { useHasAnyPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { billingService } from "@/services/billing.service";

/** Every code that lets a desk collect something (#4885). */
export const COLLECT_PERMISSIONS = [
  P.BILLING.COLLECT_REGISTRATION,
  P.BILLING.COLLECT_OPD,
  P.BILLING.COLLECT_LAB,
  P.BILLING.COLLECT_RADIOLOGY,
  P.BILLING.COLLECT_EMERGENCY,
  P.BILLING.COLLECT_IPD,
  P.BILLING.COLLECT_PHARMACY,
  P.BILLING.COLLECT_CROSS,
];

/** Whether this caller may collect this bill: three answers, never two. */
export type Collectable = "checking" | "yes" | "no" | "unknown";

/**
 * Asks the server — which owns the lane rules — whether the bill is one this
 * desk collects. A caller without any collect code issues no fetch.
 */
export function useBillCollectable(
  patientId: string | undefined,
  invoiceId: string | undefined,
  enabled: boolean,
): Collectable {
  const canCollectSomething = useHasAnyPermission(COLLECT_PERMISSIONS);
  const dues = useQuery({
    queryKey: ["dues", patientId],
    queryFn: () => billingService.getPatientDues(patientId ?? ""),
    enabled: enabled && canCollectSomething && Boolean(patientId),
  });
  if (!canCollectSomething) return "no";
  if (dues.isError) return "unknown";
  if (!dues.data) return "checking";
  return dues.data.bills.some((bill) => bill.invoice_id === invoiceId && bill.can_collect)
    ? "yes"
    : "no";
}
