import { api } from "@medbrains/api";

export const wellsDvtService = {
  computeWellsDvt: (data: Parameters<typeof api.computeWellsDvt>[0]) => api.computeWellsDvt(data),
};
