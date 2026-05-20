import { api } from "@medbrains/api";

export const doctorService = {
  getMyProfile: api.getMyDoctorProfile,
  updateMyProfile: api.updateMyDoctorProfile,
  getMyDay: api.getMyDay,
};
