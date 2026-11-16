import { api } from "@medbrains/api";

/** The launcher's reads and writes: my starred screens and the app names. */
export const launcherService = {
  getLauncher: api.getLauncher,
  setFavourite: api.setFavourite,
};
