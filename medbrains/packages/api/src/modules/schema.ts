/** The `/schema` API area. Moved from `client.ts`; one module per first path segment. */
import type { EventSchema, ModuleEntitySchema, ModuleSummary } from "@medbrains/types";
import { request } from "../client.js";

export const schemaApi = {
  // ── Schema Registry ─────────────────────────────────────

  listSchemaModules: () => request<ModuleSummary[]>("/schema/modules"),
  listModuleEntities: (code: string) =>
    request<ModuleEntitySchema[]>(`/schema/modules/${code}/entities`),
  listEventSchemas: () => request<EventSchema[]>("/schema/events"),
  getEventSchema: (eventType: string) =>
    request<EventSchema>(`/schema/events/${encodeURIComponent(eventType)}`),
};
