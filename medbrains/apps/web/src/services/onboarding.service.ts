import { setCsrfToken } from "@medbrains/api";
import { geoApi } from "@medbrains/api/modules/geo";
import { onboardingApi } from "@medbrains/api/modules/onboarding";
import { setupApi } from "@medbrains/api/modules/setup";

export const onboardingService = {
  onboardingStatus: (...args: Parameters<typeof onboardingApi.onboardingStatus>) =>
    onboardingApi.onboardingStatus(...args),
  onboardingInit: (...args: Parameters<typeof onboardingApi.onboardingInit>) =>
    onboardingApi.onboardingInit(...args),
  getTrialSizing: (...args: Parameters<typeof onboardingApi.getTrialSizing>) =>
    onboardingApi.getTrialSizing(...args),
  onboardingSetup: (...args: Parameters<typeof onboardingApi.onboardingSetup>) =>
    onboardingApi.onboardingSetup(...args),
  importDepartments: (...args: Parameters<typeof setupApi.importDepartments>) =>
    setupApi.importDepartments(...args),
  importLocations: (...args: Parameters<typeof setupApi.importLocations>) =>
    setupApi.importLocations(...args),
  importUsers: (...args: Parameters<typeof setupApi.importUsers>) => setupApi.importUsers(...args),
  seedModuleMasters: (...args: Parameters<typeof setupApi.seedModuleMasters>) =>
    setupApi.seedModuleMasters(...args),
  geoCountries: (...args: Parameters<typeof geoApi.geoCountries>) => geoApi.geoCountries(...args),
  geoStates: (...args: Parameters<typeof geoApi.geoStates>) => geoApi.geoStates(...args),
  geoDistricts: (...args: Parameters<typeof geoApi.geoDistricts>) => geoApi.geoDistricts(...args),
  geoAutoDetectRegulators: (...args: Parameters<typeof geoApi.geoAutoDetectRegulators>) =>
    geoApi.geoAutoDetectRegulators(...args),
  setCsrfToken: (...args: Parameters<typeof setCsrfToken>) => setCsrfToken(...args),
};
