import { telemedicineApi } from "@medbrains/api/modules/telemedicine";

export const telemedicineService = {
  listTeleConsultations: (...args: Parameters<typeof telemedicineApi.listTeleConsultations>) =>
    telemedicineApi.listTeleConsultations(...args),
  createTeleConsultation: (data: Parameters<typeof telemedicineApi.createTeleConsultation>[0]) =>
    telemedicineApi.createTeleConsultation(data),
  getTeleConsultation: (id: string) => telemedicineApi.getTeleConsultation(id),
  getTeleJoinInfo: (id: string) => telemedicineApi.getTeleJoinInfo(id),
  getTeleWaitingRoom: (doctorId?: string) => telemedicineApi.getTeleWaitingRoom(doctorId),
  updateTeleRecording: (
    id: string,
    data: Parameters<typeof telemedicineApi.updateTeleRecording>[1],
  ) => telemedicineApi.updateTeleRecording(id, data),
  scheduleTeleFollowUp: (
    id: string,
    data: Parameters<typeof telemedicineApi.scheduleTeleFollowUp>[1],
  ) => telemedicineApi.scheduleTeleFollowUp(id, data),
  listTeleChat: (id: string) => telemedicineApi.listTeleChat(id),
  postTeleChat: (id: string, data: Parameters<typeof telemedicineApi.postTeleChat>[1]) =>
    telemedicineApi.postTeleChat(id, data),
  getTeleConfig: () => telemedicineApi.getTeleConfig(),
  updateTeleConfig: (data: Parameters<typeof telemedicineApi.updateTeleConfig>[0]) =>
    telemedicineApi.updateTeleConfig(data),
  getTriage: (id: string) => telemedicineApi.getTriage(id),
  submitTriage: (id: string, data: Parameters<typeof telemedicineApi.submitTriage>[1]) =>
    telemedicineApi.submitTriage(id, data),
  getTriageResearchSummary: () => telemedicineApi.getTriageResearchSummary(),
  getTriageResearchDataset: () => telemedicineApi.getTriageResearchDataset(),
  updateTeleStatus: (id: string, data: Parameters<typeof telemedicineApi.updateTeleStatus>[1]) =>
    telemedicineApi.updateTeleStatus(id, data),
};
