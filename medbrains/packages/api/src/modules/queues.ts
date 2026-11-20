/** The `/queues` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  QueueCategory,
  QueueConfig,
  QueueCounter,
  QueueCounterInput,
  QueueInput,
  QueuePlace,
  QueueRow,
  QueueSession,
} from "@medbrains/types";
import { request } from "../client.js";

export const queuesApi = {
  // Configured queues (Admin → Queues)
  listQueues: () => request<QueueRow[]>("/queues"),
  listQueuePlaces: (q?: string) =>
    request<QueuePlace[]>(`/queues/places${q ? `?${new URLSearchParams({ q })}` : ""}`),
  createQueue: (data: QueueInput) =>
    request<QueueConfig>("/queues", { method: "POST", body: JSON.stringify(data) }),
  updateQueue: (id: string, data: QueueInput) =>
    request<QueueConfig>(`/queues/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  listQueueCounters: (id: string) => request<QueueCounter[]>(`/queues/${id}/counters`),
  replaceQueueCounters: (id: string, data: QueueCounterInput[]) =>
    request<QueueCounter[]>(`/queues/${id}/counters`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listQueueSessions: (id: string) => request<QueueSession[]>(`/queues/${id}/sessions`),
  replaceQueueSessions: (id: string, data: QueueSession[]) =>
    request<QueueSession[]>(`/queues/${id}/sessions`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listQueueCategories: (id: string) => request<QueueCategory[]>(`/queues/${id}/categories`),
  replaceQueueCategories: (id: string, data: QueueCategory[]) =>
    request<QueueCategory[]>(`/queues/${id}/categories`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
