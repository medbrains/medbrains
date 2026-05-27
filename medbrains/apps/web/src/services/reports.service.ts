import { api } from "@medbrains/api";

export const reportsService = {
  getNabhIndicators: (...args: Parameters<typeof api.getNabhIndicators>) =>
    api.getNabhIndicators(...args),
  listReportTemplates: (...args: Parameters<typeof api.listReportTemplates>) =>
    api.listReportTemplates(...args),
  getReportCatalog: (...args: Parameters<typeof api.getReportCatalog>) =>
    api.getReportCatalog(...args),
  getReportData: (...args: Parameters<typeof api.getReportData>) => api.getReportData(...args),
};
