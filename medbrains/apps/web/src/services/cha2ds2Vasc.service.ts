import { clinicalApi } from "@medbrains/api/modules/clinical";

export const cha2ds2VascService = {
  computeCha2ds2Vasc: (data: Parameters<typeof clinicalApi.computeCha2ds2Vasc>[0]) =>
    clinicalApi.computeCha2ds2Vasc(data),
};
