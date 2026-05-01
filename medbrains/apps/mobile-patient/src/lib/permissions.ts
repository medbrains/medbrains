/**
 * Permission helper hook for the staff app. Lives here for now;
 * lift into mobile-shell when patient/vendor apps need the same
 * shape.
 */

import { useAuthStore } from "@medbrains/mobile-shell";

const BYPASS_ROLES = new Set(["super_admin", "hospital_admin"]);

export function useHasPermission(code: string): boolean {
  return useAuthStore((s) => {
    if (!s.identity) return false;
    if (s.identity.role && BYPASS_ROLES.has(s.identity.role)) return true;
    return s.identity.permissions.includes(code);
  });
}

export function useHasAny(codes: ReadonlyArray<string>): boolean {
  return useAuthStore((s) => {
    if (!s.identity) return false;
    if (s.identity.role && BYPASS_ROLES.has(s.identity.role)) return true;
    return codes.some((c) => s.identity?.permissions.includes(c) ?? false);
  });
}
