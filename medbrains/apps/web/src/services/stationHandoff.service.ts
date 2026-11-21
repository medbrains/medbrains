import { stationHandoffsApi } from "@medbrains/api/modules/station-handoffs";

export const stationHandoffService = {
  list: (...args: Parameters<typeof stationHandoffsApi.listStationHandoffs>) =>
    stationHandoffsApi.listStationHandoffs(...args),
  create: (...args: Parameters<typeof stationHandoffsApi.createStationHandoff>) =>
    stationHandoffsApi.createStationHandoff(...args),
  acknowledge: (...args: Parameters<typeof stationHandoffsApi.acknowledgeStationHandoff>) =>
    stationHandoffsApi.acknowledgeStationHandoff(...args),
};
