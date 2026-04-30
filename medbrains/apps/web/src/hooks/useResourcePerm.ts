/**
 * useResourcePerm — read the per-row `_perms` block on any list/detail
 * response and return typed booleans for action buttons.
 *
 * Backend handlers (Wave 1+ rebac wiring) embed `_perms` on every
 * resource row:
 *
 *   { ..., _perms: { view, edit, delete, share, approve } }
 *
 * Frontend usage:
 *
 *   const { canEdit, canDelete, canShare } = useResourcePerm(row);
 *   {canEdit && <Button>Edit</Button>}
 *
 * Bypass roles (super_admin, hospital_admin) get `_perms` populated
 * with all-true by the backend, so this hook works uniformly without
 * a separate "is admin?" check.
 *
 * If `_perms` is absent (older endpoint not yet wired), every flag
 * defaults to `false` — fail-closed UX, force the backend to opt in.
 */

export interface PermsBlock {
  view: boolean;
  edit: boolean;
  delete: boolean;
  share: boolean;
  approve: boolean;
}

export interface ResourceWithPerms {
  _perms?: Partial<PermsBlock>;
  [key: string]: unknown;
}

export interface ResourcePermResult {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canApprove: boolean;
}

const DENY_ALL: ResourcePermResult = {
  canView: false,
  canEdit: false,
  canDelete: false,
  canShare: false,
  canApprove: false,
};

export function useResourcePerm(
  row: ResourceWithPerms | undefined | null,
): ResourcePermResult {
  if (!row || !row._perms) return DENY_ALL;
  const p = row._perms;
  return {
    canView: !!p.view,
    canEdit: !!p.edit,
    canDelete: !!p.delete,
    canShare: !!p.share,
    canApprove: !!p.approve,
  };
}
