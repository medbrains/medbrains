import { api } from "@medbrains/api";

/** De-identified research exports: request, decide, and download for 24 hours. */
export const researchExportsService = {
  list: () => api.listResearchExports(),
  create: (...args: Parameters<typeof api.createResearchExport>) =>
    api.createResearchExport(...args),
  approve: (id: string, note?: string) => api.approveResearchExport(id, note),
  reject: (id: string, note?: string) => api.rejectResearchExport(id, note),
  file: (id: string, file: "data" | "dictionary") => api.getResearchExportFile(id, file),
};
