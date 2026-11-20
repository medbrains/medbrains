import { abdmApi } from "@medbrains/api/modules/abdm";
import type { CompleteAbdmProfileShare } from "@medbrains/types";

/** ABDM Scan & Share: counter QR codes and the desk's queue of shared profiles. */
export const abdmScanShareService = {
  counters: () => abdmApi.getAbdmScanShareCounters(),
  queue: () => abdmApi.listAbdmScanShares(),
  verify: (id: string) => abdmApi.createAbdmScanShareVerification(id),
  complete: (id: string, data: CompleteAbdmProfileShare) => abdmApi.completeAbdmScanShare(id, data),
  dismiss: (id: string) => abdmApi.dismissAbdmScanShare(id),
};
