import { clinicalApi } from "@medbrains/api/modules/clinical";

export const childPughService = {
  computeChildPugh: (data: Parameters<typeof clinicalApi.computeChildPugh>[0]) =>
    clinicalApi.computeChildPugh(data),
};
