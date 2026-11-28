import { clinicalApi } from "@medbrains/api/modules/clinical";

export const sofaService = {
  computeSofa: (data: Parameters<typeof clinicalApi.computeSofa>[0]) =>
    clinicalApi.computeSofa(data),
};
