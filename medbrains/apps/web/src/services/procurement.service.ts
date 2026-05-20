import { api } from "@medbrains/api";

export type CreateVendorInput = Parameters<typeof api.createVendor>[0];
export type ListVendorsParams = Parameters<typeof api.listVendors>[0];
export type ListPurchaseOrdersParams = Parameters<typeof api.listPurchaseOrders>[0];
export type ListStoreCatalogParams = Parameters<typeof api.listStoreCatalog>[0];
export type ListIndentRequisitionsParams = Parameters<typeof api.listIndentRequisitions>[0];
export type ListGrnParams = Parameters<typeof api.listGrns>[0];
export type CreatePurchaseOrderInput = Parameters<typeof api.createPurchaseOrder>[0];
export type CreateGrnInput = Parameters<typeof api.createGrn>[0];
export type CreateRateContractInput = Parameters<typeof api.createRateContract>[0];
export type CreateStoreLocationInput = Parameters<typeof api.createStoreLocation>[0];
export type CreateSupplierPaymentInput = Parameters<typeof api.createSupplierPayment>[0];

export const procurementService = {
  listVendors: (params?: ListVendorsParams) => api.listVendors(params),
  createVendor: (data: CreateVendorInput) => api.createVendor(data),
  listPurchaseOrders: (params?: ListPurchaseOrdersParams) => api.listPurchaseOrders(params),
  approvePurchaseOrder: (id: string) => api.approvePurchaseOrder(id),
  sendPurchaseOrder: (id: string) => api.sendPurchaseOrder(id),
  getPurchaseOrder: (id: string) => api.getPurchaseOrder(id),
  listStoreCatalog: (params?: ListStoreCatalogParams) => api.listStoreCatalog(params),
  listIndentRequisitions: (params?: ListIndentRequisitionsParams) =>
    api.listIndentRequisitions(params),
  getIndentRequisition: (id: string) => api.getIndentRequisition(id),
  createPurchaseOrder: (data: CreatePurchaseOrderInput) => api.createPurchaseOrder(data),
  listGrns: (params?: ListGrnParams) => api.listGrns(params),
  getGrn: (id: string) => api.getGrn(id),
  createGrn: (data: CreateGrnInput) => api.createGrn(data),
  listRateContracts: () => api.listRateContracts(),
  createRateContract: (data: CreateRateContractInput) => api.createRateContract(data),
  listBatchStock: () => api.listBatchStock(),
  listStoreLocations: () => api.listStoreLocations(),
  createStoreLocation: (data: CreateStoreLocationInput) => api.createStoreLocation(data),
  getVendorPerformance: () => api.getVendorPerformance(),
  getVendorComparison: (itemId: string) => api.getVendorComparison(itemId),
  listSupplierPayments: () => api.listSupplierPayments(),
  createSupplierPayment: (data: CreateSupplierPaymentInput) => api.createSupplierPayment(data),
};
