import { clinicalApi } from "@medbrains/api/modules/clinical";

export const glasgowBlatchfordService = {
  computeGlasgowBlatchford: (data: Parameters<typeof clinicalApi.computeGlasgowBlatchford>[0]) =>
    clinicalApi.computeGlasgowBlatchford(data),
};
