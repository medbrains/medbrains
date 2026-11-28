import { researchApi } from "@medbrains/api/modules/research";

/** De-identified research exports: request, decide, and download for 24 hours. */
export const researchExportsService = {
  list: () => researchApi.listResearchExports(),
  create: (...args: Parameters<typeof researchApi.createResearchExport>) =>
    researchApi.createResearchExport(...args),
  approve: (id: string, note?: string) => researchApi.approveResearchExport(id, note),
  reject: (id: string, note?: string) => researchApi.rejectResearchExport(id, note),
  file: (id: string, file: "data" | "dictionary") => researchApi.getResearchExportFile(id, file),
};
