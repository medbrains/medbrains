import { clinicalApi } from "@medbrains/api/modules/clinical";

export const anionGapService = {
  computeAnionGap: (data: Parameters<typeof clinicalApi.computeAnionGap>[0]) =>
    clinicalApi.computeAnionGap(data),
};
