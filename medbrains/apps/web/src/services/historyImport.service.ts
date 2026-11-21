import { historyImportApi } from "@medbrains/api/modules/history-import";

/** Historical import: the go-live cut-over, batch check/commit, and the batch log. */
export const historyImportService = {
  getSettings: () => historyImportApi.getHistoryImportSettings(),
  saveSettings: (...args: Parameters<typeof historyImportApi.saveHistoryImportSettings>) =>
    historyImportApi.saveHistoryImportSettings(...args),
  runBatch: (...args: Parameters<typeof historyImportApi.runHistoryImportBatch>) =>
    historyImportApi.runHistoryImportBatch(...args),
  listBatches: () => historyImportApi.listHistoryImportBatches(),
  getBatch: (id: string) => historyImportApi.getHistoryImportBatch(id),
};
