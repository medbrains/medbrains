import { api } from "@medbrains/api";
import type { CompleteAbdmProfileShare } from "@medbrains/types";

/** ABDM Scan & Share: counter QR codes and the desk's queue of shared profiles. */
export const abdmScanShareService = {
  counters: () => api.getAbdmScanShareCounters(),
  queue: () => api.listAbdmScanShares(),
  verify: (id: string) => api.createAbdmScanShareVerification(id),
  complete: (id: string, data: CompleteAbdmProfileShare) => api.completeAbdmScanShare(id, data),
  dismiss: (id: string) => api.dismissAbdmScanShare(id),
};
