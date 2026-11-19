import { careViewApi } from "@medbrains/api/modules/care-view";
import { ipdApi } from "@medbrains/api/modules/ipd";
import { nurseApi } from "@medbrains/api/modules/nurse";

export const careViewService = {
  listWards: ipdApi.listWards,
  wardOnDuty: ipdApi.wardOnDuty,
  wardPatientGrid: careViewApi.wardPatientGrid,
  vitalsChecklist: careViewApi.vitalsChecklist,
  myTasks: careViewApi.careViewMyTasks,
  completeTask: careViewApi.completeCareViewTask,
  handoverSummary: careViewApi.handoverSummary,
  dischargeReadiness: careViewApi.dischargeReadiness,
  listPatientScores: careViewApi.listPatientScores,
  recordPatientScore: careViewApi.recordPatientScore,
  listEwsEscalations: nurseApi.listEwsEscalations,
  acknowledgeEwsEscalation: nurseApi.acknowledgeEwsEscalation,
};
