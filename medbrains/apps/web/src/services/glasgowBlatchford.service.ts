import { api } from "@medbrains/api";

export const glasgowBlatchfordService = {
  computeGlasgowBlatchford: (data: Parameters<typeof api.computeGlasgowBlatchford>[0]) =>
    api.computeGlasgowBlatchford(data),
};
