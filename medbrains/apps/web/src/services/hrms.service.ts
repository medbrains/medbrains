import { hrmsApi } from "@medbrains/api/modules/hrms";

export const hrmsService = {
  getHumanexConfig: () => hrmsApi.getHumanexConfig(),
  updateHumanexConfig: (...args: Parameters<typeof hrmsApi.updateHumanexConfig>) =>
    hrmsApi.updateHumanexConfig(...args),
  syncHumanex: () => hrmsApi.syncHumanex(),
  getHumanexStatus: () => hrmsApi.getHumanexStatus(),
};
