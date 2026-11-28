import { usersApi } from "@medbrains/api/modules/users";

/** The launcher's reads and writes: my starred screens, the app names and my work counts. */
export const launcherService = {
  getLauncher: usersApi.getLauncher,
  getMyWork: usersApi.getMyWork,
  setFavourite: usersApi.setFavourite,
};
