/** The `/store` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const storeApi = {
  // ── Pharmacy storefront ───────────────────────────────────────────
  // Browsing and sign-in are public (anyone, by tenant code); the cart,
  // checkout and orders take the patient's token.
  getStoreAbout: (tenantCode: string) =>
    request<import("@medbrains/types").StoreAbout>(
      `/store/${encodeURIComponent(tenantCode)}/about`,
    ),
  searchStore: (tenantCode: string, q?: string, category?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    return request<import("@medbrains/types").StoreSearchResult>(
      `/store/${encodeURIComponent(tenantCode)}/items?${params.toString()}`,
    );
  },
  getStoreItem: (tenantCode: string, id: string) =>
    request<import("@medbrains/types").StoreItemPage>(
      `/store/${encodeURIComponent(tenantCode)}/items/${id}`,
    ),
  requestStoreCode: (tenantCode: string, phone: string) =>
    request<{ status: string; message: string }>(`/store/${encodeURIComponent(tenantCode)}/otp`, {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  storeSignIn: (tenantCode: string, data: import("@medbrains/types").StoreSignInRequest) =>
    request<import("@medbrains/types").StoreSignIn>(
      `/store/${encodeURIComponent(tenantCode)}/sign-in`,
      { method: "POST", body: JSON.stringify(data) },
    ),
};
