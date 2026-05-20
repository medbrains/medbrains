import { api } from "@medbrains/api";

export type SubscribeToPackageInput = Parameters<typeof api.subscribeToPackage>[0];
export type ConsumePackageInput = Parameters<typeof api.consumePackage>[1];
export type AdminListDoctorPackagesInput = Parameters<typeof api.adminListDoctorPackages>[0];
export type AdminCreateDoctorPackageInput = Parameters<typeof api.adminCreateDoctorPackage>[0];
export type AdminAddInclusionInput = Parameters<typeof api.adminAddInclusion>[1];

export const patientPackagesService = {
  adminListDoctorPackages: (params?: AdminListDoctorPackagesInput) =>
    api.adminListDoctorPackages(params),
  adminCreateDoctorPackage: (data: AdminCreateDoctorPackageInput) =>
    api.adminCreateDoctorPackage(data),
  adminGetDoctorPackage: (id: string) => api.adminGetDoctorPackage(id),
  adminAddInclusion: (packageId: string, data: AdminAddInclusionInput) =>
    api.adminAddInclusion(packageId, data),
  adminRemoveInclusion: (packageId: string, inclusionId: string) =>
    api.adminRemoveInclusion(packageId, inclusionId),
  listPatientPackages: (patientId: string) => api.listPatientPackages(patientId),
  refundPackage: (subscriptionId: string) => api.refundPackage(subscriptionId),
  consumePackage: (subscriptionId: string, data: ConsumePackageInput) =>
    api.consumePackage(subscriptionId, data),
  listActiveDoctorPackages: () => api.adminListDoctorPackages({ is_active: true }),
  subscribeToPackage: (data: SubscribeToPackageInput) => api.subscribeToPackage(data),
};
