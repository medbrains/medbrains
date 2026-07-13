import { api } from "@medbrains/api";

export const hasBledService = {
  computeHasBled: (data: Parameters<typeof api.computeHasBled>[0]) => api.computeHasBled(data),
};
