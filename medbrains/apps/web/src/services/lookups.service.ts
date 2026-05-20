import { api } from "@medbrains/api";

export const lookupsService = {
  listWards: (...args: Parameters<typeof api.listWards>) => api.listWards(...args),
  listAvailableBeds: (...args: Parameters<typeof api.listAvailableBeds>) =>
    api.listAvailableBeds(...args),
  listEmployees: (...args: Parameters<typeof api.listEmployees>) => api.listEmployees(...args),
  searchPincode: (...args: Parameters<typeof api.searchPincode>) => api.searchPincode(...args),
  listDoctors: (...args: Parameters<typeof api.listDoctors>) => api.listDoctors(...args),
  listPharmacyCatalog: (...args: Parameters<typeof api.listPharmacyCatalog>) =>
    api.listPharmacyCatalog(...args),
  listLabCatalog: (...args: Parameters<typeof api.listLabCatalog>) => api.listLabCatalog(...args),
  listDepartments: (...args: Parameters<typeof api.listDepartments>) =>
    api.listDepartments(...args),
  listPatients: (...args: Parameters<typeof api.listPatients>) => api.listPatients(...args),
  listPatientVisits: (...args: Parameters<typeof api.listPatientVisits>) =>
    api.listPatientVisits(...args),
};
