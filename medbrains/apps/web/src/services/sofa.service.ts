import { api } from "@medbrains/api";

export const sofaService = {
  computeSofa: (data: Parameters<typeof api.computeSofa>[0]) => api.computeSofa(data),
};
