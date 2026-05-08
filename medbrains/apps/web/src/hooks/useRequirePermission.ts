import { usePermissionStore } from "@medbrains/stores";
import { useEffect } from "react";
import { useNavigate } from "react-router";

/**
 * Guard hook — redirects to /dashboard if the user lacks the required permission.
 * Use at the top of page components for page-level access control.
 */
export function useRequirePermission(code: string): void {
  const hasPermission = usePermissionStore((s) => s.hasPermission(code));
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission) {
      navigate("/dashboard", { replace: true });
    }
  }, [hasPermission, navigate]);
}
