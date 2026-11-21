import { adminApi } from "@medbrains/api/modules/admin";
import { devicePairingApi } from "@medbrains/api/modules/device-pairing";
import { devicesApi } from "@medbrains/api/modules/devices";
import { stationsApi } from "@medbrains/api/modules/stations";

export type MintDevicePairingTokenInput = Parameters<typeof adminApi.mintDevicePairingToken>[0];
export type ListAdapterCatalogInput = Parameters<typeof devicesApi.listAdapterCatalog>[0];
export type PreviewAdapterConfigResult = Awaited<
  ReturnType<typeof devicesApi.previewAdapterConfig>
>;
export type CreateDeviceInstanceInput = Parameters<typeof devicesApi.createDeviceInstance>[0];
export type CreateRoutingRuleInput = Parameters<typeof devicesApi.createRoutingRule>[0];
export type PairingToken = Awaited<ReturnType<typeof adminApi.mintDevicePairingToken>>;
export type PairedDeviceRow = Awaited<ReturnType<typeof adminApi.listPairedDevices>>[number];

export const adminDevicesService = {
  listDeviceInstances: () => devicesApi.listDeviceInstances(),
  assignDeviceBed: (id: string, bedLocationId: string | null) =>
    devicesApi.assignDeviceBed(id, bedLocationId),
  listDeviceMessages: (deviceId: string) => devicesApi.listDeviceMessages(deviceId),
  createDeviceInstance: (data: CreateDeviceInstanceInput) => devicesApi.createDeviceInstance(data),
  listAdapterCatalog: (params?: ListAdapterCatalogInput) => devicesApi.listAdapterCatalog(params),
  previewAdapterConfig: (adapterCode: string, departmentCode?: string) =>
    devicesApi.previewAdapterConfig(adapterCode, departmentCode),
  listManufacturers: () => devicesApi.listManufacturers(),
  listBridgeAgents: () => devicesApi.listBridgeAgents(),
  listRoutingRules: () => devicesApi.listRoutingRules(),
  createRoutingRule: (data: CreateRoutingRuleInput) => devicesApi.createRoutingRule(data),
  deleteRoutingRule: (id: string) => devicesApi.deleteRoutingRule(id),
  listPairedDevices: () => adminApi.listPairedDevices(),
  mintDevicePairingToken: (data: MintDevicePairingTokenInput) =>
    adminApi.mintDevicePairingToken(data),
  revokePairedDevice: (id: string, reason?: string) => adminApi.revokePairedDevice(id, reason),
  // One call for the whole fleet. The per-device endpoint exists, but asking it
  // once per row is an N+1 against a table that can hold a hospital's devices.
  getPeerRoster: () => devicePairingApi.getPeerRoster(),
  registerDeviceNodeKey: (deviceId: string, nodeId: string) =>
    devicePairingApi.registerDeviceNodeKey(deviceId, { node_id: nodeId }),
  revokeDeviceNodeKey: (deviceId: string) => devicePairingApi.revokeDeviceNodeKey(deviceId),
  listStations: () => stationsApi.listStations(),
  createStation: (data: Parameters<typeof stationsApi.createStation>[0]) =>
    stationsApi.createStation(data),
  updateStation: (id: string, data: Parameters<typeof stationsApi.updateStation>[1]) =>
    stationsApi.updateStation(id, data),
  deleteStation: (id: string) => stationsApi.deleteStation(id),
  listDeviceBindingCodes: () => adminApi.listDeviceBindingCodes(),
  issueDeviceBindingCode: (data: Parameters<typeof adminApi.issueDeviceBindingCode>[0]) =>
    adminApi.issueDeviceBindingCode(data),
  revokeDeviceBindingCode: (id: string, reason?: string) =>
    adminApi.revokeDeviceBindingCode(id, reason),
};
