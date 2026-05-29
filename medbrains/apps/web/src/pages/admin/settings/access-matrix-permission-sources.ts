export interface PermissionSourceGroup {
  id: string;
  code?: string;
  name: string;
  permissions: readonly unknown[];
}

export interface ResolvePermissionSourcesInput {
  bypassRole: boolean;
  denied: boolean;
  extraGrant: boolean;
  groups: readonly PermissionSourceGroup[];
  permissionCode: string;
  roleGrant: boolean;
  temporaryGrant: boolean;
}

export interface PermissionSourceResolution {
  denied: boolean;
  deniedOverlap: boolean;
  duplicateGrant: boolean;
  effective: boolean;
  extraGrant: boolean;
  groupGrantCount: number;
  groupGrantNames: readonly string[];
  permissionCode: string;
  redundantIndividualExtra: boolean;
  roleGrant: boolean;
  sourceCount: number;
  sourceLabels: readonly string[];
  temporaryGrant: boolean;
}

function permissionStrings(value: readonly unknown[]) {
  return value.filter((permission): permission is string => typeof permission === "string");
}

export function groupsGrantingPermission(
  groups: readonly PermissionSourceGroup[],
  permissionCode: string,
) {
  return groups.filter((group) => permissionStrings(group.permissions).includes(permissionCode));
}

export function resolvePermissionSources(
  input: ResolvePermissionSourcesInput,
): PermissionSourceResolution {
  const grantingGroups = groupsGrantingPermission(input.groups, input.permissionCode);
  const groupGrantNames = grantingGroups.map((group) => group.name);

  if (input.bypassRole) {
    return {
      denied: input.denied,
      deniedOverlap: false,
      duplicateGrant: false,
      effective: true,
      extraGrant: input.extraGrant,
      groupGrantCount: groupGrantNames.length,
      groupGrantNames,
      permissionCode: input.permissionCode,
      redundantIndividualExtra: false,
      roleGrant: input.roleGrant,
      sourceCount: 1,
      sourceLabels: ["Bypass role"],
      temporaryGrant: input.temporaryGrant,
    };
  }

  const sourceLabels = [
    ...(input.roleGrant ? ["Role"] : []),
    ...groupGrantNames.map((name) => `Group: ${name}`),
    ...(input.extraGrant ? ["Individual"] : []),
    ...(input.temporaryGrant ? ["Temporary"] : []),
  ];
  const sourceCount = sourceLabels.length;

  return {
    denied: input.denied,
    deniedOverlap: input.denied && sourceCount > 0,
    duplicateGrant: sourceCount > 1,
    effective: !input.denied && sourceCount > 0,
    extraGrant: input.extraGrant,
    groupGrantCount: groupGrantNames.length,
    groupGrantNames,
    permissionCode: input.permissionCode,
    redundantIndividualExtra:
      input.extraGrant && (input.roleGrant || groupGrantNames.length > 0 || input.temporaryGrant),
    roleGrant: input.roleGrant,
    sourceCount,
    sourceLabels,
    temporaryGrant: input.temporaryGrant,
  };
}
