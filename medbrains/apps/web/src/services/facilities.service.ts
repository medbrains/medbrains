import { facilitiesApi } from "@medbrains/api/modules/facilities";

export const facilitiesService = {
  listFmsGasReadings: (...args: Parameters<typeof facilitiesApi.listFmsGasReadings>) =>
    facilitiesApi.listFmsGasReadings(...args),
  listFmsGasCompliance: (...args: Parameters<typeof facilitiesApi.listFmsGasCompliance>) =>
    facilitiesApi.listFmsGasCompliance(...args),
  createFmsGasReading: (...args: Parameters<typeof facilitiesApi.createFmsGasReading>) =>
    facilitiesApi.createFmsGasReading(...args),
  createFmsGasCompliance: (...args: Parameters<typeof facilitiesApi.createFmsGasCompliance>) =>
    facilitiesApi.createFmsGasCompliance(...args),
  listFmsFireEquipment: (...args: Parameters<typeof facilitiesApi.listFmsFireEquipment>) =>
    facilitiesApi.listFmsFireEquipment(...args),
  listFmsFireInspections: (...args: Parameters<typeof facilitiesApi.listFmsFireInspections>) =>
    facilitiesApi.listFmsFireInspections(...args),
  listFmsFireDrills: (...args: Parameters<typeof facilitiesApi.listFmsFireDrills>) =>
    facilitiesApi.listFmsFireDrills(...args),
  listFmsFireNoc: (...args: Parameters<typeof facilitiesApi.listFmsFireNoc>) =>
    facilitiesApi.listFmsFireNoc(...args),
  createFmsFireEquipment: (...args: Parameters<typeof facilitiesApi.createFmsFireEquipment>) =>
    facilitiesApi.createFmsFireEquipment(...args),
  createFmsFireDrill: (...args: Parameters<typeof facilitiesApi.createFmsFireDrill>) =>
    facilitiesApi.createFmsFireDrill(...args),
  listFmsWaterTests: (...args: Parameters<typeof facilitiesApi.listFmsWaterTests>) =>
    facilitiesApi.listFmsWaterTests(...args),
  listFmsWaterSchedules: (...args: Parameters<typeof facilitiesApi.listFmsWaterSchedules>) =>
    facilitiesApi.listFmsWaterSchedules(...args),
  createFmsWaterTest: (...args: Parameters<typeof facilitiesApi.createFmsWaterTest>) =>
    facilitiesApi.createFmsWaterTest(...args),
  createFmsWaterSchedule: (...args: Parameters<typeof facilitiesApi.createFmsWaterSchedule>) =>
    facilitiesApi.createFmsWaterSchedule(...args),
  listFmsEnergyReadings: (...args: Parameters<typeof facilitiesApi.listFmsEnergyReadings>) =>
    facilitiesApi.listFmsEnergyReadings(...args),
  createFmsEnergyReading: (...args: Parameters<typeof facilitiesApi.createFmsEnergyReading>) =>
    facilitiesApi.createFmsEnergyReading(...args),
  energyAnalytics: (...args: Parameters<typeof facilitiesApi.energyAnalytics>) =>
    facilitiesApi.energyAnalytics(...args),
  listFmsWorkOrders: (...args: Parameters<typeof facilitiesApi.listFmsWorkOrders>) =>
    facilitiesApi.listFmsWorkOrders(...args),
  createFmsWorkOrder: (...args: Parameters<typeof facilitiesApi.createFmsWorkOrder>) =>
    facilitiesApi.createFmsWorkOrder(...args),
  updateFmsWorkOrderStatus: (...args: Parameters<typeof facilitiesApi.updateFmsWorkOrderStatus>) =>
    facilitiesApi.updateFmsWorkOrderStatus(...args),
  schedulePm: (...args: Parameters<typeof facilitiesApi.schedulePm>) =>
    facilitiesApi.schedulePm(...args),
};
