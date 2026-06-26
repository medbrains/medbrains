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
  listAssetMovements: api.listAssetMovements,
  createAssetMovement: api.createAssetMovement,
  completeAssetMovement: api.completeAssetMovement,
  rejectAssetMovement: api.rejectAssetMovement,
  listDepartments: api.listDepartments,
};
