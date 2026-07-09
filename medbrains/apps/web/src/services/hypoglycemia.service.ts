import { api } from "@medbrains/api";

export const hypoglycemiaService = {
  createHypoglycemiaEvent: (data: Parameters<typeof api.createHypoglycemiaEvent>[0]) =>
    api.createHypoglycemiaEvent(data),
  recheckHypoglycemiaEvent: (
    id: string,
    data: Parameters<typeof api.recheckHypoglycemiaEvent>[1],
  ) => api.recheckHypoglycemiaEvent(id, data),
  listHypoglycemiaEvents: (patientId: string) => api.listHypoglycemiaEvents(patientId),
};
