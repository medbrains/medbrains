import { clinicalApi } from "@medbrains/api/modules/clinical";

export const ciwaArService = {
  computeCiwaAr: (data: Parameters<typeof clinicalApi.computeCiwaAr>[0]) =>
    clinicalApi.computeCiwaAr(data),
};
