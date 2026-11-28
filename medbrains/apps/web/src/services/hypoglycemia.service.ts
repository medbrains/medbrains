import { clinicalApi } from "@medbrains/api/modules/clinical";

export const hypoglycemiaService = {
  createHypoglycemiaEvent: (data: Parameters<typeof clinicalApi.createHypoglycemiaEvent>[0]) =>
    clinicalApi.createHypoglycemiaEvent(data),
  recheckHypoglycemiaEvent: (
    id: string,
    data: Parameters<typeof clinicalApi.recheckHypoglycemiaEvent>[1],
  ) => clinicalApi.recheckHypoglycemiaEvent(id, data),
  listHypoglycemiaEvents: (patientId: string) => clinicalApi.listHypoglycemiaEvents(patientId),
};
