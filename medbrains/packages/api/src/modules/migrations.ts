/** The `/migrations` API area. Moved from `client.ts`; one module per first path segment. */
import type { CreateMigrationRequest, DataMigration, MigrationQuery } from "@medbrains/types";
import { request } from "../client.js";

export const migrationsApi = {
  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: DATA MIGRATION
  // ══════════════════════════════════════════════════════════════

  listMigrations: (params?: MigrationQuery) => {
    const sp = new URLSearchParams();
    if (params?.direction) sp.set("direction", params.direction);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.status) sp.set("status", params.status);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<DataMigration[]>(`/migrations${qs ? `?${qs}` : ""}`);
  },

  getMigration: (id: string) => request<DataMigration>(`/migrations/${id}`),

  createMigration: (data: CreateMigrationRequest) =>
    request<DataMigration>("/migrations", { method: "POST", body: JSON.stringify(data) }),

  cancelMigration: (id: string) =>
    request<DataMigration>(`/migrations/${id}/cancel`, { method: "POST" }),
};
