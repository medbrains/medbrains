import { sharingApi } from "@medbrains/api/modules/sharing";

export type CreateSharingGrantInput = Parameters<typeof sharingApi.createSharingGrant>[0];
export type RevokeSharingGrantInput = Parameters<typeof sharingApi.revokeSharingGrant>[0];
export type SharingSubjectType = CreateSharingGrantInput["subject"]["type"];
export type SharingSubjects = Awaited<ReturnType<typeof sharingApi.listSharingSubjects>>;

export const sharingService = {
  listSharingGrants: (objectType: string, objectId: string) =>
    sharingApi.listSharingGrants(objectType, objectId),
  listSharingSubjects: () => sharingApi.listSharingSubjects(),
  createSharingGrant: (data: CreateSharingGrantInput) => sharingApi.createSharingGrant(data),
  revokeSharingGrant: (data: RevokeSharingGrantInput) => sharingApi.revokeSharingGrant(data),
};
