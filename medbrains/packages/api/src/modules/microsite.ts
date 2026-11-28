/** The `/microsite` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  HealthPackage,
  MicrositeConfig,
  SeoSetting,
  SiteDomain,
  Testimonial,
} from "@medbrains/types";
import { request } from "../client.js";

export const micrositeApi = {
  listHealthPackages: (activeOnly?: boolean) =>
    request<HealthPackage[]>(`/microsite/packages${activeOnly ? "?active_only=true" : ""}`),
  createHealthPackage: (data: {
    name: string;
    description?: string;
    price: number;
    includes?: string;
    category?: string;
    is_promoted?: boolean;
  }) =>
    request<HealthPackage>("/microsite/packages", { method: "POST", body: JSON.stringify(data) }),
  updateHealthPackage: (
    id: string,
    data: {
      name: string;
      description?: string;
      price: number;
      includes?: string;
      category?: string;
      is_active?: boolean;
      is_promoted?: boolean;
    },
  ) =>
    request<HealthPackage>(`/microsite/packages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteHealthPackage: (id: string) =>
    request<{ deactivated: string }>(`/microsite/packages/${id}`, { method: "DELETE" }),
  bookHealthPackage: (id: string, patientId: string) =>
    request<{ booking_id: string; invoice_id: string }>(`/microsite/packages/${id}/book`, {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId }),
    }),
  listTestimonials: (publishedOnly?: boolean) =>
    request<Testimonial[]>(`/microsite/testimonials${publishedOnly ? "?published_only=true" : ""}`),
  createTestimonial: (data: {
    patient_name: string;
    rating: number;
    service?: string;
    body: string;
  }) =>
    request<Testimonial>("/microsite/testimonials", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  moderateTestimonial: (id: string, data: { is_approved?: boolean; is_published?: boolean }) =>
    request<Testimonial>(`/microsite/testimonials/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listSeoSettings: () => request<SeoSetting[]>("/microsite/seo"),
  upsertSeoSetting: (data: {
    page_slug: string;
    meta_title?: string;
    meta_description?: string;
    keywords?: string;
    og_image_url?: string;
  }) => request<SeoSetting>("/microsite/seo", { method: "POST", body: JSON.stringify(data) }),
  listSiteDomains: () => request<SiteDomain[]>("/microsite/domains"),
  addSiteDomain: (data: { domain: string; is_primary?: boolean }) =>
    request<SiteDomain>("/microsite/domains", { method: "POST", body: JSON.stringify(data) }),
  verifySiteDomain: (id: string) =>
    request<SiteDomain>(`/microsite/domains/${id}/verify`, { method: "POST" }),
  getMicrositeConfig: () => request<MicrositeConfig>("/microsite/config"),
  updateMicrositeConfig: (data: {
    whatsapp_number?: string;
    whatsapp_enabled: boolean;
    chat_widget_enabled: boolean;
    chat_greeting?: string;
  }) =>
    request<MicrositeConfig>("/microsite/config", { method: "PUT", body: JSON.stringify(data) }),
};
