import { api } from "@medbrains/api";

export type CreatePaymentOrderInput = Parameters<typeof api.createPaymentOrder>[0];
export type VerifyPaymentInput = Parameters<typeof api.verifyPayment>[0];
export type GenerateUpiQrInput = Parameters<typeof api.generateUpiQr>[0];

export const paymentsService = {
  createPaymentOrder: (data: CreatePaymentOrderInput) => api.createPaymentOrder(data),
  posSale: (data: Parameters<typeof api.posSale>[0]) => api.posSale(data),
  getPaymentStatus: (id: string) => api.getPaymentStatus(id),
  verifyPayment: (data: VerifyPaymentInput) => api.verifyPayment(data),
  generateUpiQr: (data: GenerateUpiQrInput) => api.generateUpiQr(data),
  listPaymentProviders: () => api.listPaymentProviders(),
  listPaymentTerminals: (...args: Parameters<typeof api.listPaymentTerminals>) =>
    api.listPaymentTerminals(...args),
  createPaymentTerminal: (data: Parameters<typeof api.createPaymentTerminal>[0]) =>
    api.createPaymentTerminal(data),
  updatePaymentTerminal: (id: string, data: Parameters<typeof api.updatePaymentTerminal>[1]) =>
    api.updatePaymentTerminal(id, data),
  deletePaymentTerminal: (id: string) => api.deletePaymentTerminal(id),
};
