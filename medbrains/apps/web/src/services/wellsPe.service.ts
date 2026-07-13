import { api } from "@medbrains/api";

export const wellsPeService = {
  computeWellsPe: (data: Parameters<typeof api.computeWellsPe>[0]) => api.computeWellsPe(data),
};
