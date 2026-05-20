import { api } from "@medbrains/api";
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
  listSchedules: (...args: Parameters<typeof api.listSchedules>) => api.listSchedules(...args),
  createSchedule: (data: CreateScheduleRequest) => api.createSchedule(data),
  updateSchedule: (id: string, data: UpdateScheduleRequest) => api.updateSchedule(id, data),
  deleteSchedule: (id: string) => api.deleteSchedule(id),
  listScheduleExceptions: (...args: Parameters<typeof api.listScheduleExceptions>) =>
    api.listScheduleExceptions(...args),
  createScheduleException: (data: CreateScheduleExceptionRequest) =>
    api.createScheduleException(data),
  deleteScheduleException: (id: string) => api.deleteScheduleException(id),
  listPredictions: api.listPredictions,
  scoreBatch: api.scoreBatch,
  scoreAppointment: api.scoreAppointment,
  listWaitlist: api.listWaitlist,
  createWaitlistEntry: (data: CreateWaitlistRequest) => api.createWaitlistEntry(data),
  offerSlot: api.offerSlot,
  respondToOffer: api.respondToOffer,
  autoFillSlots: api.autoFillSlots,
  listOverbookingRules: api.listOverbookingRules,
  createOverbookingRule: (data: CreateOverbookingRuleRequest) => api.createOverbookingRule(data),
  updateOverbookingRule: (id: string, data: UpdateOverbookingRuleRequest) =>
    api.updateOverbookingRule(id, data),
  deleteOverbookingRule: api.deleteOverbookingRule,
  schedulingConflicts: api.schedulingConflicts,
  createRecurringAppointment: (data: CreateRecurringRequest) =>
    api.createRecurringAppointment(data),
  createScheduleBlock: (data: CreateBlockRequest) => api.createScheduleBlock(data),
  promoteWaitlist: api.promoteWaitlist,
  noshowRates: api.noshowRates,
  predictionAccuracy: api.predictionAccuracy,
  waitlistStats: api.waitlistStats,
  scheduleAnalytics: api.scheduleAnalytics,
};
