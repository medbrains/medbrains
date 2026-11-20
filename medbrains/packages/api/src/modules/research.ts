/** The `/research` API area. Moved from `client.ts`; one module per first path segment. */
import type { NewResearchExport, ResearchExport, ResearchExportFile } from "@medbrains/types";
import { request } from "../client.js";

export const researchApi = {
  listResearchExports: () => request<ResearchExport[]>("/research/exports"),
  createResearchExport: (data: NewResearchExport) =>
    request<ResearchExport>("/research/exports", { method: "POST", body: JSON.stringify(data) }),
  approveResearchExport: (id: string, note?: string) =>
    request<ResearchExport>(`/research/exports/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  rejectResearchExport: (id: string, note?: string) =>
    request<ResearchExport>(`/research/exports/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  getResearchExportFile: (id: string, file: "data" | "dictionary") =>
    request<ResearchExportFile>(`/research/exports/${id}/files/${file}`),
};
