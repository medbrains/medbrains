import { clinicalApi } from "@medbrains/api/modules/clinical";

export const aldreteService = {
  computeAldrete: (data: Parameters<typeof clinicalApi.computeAldrete>[0]) =>
    clinicalApi.computeAldrete(data),
};
