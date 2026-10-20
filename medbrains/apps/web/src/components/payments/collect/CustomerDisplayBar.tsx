import { Group } from "@mantine/core";
import { IconDeviceTv, IconDeviceTvOff } from "@tabler/icons-react";
import { Badge, Switch } from "@/components/ui";
import { useDisplayFeed, useDisplayStatus } from "./customer-display";

/**
 * "Customer display: connected" and the "Show QR on display" switch, for the
 * cashier's counter. Nothing when the counter has no display paired.
 */
export function CustomerDisplayBar({ stationId }: { stationId: string | null }) {
  const status = useDisplayStatus(stationId);
  const showQr = useDisplayFeed((s) => s.showQr);
  const setShowQr = useDisplayFeed((s) => s.setShowQr);
  const failed = useDisplayFeed((s) => s.failed);
  if (status.isError) {
    return (
      <Badge tone="warning" data-testid="customer-display-status">
        Customer display: status unknown
      </Badge>
    );
  }
  if (!status.data?.paired) return null;
  const connected = status.data.connected && !failed;
  return (
    <Group gap="sm" justify="space-between" data-testid="customer-display-bar">
      <Badge
        tone={connected ? "success" : "warning"}
        leftSection={
          connected ? (
            <IconDeviceTv size={14} aria-hidden />
          ) : (
            <IconDeviceTvOff size={14} aria-hidden />
          )
        }
        data-testid="customer-display-status"
      >
        Customer display: {connected ? "connected" : "not connected"}
      </Badge>
      <Switch
        label="Show QR on display"
        checked={showQr}
        onChange={(e) => setShowQr(e.currentTarget.checked)}
        data-testid="customer-display-qr"
      />
    </Group>
  );
}
