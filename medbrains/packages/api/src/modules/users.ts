/** The `/users` API area. Moved from `client.ts`; one module per first path segment. */
import type { FavouritesResponse, LauncherResponse, WorkResponse } from "@medbrains/types";
import { request } from "../client.js";

export const usersApi = {
  /** My starred screens and every app's name, for the launcher. */
  getLauncher: () => request<LauncherResponse>("/users/me/launcher"),
  /** My work across my apps: critical values, my queue, my drafts, my approvals. */
  getMyWork: () => request<WorkResponse>("/users/me/work"),
  /** Star or unstar one screen for me; answers my list after the change. */
  setFavourite: (path: string, starred: boolean) =>
    request<FavouritesResponse>("/users/me/favourites", {
      method: "PUT",
      body: JSON.stringify({ path, starred }),
    }),
};
