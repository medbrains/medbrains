import { clinicalApi } from "@medbrains/api/modules/clinical";

export const news2Service = {
  computeNews2: (data: Parameters<typeof clinicalApi.computeNews2>[0]) =>
    clinicalApi.computeNews2(data),
};
