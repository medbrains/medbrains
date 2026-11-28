import { ambulanceApi } from "@medbrains/api/modules/ambulance";
import type {
  AmbulanceMaintenanceStatus,
  AmbulanceTripStatus,
  CreateAmbulanceDriverRequest,
  CreateAmbulanceMaintenanceRequest,
  CreateAmbulanceRequest,
  CreateAmbulanceTripRequest,
  UpdateAmbulanceRequest,
} from "@medbrains/types";

export const ambulanceService = {
  listAmbulances: ambulanceApi.listAmbulances,
  createAmbulance: (data: CreateAmbulanceRequest) => ambulanceApi.createAmbulance(data),
  updateAmbulance: (id: string, data: UpdateAmbulanceRequest) =>
    ambulanceApi.updateAmbulance(id, data),
  listAmbulanceDrivers: ambulanceApi.listAmbulanceDrivers,
  createAmbulanceDriver: (data: CreateAmbulanceDriverRequest) =>
    ambulanceApi.createAmbulanceDriver(data),
  listAmbulanceTrips: ambulanceApi.listAmbulanceTrips,
  createAmbulanceTrip: (data: CreateAmbulanceTripRequest) => ambulanceApi.createAmbulanceTrip(data),
  updateAmbulanceTripStatus: (id: string, status: AmbulanceTripStatus) =>
    ambulanceApi.updateAmbulanceTripStatus(id, { status }),
  listAmbulanceMaintenance: ambulanceApi.listAmbulanceMaintenance,
  createAmbulanceMaintenance: (data: CreateAmbulanceMaintenanceRequest) =>
    ambulanceApi.createAmbulanceMaintenance(data),
  updateAmbulanceMaintenanceStatus: (id: string, status: AmbulanceMaintenanceStatus) =>
    ambulanceApi.updateAmbulanceMaintenance(id, { status }),
};
