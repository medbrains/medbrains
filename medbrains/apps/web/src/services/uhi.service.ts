import { abdmApi } from "@medbrains/api/modules/abdm";
import { uhiApi } from "@medbrains/api/modules/uhi";

export const uhiService = {
  getSettings: () => uhiApi.getUhiSettings(),
  saveSettings: (...args: Parameters<typeof uhiApi.saveUhiSettings>) =>
    uhiApi.saveUhiSettings(...args),
  generateKeys: (privateKey?: string) => uhiApi.generateUhiKeys(privateKey),
  listRequests: (...args: Parameters<typeof uhiApi.listUhiRequests>) =>
    uhiApi.listUhiRequests(...args),
  accept: (id: string) => uhiApi.acceptUhiRequest(id),
  decline: (id: string, reason: string) => uhiApi.declineUhiRequest(id, reason),
  checkPin: (id: string, pin: string) => uhiApi.checkUhiPin(id, pin),
  listCampuses: () => abdmApi.listFacilityHfr(),
};
