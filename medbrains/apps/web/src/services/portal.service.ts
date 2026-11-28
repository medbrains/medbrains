/**
 * Patient portal calls.
 *
 * Kept in its own service because every read takes the patient's token
 * explicitly. Folding these in beside the staff services would invite somebody
 * to call one without a token and have it silently use the staff session.
 */

import { portalApi } from "@medbrains/api/modules/portal";
import { storeApi } from "@medbrains/api/modules/store";

export const portalService = {
  requestPortalOtp: (data: Parameters<typeof portalApi.requestPortalOtp>[0]) =>
    portalApi.requestPortalOtp(data),
  verifyPortalOtp: (data: Parameters<typeof portalApi.verifyPortalOtp>[0]) =>
    portalApi.verifyPortalOtp(data),
  getPortalBills: (token: string) => portalApi.getPortalBills(token),
  payPortalBill: (token: string, invoiceId: string, amount?: number) =>
    portalApi.payPortalBill(token, invoiceId, { amount }),
  getPortalLabReports: (token: string) => portalApi.getPortalLabReports(token),
  getPortalPrescriptions: (token: string) => portalApi.getPortalPrescriptions(token),
  getPortalAppointments: (token: string) => portalApi.getPortalAppointments(token),
  getPortalTeleconsults: (token: string) => portalApi.getPortalTeleconsults(token),
  getPortalRefills: (token: string) => portalApi.getPortalRefills(token),
  requestPortalRefill: (...args: Parameters<typeof portalApi.requestPortalRefill>) =>
    portalApi.requestPortalRefill(...args),
  getPortalDeliveryOptions: (token: string, prescriptionId: string) =>
    portalApi.getPortalDeliveryOptions(token, prescriptionId),
  getPortalDeliveries: (token: string) => portalApi.getPortalDeliveries(token),
  getPortalDelivery: (token: string, id: string) => portalApi.getPortalDelivery(token, id),
  getPortalPrivacy: (token: string) => portalApi.getPortalPrivacy(token),
  // The storefront: public browsing and sign-in, then the patient's own cart.
  getStoreAbout: (tenantCode: string) => storeApi.getStoreAbout(tenantCode),
  searchStore: (...args: Parameters<typeof storeApi.searchStore>) => storeApi.searchStore(...args),
  getStoreItem: (tenantCode: string, id: string) => storeApi.getStoreItem(tenantCode, id),
  requestStoreCode: (tenantCode: string, phone: string) =>
    storeApi.requestStoreCode(tenantCode, phone),
  storeSignIn: (...args: Parameters<typeof storeApi.storeSignIn>) => storeApi.storeSignIn(...args),
  getStoreCart: (token: string) => portalApi.getStoreCart(token),
  setStoreCartQuantity: (...args: Parameters<typeof portalApi.setStoreCartQuantity>) =>
    portalApi.setStoreCartQuantity(...args),
  uploadStorePrescription: (token: string, dataBase64: string) =>
    portalApi.uploadStorePrescription(token, dataBase64),
  getStoreDeliveryOptions: (token: string) => portalApi.getStoreDeliveryOptions(token),
  storeCheckout: (...args: Parameters<typeof portalApi.storeCheckout>) =>
    portalApi.storeCheckout(...args),
  getStoreOrders: (token: string) => portalApi.getStoreOrders(token),
  getStoreOrder: (token: string, id: string) => portalApi.getStoreOrder(token, id),
  orderPortalPrescription: (token: string, prescriptionId: string) =>
    portalApi.orderPortalPrescription(token, prescriptionId),
  holdStoreCart: (...args: Parameters<typeof portalApi.holdStoreCart>) =>
    portalApi.holdStoreCart(...args),
  getStoreServiceability: (token: string, pincode?: string) =>
    portalApi.getStoreServiceability(token, pincode),
  cancelStoreOrder: (token: string, id: string) => portalApi.cancelStoreOrder(token, id),
  requestStoreReturn: (...args: Parameters<typeof portalApi.requestStoreReturn>) =>
    portalApi.requestStoreReturn(...args),
  consentStoreSubstitution: (...args: Parameters<typeof portalApi.consentStoreSubstitution>) =>
    portalApi.consentStoreSubstitution(...args),
  printStoreOutside: (...args: Parameters<typeof portalApi.printStoreOutside>) =>
    portalApi.printStoreOutside(...args),
  getPortalExport: (token: string) => portalApi.getPortalExport(token),
  setPortalDpdpConsent: (...args: Parameters<typeof portalApi.setPortalDpdpConsent>) =>
    portalApi.setPortalDpdpConsent(...args),
  createPortalPrivacyRequest: (...args: Parameters<typeof portalApi.createPortalPrivacyRequest>) =>
    portalApi.createPortalPrivacyRequest(...args),
};
