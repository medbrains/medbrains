/** The `/devices` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AnalyzerOrderSent,
  AnalyzerWorklist,
  BridgeAgent,
  CreateDeviceInstanceRequest,
  CreateRoutingRuleRequest,
  DeviceAdapterCatalog,
  DeviceConfigHistory,
  DeviceInstance,
  DeviceMessage,
  DeviceRoutingRule,
  GeneratedDeviceConfig,
  ManufacturerSummary,
  UpdateDeviceInstanceRequest,
  UpdateRoutingRuleRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const devicesApi = {
  // ── Device Integration ──────────────────────────────────────

  listManufacturers: () => request<ManufacturerSummary[]>("/devices/manufacturers"),

  listAdapterCatalog: (params?: {
    q?: string;
    category?: string;
    protocol?: string;
    manufacturer?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.category) qs.set("category", params.category);
    if (params?.protocol) qs.set("protocol", params.protocol);
    if (params?.manufacturer) qs.set("manufacturer", params.manufacturer);
    const query = qs.toString();
    return request<DeviceAdapterCatalog[]>(`/devices/catalog${query ? `?${query}` : ""}`);
  },

  getAdapter: (adapterCode: string) =>
    request<DeviceAdapterCatalog>(`/devices/catalog/${adapterCode}`),

  previewAdapterConfig: (adapterCode: string, departmentCode?: string) =>
    request<GeneratedDeviceConfig>(
      `/devices/catalog/${adapterCode}/preview-config${departmentCode ? `?department_code=${departmentCode}` : ""}`,
    ),

  listDeviceInstances: () => request<DeviceInstance[]>("/devices/instances"),

  getDeviceInstance: (id: string) => request<DeviceInstance>(`/devices/instances/${id}`),

  createDeviceInstance: (data: CreateDeviceInstanceRequest) =>
    request<DeviceInstance>("/devices/instances", { method: "POST", body: JSON.stringify(data) }),

  /** The bed a bedside monitor watches; `null` takes it off. */
  assignDeviceBed: (id: string, bedLocationId: string | null) =>
    request<DeviceInstance>(`/devices/instances/${id}/bed`, {
      method: "PUT",
      body: JSON.stringify({ bed_location_id: bedLocationId }),
    }),
  updateDeviceInstance: (id: string, data: UpdateDeviceInstanceRequest) =>
    request<DeviceInstance>(`/devices/instances/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  decommissionDevice: (id: string) =>
    request<{ status: string }>(`/devices/instances/${id}`, { method: "DELETE" }),

  testDeviceConnection: (id: string) =>
    request<{ status: string; message: string }>(`/devices/instances/${id}/test`, {
      method: "POST",
    }),

  regenerateDeviceConfig: (id: string) =>
    request<GeneratedDeviceConfig>(`/devices/instances/${id}/regenerate-config`, {
      method: "POST",
    }),

  listDeviceMessages: (deviceId: string, params?: { page?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return request<DeviceMessage[]>(
      `/devices/instances/${deviceId}/messages${query ? `?${query}` : ""}`,
    );
  },

  /** The analyzer's worklist, as its lab bridge polls it (#227). */
  listAnalyzerOrders: (deviceId: string) =>
    request<AnalyzerWorklist>(`/devices/instances/${deviceId}/analyzer-orders`),

  /** What the analyzer acknowledged, as its lab bridge reports it. */
  recordAnalyzerOrdersSent: (deviceId: string, sent: AnalyzerOrderSent[]) =>
    request<{ recorded: number }>(`/devices/instances/${deviceId}/analyzer-orders/sent`, {
      method: "POST",
      body: JSON.stringify({ sent }),
    }),

  listDeviceConfigHistory: (deviceId: string) =>
    request<DeviceConfigHistory[]>(`/devices/instances/${deviceId}/config-history`),

  listBridgeAgents: () => request<BridgeAgent[]>("/devices/agents"),

  // Routing Rules
  listRoutingRules: () => request<DeviceRoutingRule[]>("/devices/routing-rules"),

  createRoutingRule: (data: CreateRoutingRuleRequest) =>
    request<DeviceRoutingRule>("/devices/routing-rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRoutingRule: (id: string, data: UpdateRoutingRuleRequest) =>
    request<DeviceRoutingRule>(`/devices/routing-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteRoutingRule: (id: string) =>
    request<{ status: string }>(`/devices/routing-rules/${id}`, { method: "DELETE" }),
};
