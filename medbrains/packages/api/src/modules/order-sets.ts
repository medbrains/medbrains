/** The `/order-sets` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  ActivateOrderSetRequest,
  ActivationResult,
  ActivationWithItems,
  AddOrderSetItemRequest,
  CreateOrderSetTemplateRequest,
  OrderSetActivation,
  OrderSetAnalyticsSummary,
  OrderSetTemplate,
  OrderSetTemplateItem,
  OrderSetUsageStats,
  TemplateWithItems,
  UpdateOrderSetItemRequest,
  UpdateOrderSetTemplateRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const orderSetsApi = {
  // ── Order Sets ──────────────────────────────────────

  listOrderSetTemplates: (params?: {
    context?: string;
    department_id?: string;
    search?: string;
    is_active?: boolean;
  }) => {
    const sp = new URLSearchParams();
    if (params?.context) sp.set("context", params.context);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.search) sp.set("search", params.search);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<OrderSetTemplate[]>(`/order-sets/templates${qs ? `?${qs}` : ""}`);
  },

  getOrderSetTemplate: (id: string) => request<TemplateWithItems>(`/order-sets/templates/${id}`),

  createOrderSetTemplate: (data: CreateOrderSetTemplateRequest) =>
    request<OrderSetTemplate>("/order-sets/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOrderSetTemplate: (id: string, data: UpdateOrderSetTemplateRequest) =>
    request<OrderSetTemplate>(`/order-sets/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteOrderSetTemplate: (id: string) =>
    request<OrderSetTemplate>(`/order-sets/templates/${id}`, {
      method: "DELETE",
    }),

  addOrderSetItem: (templateId: string, data: AddOrderSetItemRequest) =>
    request<OrderSetTemplateItem>(`/order-sets/templates/${templateId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOrderSetItem: (templateId: string, itemId: string, data: UpdateOrderSetItemRequest) =>
    request<OrderSetTemplateItem>(`/order-sets/templates/${templateId}/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteOrderSetItem: (templateId: string, itemId: string) =>
    request<{ deleted: boolean }>(`/order-sets/templates/${templateId}/items/${itemId}`, {
      method: "DELETE",
    }),

  createOrderSetVersion: (id: string) =>
    request<TemplateWithItems>(`/order-sets/templates/${id}/new-version`, {
      method: "POST",
    }),

  approveOrderSetTemplate: (id: string) =>
    request<OrderSetTemplate>(`/order-sets/templates/${id}/approve`, {
      method: "PUT",
    }),

  listOrderSetVersions: (id: string) =>
    request<OrderSetTemplate[]>(`/order-sets/templates/${id}/versions`),

  suggestOrderSets: (params?: { icd_code?: string; context?: string; department_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.icd_code) sp.set("icd_code", params.icd_code);
    if (params?.context) sp.set("context", params.context);
    if (params?.department_id) sp.set("department_id", params.department_id);
    const qs = sp.toString();
    return request<OrderSetTemplate[]>(`/order-sets/suggest${qs ? `?${qs}` : ""}`);
  },

  activateOrderSet: (data: ActivateOrderSetRequest) =>
    request<ActivationResult>("/order-sets/activate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listOrderSetActivations: (params?: {
    encounter_id?: string;
    patient_id?: string;
    template_id?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.encounter_id) sp.set("encounter_id", params.encounter_id);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.template_id) sp.set("template_id", params.template_id);
    const qs = sp.toString();
    return request<OrderSetActivation[]>(`/order-sets/activations${qs ? `?${qs}` : ""}`);
  },

  getOrderSetActivation: (id: string) =>
    request<ActivationWithItems>(`/order-sets/activations/${id}`),

  getOrderSetAnalytics: () => request<OrderSetAnalyticsSummary>("/order-sets/analytics"),

  getOrderSetTemplateAnalytics: (templateId: string) =>
    request<OrderSetUsageStats[]>(`/order-sets/analytics/${templateId}`),
};
