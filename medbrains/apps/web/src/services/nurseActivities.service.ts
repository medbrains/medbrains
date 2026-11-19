import { nurseApi } from "@medbrains/api/modules/nurse";
import type { IpdMedicationAdministration, MarDueRow, UpdateMarRoundInput } from "@medbrains/types";

export const nurseActivitiesService = {
  listNurseRoster: (...args: Parameters<typeof nurseApi.listNurseRoster>) =>
    nurseApi.listNurseRoster(...args),
  createNurseRosterEntry: (...args: Parameters<typeof nurseApi.createNurseRosterEntry>) =>
    nurseApi.createNurseRosterEntry(...args),
  deleteNurseRosterEntry: (...args: Parameters<typeof nurseApi.deleteNurseRosterEntry>) =>
    nurseApi.deleteNurseRosterEntry(...args),
  listNurseRosterCandidates: (...args: Parameters<typeof nurseApi.listNurseRosterCandidates>) =>
    nurseApi.listNurseRosterCandidates(...args),
  listMarDueNow: (params?: { window_min?: number; ward_id?: string; patient_id?: string }) =>
    nurseApi.listMarDueNow(params) as Promise<MarDueRow[]>,
  updateMarRound: (id: string, data: UpdateMarRoundInput) =>
    nurseApi.updateMarRound(
      id,
      data as unknown as Record<string, unknown>,
    ) as Promise<IpdMedicationAdministration>,
  listMarForPatient: (patientId: string) =>
    nurseApi.listMarForPatient(patientId) as Promise<IpdMedicationAdministration[]>,
  verifyMarBarcode: (id: string, data: { patient_barcode: string; drug_barcode: string }) =>
    nurseApi.verifyMarBarcode(id, data),
  listVitalsSchedules: (...args: Parameters<typeof nurseApi.listVitalsSchedules>) =>
    nurseApi.listVitalsSchedules(...args),
  createVitalsSchedule: (...args: Parameters<typeof nurseApi.createVitalsSchedule>) =>
    nurseApi.createVitalsSchedule(...args),
  endVitalsSchedule: (...args: Parameters<typeof nurseApi.endVitalsSchedule>) =>
    nurseApi.endVitalsSchedule(...args),
  createNurseVital: (...args: Parameters<typeof nurseApi.createNurseVital>) =>
    nurseApi.createNurseVital(...args),
  listMonitorReadings: (encounterId: string) => nurseApi.listMonitorReadings(encounterId),
  confirmMonitorReading: (...args: Parameters<typeof nurseApi.confirmMonitorReading>) =>
    nurseApi.confirmMonitorReading(...args),
  discardMonitorReading: (id: string, reason: string) => nurseApi.discardMonitorReading(id, reason),
  // A failed read is an error on screen, never another encounter list passed
  // off as this one.
  listNurseVitals: (encounterId: string) => nurseApi.listNurseVitals(encounterId),
  getEwsPlan: (encounterId: string) => nurseApi.getEwsPlan(encounterId),
  setEwsPlan: (...args: Parameters<typeof nurseApi.setEwsPlan>) => nurseApi.setEwsPlan(...args),
  getEwsPolicy: () => nurseApi.getEwsPolicy(),
  setEwsPolicy: (...args: Parameters<typeof nurseApi.setEwsPolicy>) =>
    nurseApi.setEwsPolicy(...args),
  listIoForEncounter: (...args: Parameters<typeof nurseApi.listIoForEncounter>) =>
    nurseApi.listIoForEncounter(...args),
  getEncounterIoBalance: (...args: Parameters<typeof nurseApi.getEncounterIoBalance>) =>
    nurseApi.getEncounterIoBalance(...args),
  createIoEntry: (...args: Parameters<typeof nurseApi.createIoEntry>) =>
    nurseApi.createIoEntry(...args),
  createPainEntry: (...args: Parameters<typeof nurseApi.createPainEntry>) =>
    nurseApi.createPainEntry(...args),
  listPainForEncounter: (...args: Parameters<typeof nurseApi.listPainForEncounter>) =>
    nurseApi.listPainForEncounter(...args),
  createFallRisk: (...args: Parameters<typeof nurseApi.createFallRisk>) =>
    nurseApi.createFallRisk(...args),
  listFallRiskForEncounter: (...args: Parameters<typeof nurseApi.listFallRiskForEncounter>) =>
    nurseApi.listFallRiskForEncounter(...args),
  createWound: (...args: Parameters<typeof nurseApi.createWound>) => nurseApi.createWound(...args),
  listWoundsForEncounter: (...args: Parameters<typeof nurseApi.listWoundsForEncounter>) =>
    nurseApi.listWoundsForEncounter(...args),
  createHandoff: (...args: Parameters<typeof nurseApi.createHandoff>) =>
    nurseApi.createHandoff(...args),
  acceptHandoff: (...args: Parameters<typeof nurseApi.acceptHandoff>) =>
    nurseApi.acceptHandoff(...args),
  listHandoffsForEncounter: (...args: Parameters<typeof nurseApi.listHandoffsForEncounter>) =>
    nurseApi.listHandoffsForEncounter(...args),
  listCodeBlue: (...args: Parameters<typeof nurseApi.listCodeBlue>) =>
    nurseApi.listCodeBlue(...args),
  startCodeBlue: (...args: Parameters<typeof nurseApi.startCodeBlue>) =>
    nurseApi.startCodeBlue(...args),
  endCodeBlue: (...args: Parameters<typeof nurseApi.endCodeBlue>) => nurseApi.endCodeBlue(...args),
  listCodeBlueResponders: (...args: Parameters<typeof nurseApi.listCodeBlueResponders>) =>
    nurseApi.listCodeBlueResponders(...args),
  respondToCodeBlue: (...args: Parameters<typeof nurseApi.respondToCodeBlue>) =>
    nurseApi.respondToCodeBlue(...args),
  getCodeBlueTeam: () => nurseApi.getCodeBlueTeam(),
  addCodeBlueTeamMember: (...args: Parameters<typeof nurseApi.addCodeBlueTeamMember>) =>
    nurseApi.addCodeBlueTeamMember(...args),
  removeCodeBlueTeamMember: (...args: Parameters<typeof nurseApi.removeCodeBlueTeamMember>) =>
    nurseApi.removeCodeBlueTeamMember(...args),
  updateCodeBlueTeamSettings: (...args: Parameters<typeof nurseApi.updateCodeBlueTeamSettings>) =>
    nurseApi.updateCodeBlueTeamSettings(...args),
  listEquipmentChecks: (...args: Parameters<typeof nurseApi.listEquipmentChecks>) =>
    nurseApi.listEquipmentChecks(...args),
  createEquipmentCheck: (...args: Parameters<typeof nurseApi.createEquipmentCheck>) =>
    nurseApi.createEquipmentCheck(...args),
};
