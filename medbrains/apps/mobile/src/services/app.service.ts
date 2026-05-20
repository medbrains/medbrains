import { api } from "@medbrains/api";

export const appService = {
  health: () => api.health(),
};
