/** The `/immunizations` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  ImmunizationDueList,
  ImmunizationScheduleSetting,
  PatientImmunization,
} from "@medbrains/types";
import { request } from "../client.js";

export const immunizationsApi = {
  listImmunizationDueList: (params?: { within_days?: number; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.within_days !== undefined) qs.set("within_days", String(params.within_days));
    if (params?.page) qs.set("page", String(params.page));
    const query = qs.toString();
    return request<ImmunizationDueList>(`/immunizations/due-list${query ? `?${query}` : ""}`);
  },
  getImmunizationSettings: () => request<ImmunizationScheduleSetting>("/immunizations/settings"),
  updateImmunizationSettings: (data: ImmunizationScheduleSetting) =>
    request<ImmunizationScheduleSetting>("/immunizations/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  strikePatientImmunization: (id: string, reason: string) =>
    request<PatientImmunization>(`/immunizations/${id}/strike`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
