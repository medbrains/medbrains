import { multiHospitalApi } from "@medbrains/api/modules/multi-hospital";

export const multiHospitalService = {
  listOutgoingPatientTransfers: multiHospitalApi.listOutgoingPatientTransfers,
  listIncomingPatientTransfers: multiHospitalApi.listIncomingPatientTransfers,
  createPatientTransfer: multiHospitalApi.createPatientTransfer,
  updatePatientTransferStatus: multiHospitalApi.updatePatientTransferStatus,
  listHospitalGroups: multiHospitalApi.listHospitalGroups,
  createHospitalGroup: multiHospitalApi.createHospitalGroup,
  updateHospitalGroup: multiHospitalApi.updateHospitalGroup,
  listHospitalsInGroup: multiHospitalApi.listHospitalsInGroup,
  listAllHospitals: multiHospitalApi.listAllHospitals,
  assignHospitalToGroup: multiHospitalApi.assignHospitalToGroup,
  removeHospitalFromGroup: multiHospitalApi.removeHospitalFromGroup,
  getGroupDashboard: multiHospitalApi.getGroupDashboard,
  listOutgoingStockTransfers: multiHospitalApi.listOutgoingStockTransfers,
  listIncomingStockTransfers: multiHospitalApi.listIncomingStockTransfers,
  createStockTransfer: multiHospitalApi.createStockTransfer,
  updateStockTransferStatus: multiHospitalApi.updateStockTransferStatus,
};
