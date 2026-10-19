import { usePermissionStore } from "@medbrains/stores";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

/** What the access-denied screen is told: the page asked for and why it refused. */
export interface AccessDeniedState {
  from: string;
  need: string[];
}

/**
 * Guard hook — sends a user who lacks the permission to the access-denied
 * screen, which names what was needed and lets them ask for it. Passing
 * multiple codes allows access when any one permission is granted.
 */
export function useRequirePermission(code: string | readonly string[]): void {
  const hasPermission = usePermissionStore((s) =>
    typeof code === "string" ? s.hasPermission(code) : s.hasAnyPermission(Array.from(code)),
  );
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const need = typeof code === "string" ? code : code.join(",");

  useEffect(() => {
    if (!hasPermission) {
      const state: AccessDeniedState = { from: pathname + search, need: need.split(",") };
      navigate("/forbidden", { replace: true, state });
    }
  }, [hasPermission, navigate, pathname, search, need]);
}
