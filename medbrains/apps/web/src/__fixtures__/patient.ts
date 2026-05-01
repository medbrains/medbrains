import type { Patient } from "@medbrains/types";
import { SEED } from "./seed";

/**
 * Canonical Patient fixture used by Vitest tests + MSW handlers.
 *
 * Mirrors what the smoke seeder creates in the live backend so
 * UI rendering is verified against the same shape.
 */
export const patientFixture: Patient = {
  id: SEED.patient,
  tenant_id: SEED.tenant,
  uhid: "UH-2026-00342",
  abha_id: null,
  prefix: "Ms.",
  first_name: "Anika",
  middle_name: null,
  last_name: "Verma",
  suffix: null,
  full_name_local: null,
  father_name: null,
  mother_name: null,
  spouse_name: null,
  guardian_name: null,
  guardian_relation: null,
  date_of_birth: "1986-03-14",
  is_dob_estimated: false,
  gender: "female",
  gender_identity: null,
  marital_status: "single",
  religion: null,
  nationality_id: null,
  preferred_language: "en",
  birth_place: null,
  blood_group: "o_positive",
  blood_group_verified: true,
  no_known_allergies: false,
  occupation: "Software engineer",
  education_level: null,
  phone: "+919843221107",
  phone_secondary: null,
  email: "anika.v@protonmail.in",
  is_active: true,
  category: "general",
  registration_type: "new",
  registration_source: "walk_in",
  financial_class: "self_pay",
  is_medico_legal: false,
  mlc_number: null,
  is_vip: false,
  is_unknown_patient: false,
  attributes: { known_allergies: "Penicillin · rash (2024)" },
  created_at: "2026-04-30T14:24:00Z",
  updated_at: "2026-04-30T14:24:00Z",
} as unknown as Patient;
