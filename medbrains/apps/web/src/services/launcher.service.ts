import { api } from "@medbrains/api";

/** The launcher's reads and writes: my starred screens, the app names and my work counts. */
export const launcherService = {
  getLauncher: api.getLauncher,
  getMyWork: api.getMyWork,
  setFavourite: api.setFavourite,
};
