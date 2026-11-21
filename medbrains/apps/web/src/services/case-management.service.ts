import { caseMgmtApi } from "@medbrains/api/modules/case-mgmt";
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
  listCaseAssignments: caseMgmtApi.listCaseAssignments,
  caseloadSummary: caseMgmtApi.caseloadSummary,
  createCaseAssignment: (data: CreateCaseAssignmentRequest) =>
    caseMgmtApi.createCaseAssignment(data),
  updateCaseAssignment: (id: string, data: UpdateCaseAssignmentRequest) =>
    caseMgmtApi.updateCaseAssignment(id, data),
  autoAssignCase: (data: AutoAssignRequest) => caseMgmtApi.autoAssignCase(data),
  listDischargeBarriers: caseMgmtApi.listDischargeBarriers,
  createDischargeBarrier: (data: CreateDischargeBarrierRequest) =>
    caseMgmtApi.createDischargeBarrier(data),
  updateDischargeBarrier: (id: string, data: UpdateDischargeBarrierRequest) =>
    caseMgmtApi.updateDischargeBarrier(id, data),
  listCaseReferrals: caseMgmtApi.listCaseReferrals,
  createCaseReferral: (data: CreateCaseReferralRequest) => caseMgmtApi.createCaseReferral(data),
  updateCaseReferral: (id: string, data: UpdateCaseReferralRequest) =>
    caseMgmtApi.updateCaseReferral(id, data),
  dispositionAnalytics: caseMgmtApi.dispositionAnalytics,
  barrierAnalytics: caseMgmtApi.barrierAnalytics,
  outcomeAnalytics: caseMgmtApi.outcomeAnalytics,
};
