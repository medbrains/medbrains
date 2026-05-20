import { api } from "@medbrains/api";
import type {
  CreateDietOrderRequest,
  CreateDietTemplateRequest,
  CreateKitchenAuditRequest,
  CreateKitchenInventoryRequest,
  CreateKitchenMenuRequest,
  CreateMealPrepRequest,
  UpdateMealPrepStatusRequest,
} from "@medbrains/types";

export const dietKitchenService = {
  listAdmissions: api.listAdmissions,
  listDietOrders: api.listDietOrders,
  createDietOrder: (data: CreateDietOrderRequest) => api.createDietOrder(data),
  listDietTemplates: api.listDietTemplates,
  createDietTemplate: (data: CreateDietTemplateRequest) => api.createDietTemplate(data),
  listKitchenMenus: api.listKitchenMenus,
  createKitchenMenu: (data: CreateKitchenMenuRequest) => api.createKitchenMenu(data),
  listMealPreps: api.listMealPreps,
  createMealPrep: (data: CreateMealPrepRequest) => api.createMealPrep(data),
  updateMealPrepStatus: (id: string, data: UpdateMealPrepStatusRequest) =>
    api.updateMealPrepStatus(id, data),
  listMealCounts: api.listMealCounts,
  listKitchenInventory: api.listKitchenInventory,
  createKitchenInventoryItem: (data: CreateKitchenInventoryRequest) =>
    api.createKitchenInventoryItem(data),
  listKitchenAudits: api.listKitchenAudits,
  createKitchenAudit: (data: CreateKitchenAuditRequest) => api.createKitchenAudit(data),
};
