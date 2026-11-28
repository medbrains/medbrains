import { adminApi } from "@medbrains/api/modules/admin";

/** Kernel health for operators: audit chain, RLS mode, authz engine, config, facade adoption. */
export const kernelService = {
  getHealth: () => adminApi.getKernelHealth(),
};
