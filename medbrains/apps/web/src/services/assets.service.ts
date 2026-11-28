import { assetsApi } from "@medbrains/api/modules/assets";
import { materialsApi } from "@medbrains/api/modules/materials";
import { setupApi } from "@medbrains/api/modules/setup";

export const assetsService = {
  listAssets: assetsApi.listAssets,
  listAssetCategories: assetsApi.listAssetCategories,
  createAssetCategory: assetsApi.createAssetCategory,
  updateAssetCategory: assetsApi.updateAssetCategory,
  listStoreCategories: assetsApi.listStoreCategories,
  createStoreCategory: assetsApi.createStoreCategory,
  updateStoreCategory: assetsApi.updateStoreCategory,
  upsertAssetClassification: assetsApi.upsertAssetClassification,
  listAssetMovements: assetsApi.listAssetMovements,
  createAssetMovement: assetsApi.createAssetMovement,
  completeAssetMovement: assetsApi.completeAssetMovement,
  rejectAssetMovement: assetsApi.rejectAssetMovement,
  listDepartments: setupApi.listDepartments,
  listRequisitions: materialsApi.listRequisitions,
  listInventory: materialsApi.listInventory,
  getMaterialsAnalytics: materialsApi.getMaterialsAnalytics,
};
