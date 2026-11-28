/** The `/forms` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateFormTemplateRequest,
  FormTemplate,
  FormTemplateDetail,
  FormTemplateListItem,
  FormTemplateVersion,
  LiveForm,
  UpdateFormTemplateRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const formsApi = {
  listFormTemplates: () => request<FormTemplateListItem[]>("/forms/templates"),
  createFormTemplate: (data: CreateFormTemplateRequest) =>
    request<FormTemplate>("/forms/templates", { method: "POST", body: JSON.stringify(data) }),
  getFormTemplate: (id: string) => request<FormTemplateDetail>(`/forms/templates/${id}`),
  updateFormTemplate: (id: string, data: UpdateFormTemplateRequest) =>
    request<FormTemplate>(`/forms/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  publishFormTemplate: (id: string) =>
    request<FormTemplateVersion>(`/forms/templates/${id}/publish`, { method: "POST" }),
  retireFormTemplate: (id: string) =>
    request<FormTemplate>(`/forms/templates/${id}/retire`, { method: "POST" }),
  getLiveForm: (code: string) => request<LiveForm>(`/forms/live/${code}`),
  getFormVersion: (id: string) => request<FormTemplateVersion>(`/forms/versions/${id}`),
};
