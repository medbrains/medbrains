import { orderSetsApi } from "@medbrains/api/modules/order-sets";
import type { AddOrderSetItemRequest, CreateOrderSetTemplateRequest } from "@medbrains/types";

export const orderSetsService = {
  listOrderSetTemplates: orderSetsApi.listOrderSetTemplates,
  getOrderSetTemplate: orderSetsApi.getOrderSetTemplate,
  createOrderSetTemplate: (data: CreateOrderSetTemplateRequest) =>
    orderSetsApi.createOrderSetTemplate(data),
  approveOrderSetTemplate: orderSetsApi.approveOrderSetTemplate,
  deleteOrderSetTemplate: orderSetsApi.deleteOrderSetTemplate,
  createOrderSetVersion: orderSetsApi.createOrderSetVersion,
  addOrderSetItem: (templateId: string, data: AddOrderSetItemRequest) =>
    orderSetsApi.addOrderSetItem(templateId, data),
  deleteOrderSetItem: orderSetsApi.deleteOrderSetItem,
  listOrderSetActivations: orderSetsApi.listOrderSetActivations,
  getOrderSetActivation: orderSetsApi.getOrderSetActivation,
  getOrderSetAnalytics: orderSetsApi.getOrderSetAnalytics,
};
