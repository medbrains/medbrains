import { doctorsApi } from "@medbrains/api/modules/doctors";

export const doctorService = {
  getMyProfile: doctorsApi.getMyDoctorProfile,
  updateMyProfile: doctorsApi.updateMyDoctorProfile,
  getMyDay: doctorsApi.getMyDay,
};
