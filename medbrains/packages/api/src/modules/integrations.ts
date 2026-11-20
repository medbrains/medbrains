/** The `/integrations` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AdtDelivery,
  AdtDestination,
  AdtDestinationInput,
  NhcxConnectionTest,
  NhcxSettingsView,
  NhcxStatus,
  SaveNhcxSettings,
} from "@medbrains/types";
import { request } from "../client.js";

export const integrationsApi = {
  // HL7 ADT outbound feeds
  listHl7AdtDestinations: () => request<AdtDestination[]>("/integrations/hl7-adt/destinations"),
  createHl7AdtDestination: (data: AdtDestinationInput) =>
    request<AdtDestination>("/integrations/hl7-adt/destinations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateHl7AdtDestination: (id: string, data: AdtDestinationInput) =>
    request<AdtDestination>(`/integrations/hl7-adt/destinations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteHl7AdtDestination: (id: string) =>
    request<{ deleted: string }>(`/integrations/hl7-adt/destinations/${id}`, { method: "DELETE" }),
  listHl7AdtDeliveries: () => request<AdtDelivery[]>("/integrations/hl7-adt/deliveries"),

  /** Whether claims can go to NHCX, and what is missing if not. */
  getNhcxStatus: () => request<NhcxStatus>("/integrations/nhcx/status"),

  /** Settings → NHCX. Never returns a secret. */
  getNhcxSettings: () => request<NhcxSettingsView>("/integrations/nhcx/settings"),

  saveNhcxSettings: (data: SaveNhcxSettings) =>
    request<NhcxSettingsView>("/integrations/nhcx/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /** Sign in to the NHCX gateway with the saved credentials. */
  testNhcxConnection: () =>
    request<NhcxConnectionTest>("/integrations/nhcx/settings/test", { method: "POST" }),

  /**
   * NHCX webhook receipt log. Optional filters: correlation_id (specific
   * gateway exchange) or matched_id (specific local claim/preauth row).
   */
  listNhcxCallbacks: (params?: {
    correlation_id?: string;
    matched_id?: string;
    limit?: number;
  }) => {
    const qs = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        )}`
      : "";
    return request<
      Array<{
        id: string;
        tenant_id: string | null;
        received_at: string;
        correlation_id: string | null;
        api_call_id: string | null;
        sender_code: string | null;
        recipient_code: string | null;
        callback_type: string | null;
        raw_envelope: unknown;
        decrypted_payload: unknown;
        verification_status: string;
        matched_table: string | null;
        matched_id: string | null;
        error_detail: string | null;
      }>
    >(`/integrations/nhcx/callbacks${qs}`);
  },
};
