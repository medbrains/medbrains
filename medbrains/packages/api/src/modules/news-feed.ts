/** The `/news-feed` API area. Moved from `client.ts`; one module per first path segment. */
import type { NewsFeedArticle, NewsFeedListItem } from "@medbrains/types";
import { request } from "../client.js";

export const newsFeedApi = {
  listNewsFeed: (params?: { topic?: string; q?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.topic) qs.set("topic", params.topic);
    if (params?.q) qs.set("q", params.q);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString();
    return request<NewsFeedListItem[]>(`/news-feed${suffix ? `?${suffix}` : ""}`);
  },
  getNewsFeedArticle: (id: string) => request<NewsFeedArticle>(`/news-feed/${id}`),
};
