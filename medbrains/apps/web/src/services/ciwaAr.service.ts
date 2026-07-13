import { api } from "@medbrains/api";

export const ciwaArService = {
  computeCiwaAr: (data: Parameters<typeof api.computeCiwaAr>[0]) => api.computeCiwaAr(data),
};
