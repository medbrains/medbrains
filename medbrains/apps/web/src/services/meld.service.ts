import { api } from "@medbrains/api";

export const meldService = {
  computeMeld: (data: Parameters<typeof api.computeMeld>[0]) => api.computeMeld(data),
};
