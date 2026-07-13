import { api } from "@medbrains/api";

export const camIcuService = {
  computeCamIcu: (data: Parameters<typeof api.computeCamIcu>[0]) => api.computeCamIcu(data),
};
