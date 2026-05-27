import { api } from "@medbrains/api";

export const assetsService = {
  listAssets: api.listAssets,
  listAssetCategories: api.listAssetCategories,
  createAssetCategory: api.createAssetCategory,
  updateAssetCategory: api.updateAssetCategory,
  listStoreCategories: api.listStoreCategories,
  createStoreCategory: api.createStoreCategory,
  updateStoreCategory: api.updateStoreCategory,
  upsertAssetClassification: api.upsertAssetClassification,
};
