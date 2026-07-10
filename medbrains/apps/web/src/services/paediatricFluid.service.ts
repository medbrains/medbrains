import { api } from "@medbrains/api";

export const paediatricFluidService = {
  computePaediatricFluid: (data: Parameters<typeof api.computePaediatricFluid>[0]) =>
    api.computePaediatricFluid(data),
};
