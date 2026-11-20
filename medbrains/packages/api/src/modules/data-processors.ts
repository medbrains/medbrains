/** The `/data-processors` API area. Moved from `client.ts`; one module per first path segment. */
import type { DataProcessor, DataProcessorInput } from "@medbrains/types";
import { request } from "../client.js";

export const dataProcessorsApi = {
  listDataProcessors: () => request<DataProcessor[]>("/data-processors"),
  createDataProcessor: (data: DataProcessorInput) =>
    request<DataProcessor>("/data-processors", { method: "POST", body: JSON.stringify(data) }),
  updateDataProcessor: (id: string, data: DataProcessorInput) =>
    request<DataProcessor>(`/data-processors/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};
