/**
 * Patient portal calls.
 *
 * Kept in its own service because every read takes the patient's token
 * explicitly. Folding these in beside the staff services would invite somebody
 * to call one without a token and have it silently use the staff session.
 */

import { api } from "@medbrains/api";

export const portalService = {
  requestPortalOtp: (data: Parameters<typeof api.requestPortalOtp>[0]) =>
    api.requestPortalOtp(data),
  verifyPortalOtp: (data: Parameters<typeof api.verifyPortalOtp>[0]) => api.verifyPortalOtp(data),
  getPortalBills: (token: string) => api.getPortalBills(token),
  getPortalLabReports: (token: string) => api.getPortalLabReports(token),
  getPortalPrescriptions: (token: string) => api.getPortalPrescriptions(token),
  getPortalAppointments: (token: string) => api.getPortalAppointments(token),
  getPortalTeleconsults: (token: string) => api.getPortalTeleconsults(token),
  getPortalRefills: (token: string) => api.getPortalRefills(token),
  requestPortalRefill: (...args: Parameters<typeof api.requestPortalRefill>) =>
    api.requestPortalRefill(...args),
  getPortalDeliveryOptions: (token: string, prescriptionId: string) =>
    api.getPortalDeliveryOptions(token, prescriptionId),
  getPortalDeliveries: (token: string) => api.getPortalDeliveries(token),
  getPortalDelivery: (token: string, id: string) => api.getPortalDelivery(token, id),
  getPortalPrivacy: (token: string) => api.getPortalPrivacy(token),
  // The storefront: public browsing and sign-in, then the patient's own cart.
  getStoreAbout: (tenantCode: string) => api.getStoreAbout(tenantCode),
  searchStore: (...args: Parameters<typeof api.searchStore>) => api.searchStore(...args),
  getStoreItem: (tenantCode: string, id: string) => api.getStoreItem(tenantCode, id),
  requestStoreCode: (tenantCode: string, phone: string) => api.requestStoreCode(tenantCode, phone),
  storeSignIn: (...args: Parameters<typeof api.storeSignIn>) => api.storeSignIn(...args),
  getStoreCart: (token: string) => api.getStoreCart(token),
  setStoreCartQuantity: (...args: Parameters<typeof api.setStoreCartQuantity>) =>
    api.setStoreCartQuantity(...args),
  uploadStorePrescription: (token: string, dataBase64: string) =>
    api.uploadStorePrescription(token, dataBase64),
  getStoreDeliveryOptions: (token: string) => api.getStoreDeliveryOptions(token),
  storeCheckout: (...args: Parameters<typeof api.storeCheckout>) => api.storeCheckout(...args),
  getStoreOrders: (token: string) => api.getStoreOrders(token),
  getStoreOrder: (token: string, id: string) => api.getStoreOrder(token, id),
  orderPortalPrescription: (token: string, prescriptionId: string) =>
    api.orderPortalPrescription(token, prescriptionId),
  getPortalExport: (token: string) => api.getPortalExport(token),
  setPortalDpdpConsent: (...args: Parameters<typeof api.setPortalDpdpConsent>) =>
    api.setPortalDpdpConsent(...args),
  createPortalPrivacyRequest: (...args: Parameters<typeof api.createPortalPrivacyRequest>) =>
    api.createPortalPrivacyRequest(...args),
};
