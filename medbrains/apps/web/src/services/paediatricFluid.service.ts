import { clinicalApi } from "@medbrains/api/modules/clinical";

export const paediatricFluidService = {
  computePaediatricFluid: (data: Parameters<typeof clinicalApi.computePaediatricFluid>[0]) =>
    clinicalApi.computePaediatricFluid(data),
};
