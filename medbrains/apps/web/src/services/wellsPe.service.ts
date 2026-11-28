import { clinicalApi } from "@medbrains/api/modules/clinical";

export const wellsPeService = {
  computeWellsPe: (data: Parameters<typeof clinicalApi.computeWellsPe>[0]) =>
    clinicalApi.computeWellsPe(data),
};
