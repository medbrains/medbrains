import { api } from "@medbrains/api";

export type ListBiowasteParams = Parameters<typeof api.listBiowasteRecords>[0];
export type CreateCleaningTaskInput = Parameters<typeof api.createCleaningTask>[0];
export type UpdateCleaningTaskStatusInput = Parameters<typeof api.updateCleaningTaskStatus>[1];
export type CreateTurnaroundInput = Parameters<typeof api.createTurnaround>[0];
export type CreateCleaningScheduleInput = Parameters<typeof api.createCleaningSchedule>[0];
export type CreatePestControlScheduleInput = Parameters<typeof api.createPestControlSchedule>[0];
export type CreatePestControlLogInput = Parameters<typeof api.createPestControlLog>[0];
export type CreateLinenItemInput = Parameters<typeof api.createLinenItem>[0];
export type CreateLinenMovementInput = Parameters<typeof api.createLinenMovement>[0];
export type CreateLaundryBatchInput = Parameters<typeof api.createLaundryBatch>[0];
export type UpsertParLevelInput = Parameters<typeof api.upsertParLevel>[0];
export type CreateBiowasteRecordInput = Parameters<typeof api.createBiowasteRecord>[0];
export type SharpReplacementInput = Parameters<typeof api.createSharpReplacement>[0];

export const housekeepingService = {
  listCleaningTasks: () => api.listCleaningTasks(),
  listTurnarounds: () => api.listTurnarounds(),
  createCleaningTask: (data: CreateCleaningTaskInput) => api.createCleaningTask(data),
  updateCleaningTaskStatus: (id: string, data: UpdateCleaningTaskStatusInput) =>
    api.updateCleaningTaskStatus(id, data),
  verifyCleaningTask: (id: string) => api.verifyCleaningTask(id),
  createTurnaround: (data: CreateTurnaroundInput) => api.createTurnaround(data),
  completeTurnaround: (id: string) => api.completeTurnaround(id),
  listCleaningSchedules: () => api.listCleaningSchedules(),
  listPestControlSchedules: () => api.listPestControlSchedules(),
  listPestControlLogs: () => api.listPestControlLogs(),
  createCleaningSchedule: (data: CreateCleaningScheduleInput) => api.createCleaningSchedule(data),
  createPestControlSchedule: (data: CreatePestControlScheduleInput) =>
    api.createPestControlSchedule(data),
  createPestControlLog: (data: CreatePestControlLogInput) => api.createPestControlLog(data),
  listLinenItems: () => api.listLinenItems(),
  listLinenMovements: () => api.listLinenMovements(),
  listLaundryBatches: () => api.listLaundryBatches(),
  createLinenItem: (data: CreateLinenItemInput) => api.createLinenItem(data),
  createLinenMovement: (data: CreateLinenMovementInput) => api.createLinenMovement(data),
  createLaundryBatch: (data: CreateLaundryBatchInput) => api.createLaundryBatch(data),
  completeLaundryBatch: (id: string) => api.completeLaundryBatch(id),
  listParLevels: () => api.listParLevels(),
  listLinenCondemnations: () => api.listLinenCondemnations(),
  upsertParLevel: (data: UpsertParLevelInput) => api.upsertParLevel(data),
  listBiowasteRecords: (params?: ListBiowasteParams) => api.listBiowasteRecords(params),
  createBiowasteRecord: (data: CreateBiowasteRecordInput) => api.createBiowasteRecord(data),
  getBmwSchedule: () => api.getBmwSchedule(),
  createSharpReplacement: (data: SharpReplacementInput) => api.createSharpReplacement(data),
};
