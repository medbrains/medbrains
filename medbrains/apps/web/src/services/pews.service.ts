import { clinicalApi } from "@medbrains/api/modules/clinical";

export const pewsService = {
  computePews: (data: Parameters<typeof clinicalApi.computePews>[0]) =>
    clinicalApi.computePews(data),
};
