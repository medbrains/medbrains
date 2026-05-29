// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  groupsGrantingPermission,
  resolvePermissionSources,
  type PermissionSourceGroup,
} from "./access-matrix-permission-sources";

function group(input: Partial<PermissionSourceGroup>): PermissionSourceGroup {
  return {
    id: "group-1",
    code: "lab_seniors",
    name: "Lab Seniors",
    permissions: [],
    ...input,
  };
}

describe("access matrix permission source resolver", () => {
  it("returns exact group names that grant a permission", () => {
    const groups = [
      group({ id: "g1", name: "Lab Seniors", permissions: ["lab.order.verify"] }),
      group({ id: "g2", name: "Night Duty", permissions: ["ipd.admission.list"] }),
    ];

    expect(groupsGrantingPermission(groups, "lab.order.verify").map((item) => item.name)).toEqual([
      "Lab Seniors",
    ]);
  });

  it("counts multiple granting groups as duplicate sources", () => {
    const result = resolvePermissionSources({
      bypassRole: false,
      denied: false,
      extraGrant: true,
      groups: [
        group({ id: "g1", name: "Lab Seniors", permissions: ["lab.order.verify"] }),
        group({ id: "g2", name: "Night Duty", permissions: ["lab.order.verify"] }),
      ],
      permissionCode: "lab.order.verify",
      roleGrant: true,
      temporaryGrant: false,
    });

    expect(result.groupGrantNames).toEqual(["Lab Seniors", "Night Duty"]);
    expect(result.sourceCount).toBe(4);
    expect(result.duplicateGrant).toBe(true);
    expect(result.redundantIndividualExtra).toBe(true);
  });

  it("flags deny conflicts against any active source", () => {
    const result = resolvePermissionSources({
      bypassRole: false,
      denied: true,
      extraGrant: false,
      groups: [group({ permissions: ["billing.invoice.view"] })],
      permissionCode: "billing.invoice.view",
      roleGrant: false,
      temporaryGrant: false,
    });

    expect(result.deniedOverlap).toBe(true);
    expect(result.effective).toBe(false);
  });

  it("treats bypass roles as effective without cleanup noise", () => {
    const result = resolvePermissionSources({
      bypassRole: true,
      denied: true,
      extraGrant: true,
      groups: [group({ permissions: ["admin.users.delete"] })],
      permissionCode: "admin.users.delete",
      roleGrant: true,
      temporaryGrant: true,
    });

    expect(result.effective).toBe(true);
    expect(result.duplicateGrant).toBe(false);
    expect(result.deniedOverlap).toBe(false);
    expect(result.redundantIndividualExtra).toBe(false);
  });
});
