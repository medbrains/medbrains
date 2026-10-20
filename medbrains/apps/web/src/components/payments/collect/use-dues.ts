import { useHasAnyPermission } from "@medbrains/stores";
import type { BillingLaneName, DueBill } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { billingService } from "@/services/billing.service";

/** The code that collects each department's bills at its own desk. */
export const LANE_COLLECT: Record<BillingLaneName, string> = {
  registration: P.BILLING.COLLECT_REGISTRATION,
  opd: P.BILLING.COLLECT_OPD,
  lab: P.BILLING.COLLECT_LAB,
  radiology: P.BILLING.COLLECT_RADIOLOGY,
  emergency: P.BILLING.COLLECT_EMERGENCY,
  ipd: P.BILLING.COLLECT_IPD,
  pharmacy: P.BILLING.COLLECT_PHARMACY,
};

/** Every code that lets a desk collect something (#4885). */
export const COLLECT_PERMISSIONS = [...Object.values(LANE_COLLECT), P.BILLING.COLLECT_CROSS];

export const LANE_LABEL: Record<BillingLaneName, string> = {
  registration: "Registration",
  opd: "OPD",
  lab: "Lab",
  radiology: "Radiology",
  emergency: "Emergency",
  ipd: "IPD",
  pharmacy: "Pharmacy",
};

/** The codes that collect a lane here: its own, or the central cashier's. */
export function collectCodes(lane?: BillingLaneName): string[] {
  return lane ? [LANE_COLLECT[lane], P.BILLING.COLLECT_CROSS] : COLLECT_PERMISSIONS;
}

/** Whether this user collects this lane (or anything, with no lane). */
export function useCanCollect(lane?: BillingLaneName): boolean {
  return useHasAnyPermission(collectCodes(lane));
}

export const duesKey = (patientId: string | null | undefined) => ["dues", patientId] as const;

/**
 * What the patient owes, by bill, and what this user may collect of it. A
 * user who collects nothing issues no fetch (the server would answer 403).
 */
export function useDues(patientId: string | null | undefined, enabled = true) {
  const canCollect = useCanCollect();
  return useQuery({
    queryKey: duesKey(patientId),
    queryFn: () => billingService.getPatientDues(patientId ?? ""),
    enabled: enabled && canCollect && Boolean(patientId),
    staleTime: 15_000,
  });
}

/** After money moves: every figure that showed what the patient owed. */
export function useInvalidateDues() {
  const queryClient = useQueryClient();
  return (patientId: string | null | undefined) => {
    for (const key of [
      duesKey(patientId),
      ["patient-context", patientId],
      ["patient-invoices", patientId],
      ["counter-invoices", patientId],
      ["invoices"],
      ["invoice-detail"],
      ["invoice-receipts"],
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

/** Of these bills, the ones still open now — read fresh from the server. */
export function useStillOpenBills() {
  const queryClient = useQueryClient();
  return async (patientId: string, bills: DueBill[]): Promise<DueBill[]> => {
    const dues = await queryClient.fetchQuery({
      queryKey: duesKey(patientId),
      queryFn: () => billingService.getPatientDues(patientId),
      staleTime: 0,
    });
    const open = new Set(dues.bills.map((b) => b.invoice_id));
    return bills.filter((b) => open.has(b.invoice_id));
  };
}
