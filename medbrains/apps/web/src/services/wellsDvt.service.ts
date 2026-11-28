import { clinicalApi } from "@medbrains/api/modules/clinical";

export const wellsDvtService = {
  computeWellsDvt: (data: Parameters<typeof clinicalApi.computeWellsDvt>[0]) =>
    clinicalApi.computeWellsDvt(data),
};
