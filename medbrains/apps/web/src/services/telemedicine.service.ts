import { api } from "@medbrains/api";

export const telemedicineService = {
  listTeleConsultations: (...args: Parameters<typeof api.listTeleConsultations>) =>
    api.listTeleConsultations(...args),
  createTeleConsultation: (data: Parameters<typeof api.createTeleConsultation>[0]) =>
    api.createTeleConsultation(data),
  getTeleConsultation: (id: string) => api.getTeleConsultation(id),
  getTeleJoinInfo: (id: string) => api.getTeleJoinInfo(id),
  getTeleWaitingRoom: (doctorId?: string) => api.getTeleWaitingRoom(doctorId),
  updateTeleRecording: (id: string, data: Parameters<typeof api.updateTeleRecording>[1]) =>
    api.updateTeleRecording(id, data),
  scheduleTeleFollowUp: (id: string, data: Parameters<typeof api.scheduleTeleFollowUp>[1]) =>
    api.scheduleTeleFollowUp(id, data),
  listTeleChat: (id: string) => api.listTeleChat(id),
  postTeleChat: (id: string, data: Parameters<typeof api.postTeleChat>[1]) =>
    api.postTeleChat(id, data),
  getTeleConfig: () => api.getTeleConfig(),
  updateTeleConfig: (data: Parameters<typeof api.updateTeleConfig>[0]) =>
    api.updateTeleConfig(data),
  getTriage: (id: string) => api.getTriage(id),
  submitTriage: (id: string, data: Parameters<typeof api.submitTriage>[1]) =>
    api.submitTriage(id, data),
  updateTeleStatus: (id: string, data: Parameters<typeof api.updateTeleStatus>[1]) =>
    api.updateTeleStatus(id, data),
};
