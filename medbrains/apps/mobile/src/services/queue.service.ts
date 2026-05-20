import { api } from "@medbrains/api";

export type ListQueueInput = Parameters<typeof api.listQueue>[0];

export const queueService = {
  listQueue: (params: ListQueueInput) => api.listQueue(params),
  callQueueEntry: (id: string) => api.callQueueEntry(id),
  startConsultation: (id: string) => api.startConsultation(id),
  completeQueueEntry: (id: string) => api.completeQueueEntry(id),
  markNoShow: (id: string) => api.markNoShow(id),
};
