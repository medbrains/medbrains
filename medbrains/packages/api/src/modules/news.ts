/** The `/news` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const newsApi = {
  // ── News / health advisories ──
  listActiveNews: (params?: { category?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<import("@medbrains/types").NewsArticle[]>(`/news${suffix}`);
  },
};
