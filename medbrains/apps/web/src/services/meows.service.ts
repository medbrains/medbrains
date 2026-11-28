import { clinicalApi } from "@medbrains/api/modules/clinical";

export const meowsService = {
  computeMeows: (data: Parameters<typeof clinicalApi.computeMeows>[0]) =>
    clinicalApi.computeMeows(data),
};
