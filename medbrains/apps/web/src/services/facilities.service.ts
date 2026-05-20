import { api } from "@medbrains/api";

export const facilitiesService = {
  listFmsGasReadings: (...args: Parameters<typeof api.listFmsGasReadings>) =>
    api.listFmsGasReadings(...args),
  listFmsGasCompliance: (...args: Parameters<typeof api.listFmsGasCompliance>) =>
    api.listFmsGasCompliance(...args),
  createFmsGasReading: (...args: Parameters<typeof api.createFmsGasReading>) =>
    api.createFmsGasReading(...args),
  createFmsGasCompliance: (...args: Parameters<typeof api.createFmsGasCompliance>) =>
    api.createFmsGasCompliance(...args),
  listFmsFireEquipment: (...args: Parameters<typeof api.listFmsFireEquipment>) =>
    api.listFmsFireEquipment(...args),
  listFmsFireInspections: (...args: Parameters<typeof api.listFmsFireInspections>) =>
    api.listFmsFireInspections(...args),
  listFmsFireDrills: (...args: Parameters<typeof api.listFmsFireDrills>) =>
    api.listFmsFireDrills(...args),
  listFmsFireNoc: (...args: Parameters<typeof api.listFmsFireNoc>) => api.listFmsFireNoc(...args),
  createFmsFireEquipment: (...args: Parameters<typeof api.createFmsFireEquipment>) =>
    api.createFmsFireEquipment(...args),
  createFmsFireDrill: (...args: Parameters<typeof api.createFmsFireDrill>) =>
    api.createFmsFireDrill(...args),
  listFmsWaterTests: (...args: Parameters<typeof api.listFmsWaterTests>) =>
    api.listFmsWaterTests(...args),
  listFmsWaterSchedules: (...args: Parameters<typeof api.listFmsWaterSchedules>) =>
    api.listFmsWaterSchedules(...args),
  createFmsWaterTest: (...args: Parameters<typeof api.createFmsWaterTest>) =>
    api.createFmsWaterTest(...args),
  createFmsWaterSchedule: (...args: Parameters<typeof api.createFmsWaterSchedule>) =>
    api.createFmsWaterSchedule(...args),
  listFmsEnergyReadings: (...args: Parameters<typeof api.listFmsEnergyReadings>) =>
    api.listFmsEnergyReadings(...args),
  createFmsEnergyReading: (...args: Parameters<typeof api.createFmsEnergyReading>) =>
    api.createFmsEnergyReading(...args),
  energyAnalytics: (...args: Parameters<typeof api.energyAnalytics>) =>
    api.energyAnalytics(...args),
  listFmsWorkOrders: (...args: Parameters<typeof api.listFmsWorkOrders>) =>
    api.listFmsWorkOrders(...args),
  createFmsWorkOrder: (...args: Parameters<typeof api.createFmsWorkOrder>) =>
    api.createFmsWorkOrder(...args),
  updateFmsWorkOrderStatus: (...args: Parameters<typeof api.updateFmsWorkOrderStatus>) =>
    api.updateFmsWorkOrderStatus(...args),
  schedulePm: (...args: Parameters<typeof api.schedulePm>) => api.schedulePm(...args),
};
