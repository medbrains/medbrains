import { clinicalApi } from "@medbrains/api/modules/clinical";

export const sepsisService = {
  computeQsofa: (data: Parameters<typeof clinicalApi.computeQsofa>[0]) =>
    clinicalApi.computeQsofa(data),
};
