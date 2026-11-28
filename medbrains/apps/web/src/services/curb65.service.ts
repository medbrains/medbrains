import { clinicalApi } from "@medbrains/api/modules/clinical";

export const curb65Service = {
  computeCurb65: (data: Parameters<typeof clinicalApi.computeCurb65>[0]) =>
    clinicalApi.computeCurb65(data),
};
