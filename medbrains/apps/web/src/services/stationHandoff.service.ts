import { api } from "@medbrains/api";

export const stationHandoffService = {
  list: (...args: Parameters<typeof api.listStationHandoffs>) => api.listStationHandoffs(...args),
  create: (...args: Parameters<typeof api.createStationHandoff>) =>
    api.createStationHandoff(...args),
  acknowledge: (...args: Parameters<typeof api.acknowledgeStationHandoff>) =>
    api.acknowledgeStationHandoff(...args),
};
