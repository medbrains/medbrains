import { api } from "@medbrains/api";

export type MintDevicePairingTokenInput = Parameters<typeof api.mintDevicePairingToken>[0];
export type ListAdapterCatalogInput = Parameters<typeof api.listAdapterCatalog>[0];
export type PreviewAdapterConfigResult = Awaited<ReturnType<typeof api.previewAdapterConfig>>;
export type CreateDeviceInstanceInput = Parameters<typeof api.createDeviceInstance>[0];
export type CreateRoutingRuleInput = Parameters<typeof api.createRoutingRule>[0];
export type PairingToken = Awaited<ReturnType<typeof api.mintDevicePairingToken>>;
export type PairedDeviceRow = Awaited<ReturnType<typeof api.listPairedDevices>>[number];

export const adminDevicesService = {
  listDeviceInstances: () => api.listDeviceInstances(),
  createDeviceInstance: (data: CreateDeviceInstanceInput) => api.createDeviceInstance(data),
  listAdapterCatalog: (params?: ListAdapterCatalogInput) => api.listAdapterCatalog(params),
  previewAdapterConfig: (adapterCode: string, departmentCode?: string) =>
    api.previewAdapterConfig(adapterCode, departmentCode),
  listManufacturers: () => api.listManufacturers(),
  listBridgeAgents: () => api.listBridgeAgents(),
  listRoutingRules: () => api.listRoutingRules(),
  createRoutingRule: (data: CreateRoutingRuleInput) => api.createRoutingRule(data),
  deleteRoutingRule: (id: string) => api.deleteRoutingRule(id),
  listPairedDevices: () => api.listPairedDevices(),
  mintDevicePairingToken: (data: MintDevicePairingTokenInput) => api.mintDevicePairingToken(data),
  revokePairedDevice: (id: string, reason?: string) => api.revokePairedDevice(id, reason),
  // One call for the whole fleet. The per-device endpoint exists, but asking it
  // once per row is an N+1 against a table that can hold a hospital's devices.
  getPeerRoster: () => api.getPeerRoster(),
  registerDeviceNodeKey: (deviceId: string, nodeId: string) =>
    api.registerDeviceNodeKey(deviceId, { node_id: nodeId }),
  revokeDeviceNodeKey: (deviceId: string) => api.revokeDeviceNodeKey(deviceId),
  listStations: () => api.listStations(),
  createStation: (data: Parameters<typeof api.createStation>[0]) => api.createStation(data),
  updateStation: (id: string, data: Parameters<typeof api.updateStation>[1]) =>
    api.updateStation(id, data),
  deleteStation: (id: string) => api.deleteStation(id),
};
