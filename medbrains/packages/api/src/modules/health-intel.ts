/** The `/health-intel` API area. Moved from `client.ts`; one module per first path segment. */
import type { EnvironmentView, HealthIntel } from "@medbrains/types";
import { request } from "../client.js";

export const healthIntelApi = {
  getHealthIntel: () => request<HealthIntel>("/health-intel"),
  getHealthEnvironment: () => request<EnvironmentView>("/health-intel/environment"),
};
