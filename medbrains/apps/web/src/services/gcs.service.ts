import { clinicalApi } from "@medbrains/api/modules/clinical";

export const gcsService = {
  computeGcs: (data: Parameters<typeof clinicalApi.computeGcs>[0]) => clinicalApi.computeGcs(data),
};
