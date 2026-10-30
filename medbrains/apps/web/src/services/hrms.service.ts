import { api } from "@medbrains/api";

export const hrmsService = {
  getHumanexConfig: () => api.getHumanexConfig(),
  updateHumanexConfig: (...args: Parameters<typeof api.updateHumanexConfig>) =>
    api.updateHumanexConfig(...args),
  syncHumanex: () => api.syncHumanex(),
  getHumanexStatus: () => api.getHumanexStatus(),
};
