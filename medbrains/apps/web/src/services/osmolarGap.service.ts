import { api } from "@medbrains/api";

export const osmolarGapService = {
  computeOsmolarGap: (data: Parameters<typeof api.computeOsmolarGap>[0]) =>
    api.computeOsmolarGap(data),
};
