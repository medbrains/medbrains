/** The `/sensitive-patients` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateSensitivePatientRequest,
  SensitivePatient,
  SensitivePatientSummary,
} from "@medbrains/types";
import { request } from "../client.js";

export const sensitivePatientsApi = {
  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: CLINICAL ACCESS MONITOR
  // ══════════════════════════════════════════════════════════════

  listSensitivePatients: () => request<SensitivePatientSummary[]>("/sensitive-patients"),

  createSensitivePatient: (data: CreateSensitivePatientRequest) =>
    request<SensitivePatient>("/sensitive-patients", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteSensitivePatient: (id: string) =>
    request<{ deleted: boolean }>(`/sensitive-patients/${id}`, { method: "DELETE" }),
};
