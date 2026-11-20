import { clinicalApi } from "@medbrains/api/modules/clinical";

export const camIcuService = {
  computeCamIcu: (data: Parameters<typeof clinicalApi.computeCamIcu>[0]) =>
    clinicalApi.computeCamIcu(data),
};
