/** The `/document-ingestion` API area. Moved from `client.ts`; one module per first path segment. */
import type { AddIngestionItemInput, IngestionBatch, IngestionItem } from "@medbrains/types";
import { request } from "../client.js";

export const documentIngestionApi = {
  // Reverse-print / document ingestion
  listIngestionBatches: () => request<IngestionBatch[]>("/document-ingestion/batches"),
  createIngestionBatch: (data: { label: string }) =>
    request<IngestionBatch>("/document-ingestion/batches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIngestionItems: (batchId: string) =>
    request<IngestionItem[]>(`/document-ingestion/batches/${batchId}/items`),
  addIngestionItem: (batchId: string, data: AddIngestionItemInput) =>
    request<IngestionItem>(`/document-ingestion/batches/${batchId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  linkIngestionItem: (itemId: string, data: { barcode: string }) =>
    request<IngestionItem>(`/document-ingestion/items/${itemId}/link`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  fileIngestionItem: (itemId: string) =>
    request<IngestionItem>(`/document-ingestion/items/${itemId}/file`, { method: "PUT" }),
  ocrIngestionItem: (itemId: string) =>
    request<IngestionItem>(`/document-ingestion/items/${itemId}/ocr`, { method: "PUT" }),
  searchIngested: (q: string) =>
    request<IngestionItem[]>(`/document-ingestion/search?q=${encodeURIComponent(q)}`),
};
