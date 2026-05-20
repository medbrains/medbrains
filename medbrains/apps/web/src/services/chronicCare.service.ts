import { api } from "@medbrains/api";

export type ListChronicProgramsInput = Parameters<typeof api.listChronicPrograms>[0];
export type CreateChronicProgramInput = Parameters<typeof api.createChronicProgram>[0];
export type UpdateChronicProgramInput = Parameters<typeof api.updateChronicProgram>[1];
export type ListChronicEnrollmentsInput = Parameters<typeof api.listChronicEnrollments>[0];
export type CreateChronicEnrollmentInput = Parameters<typeof api.createEnrollment>[0];

export const chronicCareService = {
  listChronicPrograms: (params?: ListChronicProgramsInput) => api.listChronicPrograms(params),
  createChronicProgram: (data: CreateChronicProgramInput) => api.createChronicProgram(data),
  updateChronicProgram: (id: string, data: UpdateChronicProgramInput) =>
    api.updateChronicProgram(id, data),
  deleteChronicProgram: (id: string) => api.deleteChronicProgram(id),
  listChronicEnrollments: (params?: ListChronicEnrollmentsInput) =>
    api.listChronicEnrollments(params),
  createEnrollment: (data: CreateChronicEnrollmentInput) => api.createEnrollment(data),
  adherenceSummary: (enrollmentId: string) => api.adherenceSummary(enrollmentId),
  outcomeDashboard: (patientId: string) => api.outcomeDashboard(patientId),
  drugTimelineWithLabs: (patientId: string) => api.drugTimelineWithLabs(patientId),
  treatmentSummary: (patientId: string) => api.treatmentSummary(patientId),
};
