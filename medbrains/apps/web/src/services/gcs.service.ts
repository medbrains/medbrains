import { api } from "@medbrains/api";

export const gcsService = {
  computeGcs: (data: Parameters<typeof api.computeGcs>[0]) => api.computeGcs(data),
};
