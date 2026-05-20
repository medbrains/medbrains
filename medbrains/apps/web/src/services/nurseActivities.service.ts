import { api } from "@medbrains/api";

export const nurseActivitiesService = {
  listMarDueNow: (...args: Parameters<typeof api.listMarDueNow>) => api.listMarDueNow(...args),
  administerMar: (...args: Parameters<typeof api.administerMar>) => api.administerMar(...args),
  holdMar: (...args: Parameters<typeof api.holdMar>) => api.holdMar(...args),
  refuseMar: (...args: Parameters<typeof api.refuseMar>) => api.refuseMar(...args),
  listIoForEncounter: (...args: Parameters<typeof api.listIoForEncounter>) =>
    api.listIoForEncounter(...args),
  getEncounterIoBalance: (...args: Parameters<typeof api.getEncounterIoBalance>) =>
    api.getEncounterIoBalance(...args),
  createIoEntry: (...args: Parameters<typeof api.createIoEntry>) => api.createIoEntry(...args),
  listCodeBlue: (...args: Parameters<typeof api.listCodeBlue>) => api.listCodeBlue(...args),
  endCodeBlue: (...args: Parameters<typeof api.endCodeBlue>) => api.endCodeBlue(...args),
};
