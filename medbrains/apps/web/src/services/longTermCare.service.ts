import { ltcApi } from "@medbrains/api/modules/ltc";

export const longTermCareService = {
  listMdsAssessments: ltcApi.listMdsAssessments,
  createMdsAssessment: ltcApi.createMdsAssessment,
  completeMdsAssessment: ltcApi.completeMdsAssessment,
  listLtcMedications: ltcApi.listLtcMedications,
  addLtcMedication: ltcApi.addLtcMedication,
  refillLtcMedication: ltcApi.refillLtcMedication,
  updateLtcMedication: ltcApi.updateLtcMedication,
  listRehabProgress: ltcApi.listRehabProgress,
  addRehabProgress: ltcApi.addRehabProgress,
  listFamilyMessages: ltcApi.listFamilyMessages,
  postFamilyMessage: ltcApi.postFamilyMessage,
  updateFamilyMessage: ltcApi.updateFamilyMessage,
  listReadmissionRisk: ltcApi.listReadmissionRisk,
  assessReadmissionRisk: ltcApi.assessReadmissionRisk,
  listHomeCareReferrals: ltcApi.listHomeCareReferrals,
  createHomeCareReferral: ltcApi.createHomeCareReferral,
  updateHomeCareReferral: ltcApi.updateHomeCareReferral,
  listSnfAdmissions: ltcApi.listSnfAdmissions,
  createSnfAdmission: ltcApi.createSnfAdmission,
  updateSnfAdmission: ltcApi.updateSnfAdmission,
};
