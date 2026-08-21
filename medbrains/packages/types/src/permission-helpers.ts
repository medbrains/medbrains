/**
 * Helpers over the permission catalogue.
 *
 * Hand-written, and deliberately NOT in `permissions.ts` — that file is
 * generated from the Rust constants and regenerating it would delete anything
 * living alongside the data. Logic here, data there.
 */

import type { PermissionDef } from "./permissions";
import { PERMISSION_CODES } from "./permissions";

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: PermissionDef[];
  children: PermissionGroup[];
}

function capitalize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildPermissionTree(perms: PermissionDef[]): PermissionGroup[] {
  const root: PermissionGroup = { key: "", label: "", permissions: [], children: [] };

  for (const perm of perms) {
    const segments = perm.code.split(".");
    let current = root;

    // Walk all segments except the last (the action)
    for (let i = 0; i < segments.length - 1; i++) {
      const key = segments.slice(0, i + 1).join(".");
      let child = current.children.find((c) => c.key === key);
      if (!child) {
        child = {
          key,
          label: capitalize(segments[i] ?? ""),
          permissions: [],
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }

    current.permissions.push(perm);
  }

  return root.children;
}

const ALL_CODES = new Set<string>(PERMISSION_CODES);

/** Whether a code is one the server actually enforces. */
export function isValidPermissionCode(code: string): boolean {
  return ALL_CODES.has(code);
}
