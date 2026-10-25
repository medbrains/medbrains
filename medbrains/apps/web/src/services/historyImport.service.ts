import { api } from "@medbrains/api";

/** Historical import: the go-live cut-over, batch check/commit, and the batch log. */
export const historyImportService = {
  getSettings: () => api.getHistoryImportSettings(),
  saveSettings: (...args: Parameters<typeof api.saveHistoryImportSettings>) =>
    api.saveHistoryImportSettings(...args),
  runBatch: (...args: Parameters<typeof api.runHistoryImportBatch>) =>
    api.runHistoryImportBatch(...args),
  listBatches: () => api.listHistoryImportBatches(),
  getBatch: (id: string) => api.getHistoryImportBatch(id),
};
