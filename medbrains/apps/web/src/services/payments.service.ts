import { paymentsApi } from "@medbrains/api/modules/payments";

export type CreatePaymentOrderInput = Parameters<typeof paymentsApi.createPaymentOrder>[0];
export type VerifyPaymentInput = Parameters<typeof paymentsApi.verifyPayment>[0];
export type GenerateUpiQrInput = Parameters<typeof paymentsApi.generateUpiQr>[0];

export const paymentsService = {
  createPaymentOrder: (data: CreatePaymentOrderInput) => paymentsApi.createPaymentOrder(data),
  posSale: (data: Parameters<typeof paymentsApi.posSale>[0]) => paymentsApi.posSale(data),
  getCardSale: (id: string) => paymentsApi.getCardSale(id),
  cancelCardSale: (id: string) => paymentsApi.cancelCardSale(id),
  listUnresolvedCardSales: (invoiceId: string) => paymentsApi.listUnresolvedCardSales(invoiceId),
  resolveCardSale: (id: string, data: Parameters<typeof paymentsApi.resolveCardSale>[1]) =>
    paymentsApi.resolveCardSale(id, data),
  listSimulatedSales: () => paymentsApi.listSimulatedSales(),
  actOnSimulatedSale: (id: string, data: Parameters<typeof paymentsApi.actOnSimulatedSale>[1]) =>
    paymentsApi.actOnSimulatedSale(id, data),
  powerSimulatedTerminal: (id: string, on: boolean) =>
    paymentsApi.powerSimulatedTerminal(id, { on }),
  createVirtualAccount: (data: Parameters<typeof paymentsApi.createVirtualAccount>[0]) =>
    paymentsApi.createVirtualAccount(data),
  getPaymentStatus: (id: string) => paymentsApi.getPaymentStatus(id),
  verifyPayment: (data: VerifyPaymentInput) => paymentsApi.verifyPayment(data),
  initiateRefund: (data: Parameters<typeof paymentsApi.initiateRefund>[0]) =>
    paymentsApi.initiateRefund(data),
  generateUpiQr: (data: GenerateUpiQrInput) => paymentsApi.generateUpiQr(data),
  createPaymentLink: (data: Parameters<typeof paymentsApi.createPaymentLink>[0]) =>
    paymentsApi.createPaymentLink(data),
  listPaymentLinks: (params: Parameters<typeof paymentsApi.listPaymentLinks>[0]) =>
    paymentsApi.listPaymentLinks(params),
  getPaymentLink: (id: string) => paymentsApi.getPaymentLink(id),
  resendPaymentLink: (id: string, data: Parameters<typeof paymentsApi.resendPaymentLink>[1]) =>
    paymentsApi.resendPaymentLink(id, data),
  cancelPaymentLink: (id: string) => paymentsApi.cancelPaymentLink(id),
  listPaymentProviders: () => paymentsApi.listPaymentProviders(),
  getPaymentCapabilities: (stationId: string | null) =>
    paymentsApi.getPaymentCapabilities(stationId),
  getOnlineSettings: () => paymentsApi.getOnlineSettings(),
  updateOnlineSettings: (data: Parameters<typeof paymentsApi.updateOnlineSettings>[0]) =>
    paymentsApi.updateOnlineSettings(data),
  setProviderKeys: (provider: string, data: Parameters<typeof paymentsApi.setProviderKeys>[1]) =>
    paymentsApi.setProviderKeys(provider, data),
  setStationProvider: (id: string, paymentProvider: string | null) =>
    paymentsApi.setStationProvider(id, { payment_provider: paymentProvider }),
  testPaymentProvider: (provider: string) => paymentsApi.testPaymentProvider(provider),
  getReconSummary: () => paymentsApi.getReconSummary(),
  listPaymentExceptions: (...args: Parameters<typeof paymentsApi.listPaymentExceptions>) =>
    paymentsApi.listPaymentExceptions(...args),
  resolvePaymentException: (
    id: string,
    data: Parameters<typeof paymentsApi.resolvePaymentException>[1],
  ) => paymentsApi.resolvePaymentException(id, data),
  listPaymentTerminals: (...args: Parameters<typeof paymentsApi.listPaymentTerminals>) =>
    paymentsApi.listPaymentTerminals(...args),
  createPaymentTerminal: (data: Parameters<typeof paymentsApi.createPaymentTerminal>[0]) =>
    paymentsApi.createPaymentTerminal(data),
  updatePaymentTerminal: (
    id: string,
    data: Parameters<typeof paymentsApi.updatePaymentTerminal>[1],
  ) => paymentsApi.updatePaymentTerminal(id, data),
  pingPaymentTerminal: (id: string) => paymentsApi.pingPaymentTerminal(id),
  retirePaymentTerminal: (id: string) => paymentsApi.retirePaymentTerminal(id),
  listTerminalProviders: () => paymentsApi.listTerminalProviders(),
};
