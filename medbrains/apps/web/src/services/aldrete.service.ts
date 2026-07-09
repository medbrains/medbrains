import { api } from "@medbrains/api";

export const aldreteService = {
  computeAldrete: (data: Parameters<typeof api.computeAldrete>[0]) => api.computeAldrete(data),
};
