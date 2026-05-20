import { api } from "@medbrains/api";

export const pgLogbookService = {
  listPgLogbook: (...args: Parameters<typeof api.listPgLogbook>) => api.listPgLogbook(...args),
  createPgLogbookEntry: (...args: Parameters<typeof api.createPgLogbookEntry>) =>
    api.createPgLogbookEntry(...args),
  verifyPgLogbookEntry: (...args: Parameters<typeof api.verifyPgLogbookEntry>) =>
    api.verifyPgLogbookEntry(...args),
  listCoSignatures: (...args: Parameters<typeof api.listCoSignatures>) =>
    api.listCoSignatures(...args),
  updateCoSignature: (...args: Parameters<typeof api.updateCoSignature>) =>
    api.updateCoSignature(...args),
};
