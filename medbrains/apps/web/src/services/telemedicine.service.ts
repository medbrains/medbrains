import { api } from "@medbrains/api";

export const telemedicineService = {
  listTeleConsultations: (...args: Parameters<typeof api.listTeleConsultations>) =>
    api.listTeleConsultations(...args),
  createTeleConsultation: (data: Parameters<typeof api.createTeleConsultation>[0]) =>
    api.createTeleConsultation(data),
  getTeleConsultation: (id: string) => api.getTeleConsultation(id),
  getTeleJoinInfo: (id: string) => api.getTeleJoinInfo(id),
  getTeleWaitingRoom: (doctorId?: string) => api.getTeleWaitingRoom(doctorId),
  updateTeleStatus: (id: string, data: Parameters<typeof api.updateTeleStatus>[1]) =>
    api.updateTeleStatus(id, data),
};
