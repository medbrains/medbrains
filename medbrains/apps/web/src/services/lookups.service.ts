import { geoApi } from "@medbrains/api/modules/geo";
import { hrApi } from "@medbrains/api/modules/hr";
import { ipdApi } from "@medbrains/api/modules/ipd";
import { labApi } from "@medbrains/api/modules/lab";
import { patientsApi } from "@medbrains/api/modules/patients";
import { pharmacyApi } from "@medbrains/api/modules/pharmacy";
import { setupApi } from "@medbrains/api/modules/setup";

export const lookupsService = {
  listWards: (...args: Parameters<typeof ipdApi.listWards>) => ipdApi.listWards(...args),
  listAvailableBeds: (...args: Parameters<typeof ipdApi.listAvailableBeds>) =>
    ipdApi.listAvailableBeds(...args),
  listEmployees: (...args: Parameters<typeof hrApi.listEmployees>) => hrApi.listEmployees(...args),
  searchPincode: (...args: Parameters<typeof geoApi.searchPincode>) =>
    geoApi.searchPincode(...args),
  listDoctors: (...args: Parameters<typeof setupApi.listDoctors>) => setupApi.listDoctors(...args),
  listPharmacyCatalog: (...args: Parameters<typeof pharmacyApi.listPharmacyCatalog>) =>
    pharmacyApi.listPharmacyCatalog(...args),
  listLabCatalog: (...args: Parameters<typeof labApi.listLabCatalog>) =>
    labApi.listLabCatalog(...args),
  listDepartments: (...args: Parameters<typeof setupApi.listDepartments>) =>
    setupApi.listDepartments(...args),
  listPatients: (...args: Parameters<typeof patientsApi.listPatients>) =>
    patientsApi.listPatients(...args),
  findPatients: (...args: Parameters<typeof patientsApi.findPatients>) =>
    patientsApi.findPatients(...args),
  listPatientVisits: (...args: Parameters<typeof patientsApi.listPatientVisits>) =>
    patientsApi.listPatientVisits(...args),
};
