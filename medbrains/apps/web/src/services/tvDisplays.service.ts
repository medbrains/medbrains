import { api } from "@medbrains/api";

export const tvDisplaysService = {
  listTvDisplays: (...args: Parameters<typeof api.listTvDisplays>) => api.listTvDisplays(...args),
  createTvDisplay: (...args: Parameters<typeof api.createTvDisplay>) =>
    api.createTvDisplay(...args),
  updateTvDisplay: (...args: Parameters<typeof api.updateTvDisplay>) =>
    api.updateTvDisplay(...args),
  deleteTvDisplay: (...args: Parameters<typeof api.deleteTvDisplay>) =>
    api.deleteTvDisplay(...args),
  listQueueTokens: (...args: Parameters<typeof api.listQueueTokens>) =>
    api.listQueueTokens(...args),
  createQueueToken: (...args: Parameters<typeof api.createQueueToken>) =>
    api.createQueueToken(...args),
  callQueueToken: (...args: Parameters<typeof api.callQueueToken>) => api.callQueueToken(...args),
  completeQueueToken: (...args: Parameters<typeof api.completeQueueToken>) =>
    api.completeQueueToken(...args),
  noShowQueueToken: (...args: Parameters<typeof api.noShowQueueToken>) =>
    api.noShowQueueToken(...args),
  getQueueState: (...args: Parameters<typeof api.getQueueState>) => api.getQueueState(...args),
  broadcastAnnouncement: (...args: Parameters<typeof api.broadcastAnnouncement>) =>
    api.broadcastAnnouncement(...args),
  listDepartments: (...args: Parameters<typeof api.listDepartments>) =>
    api.listDepartments(...args),
};
