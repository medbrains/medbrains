import { opdApi } from "@medbrains/api/modules/opd";
import { schedulingApi } from "@medbrains/api/modules/scheduling";
import type {
  CreateBlockRequest,
  CreateOverbookingRuleRequest,
  CreateRecurringRequest,
  CreateScheduleExceptionRequest,
  CreateScheduleRequest,
  CreateWaitlistRequest,
  UpdateOverbookingRuleRequest,
  UpdateScheduleRequest,
} from "@medbrains/types";

export const schedulingService = {
  listSchedules: (...args: Parameters<typeof opdApi.listSchedules>) =>
    opdApi.listSchedules(...args),
  createSchedule: (data: CreateScheduleRequest) => opdApi.createSchedule(data),
  updateSchedule: (id: string, data: UpdateScheduleRequest) => opdApi.updateSchedule(id, data),
  deleteSchedule: (id: string) => opdApi.deleteSchedule(id),
  listScheduleExceptions: (...args: Parameters<typeof opdApi.listScheduleExceptions>) =>
    opdApi.listScheduleExceptions(...args),
  createScheduleException: (data: CreateScheduleExceptionRequest) =>
    opdApi.createScheduleException(data),
  deleteScheduleException: (id: string) => opdApi.deleteScheduleException(id),
  listPredictions: schedulingApi.listPredictions,
  scoreBatch: schedulingApi.scoreBatch,
  scoreAppointment: schedulingApi.scoreAppointment,
  listWaitlist: schedulingApi.listWaitlist,
  createWaitlistEntry: (data: CreateWaitlistRequest) => schedulingApi.createWaitlistEntry(data),
  offerSlot: schedulingApi.offerSlot,
  respondToOffer: schedulingApi.respondToOffer,
  autoFillSlots: schedulingApi.autoFillSlots,
  listOverbookingRules: schedulingApi.listOverbookingRules,
  createOverbookingRule: (data: CreateOverbookingRuleRequest) =>
    schedulingApi.createOverbookingRule(data),
  updateOverbookingRule: (id: string, data: UpdateOverbookingRuleRequest) =>
    schedulingApi.updateOverbookingRule(id, data),
  deleteOverbookingRule: schedulingApi.deleteOverbookingRule,
  schedulingConflicts: schedulingApi.schedulingConflicts,
  createRecurringAppointment: (data: CreateRecurringRequest) =>
    schedulingApi.createRecurringAppointment(data),
  createScheduleBlock: (data: CreateBlockRequest) => schedulingApi.createScheduleBlock(data),
  promoteWaitlist: schedulingApi.promoteWaitlist,
  noshowRates: schedulingApi.noshowRates,
  predictionAccuracy: schedulingApi.predictionAccuracy,
  waitlistStats: schedulingApi.waitlistStats,
  scheduleAnalytics: schedulingApi.scheduleAnalytics,
};
