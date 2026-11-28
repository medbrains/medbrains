import { patientsApi } from "@medbrains/api/modules/patients";
import { vteAssessmentsApi } from "@medbrains/api/modules/vte-assessments";

export const vteService = {
  createVteAssessment: (data: Parameters<typeof vteAssessmentsApi.createVteAssessment>[0]) =>
    vteAssessmentsApi.createVteAssessment(data),
  listVteAssessments: (patientId: string) => patientsApi.listVteAssessments(patientId),
};
