import { api } from "@medbrains/api";

export const anionGapService = {
  computeAnionGap: (data: Parameters<typeof api.computeAnionGap>[0]) => api.computeAnionGap(data),
};
