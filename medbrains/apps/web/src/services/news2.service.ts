import { api } from "@medbrains/api";

export const news2Service = {
  computeNews2: (data: Parameters<typeof api.computeNews2>[0]) => api.computeNews2(data),
};
