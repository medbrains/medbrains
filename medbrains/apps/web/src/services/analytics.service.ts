import { analyticsApi } from "@medbrains/api/modules/analytics";

export const analyticsService = {
  getDeptRevenue: analyticsApi.getDeptRevenue,
  getDoctorRevenue: analyticsApi.getDoctorRevenue,
  exportAnalytics: analyticsApi.exportAnalytics,
  getOpdFootfall: analyticsApi.getOpdFootfall,
  getBedOccupancy: analyticsApi.getBedOccupancy,
  getIpdCensus: analyticsApi.getIpdCensus,
  getLabTat: analyticsApi.getLabTat,
  getOtUtilization: analyticsApi.getOtUtilization,
  getErVolume: analyticsApi.getErVolume,
  getClinicalIndicators: analyticsApi.getClinicalIndicators,
};
