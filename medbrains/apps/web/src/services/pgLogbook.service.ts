import { cdsApi } from "@medbrains/api/modules/cds";

export const pgLogbookService = {
  listPgLogbook: (...args: Parameters<typeof cdsApi.listPgLogbook>) =>
    cdsApi.listPgLogbook(...args),
  createPgLogbookEntry: (...args: Parameters<typeof cdsApi.createPgLogbookEntry>) =>
    cdsApi.createPgLogbookEntry(...args),
  verifyPgLogbookEntry: (...args: Parameters<typeof cdsApi.verifyPgLogbookEntry>) =>
    cdsApi.verifyPgLogbookEntry(...args),
  listCoSignatures: (...args: Parameters<typeof cdsApi.listCoSignatures>) =>
    cdsApi.listCoSignatures(...args),
  updateCoSignature: (...args: Parameters<typeof cdsApi.updateCoSignature>) =>
    cdsApi.updateCoSignature(...args),
};
