import { api } from "@medbrains/api";

export type CreatePaymentOrderInput = Parameters<typeof api.createPaymentOrder>[0];
export type VerifyPaymentInput = Parameters<typeof api.verifyPayment>[0];
export type GenerateUpiQrInput = Parameters<typeof api.generateUpiQr>[0];

export const paymentsService = {
  createPaymentOrder: (data: CreatePaymentOrderInput) => api.createPaymentOrder(data),
  posSale: (data: Parameters<typeof api.posSale>[0]) => api.posSale(data),
  getCardSale: (id: string) => api.getCardSale(id),
  cancelCardSale: (id: string) => api.cancelCardSale(id),
  listUnresolvedCardSales: (invoiceId: string) => api.listUnresolvedCardSales(invoiceId),
  resolveCardSale: (id: string, data: Parameters<typeof api.resolveCardSale>[1]) =>
    api.resolveCardSale(id, data),
  listSimulatedSales: () => api.listSimulatedSales(),
  actOnSimulatedSale: (id: string, data: Parameters<typeof api.actOnSimulatedSale>[1]) =>
    api.actOnSimulatedSale(id, data),
  powerSimulatedTerminal: (id: string, on: boolean) => api.powerSimulatedTerminal(id, { on }),
  createVirtualAccount: (data: Parameters<typeof api.createVirtualAccount>[0]) =>
    api.createVirtualAccount(data),
  getPaymentStatus: (id: string) => api.getPaymentStatus(id),
  verifyPayment: (data: VerifyPaymentInput) => api.verifyPayment(data),
  initiateRefund: (data: Parameters<typeof api.initiateRefund>[0]) => api.initiateRefund(data),
  generateUpiQr: (data: GenerateUpiQrInput) => api.generateUpiQr(data),
  listPaymentProviders: () => api.listPaymentProviders(),
  getPaymentCapabilities: (stationId: string | null) => api.getPaymentCapabilities(stationId),
  getOnlineSettings: () => api.getOnlineSettings(),
  updateOnlineSettings: (data: Parameters<typeof api.updateOnlineSettings>[0]) =>
    api.updateOnlineSettings(data),
  setProviderKeys: (provider: string, data: Parameters<typeof api.setProviderKeys>[1]) =>
    api.setProviderKeys(provider, data),
  setStationProvider: (id: string, paymentProvider: string | null) =>
    api.setStationProvider(id, { payment_provider: paymentProvider }),
  testPaymentProvider: (provider: string) => api.testPaymentProvider(provider),
  getReconSummary: () => api.getReconSummary(),
  listPaymentExceptions: (...args: Parameters<typeof api.listPaymentExceptions>) =>
    api.listPaymentExceptions(...args),
  resolvePaymentException: (id: string, data: Parameters<typeof api.resolvePaymentException>[1]) =>
    api.resolvePaymentException(id, data),
  listPaymentTerminals: (...args: Parameters<typeof api.listPaymentTerminals>) =>
    api.listPaymentTerminals(...args),
  createPaymentTerminal: (data: Parameters<typeof api.createPaymentTerminal>[0]) =>
    api.createPaymentTerminal(data),
  updatePaymentTerminal: (id: string, data: Parameters<typeof api.updatePaymentTerminal>[1]) =>
    api.updatePaymentTerminal(id, data),
  pingPaymentTerminal: (id: string) => api.pingPaymentTerminal(id),
  retirePaymentTerminal: (id: string) => api.retirePaymentTerminal(id),
  listTerminalProviders: () => api.listTerminalProviders(),
};
