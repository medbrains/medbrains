import { setupApi } from "@medbrains/api/modules/setup";
import { tvApi } from "@medbrains/api/modules/tv";

export const tvDisplaysService = {
  listTvDisplays: (...args: Parameters<typeof tvApi.listTvDisplays>) =>
    tvApi.listTvDisplays(...args),
  createTvDisplay: (...args: Parameters<typeof tvApi.createTvDisplay>) =>
    tvApi.createTvDisplay(...args),
  updateTvDisplay: (...args: Parameters<typeof tvApi.updateTvDisplay>) =>
    tvApi.updateTvDisplay(...args),
  deleteTvDisplay: (...args: Parameters<typeof tvApi.deleteTvDisplay>) =>
    tvApi.deleteTvDisplay(...args),
  listQueueTokens: (...args: Parameters<typeof tvApi.listQueueTokens>) =>
    tvApi.listQueueTokens(...args),
  createQueueToken: (...args: Parameters<typeof tvApi.createQueueToken>) =>
    tvApi.createQueueToken(...args),
  callQueueToken: (...args: Parameters<typeof tvApi.callQueueToken>) =>
    tvApi.callQueueToken(...args),
  completeQueueToken: (...args: Parameters<typeof tvApi.completeQueueToken>) =>
    tvApi.completeQueueToken(...args),
  noShowQueueToken: (...args: Parameters<typeof tvApi.noShowQueueToken>) =>
    tvApi.noShowQueueToken(...args),
  getQueueState: (...args: Parameters<typeof tvApi.getQueueState>) => tvApi.getQueueState(...args),
  broadcastAnnouncement: (...args: Parameters<typeof tvApi.broadcastAnnouncement>) =>
    tvApi.broadcastAnnouncement(...args),
  listDepartments: (...args: Parameters<typeof setupApi.listDepartments>) =>
    setupApi.listDepartments(...args),
};
