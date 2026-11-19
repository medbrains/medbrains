import { clinicalApi } from "@medbrains/api/modules/clinical";

export const hasBledService = {
  computeHasBled: (data: Parameters<typeof clinicalApi.computeHasBled>[0]) =>
    clinicalApi.computeHasBled(data),
};
