import { api } from "@medbrains/api";

export const retrospectiveService = {
  listEntries: api.listRetroEntries,
  approveEntry: api.approveRetroEntry,
  rejectEntry: api.rejectRetroEntry,
  getSettings: api.getRetroSettings,
  updateSettings: api.updateRetroSettings,
};
