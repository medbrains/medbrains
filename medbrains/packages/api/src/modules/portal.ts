/** The `/portal` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  DpdpConsentInput,
  HealthAppReading,
  HealthAppReadingsResult,
  HealthDataSharing,
  HealthDataSource,
  HealthDataType,
  PatientDpdpConsent,
  PaymentLinkView,
  PortalAppointment,
  PortalDelivery,
  PortalDeliveryChoice,
  PortalDeliveryOffer,
  PortalInvoice,
  PortalLabReport,
  PortalPayRequest,
  PortalPrescriptionItem,
  PortalPrivacy,
  PortalPrivacyRequestInput,
  PortalRefill,
  PortalRefillRequest,
  PortalTeleconsult,
  PrivacyRequest,
} from "@medbrains/types";
import { portalAuth, request } from "../client.js";

export const portalApi = {
  // ── Patient portal ────────────────────────────────────────────────
  //
  // The portal session is passed per call rather than held in the client.
  // A patient token is a different credential from a staff one — it speaks
  // for one patient and carries no role — and letting the two share the
  // module-level slot is how a staff session ends up authorising a portal
  // read, or the reverse.

  requestPortalOtp: (data: { tenant_code: string; phone: string }) =>
    request<{ status: string; message: string }>("/portal/auth/request-otp", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** A session, or — when a family shares the mobile — who to choose between. */
  verifyPortalOtp: (data: {
    tenant_code: string;
    phone: string;
    code: string;
    patient_id?: string;
  }) =>
    request<import("@medbrains/types").PortalVerifyResult>("/portal/auth/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPortalBills: (token: string) => request<PortalInvoice[]>("/portal/bills", portalAuth(token)),
  /** A link to pay the patient's own bill, in full or in part (#4871). */
  payPortalBill: (token: string, invoiceId: string, data: PortalPayRequest) =>
    request<PaymentLinkView>(`/portal/bills/${invoiceId}/pay`, {
      ...portalAuth(token),
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPortalLabReports: (token: string) =>
    request<PortalLabReport[]>("/portal/lab-reports", portalAuth(token)),
  getPortalPrescriptions: (token: string) =>
    request<PortalPrescriptionItem[]>("/portal/prescriptions", portalAuth(token)),
  getPortalAppointments: (token: string) =>
    request<PortalAppointment[]>("/portal/appointments", portalAuth(token)),
  getPortalTeleconsults: (token: string) =>
    request<PortalTeleconsult[]>("/portal/teleconsults", portalAuth(token)),
  getPortalRefills: (token: string) =>
    request<PortalRefill[]>("/portal/refills", portalAuth(token)),
  getPortalPrivacy: (token: string) => request<PortalPrivacy>("/portal/privacy", portalAuth(token)),
  /** What the patient shares from Apple Health / Health Connect. */
  getPortalHealthData: (token: string) =>
    request<HealthDataSharing>("/portal/health-data", portalAuth(token)),
  setPortalHealthDataConsent: (
    token: string,
    data: { source: HealthDataSource; data_type: HealthDataType; granted: boolean },
  ) =>
    request<HealthDataSharing>("/portal/health-data/consent", {
      ...portalAuth(token),
      method: "PUT",
      body: JSON.stringify(data),
    }),
  postPortalHealthReadings: (
    token: string,
    data: { source: HealthDataSource; readings: HealthAppReading[] },
  ) =>
    request<HealthAppReadingsResult>("/portal/health-data/readings", {
      ...portalAuth(token),
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** The patient's own record as a FHIR R4 collection bundle. */
  getPortalExport: (token: string) =>
    request<Record<string, unknown>>("/portal/privacy/export", portalAuth(token)),
  setPortalDpdpConsent: (token: string, data: DpdpConsentInput) =>
    request<PatientDpdpConsent>("/portal/dpdp-consent", {
      ...portalAuth(token),
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createPortalPrivacyRequest: (token: string, data: PortalPrivacyRequestInput) =>
    request<PrivacyRequest>("/portal/privacy-requests", {
      ...portalAuth(token),
      method: "POST",
      body: JSON.stringify(data),
    }),
  requestPortalRefill: (
    token: string,
    prescriptionId: string,
    data: { note?: string; delivery?: PortalDeliveryChoice },
  ) =>
    request<PortalRefillRequest>(`/portal/prescriptions/${prescriptionId}/refill-request`, {
      ...portalAuth(token),
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPortalDeliveryOptions: (token: string, prescriptionId: string) =>
    request<PortalDeliveryOffer>(
      `/portal/prescriptions/${prescriptionId}/delivery-options`,
      portalAuth(token),
    ),
  getPortalDeliveries: (token: string) =>
    request<PortalDelivery[]>("/portal/deliveries", portalAuth(token)),
  getPortalDelivery: (token: string, id: string) =>
    request<PortalDelivery>(`/portal/deliveries/${id}`, portalAuth(token)),
  getStoreCart: (token: string) =>
    request<import("@medbrains/types").StoreCart>("/portal/store/cart", portalAuth(token)),
  setStoreCartQuantity: (token: string, itemId: string, quantity: number) =>
    request<import("@medbrains/types").StoreCart>(`/portal/store/cart/items/${itemId}`, {
      ...portalAuth(token),
      method: "PUT",
      body: JSON.stringify({ quantity }),
    }),
  uploadStorePrescription: (token: string, dataBase64: string) =>
    request<import("@medbrains/types").StoreCart>("/portal/store/cart/prescription", {
      ...portalAuth(token),
      method: "PUT",
      body: JSON.stringify({ data_base64: dataBase64 }),
    }),
  getStoreDeliveryOptions: (token: string) =>
    request<PortalDeliveryOffer>("/portal/store/delivery-options", portalAuth(token)),
  storeCheckout: (token: string, data: import("@medbrains/types").StoreCheckoutRequest) =>
    request<import("@medbrains/types").StoreOrder>("/portal/store/checkout", {
      ...portalAuth(token),
      method: "POST",
      body: JSON.stringify(data),
    }),
  getStoreOrders: (token: string) =>
    request<import("@medbrains/types").StoreOrder[]>("/portal/store/orders", portalAuth(token)),
  getStoreOrder: (token: string, id: string) =>
    request<import("@medbrains/types").StoreOrder>(`/portal/store/orders/${id}`, portalAuth(token)),
  /** "Order my prescription": the cart filled from one of the patient's prescriptions. */
  orderPortalPrescription: (token: string, prescriptionId: string) =>
    request<import("@medbrains/types").StoreOrderedPrescription>(
      `/portal/store/prescriptions/${prescriptionId}/order`,
      { ...portalAuth(token), method: "POST" },
    ),
  /** Checkout opened: the cart held at the pharmacy that will fill it. */
  holdStoreCart: (token: string, data: { pincode?: string; pickup_store_id?: string }) =>
    request<import("@medbrains/types").StoreHeldCart>("/portal/store/cart/hold", {
      ...portalAuth(token),
      method: "POST",
      body: JSON.stringify(data),
    }),
  getStoreServiceability: (token: string, pincode?: string) =>
    request<import("@medbrains/types").StoreServiceability>(
      `/portal/store/serviceability${pincode ? `?pincode=${encodeURIComponent(pincode)}` : ""}`,
      portalAuth(token),
    ),
  cancelStoreOrder: (token: string, id: string) =>
    request<import("@medbrains/types").StoreOrder>(`/portal/store/orders/${id}/cancel`, {
      ...portalAuth(token),
      method: "POST",
    }),
  requestStoreReturn: (
    token: string,
    id: string,
    data: import("@medbrains/types").StoreReturnRequest,
  ) =>
    request<import("@medbrains/types").StoreReturnTicket>(`/portal/store/orders/${id}/returns`, {
      ...portalAuth(token),
      method: "POST",
      body: JSON.stringify(data),
    }),
  consentStoreSubstitution: (token: string, id: string, sid: string, accept: boolean) =>
    request<import("@medbrains/types").StoreOrder>(
      `/portal/store/orders/${id}/substitutions/${sid}/consent`,
      { ...portalAuth(token), method: "POST", body: JSON.stringify({ accept }) },
    ),
  printStoreOutside: (token: string, id: string, catalogItemIds: string[]) =>
    request<import("@medbrains/types").OutsidePrint>(`/portal/store/orders/${id}/outside-print`, {
      ...portalAuth(token),
      method: "POST",
      body: JSON.stringify({ catalog_item_ids: catalogItemIds }),
    }),
};
