import { labApi } from "@medbrains/api/modules/lab";
import { nabhApi } from "@medbrains/api/modules/nabh";
import { reportsApi } from "@medbrains/api/modules/reports";

export const reportsService = {
  getNabhIndicators: (...args: Parameters<typeof nabhApi.getNabhIndicators>) =>
    nabhApi.getNabhIndicators(...args),
  listReportTemplates: (...args: Parameters<typeof labApi.listReportTemplates>) =>
    labApi.listReportTemplates(...args),
  getReportCatalog: (...args: Parameters<typeof reportsApi.getReportCatalog>) =>
    reportsApi.getReportCatalog(...args),
  getReportData: (...args: Parameters<typeof reportsApi.getReportData>) =>
    reportsApi.getReportData(...args),
};
