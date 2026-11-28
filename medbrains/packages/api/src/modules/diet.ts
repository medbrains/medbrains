/** The `/diet` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateDietOrderRequest,
  CreateDietTemplateRequest,
  CreateKitchenAuditRequest,
  CreateKitchenInventoryRequest,
  CreateKitchenMenuRequest,
  CreateMealCountRequest,
  CreateMealPrepRequest,
  CreateMenuItemRequest,
  DietOrder,
  DietTemplate,
  KitchenAudit,
  KitchenInventory,
  KitchenMenu,
  KitchenMenuItem,
  MealCount,
  MealPreparation,
  UpdateDietOrderRequest,
  UpdateDietTemplateRequest,
  UpdateKitchenInventoryRequest,
  UpdateMealPrepStatusRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const dietApi = {
  // ── Diet & Kitchen ────────────────────────────────────

  listDietTemplates: () => request<DietTemplate[]>("/diet/templates"),

  createDietTemplate: (data: CreateDietTemplateRequest) =>
    request<DietTemplate>("/diet/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDietTemplate: (id: string, data: UpdateDietTemplateRequest) =>
    request<DietTemplate>(`/diet/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listDietOrders: () => request<DietOrder[]>("/diet/orders"),

  createDietOrder: (data: CreateDietOrderRequest) =>
    request<DietOrder>("/diet/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDietOrder: (id: string, data: UpdateDietOrderRequest) =>
    request<DietOrder>(`/diet/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listKitchenMenus: () => request<KitchenMenu[]>("/diet/menus"),

  createKitchenMenu: (data: CreateKitchenMenuRequest) =>
    request<KitchenMenu>("/diet/menus", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listKitchenMenuItems: (menuId: string) =>
    request<KitchenMenuItem[]>(`/diet/menus/${menuId}/items`),

  createKitchenMenuItem: (menuId: string, data: CreateMenuItemRequest) =>
    request<KitchenMenuItem>(`/diet/menus/${menuId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listMealPreps: () => request<MealPreparation[]>("/diet/meal-preps"),

  createMealPrep: (data: CreateMealPrepRequest) =>
    request<MealPreparation>("/diet/meal-preps", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMealPrepStatus: (id: string, data: UpdateMealPrepStatusRequest) =>
    request<MealPreparation>(`/diet/meal-preps/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listMealCounts: () => request<MealCount[]>("/diet/meal-counts"),

  createMealCount: (data: CreateMealCountRequest) =>
    request<MealCount>("/diet/meal-counts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listKitchenInventory: () => request<KitchenInventory[]>("/diet/inventory"),

  createKitchenInventoryItem: (data: CreateKitchenInventoryRequest) =>
    request<KitchenInventory>("/diet/inventory", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateKitchenInventoryItem: (id: string, data: UpdateKitchenInventoryRequest) =>
    request<KitchenInventory>(`/diet/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listKitchenAudits: () => request<KitchenAudit[]>("/diet/audits"),

  createKitchenAudit: (data: CreateKitchenAuditRequest) =>
    request<KitchenAudit>("/diet/audits", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
