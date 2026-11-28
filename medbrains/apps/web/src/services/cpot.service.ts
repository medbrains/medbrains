import { clinicalApi } from "@medbrains/api/modules/clinical";

export const cpotService = {
  computeCpot: (data: Parameters<typeof clinicalApi.computeCpot>[0]) =>
    clinicalApi.computeCpot(data),
};
