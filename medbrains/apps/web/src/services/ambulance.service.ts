import { api } from "@medbrains/api";
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
  listAmbulances: api.listAmbulances,
  createAmbulance: (data: CreateAmbulanceRequest) => api.createAmbulance(data),
  updateAmbulance: (id: string, data: UpdateAmbulanceRequest) => api.updateAmbulance(id, data),
  listAmbulanceDrivers: api.listAmbulanceDrivers,
  createAmbulanceDriver: (data: CreateAmbulanceDriverRequest) => api.createAmbulanceDriver(data),
  listAmbulanceTrips: api.listAmbulanceTrips,
  createAmbulanceTrip: (data: CreateAmbulanceTripRequest) => api.createAmbulanceTrip(data),
  updateAmbulanceTripStatus: (id: string, status: AmbulanceTripStatus) =>
    api.updateAmbulanceTripStatus(id, { status }),
  listAmbulanceMaintenance: api.listAmbulanceMaintenance,
  createAmbulanceMaintenance: (data: CreateAmbulanceMaintenanceRequest) =>
    api.createAmbulanceMaintenance(data),
  updateAmbulanceMaintenanceStatus: (id: string, status: AmbulanceMaintenanceStatus) =>
    api.updateAmbulanceMaintenance(id, { status }),
};
