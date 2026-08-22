/**
 * Put a patient in the OPD queue through the real API, so a doctor spec has
 * somebody to see.
 *
 * Seeded through the API rather than driven through the reception UI on
 * purpose: the registration journey already proves that path, and repeating it
 * here would make a doctor test fail for reception's reasons. What this
 * guarantees is only the precondition — a token exists, waiting, with an
 * encounter behind it.
 */

import { apiHeaders, E2E_BACKEND_URL, provisionIdentity, signInForApi } from "./identities";

export interface SeededVisit {
  patientId: string;
  encounterId: string;
  uhid: string;
  fullName: string;
  /** The receptionist created for the seed, so the caller can retire them. */
  receptionistId: string;
}

interface CreatedPatient {
  id: string;
  uhid: string;
  first_name: string;
  last_name: string;
}

async function firstDepartmentId(session: Awaited<ReturnType<typeof signInForApi>>): Promise<string> {
  const response = await fetch(`${E2E_BACKEND_URL}/api/setup/departments`, {
    headers: apiHeaders(session),
  });
  if (!response.ok) throw new Error(`listing departments failed: ${response.status}`);
  const body = (await response.json()) as Array<{ id: string }> | { departments: Array<{ id: string }> };
  const rows = Array.isArray(body) ? body : body.departments;
  const first = rows[0];
  if (!first) throw new Error("no departments to register against");
  return first.id;
}

/**
 * A registered patient with an open OPD encounter and a waiting token.
 *
 * `POST /api/opd/encounters` is what issues the token — the same call the
 * reception app makes — so the row the doctor's queue reads is the row the
 * waiting-room board reads.
 */
export async function seedWaitingPatient(label: string, doctorId?: string): Promise<SeededVisit> {
  const receptionist = await provisionIdentity("receptionist");
  const session = await signInForApi(receptionist.username, receptionist.password);
  const departmentId = await firstDepartmentId(session);

  const suffix = label.replace(/[^A-Za-z0-9]/g, "").slice(0, 10);
  const patientResponse = await fetch(`${E2E_BACKEND_URL}/api/patients`, {
    body: JSON.stringify({
      first_name: "Seeded",
      last_name: suffix,
      gender: "female",
      phone: "9876500123",
      date_of_birth: "1990-01-01",
      is_dob_estimated: false,
      registration_type: "new",
      registration_source: "walk_in",
      is_medico_legal: false,
      is_vip: false,
    }),
    headers: apiHeaders(session),
    method: "POST",
  });
  if (!patientResponse.ok) {
    throw new Error(`seeding a patient failed: ${patientResponse.status}`);
  }
  const patient = (await patientResponse.json()) as CreatedPatient;

  const encounterResponse = await fetch(`${E2E_BACKEND_URL}/api/opd/encounters`, {
    // `doctor_id` is what makes the doctor the attending, and without it the
    // encounter is nobody's: `require_encounter_access` is a SpiceDB Viewer
    // check, so a doctor who is neither attending nor in the department is
    // refused the consultation -- correctly. Registering against a named
    // consultant is what reception actually does, so seed it that way.
    body: JSON.stringify({
      patient_id: patient.id,
      department_id: departmentId,
      doctor_id: doctorId ?? null,
    }),
    headers: apiHeaders(session),
    method: "POST",
  });
  if (!encounterResponse.ok) {
    throw new Error(`seeding an OPD visit failed: ${encounterResponse.status}`);
  }
  const encounter = (await encounterResponse.json()) as { encounter: { id: string } };

  return {
    patientId: patient.id,
    encounterId: encounter.encounter.id,
    uhid: patient.uhid,
    fullName: `${patient.first_name} ${patient.last_name}`,
    receptionistId: receptionist.id,
  };
}
