/** The `/public` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CmsPage,
  CmsPostList,
  CmsPublicPost,
  CmsSubscriber,
  CreateCmsSubscriber,
  ErrorTrackingClientConfig,
  KioskCheckinResult,
  PublicAvailableSlot,
  PublicBookingDirectory,
  PublicBookingRequest,
  PublicBookingResponse,
  PublicEnquiryRequest,
  PublicEnquiryResponse,
  PublicInvite,
  PublicShareLink,
  PublicSignatureCheck,
  PublicTenant,
  PublicTokenStatus,
  VerifiedBill,
  VerifiedPrescription,
} from "@medbrains/types";
import { request } from "../client.js";

export const publicApi = {
  getErrorTrackingClientConfig: () =>
    request<ErrorTrackingClientConfig>("/public/error-tracking/config"),
  // Pre-auth: resolve the tenant for the current custom domain (login branding).
  // Pass the browser's hostname so it works without proxy X-Forwarded-Host.
  getTenantByHost: (domain: string) =>
    request<PublicTenant | null>(`/public/tenant-by-host?domain=${encodeURIComponent(domain)}`),

  submitPublicEnquiry: (data: PublicEnquiryRequest) =>
    request<PublicEnquiryResponse>("/public/marketing/enquiry", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Public — scanned by a pharmacist who is not a user of this system. */
  verifyPrescription: (token: string) =>
    request<VerifiedPrescription>(`/public/prescriptions/verify/${token}`),
  /** Public — the QR on a printed bill; number plus the bill's own code. */
  verifyBill: (number: string, code: string) =>
    request<VerifiedBill>(
      `/public/bills/verify?n=${encodeURIComponent(number)}&c=${encodeURIComponent(code)}`,
    ),

  // Public API
  publicListCmsPosts: (params?: {
    page?: number;
    per_page?: number;
    category?: string;
    tag?: string;
    author?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    if (params?.category) sp.set("category", params.category);
    if (params?.tag) sp.set("tag", params.tag);
    if (params?.author) sp.set("author", params.author);
    const qs = sp.toString();
    return request<CmsPostList>(`/public/cms/posts${qs ? `?${qs}` : ""}`);
  },

  publicGetCmsPost: (slug: string) => request<CmsPublicPost>(`/public/cms/posts/${slug}`),

  publicGetFeaturedPosts: () => request<CmsPublicPost[]>("/public/cms/posts/featured"),

  publicRecordCmsView: (postId: string) =>
    request<void>(`/public/cms/posts/${postId}/view`, { method: "POST" }),

  publicGetCmsPage: (slug: string) => request<CmsPage>(`/public/cms/pages/${slug}`),

  publicSubscribeCms: (data: CreateCmsSubscriber) =>
    request<CmsSubscriber>("/public/cms/subscribe", { method: "POST", body: JSON.stringify(data) }),

  publicConfirmCmsSubscription: (token: string) => request<void>(`/public/cms/confirm/${token}`),

  publicUnsubscribeCms: (token: string) => request<void>(`/public/cms/unsubscribe/${token}`),
  getPublicInvite: (token: string) =>
    request<PublicInvite>(`/public/invitations/${encodeURIComponent(token)}`),
  acceptInvite: (token: string, data: { username: string; password: string; full_name?: string }) =>
    request<{ status: string }>(`/public/invitations/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Public — the QR on a signed print; answers no patient or clinical detail. */
  verifySignatureLink: (token: string) =>
    request<PublicSignatureCheck>(`/public/signatures/verify/${encodeURIComponent(token)}`),

  /** Doctors a member of the public may book with. 404 unless the tenant opts in. */
  getPublicBookableDoctors: (tenantCode: string) =>
    request<PublicBookingDirectory>(
      `/public/appointments/directory?tenant_code=${encodeURIComponent(tenantCode)}`,
    ),
  getPublicAppointmentSlots: (params: { tenant_code: string; doctor_id: string; date: string }) =>
    request<PublicAvailableSlot[]>(
      `/public/appointments/slots?tenant_code=${encodeURIComponent(params.tenant_code)}` +
        `&doctor_id=${encodeURIComponent(params.doctor_id)}&date=${encodeURIComponent(params.date)}`,
    ),
  bookPublicAppointment: (data: PublicBookingRequest) =>
    request<PublicBookingResponse>("/public/appointments/book", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  requestPublicBookingOtp: (data: { tenant_code: string; patient_phone: string }) =>
    request<{ status: string; message: string }>("/public/appointments/otp", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  publicKioskCheckin: (data: { qr_data: string }) =>
    request<KioskCheckinResult>("/public/kiosk/checkin", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Follow a queue token from a patient's phone. No auth: the opaque token is the authorisation. */
  getPublicQueueTokenStatus: (statusToken: string) =>
    request<PublicTokenStatus>(`/public/queue-token/${statusToken}`),
  getPublicRadiologyViewer: (token: string) =>
    request<PublicShareLink>(`/public/radiology/viewer/${token}`),
  sendShareLinkCode: (token: string) =>
    request<{ sent_to: string }>(`/public/radiology/share/${token}/code`, { method: "POST" }),
  verifyShareLinkCode: (token: string, code: string) =>
    request<{ viewer_url: string }>(`/public/radiology/share/${token}/verify`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
};
