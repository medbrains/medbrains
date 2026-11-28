/** The `/hrms` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  HrmsEntityOutcome,
  HrmsSyncStatus,
  HumanexConfigInput,
  HumanexConfigView,
} from "@medbrains/types";
import { request } from "../client.js";

export const hrmsApi = {
  /** The hospital's Humanex HRMS connection (the key is never returned). */
  getHumanexConfig: () => request<HumanexConfigView>("/hrms/humanex/config"),
  updateHumanexConfig: (data: HumanexConfigInput) =>
    request<HumanexConfigView>("/hrms/humanex/config", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Pull from Humanex now rather than at the next 15-minute pass. */
  syncHumanex: () => request<HrmsEntityOutcome[]>("/hrms/humanex/sync", { method: "POST" }),
  getHumanexStatus: () => request<HrmsSyncStatus>("/hrms/humanex/status"),
};
