import { api } from "@medbrains/api";
import type { AddOrderSetItemRequest, CreateOrderSetTemplateRequest } from "@medbrains/types";

export const orderSetsService = {
  listOrderSetTemplates: api.listOrderSetTemplates,
  getOrderSetTemplate: api.getOrderSetTemplate,
  createOrderSetTemplate: (data: CreateOrderSetTemplateRequest) => api.createOrderSetTemplate(data),
  approveOrderSetTemplate: api.approveOrderSetTemplate,
  deleteOrderSetTemplate: api.deleteOrderSetTemplate,
  createOrderSetVersion: api.createOrderSetVersion,
  addOrderSetItem: (templateId: string, data: AddOrderSetItemRequest) =>
    api.addOrderSetItem(templateId, data),
  deleteOrderSetItem: api.deleteOrderSetItem,
  listOrderSetActivations: api.listOrderSetActivations,
  getOrderSetActivation: api.getOrderSetActivation,
  getOrderSetAnalytics: api.getOrderSetAnalytics,
};
