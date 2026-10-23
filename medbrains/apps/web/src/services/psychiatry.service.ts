import { api } from "@medbrains/api";

export const psychiatryService = {
  listPatients: api.listPsychPatients,
  getPatient: api.getPsychPatient,
  createPatient: api.createPsychPatient,
  updatePatient: api.updatePsychPatient,
  listAssessments: api.listPsychAssessments,
  createAssessment: api.createPsychAssessment,
  listEct: api.listEctSessions,
  createEct: api.createEctSession,
  listRestraints: api.listRestraints,
  createRestraint: api.createRestraint,
  releaseRestraint: api.releaseRestraint,
  listMhrb: api.listMhrbNotifications,
  createMhrb: api.createMhrbNotification,
  updateMhrb: api.updateMhrbNotification,
  listCounseling: api.listCounselingSessions,
  createCounseling: api.createCounselingSession,
};
