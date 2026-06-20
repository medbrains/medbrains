import { api } from "@medbrains/api";

export type CreatePaymentOrderInput = Parameters<typeof api.createPaymentOrder>[0];
export type VerifyPaymentInput = Parameters<typeof api.verifyPayment>[0];
export type GenerateUpiQrInput = Parameters<typeof api.generateUpiQr>[0];

export const paymentsService = {
  createPaymentOrder: (data: CreatePaymentOrderInput) => api.createPaymentOrder(data),
  verifyPayment: (data: VerifyPaymentInput) => api.verifyPayment(data),
  generateUpiQr: (data: GenerateUpiQrInput) => api.generateUpiQr(data),
  listPaymentProviders: () => api.listPaymentProviders(),
};
