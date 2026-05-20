import { api } from "@medbrains/api";

export type AdminListDoctorsInput = Parameters<typeof api.adminListDoctors>[0];
export type AdminListCoverageInput = Parameters<typeof api.adminListCoverage>[0];
export type AdminCreateCoverageInput = Parameters<typeof api.adminCreateCoverage>[0];
export type CreateDoctorInput = Parameters<typeof api.adminCreateDoctor>[0];
export type CreateDoctorUserInput = Parameters<typeof api.createSetupUser>[0];

export const adminDoctorsService = {
  listDoctors: (params: AdminListDoctorsInput) => api.adminListDoctors(params),
  listCoverage: (params?: AdminListCoverageInput) => api.adminListCoverage(params),
  createCoverage: (data: AdminCreateCoverageInput) => api.adminCreateCoverage(data),
  deleteCoverage: (id: string) => api.adminDeleteCoverage(id),
  listSetupUsers: () => api.listSetupUsers(),
  createSetupUser: (data: CreateDoctorUserInput) => api.createSetupUser(data),
  listDepartments: () => api.listDepartments(),
  listSignatureCredentials: (params: Parameters<typeof api.adminListSignatureCredentials>[0]) =>
    api.adminListSignatureCredentials(params),
  issueSignatureCredential: (data: Parameters<typeof api.adminIssueSignatureCredential>[0]) =>
    api.adminIssueSignatureCredential(data),
  revokeSignatureCredential: (
    id: string,
    data: Parameters<typeof api.adminRevokeSignatureCredential>[1],
  ) => api.adminRevokeSignatureCredential(id, data),
  createDoctor: (data: CreateDoctorInput) => api.adminCreateDoctor(data),
};
