import { api } from "@medbrains/api";

export const uhiService = {
  getSettings: () => api.getUhiSettings(),
  saveSettings: (...args: Parameters<typeof api.saveUhiSettings>) => api.saveUhiSettings(...args),
  generateKeys: (privateKey?: string) => api.generateUhiKeys(privateKey),
  listRequests: (...args: Parameters<typeof api.listUhiRequests>) => api.listUhiRequests(...args),
  accept: (id: string) => api.acceptUhiRequest(id),
  decline: (id: string, reason: string) => api.declineUhiRequest(id, reason),
  checkPin: (id: string, pin: string) => api.checkUhiPin(id, pin),
  listCampuses: () => api.listFacilityHfr(),
};
