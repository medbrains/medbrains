import { advanceDirectivesApi } from "@medbrains/api/modules/advance-directives";
import { bereavementApi } from "@medbrains/api/modules/bereavement";
import { homeHealthApi } from "@medbrains/api/modules/home-health";
import { homeVisitsApi } from "@medbrains/api/modules/home-visits";
import { hospiceApi } from "@medbrains/api/modules/hospice";

export const homeHealthService = {
  listHomeMeds: homeHealthApi.listHomeMeds,
  scheduleHomeMed: homeHealthApi.scheduleHomeMed,
  recordHomeMed: homeHealthApi.recordHomeMed,
  listEscalations: homeHealthApi.listEscalations,
  raiseEscalation: homeHealthApi.raiseEscalation,
  updateEscalation: homeHealthApi.updateEscalation,
  listDischargeProgram: homeHealthApi.listDischargeProgram,
  addDischargeItem: homeHealthApi.addDischargeItem,
  toggleDischargeItem: homeHealthApi.toggleDischargeItem,
  listHomeVisits: homeHealthApi.listHomeVisits,
  scheduleHomeVisit: homeHealthApi.scheduleHomeVisit,
  updateHomeVisit: homeVisitsApi.updateHomeVisit,
  documentHomeVisit: homeVisitsApi.documentHomeVisit,
  listRemoteVitals: homeHealthApi.listRemoteVitals,
  ingestRemoteVital: homeHealthApi.ingestRemoteVital,
  listHomeCarePackages: homeHealthApi.listHomeCarePackages,
  createHomeCarePackage: homeHealthApi.createHomeCarePackage,
  consumePackageVisit: homeHealthApi.consumePackageVisit,
  billHomeVisit: homeVisitsApi.billHomeVisit,
  listCaregiverEducation: homeHealthApi.listCaregiverEducation,
  recordCaregiverEducation: homeHealthApi.recordCaregiverEducation,
  listHospiceEnrollments: homeHealthApi.listHospiceEnrollments,
  enrollHospice: homeHealthApi.enrollHospice,
  updateHospice: hospiceApi.updateHospice,
  listAdvanceDirectives: homeHealthApi.listAdvanceDirectives,
  createAdvanceDirective: homeHealthApi.createAdvanceDirective,
  revokeAdvanceDirective: advanceDirectivesApi.revokeAdvanceDirective,
  listBereavement: homeHealthApi.listBereavement,
  scheduleBereavement: homeHealthApi.scheduleBereavement,
  updateBereavement: bereavementApi.updateBereavement,
};
