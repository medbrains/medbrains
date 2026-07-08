import { api } from "@medbrains/api";

export const homeHealthService = {
  listHomeMeds: api.listHomeMeds,
  scheduleHomeMed: api.scheduleHomeMed,
  recordHomeMed: api.recordHomeMed,
};
