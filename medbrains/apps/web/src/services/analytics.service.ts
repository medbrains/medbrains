import { api } from "@medbrains/api";

export const analyticsService = {
  getDeptRevenue: api.getDeptRevenue,
  getDoctorRevenue: api.getDoctorRevenue,
  exportAnalytics: api.exportAnalytics,
  getOpdFootfall: api.getOpdFootfall,
  getBedOccupancy: api.getBedOccupancy,
  getIpdCensus: api.getIpdCensus,
  getLabTat: api.getLabTat,
  getOtUtilization: api.getOtUtilization,
  getErVolume: api.getErVolume,
  getClinicalIndicators: api.getClinicalIndicators,
};
