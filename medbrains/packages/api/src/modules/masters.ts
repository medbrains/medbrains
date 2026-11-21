/** The `/masters` API area. Moved from `client.ts`; one module per first path segment. */
import type { MasterItem } from "@medbrains/types";
import { request } from "../client.js";

export const mastersApi = {
  // Masters (read-only for patient forms)
  listReligions: () => request<MasterItem[]>("/masters/religions"),
  listOccupations: () => request<MasterItem[]>("/masters/occupations"),
  listRelations: () => request<MasterItem[]>("/masters/relations"),
};
