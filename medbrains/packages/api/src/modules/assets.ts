/** The `/assets` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AssetCategory,
  AssetClassification,
  AssetMovement,
  CreateAssetCategoryRequest,
  CreateAssetMovementRequest,
  CreateStoreCategoryRequest,
  ListAssetsParams,
  RejectAssetMovementRequest,
  StoreCategory,
  UnifiedAsset,
  UpdateAssetCategoryRequest,
  UpdateStoreCategoryRequest,
  UpsertAssetClassificationRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const assetsApi = {
  // ── Unified Assets & Stores ─────────────────────────────

  listAssets: (params?: ListAssetsParams) => {
    const sp = new URLSearchParams();
    if (params?.source_type) sp.set("source_type", params.source_type);
    if (params?.source_id) sp.set("source_id", params.source_id);
    if (params?.asset_domain) sp.set("asset_domain", params.asset_domain);
    if (params?.asset_category_id) sp.set("asset_category_id", params.asset_category_id);
    if (params?.camp_eligible !== undefined) {
      sp.set("camp_eligible", String(params.camp_eligible));
    }
    if (params?.available_only !== undefined) {
      sp.set("available_only", String(params.available_only));
    }
    if (params?.search) sp.set("search", params.search);
    const qs = sp.toString();
    return request<UnifiedAsset[]>(`/assets${qs ? `?${qs}` : ""}`);
  },
  listAssetCategories: () => request<AssetCategory[]>("/assets/categories"),
  createAssetCategory: (data: CreateAssetCategoryRequest) =>
    request<AssetCategory>("/assets/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAssetCategory: (id: string, data: UpdateAssetCategoryRequest) =>
    request<AssetCategory>(`/assets/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listStoreCategories: () => request<StoreCategory[]>("/assets/store-categories"),
  createStoreCategory: (data: CreateStoreCategoryRequest) =>
    request<StoreCategory>("/assets/store-categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStoreCategory: (id: string, data: UpdateStoreCategoryRequest) =>
    request<StoreCategory>(`/assets/store-categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  upsertAssetClassification: (data: UpsertAssetClassificationRequest) =>
    request<AssetClassification>("/assets/classifications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listAssetMovements: (params?: { source_type?: string; source_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.source_type) sp.set("source_type", params.source_type);
    if (params?.source_id) sp.set("source_id", params.source_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<AssetMovement[]>(`/assets/movements${qs ? `?${qs}` : ""}`);
  },
  createAssetMovement: (data: CreateAssetMovementRequest) =>
    request<AssetMovement>("/assets/movements", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completeAssetMovement: (id: string) =>
    request<AssetMovement>(`/assets/movements/${id}/complete`, { method: "PUT" }),
  rejectAssetMovement: (id: string, data: RejectAssetMovementRequest) =>
    request<AssetMovement>(`/assets/movements/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
