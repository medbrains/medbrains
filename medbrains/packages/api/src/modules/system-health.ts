/** The `/system-health` API area. Moved from `client.ts`; one module per first path segment. */
import type { SystemHealthDashboard } from "@medbrains/types";
import { request } from "../client.js";

export const systemHealthApi = {
  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: SYSTEM HEALTH & MONITORING
  // ══════════════════════════════════════════════════════════════

  getSystemHealthDashboard: () => request<SystemHealthDashboard>("/system-health"),
};
