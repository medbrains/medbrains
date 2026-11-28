import { chronicCareApi } from "@medbrains/api/modules/chronic-care";

export type ListChronicProgramsInput = Parameters<typeof chronicCareApi.listChronicPrograms>[0];
export type CreateChronicProgramInput = Parameters<typeof chronicCareApi.createChronicProgram>[0];
export type UpdateChronicProgramInput = Parameters<typeof chronicCareApi.updateChronicProgram>[1];
export type ListChronicEnrollmentsInput = Parameters<
  typeof chronicCareApi.listChronicEnrollments
>[0];
export type CreateChronicEnrollmentInput = Parameters<typeof chronicCareApi.createEnrollment>[0];

export const chronicCareService = {
  listChronicPrograms: (params?: ListChronicProgramsInput) =>
    chronicCareApi.listChronicPrograms(params),
  createChronicProgram: (data: CreateChronicProgramInput) =>
    chronicCareApi.createChronicProgram(data),
  updateChronicProgram: (id: string, data: UpdateChronicProgramInput) =>
    chronicCareApi.updateChronicProgram(id, data),
  deleteChronicProgram: (id: string) => chronicCareApi.deleteChronicProgram(id),
  listChronicEnrollments: (params?: ListChronicEnrollmentsInput) =>
    chronicCareApi.listChronicEnrollments(params),
  createEnrollment: (data: CreateChronicEnrollmentInput) => chronicCareApi.createEnrollment(data),
  adherenceSummary: (enrollmentId: string) => chronicCareApi.adherenceSummary(enrollmentId),
  outcomeDashboard: (patientId: string) => chronicCareApi.outcomeDashboard(patientId),
  drugTimelineWithLabs: (patientId: string) => chronicCareApi.drugTimelineWithLabs(patientId),
  treatmentSummary: (patientId: string) => chronicCareApi.treatmentSummary(patientId),
};
