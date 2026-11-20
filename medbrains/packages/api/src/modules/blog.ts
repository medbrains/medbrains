/** The `/blog` API area. Moved from `client.ts`; one module per first path segment. */
import type { BlogPost, BlogPostListItem, UpsertBlogInput } from "@medbrains/types";
import { request } from "../client.js";

export const blogApi = {
  listBlog: (params?: { include_drafts?: boolean }) =>
    request<BlogPostListItem[]>(`/blog${params?.include_drafts ? "?include_drafts=true" : ""}`),
  getBlogPost: (id: string) => request<BlogPost>(`/blog/${id}`),
  createBlogPost: (input: UpsertBlogInput) =>
    request<BlogPost>("/blog", { method: "POST", body: JSON.stringify(input) }),
  updateBlogPost: (id: string, input: UpsertBlogInput) =>
    request<BlogPost>(`/blog/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteBlogPost: (id: string) =>
    request<{ deleted: boolean }>(`/blog/${id}`, { method: "DELETE" }),
};
