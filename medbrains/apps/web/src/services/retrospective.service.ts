import { retrospectiveApi } from "@medbrains/api/modules/retrospective";

export const retrospectiveService = {
  listEntries: retrospectiveApi.listRetroEntries,
  approveEntry: retrospectiveApi.approveRetroEntry,
  rejectEntry: retrospectiveApi.rejectRetroEntry,
  getSettings: retrospectiveApi.getRetroSettings,
  updateSettings: retrospectiveApi.updateRetroSettings,
};
