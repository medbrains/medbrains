import { api } from "@medbrains/api";

export const careViewService = {
  listWards: api.listWards,
  wardOnDuty: api.wardOnDuty,
  wardPatientGrid: api.wardPatientGrid,
  vitalsChecklist: api.vitalsChecklist,
  myTasks: api.careViewMyTasks,
  completeTask: api.completeCareViewTask,
  handoverSummary: api.handoverSummary,
  dischargeReadiness: api.dischargeReadiness,
  listPatientScores: api.listPatientScores,
  recordPatientScore: api.recordPatientScore,
};
