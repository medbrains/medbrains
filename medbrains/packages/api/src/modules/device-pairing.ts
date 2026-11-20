/** The `/device-pairing` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  DeviceCodeResponse,
  DeviceNodeKey,
  DeviceTokenResponse,
  PeerRosterDoc,
} from "@medbrains/types";
import { request } from "../client.js";

export const devicePairingApi = {
  /** The live peer node key for a device, or null if it has none. */
  getDeviceNodeKey: (deviceId: string) =>
    request<DeviceNodeKey | null>(`/device-pairing/paired/${deviceId}/node-key`),

  /**
   * Binds a node key to a paired device. Enrolment is privileged — a device
   * that could enrol itself would make the binding worthless.
   */
  registerDeviceNodeKey: (deviceId: string, body: { node_id: string }) =>
    request<DeviceNodeKey>(`/device-pairing/paired/${deviceId}/node-key`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /**
   * Every live node key in the tenant. Edge appliances poll this to admit peers
   * while offline; the admin UI reads it once to show which devices are keyed,
   * rather than one request per row.
   */
  getPeerRoster: () => request<PeerRosterDoc>("/device-pairing/peer-roster"),

  /** Revokes without deleting — the emergency stop for a lost device. */
  revokeDeviceNodeKey: (deviceId: string) =>
    request<{ revoked: number }>(`/device-pairing/paired/${deviceId}/node-key`, {
      method: "DELETE",
    }),
  pairDevice: (data: Record<string, unknown>) =>
    request<unknown>("/device-pairing/pair", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // Device-code pairing, for surfaces with no camera to scan a QR with.
  requestDeviceCode: (data: {
    /** The hospital's code; the request belongs to that hospital only. */
    hospital_code: string;
    app_variant: string;
    public_key_pem?: string;
  }) =>
    request<DeviceCodeResponse>("/device-pairing/device-code", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  pollDeviceToken: (data: { device_code: string }) =>
    request<DeviceTokenResponse>("/device-pairing/device-token", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
