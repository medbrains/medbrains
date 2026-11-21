import { adminApi } from "@medbrains/api/modules/admin";
import { setupApi } from "@medbrains/api/modules/setup";

export type AdminListDoctorsInput = Parameters<typeof adminApi.adminListDoctors>[0];
export type AdminListCoverageInput = Parameters<typeof adminApi.adminListCoverage>[0];
export type AdminCreateCoverageInput = Parameters<typeof adminApi.adminCreateCoverage>[0];
export type CreateDoctorInput = Parameters<typeof adminApi.adminCreateDoctor>[0];
export type CreateDoctorUserInput = Parameters<typeof setupApi.createSetupUser>[0];

export const adminDoctorsService = {
  listDoctors: (params: AdminListDoctorsInput) => adminApi.adminListDoctors(params),
  listCoverage: (params?: AdminListCoverageInput) => adminApi.adminListCoverage(params),
  createCoverage: (data: AdminCreateCoverageInput) => adminApi.adminCreateCoverage(data),
  deleteCoverage: (id: string) => adminApi.adminDeleteCoverage(id),
  listSetupUsers: () => setupApi.listSetupUsers(),
  createSetupUser: (data: CreateDoctorUserInput) => setupApi.createSetupUser(data),
  listDepartments: () => setupApi.listDepartments(),
  listSignatureCredentials: (
    params: Parameters<typeof adminApi.adminListSignatureCredentials>[0],
  ) => adminApi.adminListSignatureCredentials(params),
  issueSignatureCredential: (data: Parameters<typeof adminApi.adminIssueSignatureCredential>[0]) =>
    adminApi.adminIssueSignatureCredential(data),
  revokeSignatureCredential: (
    id: string,
    data: Parameters<typeof adminApi.adminRevokeSignatureCredential>[1],
  ) => adminApi.adminRevokeSignatureCredential(id, data),
  createDoctor: (data: CreateDoctorInput) => adminApi.adminCreateDoctor(data),
  updateDoctor: (id: string, data: Parameters<typeof adminApi.adminUpdateDoctor>[1]) =>
    adminApi.adminUpdateDoctor(id, data),
};
