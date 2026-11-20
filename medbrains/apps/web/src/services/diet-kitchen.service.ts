import { dietApi } from "@medbrains/api/modules/diet";
import { ipdApi } from "@medbrains/api/modules/ipd";
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
  listAdmissions: ipdApi.listAdmissions,
  listDietOrders: dietApi.listDietOrders,
  createDietOrder: (data: CreateDietOrderRequest) => dietApi.createDietOrder(data),
  listDietTemplates: dietApi.listDietTemplates,
  createDietTemplate: (data: CreateDietTemplateRequest) => dietApi.createDietTemplate(data),
  listKitchenMenus: dietApi.listKitchenMenus,
  createKitchenMenu: (data: CreateKitchenMenuRequest) => dietApi.createKitchenMenu(data),
  listMealPreps: dietApi.listMealPreps,
  createMealPrep: (data: CreateMealPrepRequest) => dietApi.createMealPrep(data),
  updateMealPrepStatus: (id: string, data: UpdateMealPrepStatusRequest) =>
    dietApi.updateMealPrepStatus(id, data),
  listMealCounts: dietApi.listMealCounts,
  listKitchenInventory: dietApi.listKitchenInventory,
  createKitchenInventoryItem: (data: CreateKitchenInventoryRequest) =>
    dietApi.createKitchenInventoryItem(data),
  listKitchenAudits: dietApi.listKitchenAudits,
  createKitchenAudit: (data: CreateKitchenAuditRequest) => dietApi.createKitchenAudit(data),
};
