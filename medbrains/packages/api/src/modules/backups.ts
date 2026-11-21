/** The `/backups` API area. Moved from `client.ts`; one module per first path segment. */
import type { BackupHistory } from "@medbrains/types";
import { request } from "../client.js";

export const backupsApi = {
  listBackups: () => request<BackupHistory[]>("/backups"),
};
