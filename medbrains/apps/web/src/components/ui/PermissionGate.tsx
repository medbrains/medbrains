import { useHasAnyPermission } from "@medbrains/stores";
import type { ReactNode } from "react";
import { Alert } from "./Alert";

interface PermissionGateProps {
  /** The permission codes the wrapped panel's API calls accept. Any one suffices. */
  codes: readonly string[];
  /** What the panel is, in the user's words — "medical certificates", "referrals". */
  label: string;
  children: ReactNode;
}

/**
 * Renders a panel only for a caller who holds a permission its endpoints accept,
 * and says so plainly when they do not.
 *
 * The hooks to ask the question already existed; what did not was anywhere to
 * put the answer. So a tab whose endpoint refused the caller rendered its empty
 * state — and an empty list is a claim about the ward, not about the reader.
 * The same rule the backend follows for an outage applies to a refusal on the
 * way out: it must not wear the disguise of "there is nothing here".
 *
 * Pair it with `enabled:` on the query. This stops the panel; only `enabled`
 * stops the fetch, and a screen without the permission should not issue one.
 */
export function PermissionGate({ codes, label, children }: PermissionGateProps) {
  const permitted = useHasAnyPermission([...codes]);
  if (permitted) return <>{children}</>;
  return (
    <Alert tone="info" title="Not available to your role">
      You do not have permission to view {label}. Ask an administrator if you need it.
    </Alert>
  );
}
