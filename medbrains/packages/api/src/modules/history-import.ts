/** The `/history-import` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  HistoryImportBatch,
  HistoryImportBatchRequest,
  HistoryImportResult,
  HistoryImportSettings,
} from "@medbrains/types";
import { request } from "../client.js";

export const historyImportApi = {
  getHistoryImportSettings: () => request<HistoryImportSettings>("/history-import/settings"),
  saveHistoryImportSettings: (data: HistoryImportSettings) =>
    request<HistoryImportSettings>("/history-import/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  runHistoryImportBatch: (data: HistoryImportBatchRequest) =>
    request<HistoryImportResult>("/history-import/batches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listHistoryImportBatches: () => request<HistoryImportBatch[]>("/history-import/batches"),
  getHistoryImportBatch: (id: string) =>
    request<HistoryImportBatch>(`/history-import/batches/${id}`),
};
