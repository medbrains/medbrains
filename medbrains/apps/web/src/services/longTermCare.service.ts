import { api } from "@medbrains/api";

export const longTermCareService = {
  listMdsAssessments: api.listMdsAssessments,
  createMdsAssessment: api.createMdsAssessment,
  completeMdsAssessment: api.completeMdsAssessment,
};
