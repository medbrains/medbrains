import { api } from "@medbrains/api";

export const cha2ds2VascService = {
  computeCha2ds2Vasc: (data: Parameters<typeof api.computeCha2ds2Vasc>[0]) =>
    api.computeCha2ds2Vasc(data),
};
