import { api } from "@medbrains/api";

export const meowsService = {
  computeMeows: (data: Parameters<typeof api.computeMeows>[0]) => api.computeMeows(data),
};
