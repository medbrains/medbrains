import { api } from "@medbrains/api";

export type CreateSharingGrantInput = Parameters<typeof api.createSharingGrant>[0];
export type RevokeSharingGrantInput = Parameters<typeof api.revokeSharingGrant>[0];
export type SharingSubjectType = CreateSharingGrantInput["subject"]["type"];
export type SharingSubjects = Awaited<ReturnType<typeof api.listSharingSubjects>>;

export const sharingService = {
  listSharingGrants: (objectType: string, objectId: string) =>
    api.listSharingGrants(objectType, objectId),
  listSharingSubjects: () => api.listSharingSubjects(),
  createSharingGrant: (data: CreateSharingGrantInput) => api.createSharingGrant(data),
  revokeSharingGrant: (data: RevokeSharingGrantInput) => api.revokeSharingGrant(data),
};
