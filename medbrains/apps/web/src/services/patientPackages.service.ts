import { adminApi } from "@medbrains/api/modules/admin";
import { patientPackagesApi } from "@medbrains/api/modules/patient-packages";

export type SubscribeToPackageInput = Parameters<typeof patientPackagesApi.subscribeToPackage>[0];
export type ConsumePackageInput = Parameters<typeof patientPackagesApi.consumePackage>[1];
export type AdminListDoctorPackagesInput = Parameters<typeof adminApi.adminListDoctorPackages>[0];
export type AdminCreateDoctorPackageInput = Parameters<typeof adminApi.adminCreateDoctorPackage>[0];
export type AdminAddInclusionInput = Parameters<typeof adminApi.adminAddInclusion>[1];

export const patientPackagesService = {
  adminListDoctorPackages: (params?: AdminListDoctorPackagesInput) =>
    adminApi.adminListDoctorPackages(params),
  adminCreateDoctorPackage: (data: AdminCreateDoctorPackageInput) =>
    adminApi.adminCreateDoctorPackage(data),
  adminGetDoctorPackage: (id: string) => adminApi.adminGetDoctorPackage(id),
  adminAddInclusion: (packageId: string, data: AdminAddInclusionInput) =>
    adminApi.adminAddInclusion(packageId, data),
  adminRemoveInclusion: (packageId: string, inclusionId: string) =>
    adminApi.adminRemoveInclusion(packageId, inclusionId),
  listPatientPackages: (patientId: string) => patientPackagesApi.listPatientPackages(patientId),
  refundPackage: (subscriptionId: string) => patientPackagesApi.refundPackage(subscriptionId),
  consumePackage: (subscriptionId: string, data: ConsumePackageInput) =>
    patientPackagesApi.consumePackage(subscriptionId, data),
  listActiveDoctorPackages: () => adminApi.adminListDoctorPackages({ is_active: true }),
  subscribeToPackage: (data: SubscribeToPackageInput) =>
    patientPackagesApi.subscribeToPackage(data),
};
