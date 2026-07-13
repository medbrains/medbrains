import { api } from "@medbrains/api";

export const childPughService = {
  computeChildPugh: (data: Parameters<typeof api.computeChildPugh>[0]) =>
    api.computeChildPugh(data),
};
