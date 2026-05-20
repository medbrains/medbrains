import { api, setCsrfToken } from "@medbrains/api";

export const onboardingService = {
  onboardingStatus: (...args: Parameters<typeof api.onboardingStatus>) =>
    api.onboardingStatus(...args),
  onboardingInit: (...args: Parameters<typeof api.onboardingInit>) => api.onboardingInit(...args),
  onboardingSetup: (...args: Parameters<typeof api.onboardingSetup>) =>
    api.onboardingSetup(...args),
  importDepartments: (...args: Parameters<typeof api.importDepartments>) =>
    api.importDepartments(...args),
  importLocations: (...args: Parameters<typeof api.importLocations>) =>
    api.importLocations(...args),
  importUsers: (...args: Parameters<typeof api.importUsers>) => api.importUsers(...args),
  seedModuleMasters: (...args: Parameters<typeof api.seedModuleMasters>) =>
    api.seedModuleMasters(...args),
  geoCountries: (...args: Parameters<typeof api.geoCountries>) => api.geoCountries(...args),
  geoStates: (...args: Parameters<typeof api.geoStates>) => api.geoStates(...args),
  geoDistricts: (...args: Parameters<typeof api.geoDistricts>) => api.geoDistricts(...args),
  geoAutoDetectRegulators: (...args: Parameters<typeof api.geoAutoDetectRegulators>) =>
    api.geoAutoDetectRegulators(...args),
  setCsrfToken: (...args: Parameters<typeof setCsrfToken>) => setCsrfToken(...args),
};
