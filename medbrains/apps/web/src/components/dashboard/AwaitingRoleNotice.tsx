import { useAuthStore } from "@medbrains/stores";
import { Alert } from "@/components/ui";

/**
 * A new single-sign-on account starts as Staff — dashboard only — until an
 * administrator assigns its role. Without this the screen just looks empty.
 */
export function AwaitingRoleNotice() {
  const role = useAuthStore((s) => s.user?.role);
  if (role !== "staff") return null;
  return (
    <Alert tone="info" title="Your account is waiting for a role" mb="md">
      You are signed in, but an administrator has not yet given your account a role, so only the
      dashboard is open to you. They have been told. If a page you need says you do not have access,
      use Request access there.
    </Alert>
  );
}
