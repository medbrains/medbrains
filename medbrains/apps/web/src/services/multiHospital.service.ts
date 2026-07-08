import { api } from "@medbrains/api";

export const multiHospitalService = {
  listOutgoingPatientTransfers: api.listOutgoingPatientTransfers,
  listIncomingPatientTransfers: api.listIncomingPatientTransfers,
  createPatientTransfer: api.createPatientTransfer,
  updatePatientTransferStatus: api.updatePatientTransferStatus,
  listHospitalGroups: api.listHospitalGroups,
  listHospitalsInGroup: api.listHospitalsInGroup,
};
