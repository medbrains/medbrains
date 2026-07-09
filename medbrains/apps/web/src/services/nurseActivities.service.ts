import { api } from "@medbrains/api";
import type { IpdMedicationAdministration, MarDueRow, UpdateMarRoundInput } from "@medbrains/types";

export const nurseActivitiesService = {
  listMarDueNow: (params?: { window_min?: number; ward_id?: string; patient_id?: string }) =>
    api.listMarDueNow(params) as Promise<MarDueRow[]>,
  updateMarRound: (id: string, data: UpdateMarRoundInput) =>
    api.updateMarRound(
      id,
      data as unknown as Record<string, unknown>,
    ) as Promise<IpdMedicationAdministration>,
  listMarForPatient: (patientId: string) =>
    api.listMarForPatient(patientId) as Promise<IpdMedicationAdministration[]>,
  verifyMarBarcode: (id: string, data: { patient_barcode: string; drug_barcode: string }) =>
    api.verifyMarBarcode(id, data),
  listVitalsSchedules: (...args: Parameters<typeof api.listVitalsSchedules>) =>
    api.listVitalsSchedules(...args),
  createVitalsSchedule: (...args: Parameters<typeof api.createVitalsSchedule>) =>
    api.createVitalsSchedule(...args),
  endVitalsSchedule: (...args: Parameters<typeof api.endVitalsSchedule>) =>
    api.endVitalsSchedule(...args),
  createNurseVital: (...args: Parameters<typeof api.createNurseVital>) =>
    api.createNurseVital(...args),
  listNurseVitals: async (encounterId: string) => {
    try {
      return await api.listNurseVitals(encounterId);
    } catch {
      return api.listVitals(encounterId);
    }
  },
  listIoForEncounter: (...args: Parameters<typeof api.listIoForEncounter>) =>
    api.listIoForEncounter(...args),
  getEncounterIoBalance: (...args: Parameters<typeof api.getEncounterIoBalance>) =>
    api.getEncounterIoBalance(...args),
  createIoEntry: (...args: Parameters<typeof api.createIoEntry>) => api.createIoEntry(...args),
  createPainEntry: (...args: Parameters<typeof api.createPainEntry>) =>
    api.createPainEntry(...args),
  listPainForEncounter: (...args: Parameters<typeof api.listPainForEncounter>) =>
    api.listPainForEncounter(...args),
  createFallRisk: (...args: Parameters<typeof api.createFallRisk>) => api.createFallRisk(...args),
  listFallRiskForEncounter: (...args: Parameters<typeof api.listFallRiskForEncounter>) =>
    api.listFallRiskForEncounter(...args),
  createWound: (...args: Parameters<typeof api.createWound>) => api.createWound(...args),
  listWoundsForEncounter: (...args: Parameters<typeof api.listWoundsForEncounter>) =>
    api.listWoundsForEncounter(...args),
  createHandoff: (...args: Parameters<typeof api.createHandoff>) => api.createHandoff(...args),
  acceptHandoff: (...args: Parameters<typeof api.acceptHandoff>) => api.acceptHandoff(...args),
  listHandoffsForEncounter: (...args: Parameters<typeof api.listHandoffsForEncounter>) =>
    api.listHandoffsForEncounter(...args),
  listCodeBlue: (...args: Parameters<typeof api.listCodeBlue>) => api.listCodeBlue(...args),
  startCodeBlue: (...args: Parameters<typeof api.startCodeBlue>) => api.startCodeBlue(...args),
  endCodeBlue: (...args: Parameters<typeof api.endCodeBlue>) => api.endCodeBlue(...args),
  listEquipmentChecks: (...args: Parameters<typeof api.listEquipmentChecks>) =>
    api.listEquipmentChecks(...args),
  createEquipmentCheck: (...args: Parameters<typeof api.createEquipmentCheck>) =>
    api.createEquipmentCheck(...args),
};
