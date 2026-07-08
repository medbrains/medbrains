import { api } from "@medbrains/api";

export const micrositeService = {
  listHealthPackages: api.listHealthPackages,
  createHealthPackage: api.createHealthPackage,
  updateHealthPackage: api.updateHealthPackage,
  deleteHealthPackage: api.deleteHealthPackage,
  bookHealthPackage: api.bookHealthPackage,
};
