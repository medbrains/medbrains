import { indentApi } from "@medbrains/api/modules/indent";
import { procurementApi } from "@medbrains/api/modules/procurement";

export type CreateVendorInput = Parameters<typeof procurementApi.createVendor>[0];
export type ListVendorsParams = Parameters<typeof procurementApi.listVendors>[0];
export type ListPurchaseOrdersParams = Parameters<typeof procurementApi.listPurchaseOrders>[0];
export type ListStoreCatalogParams = Parameters<typeof indentApi.listStoreCatalog>[0];
export type ListIndentRequisitionsParams = Parameters<typeof indentApi.listIndentRequisitions>[0];
export type ListGrnParams = Parameters<typeof procurementApi.listGrns>[0];
export type CreatePurchaseOrderInput = Parameters<typeof procurementApi.createPurchaseOrder>[0];
export type CreateGrnInput = Parameters<typeof procurementApi.createGrn>[0];
export type CreateRateContractInput = Parameters<typeof procurementApi.createRateContract>[0];
export type CreateStoreLocationInput = Parameters<typeof procurementApi.createStoreLocation>[0];
export type CreateSupplierPaymentInput = Parameters<typeof procurementApi.createSupplierPayment>[0];

export const procurementService = {
  listVendors: (params?: ListVendorsParams) => procurementApi.listVendors(params),
  createVendor: (data: CreateVendorInput) => procurementApi.createVendor(data),
  listPurchaseOrders: (params?: ListPurchaseOrdersParams) =>
    procurementApi.listPurchaseOrders(params),
  approvePurchaseOrder: (id: string) => procurementApi.approvePurchaseOrder(id),
  sendPurchaseOrder: (id: string) => procurementApi.sendPurchaseOrder(id),
  getPurchaseOrder: (id: string) => procurementApi.getPurchaseOrder(id),
  listStoreCatalog: (params?: ListStoreCatalogParams) => indentApi.listStoreCatalog(params),
  listIndentRequisitions: (params?: ListIndentRequisitionsParams) =>
    indentApi.listIndentRequisitions(params),
  getIndentRequisition: (id: string) => indentApi.getIndentRequisition(id),
  createPurchaseOrder: (data: CreatePurchaseOrderInput) => procurementApi.createPurchaseOrder(data),
  listGrns: (params?: ListGrnParams) => procurementApi.listGrns(params),
  getGrn: (id: string) => procurementApi.getGrn(id),
  createGrn: (data: CreateGrnInput) => procurementApi.createGrn(data),
  completeGrn: (id: string) => procurementApi.completeGrn(id),
  listRateContracts: () => procurementApi.listRateContracts(),
  createRateContract: (data: CreateRateContractInput) => procurementApi.createRateContract(data),
  listBatchStock: () => procurementApi.listBatchStock(),
  listStoreLocations: () => procurementApi.listStoreLocations(),
  createStoreLocation: (data: CreateStoreLocationInput) => procurementApi.createStoreLocation(data),
  getVendorPerformance: () => procurementApi.getVendorPerformance(),
  getVendorComparison: (itemId: string) => procurementApi.getVendorComparison(itemId),
  listSupplierPayments: () => procurementApi.listSupplierPayments(),
  createSupplierPayment: (data: CreateSupplierPaymentInput) =>
    procurementApi.createSupplierPayment(data),
};
