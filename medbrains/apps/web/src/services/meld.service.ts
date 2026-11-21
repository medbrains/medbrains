import { clinicalApi } from "@medbrains/api/modules/clinical";

export const meldService = {
  computeMeld: (data: Parameters<typeof clinicalApi.computeMeld>[0]) =>
    clinicalApi.computeMeld(data),
};
