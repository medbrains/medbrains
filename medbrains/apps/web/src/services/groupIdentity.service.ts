import { api } from "@medbrains/api";

/** A patient's records across the hospital group: linked, never merged. */
export const groupIdentityService = {
  get: (patientId: string) => api.getGroupIdentity(patientId),
  scan: (patientId: string) => api.scanGroupIdentity(patientId),
  queue: (status: Parameters<typeof api.listGroupIdentityCandidates>[0]) =>
    api.listGroupIdentityCandidates(status),
  decide: (...args: Parameters<typeof api.decideGroupIdentityCandidate>) =>
    api.decideGroupIdentityCandidate(...args),
  unlink: (...args: Parameters<typeof api.unlinkGroupIdentity>) => api.unlinkGroupIdentity(...args),
};
