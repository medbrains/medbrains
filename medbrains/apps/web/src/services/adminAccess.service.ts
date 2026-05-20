import { api } from "@medbrains/api";
import type { BulkCreateUsersRequest } from "@medbrains/types";

export type CreateSetupUserInput = Parameters<typeof api.createSetupUser>[0];
export type UpdateSetupUserInput = Parameters<typeof api.updateSetupUser>[1];
export type UpdateUserAccessMatrixInput = Parameters<typeof api.updateUserAccessMatrix>[1];
export type AssignUserFacilitiesInput = Parameters<typeof api.assignUserFacilities>[1];
export type CreateRoleInput = Parameters<typeof api.createRole>[0];
export type UpdateRoleInput = Parameters<typeof api.updateRole>[1];
export type ListIamAccessRequestsInput = Parameters<typeof api.listIamAccessRequests>[0];
export type CreateIamAccessRequestInput = Parameters<typeof api.createIamAccessRequest>[0];
export type ApproveIamAccessRequestInput = Parameters<typeof api.approveIamAccessRequest>[1];
export type RejectIamAccessRequestInput = Parameters<typeof api.rejectIamAccessRequest>[1];
export type RevokeIamAccessRequestInput = Parameters<typeof api.revokeIamAccessRequest>[1];
export type CreateAccessGroupInput = Parameters<typeof api.createAccessGroup>[0];
export type UpdateAccessGroupInput = Parameters<typeof api.updateAccessGroup>[1];
export type AddAccessGroupMemberInput = Parameters<typeof api.addAccessGroupMember>[1];
export type CreateDepartmentInput = Parameters<typeof api.createDepartment>[0];
export type CreateFacilityInput = Parameters<typeof api.createFacility>[0];
export type CreateLocationInput = Parameters<typeof api.createLocation>[0];

export const adminAccessService = {
  listIamAccessRequests: (params?: ListIamAccessRequestsInput) => api.listIamAccessRequests(params),
  createIamAccessRequest: (data: CreateIamAccessRequestInput) => api.createIamAccessRequest(data),
  approveIamAccessRequest: (id: string, data?: ApproveIamAccessRequestInput) =>
    api.approveIamAccessRequest(id, data),
  rejectIamAccessRequest: (id: string, data?: RejectIamAccessRequestInput) =>
    api.rejectIamAccessRequest(id, data),
  revokeIamAccessRequest: (id: string, data?: RevokeIamAccessRequestInput) =>
    api.revokeIamAccessRequest(id, data),

  listUsers: () => api.listSetupUsers(),
  listDoctors: () => api.listDoctors(),
  createUser: (data: CreateSetupUserInput) => api.createSetupUser(data),
  updateUser: (id: string, data: UpdateSetupUserInput) => api.updateSetupUser(id, data),
  deleteUser: (id: string) => api.deleteSetupUser(id),
  bulkCreateUsers: (data: BulkCreateUsersRequest) => api.bulkCreateUsers(data),
  updateUserAccessMatrix: (id: string, data: UpdateUserAccessMatrixInput) =>
    api.updateUserAccessMatrix(id, data),
  listUserFacilities: (userId: string) => api.listUserFacilities(userId),
  assignUserFacilities: (userId: string, data: AssignUserFacilitiesInput) =>
    api.assignUserFacilities(userId, data),

  listRoles: () => api.listRoles(),
  createRole: (data: CreateRoleInput) => api.createRole(data),
  updateRole: (id: string, data: UpdateRoleInput) => api.updateRole(id, data),
  deleteRole: (id: string) => api.deleteRole(id),
  updateRolePermissions: (id: string, permissions: string[]) =>
    api.updateRolePermissions(id, permissions),
  updateRoleFieldAccess: (
    id: string,
    fieldAccess: Parameters<typeof api.updateRoleFieldAccess>[1],
  ) => api.updateRoleFieldAccess(id, fieldAccess),
  updateRoleWidgetAccess: (
    id: string,
    widgetAccess: Parameters<typeof api.updateRoleWidgetAccess>[1],
  ) => api.updateRoleWidgetAccess(id, widgetAccess),

  listDepartments: () => api.listDepartments(),
  createDepartment: (data: CreateDepartmentInput) => api.createDepartment(data),
  listFacilities: () => api.listFacilities(),
  createFacility: (data: CreateFacilityInput) => api.createFacility(data),
  createLocation: (data: CreateLocationInput) => api.createLocation(data),
  listAccessGroups: () => api.listAccessGroups(),
  createAccessGroup: (data: CreateAccessGroupInput) => api.createAccessGroup(data),
  updateAccessGroup: (id: string, data: UpdateAccessGroupInput) => api.updateAccessGroup(id, data),
  deleteAccessGroup: (id: string) => api.deleteAccessGroup(id),
  listAccessGroupMembers: (groupId: string) => api.listAccessGroupMembers(groupId),
  addAccessGroupMember: (groupId: string, data: AddAccessGroupMemberInput) =>
    api.addAccessGroupMember(groupId, data),
  removeAccessGroupMember: (groupId: string, userId: string) =>
    api.removeAccessGroupMember(groupId, userId),
};
