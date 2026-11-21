import { patientsApi } from "@medbrains/api/modules/patients";

/** A patient's records across the hospital group: linked, never merged. */
export const groupIdentityService = {
  get: (patientId: string) => patientsApi.getGroupIdentity(patientId),
  scan: (patientId: string) => patientsApi.scanGroupIdentity(patientId),
  queue: (status: Parameters<typeof patientsApi.listGroupIdentityCandidates>[0]) =>
    patientsApi.listGroupIdentityCandidates(status),
  decide: (...args: Parameters<typeof patientsApi.decideGroupIdentityCandidate>) =>
    patientsApi.decideGroupIdentityCandidate(...args),
  unlink: (...args: Parameters<typeof patientsApi.unlinkGroupIdentity>) =>
    patientsApi.unlinkGroupIdentity(...args),
};
