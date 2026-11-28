import { housekeepingApi } from "@medbrains/api/modules/housekeeping";
import { infectionControlApi } from "@medbrains/api/modules/infection-control";

export type ListBiowasteParams = Parameters<typeof infectionControlApi.listBiowasteRecords>[0];
export type CreateCleaningTaskInput = Parameters<typeof housekeepingApi.createCleaningTask>[0];
export type UpdateCleaningTaskStatusInput = Parameters<
  typeof housekeepingApi.updateCleaningTaskStatus
>[1];
export type CreateTurnaroundInput = Parameters<typeof housekeepingApi.createTurnaround>[0];
export type CreateCleaningScheduleInput = Parameters<
  typeof housekeepingApi.createCleaningSchedule
>[0];
export type CreatePestControlScheduleInput = Parameters<
  typeof housekeepingApi.createPestControlSchedule
>[0];
export type CreatePestControlLogInput = Parameters<typeof housekeepingApi.createPestControlLog>[0];
export type CreateLinenItemInput = Parameters<typeof housekeepingApi.createLinenItem>[0];
export type CreateLinenMovementInput = Parameters<typeof housekeepingApi.createLinenMovement>[0];
export type CreateLaundryBatchInput = Parameters<typeof housekeepingApi.createLaundryBatch>[0];
export type UpsertParLevelInput = Parameters<typeof housekeepingApi.upsertParLevel>[0];
export type CreateBiowasteRecordInput = Parameters<
  typeof infectionControlApi.createBiowasteRecord
>[0];
export type SharpReplacementInput = Parameters<typeof housekeepingApi.createSharpReplacement>[0];

export const housekeepingService = {
  listCleaningTasks: () => housekeepingApi.listCleaningTasks(),
  listTurnarounds: () => housekeepingApi.listTurnarounds(),
  createCleaningTask: (data: CreateCleaningTaskInput) => housekeepingApi.createCleaningTask(data),
  updateCleaningTaskStatus: (id: string, data: UpdateCleaningTaskStatusInput) =>
    housekeepingApi.updateCleaningTaskStatus(id, data),
  verifyCleaningTask: (id: string) => housekeepingApi.verifyCleaningTask(id),
  createTurnaround: (data: CreateTurnaroundInput) => housekeepingApi.createTurnaround(data),
  completeTurnaround: (id: string) => housekeepingApi.completeTurnaround(id),
  listCleaningSchedules: () => housekeepingApi.listCleaningSchedules(),
  listPestControlSchedules: () => housekeepingApi.listPestControlSchedules(),
  listPestControlLogs: () => housekeepingApi.listPestControlLogs(),
  createCleaningSchedule: (data: CreateCleaningScheduleInput) =>
    housekeepingApi.createCleaningSchedule(data),
  createPestControlSchedule: (data: CreatePestControlScheduleInput) =>
    housekeepingApi.createPestControlSchedule(data),
  createPestControlLog: (data: CreatePestControlLogInput) =>
    housekeepingApi.createPestControlLog(data),
  listLinenItems: () => housekeepingApi.listLinenItems(),
  listLinenMovements: () => housekeepingApi.listLinenMovements(),
  listLaundryBatches: () => housekeepingApi.listLaundryBatches(),
  createLinenItem: (data: CreateLinenItemInput) => housekeepingApi.createLinenItem(data),
  createLinenMovement: (data: CreateLinenMovementInput) =>
    housekeepingApi.createLinenMovement(data),
  createLaundryBatch: (data: CreateLaundryBatchInput) => housekeepingApi.createLaundryBatch(data),
  completeLaundryBatch: (id: string) => housekeepingApi.completeLaundryBatch(id),
  listParLevels: () => housekeepingApi.listParLevels(),
  listLinenCondemnations: () => housekeepingApi.listLinenCondemnations(),
  upsertParLevel: (data: UpsertParLevelInput) => housekeepingApi.upsertParLevel(data),
  listBiowasteRecords: (params?: ListBiowasteParams) =>
    infectionControlApi.listBiowasteRecords(params),
  createBiowasteRecord: (data: CreateBiowasteRecordInput) =>
    infectionControlApi.createBiowasteRecord(data),
  getBmwSchedule: () => housekeepingApi.getBmwSchedule(),
  createSharpReplacement: (data: SharpReplacementInput) =>
    housekeepingApi.createSharpReplacement(data),
};
