import { accessApi } from "@medbrains/api/modules/access";
import { accessGroupsApi } from "@medbrains/api/modules/access-groups";
import { iamApi } from "@medbrains/api/modules/iam";
import { setupApi } from "@medbrains/api/modules/setup";
import type { BulkCreateUsersRequest } from "@medbrains/types";

export type CreateSetupUserInput = Parameters<typeof setupApi.createSetupUser>[0];
export type UpdateSetupUserInput = Parameters<typeof setupApi.updateSetupUser>[1];
export type UpdateUserAccessMatrixInput = Parameters<typeof setupApi.updateUserAccessMatrix>[1];
export type AssignUserFacilitiesInput = Parameters<typeof setupApi.assignUserFacilities>[1];
export type CreateRoleInput = Parameters<typeof setupApi.createRole>[0];
export type UpdateRoleInput = Parameters<typeof setupApi.updateRole>[1];
export type ListIamAccessRequestsInput = Parameters<typeof iamApi.listIamAccessRequests>[0];
export type CreateIamAccessRequestInput = Parameters<typeof iamApi.createIamAccessRequest>[0];
export type ApproveIamAccessRequestInput = Parameters<typeof iamApi.approveIamAccessRequest>[1];
export type RejectIamAccessRequestInput = Parameters<typeof iamApi.rejectIamAccessRequest>[1];
export type RevokeIamAccessRequestInput = Parameters<typeof iamApi.revokeIamAccessRequest>[1];
export type CreateAccessGroupInput = Parameters<typeof accessGroupsApi.createAccessGroup>[0];
export type UpdateAccessGroupInput = Parameters<typeof accessGroupsApi.updateAccessGroup>[1];
export type AddAccessGroupMemberInput = Parameters<typeof accessGroupsApi.addAccessGroupMember>[1];
export type CreateDepartmentInput = Parameters<typeof setupApi.createDepartment>[0];
export type CreateFacilityInput = Parameters<typeof setupApi.createFacility>[0];
export type CreateLocationInput = Parameters<typeof setupApi.createLocation>[0];

export const adminAccessService = {
  getAccessManifest: () => accessApi.getAccessManifest(),

  listIamAccessRequests: (params?: ListIamAccessRequestsInput) =>
    iamApi.listIamAccessRequests(params),
  createIamAccessRequest: (data: CreateIamAccessRequestInput) =>
    iamApi.createIamAccessRequest(data),
  approveIamAccessRequest: (id: string, data?: ApproveIamAccessRequestInput) =>
    iamApi.approveIamAccessRequest(id, data),
  rejectIamAccessRequest: (id: string, data?: RejectIamAccessRequestInput) =>
    iamApi.rejectIamAccessRequest(id, data),
  revokeIamAccessRequest: (id: string, data?: RevokeIamAccessRequestInput) =>
    iamApi.revokeIamAccessRequest(id, data),

  listUsers: () => setupApi.listSetupUsers(),
  listDoctors: () => setupApi.listDoctors(),
  createUser: (data: CreateSetupUserInput) => setupApi.createSetupUser(data),
  updateUser: (id: string, data: UpdateSetupUserInput) => setupApi.updateSetupUser(id, data),
  deleteUser: (id: string) => setupApi.deleteSetupUser(id),
  setUserSupervisor: (id: string, supervisorId: string | null) =>
    setupApi.setUserSupervisor(id, supervisorId),
  resetUserPassword: (id: string, newPassword?: string) =>
    setupApi.resetSetupUserPassword(id, newPassword ? { new_password: newPassword } : {}),
  bulkCreateUsers: (data: BulkCreateUsersRequest) => setupApi.bulkCreateUsers(data),
  updateUserAccessMatrix: (id: string, data: UpdateUserAccessMatrixInput) =>
    setupApi.updateUserAccessMatrix(id, data),
  listUserFacilities: (userId: string) => setupApi.listUserFacilities(userId),
  assignUserFacilities: (userId: string, data: AssignUserFacilitiesInput) =>
    setupApi.assignUserFacilities(userId, data),

  listRoles: () => setupApi.listRoles(),
  createRole: (data: CreateRoleInput) => setupApi.createRole(data),
  updateRole: (id: string, data: UpdateRoleInput) => setupApi.updateRole(id, data),
  deleteRole: (id: string) => setupApi.deleteRole(id),
  updateRolePermissions: (id: string, permissions: string[]) =>
    setupApi.updateRolePermissions(id, permissions),
  updateRoleFieldAccess: (
    id: string,
    fieldAccess: Parameters<typeof setupApi.updateRoleFieldAccess>[1],
  ) => setupApi.updateRoleFieldAccess(id, fieldAccess),
  updateRoleWidgetAccess: (
    id: string,
    widgetAccess: Parameters<typeof setupApi.updateRoleWidgetAccess>[1],
  ) => setupApi.updateRoleWidgetAccess(id, widgetAccess),

  listDepartments: () => setupApi.listDepartments(),
  createDepartment: (data: CreateDepartmentInput) => setupApi.createDepartment(data),
  listFacilities: () => setupApi.listFacilities(),
  createFacility: (data: CreateFacilityInput) => setupApi.createFacility(data),
  createLocation: (data: CreateLocationInput) => setupApi.createLocation(data),
  listAccessGroups: () => accessGroupsApi.listAccessGroups(),
  createAccessGroup: (data: CreateAccessGroupInput) => accessGroupsApi.createAccessGroup(data),
  updateAccessGroup: (id: string, data: UpdateAccessGroupInput) =>
    accessGroupsApi.updateAccessGroup(id, data),
  deleteAccessGroup: (id: string) => accessGroupsApi.deleteAccessGroup(id),
  listAccessGroupMembers: (groupId: string) => accessGroupsApi.listAccessGroupMembers(groupId),
  addAccessGroupMember: (groupId: string, data: AddAccessGroupMemberInput) =>
    accessGroupsApi.addAccessGroupMember(groupId, data),
  removeAccessGroupMember: (groupId: string, userId: string) =>
    accessGroupsApi.removeAccessGroupMember(groupId, userId),
};
