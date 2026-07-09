import { api } from "@medbrains/api";

export const vteService = {
  createVteAssessment: (data: Parameters<typeof api.createVteAssessment>[0]) =>
    api.createVteAssessment(data),
  listVteAssessments: (patientId: string) => api.listVteAssessments(patientId),
};
