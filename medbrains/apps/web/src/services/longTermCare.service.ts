import { api } from "@medbrains/api";

export const longTermCareService = {
  listMdsAssessments: api.listMdsAssessments,
  createMdsAssessment: api.createMdsAssessment,
  completeMdsAssessment: api.completeMdsAssessment,
  listLtcMedications: api.listLtcMedications,
  addLtcMedication: api.addLtcMedication,
  refillLtcMedication: api.refillLtcMedication,
  updateLtcMedication: api.updateLtcMedication,
  listRehabProgress: api.listRehabProgress,
  addRehabProgress: api.addRehabProgress,
  listFamilyMessages: api.listFamilyMessages,
  postFamilyMessage: api.postFamilyMessage,
  updateFamilyMessage: api.updateFamilyMessage,
};
