/**
 * OfflineWriteBanner — surfaces "authz changes not allowed offline"
 * on admin pages that mutate roles, users, or sharing grants.
 *
 * Per product call: offline tenants do not entertain authz / sharing
 * mutations. The matching backend middleware (authz_write_guard.rs)
 * returns 503 with retry_when:"online" so the UI can be surgically
 * disabled rather than letting users hit a wall.
 */

import { Alert } from "@mantine/core";
import { useTenantConfigOptional } from "../providers/TenantConfigProvider";

interface OfflineWriteBannerProps {
  /** Short noun describing what's locked, e.g. "role permissions". */
  resource?: string;
}

export function OfflineWriteBanner({
  resource = "permission",
}: OfflineWriteBannerProps) {
  const config = useTenantConfigOptional();
  if (!config || config.mode !== "crdt") {
    return null;
  }
  return (
    <Alert
      color="orange"
      title="Tunnel offline — authz mutations paused"
      mt="xs"
      mb="md"
    >
      This tenant is operating against the on-prem edge node. {resource}
      {" "}changes can't be applied until the WAN tunnel reconnects. Read
      access continues to work normally.
    </Alert>
  );
}
