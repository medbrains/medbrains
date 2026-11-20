/** The `/cms` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CmsAuthor,
  CmsCategory,
  CmsCategoryWithChildren,
  CmsDashboardStats,
  CmsMedia,
  CmsMenu,
  CmsPage,
  CmsPost,
  CmsPostAnalytics,
  CmsPostDetail,
  CmsPostRevision,
  CmsPostSummary,
  CmsSettings,
  CmsSubscriber,
  CmsTag,
  CreateCmsAuthor,
  CreateCmsCategory,
  CreateCmsMedia,
  CreateCmsPage,
  CreateCmsPost,
  CreateCmsTag,
  ReviewPostAction,
  SchedulePostRequest,
  SubmitPostForReview,
  UpdateCmsAuthor,
  UpdateCmsCategory,
  UpdateCmsMedia,
  UpdateCmsMenu,
  UpdateCmsPage,
  UpdateCmsPost,
  UpdateCmsSettings,
  UpdateCmsTag,
} from "@medbrains/types";
import { request } from "../client.js";

export const cmsApi = {
  // ══════════════════════════════════════════════════════════════════════════════
  // CMS & Blog
  // ══════════════════════════════════════════════════════════════════════════════

  // Dashboard
  getCmsDashboard: () => request<CmsDashboardStats>("/cms/dashboard"),

  // Categories
  listCmsCategories: () => request<CmsCategory[]>("/cms/categories"),

  listCmsCategoriesTree: () => request<CmsCategoryWithChildren[]>("/cms/categories/tree"),

  getCmsCategory: (id: string) => request<CmsCategory>(`/cms/categories/${id}`),

  createCmsCategory: (data: CreateCmsCategory) =>
    request<CmsCategory>("/cms/categories", { method: "POST", body: JSON.stringify(data) }),

  updateCmsCategory: (id: string, data: UpdateCmsCategory) =>
    request<CmsCategory>(`/cms/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsCategory: (id: string) => request<void>(`/cms/categories/${id}`, { method: "DELETE" }),

  // Tags
  listCmsTags: () => request<CmsTag[]>("/cms/tags"),

  getCmsTag: (id: string) => request<CmsTag>(`/cms/tags/${id}`),

  createCmsTag: (data: CreateCmsTag) =>
    request<CmsTag>("/cms/tags", { method: "POST", body: JSON.stringify(data) }),

  updateCmsTag: (id: string, data: UpdateCmsTag) =>
    request<CmsTag>(`/cms/tags/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsTag: (id: string) => request<void>(`/cms/tags/${id}`, { method: "DELETE" }),

  bulkDeleteCmsTags: (ids: string[]) =>
    request<void>("/cms/tags/bulk-delete", { method: "POST", body: JSON.stringify(ids) }),

  // Authors
  listCmsAuthors: () => request<CmsAuthor[]>("/cms/authors"),

  getCmsAuthor: (id: string) => request<CmsAuthor>(`/cms/authors/${id}`),

  createCmsAuthor: (data: CreateCmsAuthor) =>
    request<CmsAuthor>("/cms/authors", { method: "POST", body: JSON.stringify(data) }),

  updateCmsAuthor: (id: string, data: UpdateCmsAuthor) =>
    request<CmsAuthor>(`/cms/authors/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsAuthor: (id: string) => request<void>(`/cms/authors/${id}`, { method: "DELETE" }),

  // Media Library
  listCmsMedia: (params?: { page?: number; per_page?: number; mime_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    if (params?.mime_type) sp.set("mime_type", params.mime_type);
    const qs = sp.toString();
    return request<CmsMedia[]>(`/cms/media${qs ? `?${qs}` : ""}`);
  },

  getCmsMedia: (id: string) => request<CmsMedia>(`/cms/media/${id}`),

  createCmsMedia: (data: CreateCmsMedia) =>
    request<CmsMedia>("/cms/media", { method: "POST", body: JSON.stringify(data) }),

  updateCmsMedia: (id: string, data: UpdateCmsMedia) =>
    request<CmsMedia>(`/cms/media/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsMedia: (id: string) => request<void>(`/cms/media/${id}`, { method: "DELETE" }),

  // Posts
  listCmsPosts: (params?: {
    page?: number;
    per_page?: number;
    status?: string;
    category_id?: string;
    author_id?: string;
    search?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    if (params?.status) sp.set("status", params.status);
    if (params?.category_id) sp.set("category_id", params.category_id);
    if (params?.author_id) sp.set("author_id", params.author_id);
    if (params?.search) sp.set("search", params.search);
    const qs = sp.toString();
    return request<CmsPostSummary[]>(`/cms/posts${qs ? `?${qs}` : ""}`);
  },

  getCmsPost: (id: string) => request<CmsPostDetail>(`/cms/posts/${id}`),

  createCmsPost: (data: CreateCmsPost) =>
    request<CmsPost>("/cms/posts", { method: "POST", body: JSON.stringify(data) }),

  updateCmsPost: (id: string, data: UpdateCmsPost) =>
    request<CmsPost>(`/cms/posts/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsPost: (id: string) => request<void>(`/cms/posts/${id}`, { method: "DELETE" }),

  // Post Workflow
  submitCmsPostForReview: (id: string, data: SubmitPostForReview) =>
    request<CmsPost>(`/cms/posts/${id}/submit-review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  reviewCmsPost: (id: string, data: ReviewPostAction) =>
    request<CmsPost>(`/cms/posts/${id}/review`, { method: "POST", body: JSON.stringify(data) }),

  medicalReviewCmsPost: (id: string, data: ReviewPostAction) =>
    request<CmsPost>(`/cms/posts/${id}/medical-review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  publishCmsPost: (id: string) => request<CmsPost>(`/cms/posts/${id}/publish`, { method: "POST" }),

  scheduleCmsPost: (id: string, data: SchedulePostRequest) =>
    request<CmsPost>(`/cms/posts/${id}/schedule`, { method: "POST", body: JSON.stringify(data) }),

  archiveCmsPost: (id: string) => request<CmsPost>(`/cms/posts/${id}/archive`, { method: "POST" }),

  unarchiveCmsPost: (id: string) =>
    request<CmsPost>(`/cms/posts/${id}/unarchive`, { method: "POST" }),

  // Post Revisions
  listCmsPostRevisions: (postId: string) =>
    request<CmsPostRevision[]>(`/cms/posts/${postId}/revisions`),

  getCmsPostRevision: (postId: string, revisionNumber: number) =>
    request<CmsPostRevision>(`/cms/posts/${postId}/revisions/${revisionNumber}`),

  restoreCmsPostRevision: (postId: string, revisionNumber: number) =>
    request<CmsPost>(`/cms/posts/${postId}/revisions/${revisionNumber}/restore`, {
      method: "POST",
    }),

  // Post Analytics
  getCmsPostAnalytics: (id: string) => request<CmsPostAnalytics>(`/cms/posts/${id}/analytics`),

  listCmsTopPosts: () => request<CmsPostAnalytics[]>("/cms/analytics/top-posts"),

  // Subscribers
  listCmsSubscribers: (params?: { page?: number; per_page?: number; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<CmsSubscriber[]>(`/cms/subscribers${qs ? `?${qs}` : ""}`);
  },

  getCmsSubscriber: (id: string) => request<CmsSubscriber>(`/cms/subscribers/${id}`),

  deleteCmsSubscriber: (id: string) =>
    request<void>(`/cms/subscribers/${id}`, { method: "DELETE" }),

  exportCmsSubscribers: () => request<string>("/cms/subscribers/export"),

  // Pages
  listCmsPages: () => request<CmsPage[]>("/cms/pages"),

  getCmsPage: (id: string) => request<CmsPage>(`/cms/pages/${id}`),

  createCmsPage: (data: CreateCmsPage) =>
    request<CmsPage>("/cms/pages", { method: "POST", body: JSON.stringify(data) }),

  updateCmsPage: (id: string, data: UpdateCmsPage) =>
    request<CmsPage>(`/cms/pages/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCmsPage: (id: string) => request<void>(`/cms/pages/${id}`, { method: "DELETE" }),

  // Settings
  getCmsSettings: () => request<CmsSettings>("/cms/settings"),

  updateCmsSettings: (data: UpdateCmsSettings) =>
    request<CmsSettings>("/cms/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Menus
  listCmsMenus: () => request<CmsMenu[]>("/cms/menus"),

  getCmsMenu: (location: string) => request<CmsMenu>(`/cms/menus/${location}`),

  updateCmsMenu: (location: string, data: UpdateCmsMenu) =>
    request<CmsMenu>(`/cms/menus/${location}`, { method: "PUT", body: JSON.stringify(data) }),
};
