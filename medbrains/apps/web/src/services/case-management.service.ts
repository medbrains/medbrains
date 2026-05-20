import { api } from "@medbrains/api";
import type {
  AutoAssignRequest,
  CreateCaseAssignmentRequest,
  CreateCaseReferralRequest,
  CreateDischargeBarrierRequest,
  UpdateCaseAssignmentRequest,
  UpdateCaseReferralRequest,
  UpdateDischargeBarrierRequest,
} from "@medbrains/types";

export const caseManagementService = {
  listCaseAssignments: api.listCaseAssignments,
  caseloadSummary: api.caseloadSummary,
  createCaseAssignment: (data: CreateCaseAssignmentRequest) => api.createCaseAssignment(data),
  updateCaseAssignment: (id: string, data: UpdateCaseAssignmentRequest) =>
    api.updateCaseAssignment(id, data),
  autoAssignCase: (data: AutoAssignRequest) => api.autoAssignCase(data),
  listDischargeBarriers: api.listDischargeBarriers,
  createDischargeBarrier: (data: CreateDischargeBarrierRequest) => api.createDischargeBarrier(data),
  updateDischargeBarrier: (id: string, data: UpdateDischargeBarrierRequest) =>
    api.updateDischargeBarrier(id, data),
  listCaseReferrals: api.listCaseReferrals,
  createCaseReferral: (data: CreateCaseReferralRequest) => api.createCaseReferral(data),
  updateCaseReferral: (id: string, data: UpdateCaseReferralRequest) =>
    api.updateCaseReferral(id, data),
  dispositionAnalytics: api.dispositionAnalytics,
  barrierAnalytics: api.barrierAnalytics,
  outcomeAnalytics: api.outcomeAnalytics,
};
