import { api } from "@medbrains/api";

export const curb65Service = {
  computeCurb65: (data: Parameters<typeof api.computeCurb65>[0]) => api.computeCurb65(data),
};
