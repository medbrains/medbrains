import { clinicalApi } from "@medbrains/api/modules/clinical";

export const osmolarGapService = {
  computeOsmolarGap: (data: Parameters<typeof clinicalApi.computeOsmolarGap>[0]) =>
    clinicalApi.computeOsmolarGap(data),
};
