import { api } from "@medbrains/api";

export const homeHealthService = {
  listHomeMeds: api.listHomeMeds,
  scheduleHomeMed: api.scheduleHomeMed,
  recordHomeMed: api.recordHomeMed,
  listEscalations: api.listEscalations,
  raiseEscalation: api.raiseEscalation,
  updateEscalation: api.updateEscalation,
  listProgressNotes: api.listHomeProgressNotes,
  addProgressNote: api.addHomeProgressNote,
  listDischargeProgram: api.listDischargeProgram,
  addDischargeItem: api.addDischargeItem,
  toggleDischargeItem: api.toggleDischargeItem,
  listHomeVisits: api.listHomeVisits,
  scheduleHomeVisit: api.scheduleHomeVisit,
  updateHomeVisit: api.updateHomeVisit,
};
