import { usePermissionStore } from "@medbrains/stores";
import { useEffect } from "react";
import { useNavigate } from "react-router";

/**
 * Guard hook — redirects to the dashboard if the user lacks the required permission.
 * Passing multiple codes allows access when any one permission is granted.
 */
export function useRequirePermission(code: string | readonly string[]): void {
  const hasPermission = usePermissionStore((s) =>
    typeof code === "string" ? s.hasPermission(code) : s.hasAnyPermission(Array.from(code)),
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission) {
      navigate("/dashboard", { replace: true });
    }
  }, [hasPermission, navigate]);
}
