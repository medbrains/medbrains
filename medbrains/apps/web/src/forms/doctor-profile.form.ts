import { optionalTextFromFormValue } from "@medbrains/schemas";
import type { DoctorProfile, UpdateMyDoctorProfileRequest } from "@medbrains/types";
import { z } from "zod";

export const doctorProfileFormSchema = z.object({
  photo_url: z.string().max(500, "Photo URL is too long"),
  languages_spoken: z.string().max(500, "Languages list is too long"),
  bio_short: z.string().max(500, "Short bio is too long"),
  bio_long: z.string().max(4000, "Long bio is too long"),
});

export type DoctorProfileFormInput = z.infer<typeof doctorProfileFormSchema>;

export const DEFAULT_DOCTOR_PROFILE_FORM_VALUES: DoctorProfileFormInput = {
  photo_url: "",
  languages_spoken: "",
  bio_short: "",
  bio_long: "",
};

export function toDoctorProfileFormValues(
  profile: DoctorProfile | undefined,
): DoctorProfileFormInput {
  if (!profile) return DEFAULT_DOCTOR_PROFILE_FORM_VALUES;
  return {
    photo_url: profile.photo_url ?? "",
    languages_spoken: profile.languages_spoken.join(", "),
    bio_short: profile.bio_short ?? "",
    bio_long: profile.bio_long ?? "",
  };
}

export function toUpdateMyDoctorProfileRequest(
  values: DoctorProfileFormInput,
): UpdateMyDoctorProfileRequest {
  return {
    bio_short: optionalTextFromFormValue(values.bio_short) ?? null,
    bio_long: optionalTextFromFormValue(values.bio_long) ?? null,
    photo_url: optionalTextFromFormValue(values.photo_url) ?? null,
    languages_spoken: values.languages_spoken
      .split(",")
      .map((language) => language.trim())
      .filter(Boolean),
  };
}
