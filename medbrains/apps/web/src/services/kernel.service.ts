import { api } from "@medbrains/api";

/** Kernel health for operators: audit chain, RLS mode, authz engine, config, facade adoption. */
export const kernelService = {
  getHealth: () => api.getKernelHealth(),
};
