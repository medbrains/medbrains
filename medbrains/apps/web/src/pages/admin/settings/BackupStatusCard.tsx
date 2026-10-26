import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { BackupHistory } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconDatabaseExport } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { settingsSetupService } from "@/services/settingsSetup.service";

/** Same threshold as medbrains-host-check: a nightly run may land up to 26 h after the last. */
const STALE_AFTER_HOURS = 26;
const HOUR_MS = 3_600_000;

function finishedAt(row: BackupHistory): number {
  return Date.parse(row.completed_at ?? row.started_at);
}

function formatAge(hours: number): string {
  if (hours < 1) return "under an hour ago";
  if (hours < 48) return `${Math.floor(hours)} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function formatSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/** Rows arrive newest first (GET /api/backups orders by created_at DESC). */
function summarise(rows: BackupHistory[], now: number) {
  const lastGood = rows.find((r) => r.status === "completed");
  const lastFailed = rows.find((r) => r.status === "failed");
  const ageHours = lastGood ? (now - finishedAt(lastGood)) / HOUR_MS : null;
  const failingNow =
    lastFailed !== undefined && (!lastGood || finishedAt(lastFailed) > finishedAt(lastGood));
  return {
    lastGood,
    failure: failingNow ? lastFailed : undefined,
    ageHours,
    isStale: ageHours === null || ageHours > STALE_AFTER_HOURS,
  };
}

/** Age of the last good database backup, for Admin → Settings → System health. */
export function BackupStatusCard() {
  const canView = useHasPermission(P.ADMIN.BACKUP_MANAGE);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["backups"],
    queryFn: () => settingsSetupService.listBackups(),
    enabled: canView,
    staleTime: 60_000,
  });
  const summary = useMemo(() => (data ? summarise(data, Date.now()) : null), [data]);

  if (!canView) return null;

  return (
    <Card withBorder p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <IconDatabaseExport size={20} aria-hidden />
            <Text fw={600}>Database backups</Text>
            {summary && (
              <Badge tone={summary.isStale ? "danger" : "success"}>
                {summary.isStale ? "Overdue" : "Up to date"}
              </Badge>
            )}
          </Group>
          <Button tone="secondary" size="xs" onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Group>

        {isLoading && (
          <Text size="sm" c="dimmed">
            Checking backups…
          </Text>
        )}

        {isError && (
          <Alert tone="danger" title="Backup status could not be loaded">
            This says nothing about whether backups are running. Try again, or check
            medbrains-host-check on the server.
          </Alert>
        )}

        {summary && !summary.lastGood && (
          <Alert tone="danger" title="No successful backup recorded">
            This installation has no backup this screen can vouch for. Nightly backups are recorded
            here once medbrains-pg-backup runs on the server.
          </Alert>
        )}

        {summary?.lastGood && summary.ageHours !== null && (
          <Text size="sm">
            Last good backup {formatAge(summary.ageHours)} —{" "}
            {new Date(finishedAt(summary.lastGood)).toLocaleString()}
            {formatSize(summary.lastGood.file_size_bytes) &&
              ` · ${formatSize(summary.lastGood.file_size_bytes)}`}
            {summary.isStale && `. Backups are expected at least every ${STALE_AFTER_HOURS} h.`}
          </Text>
        )}

        {summary?.lastGood?.file_path && (
          <Text size="xs" c="dimmed" ff="monospace">
            {summary.lastGood.file_path}
          </Text>
        )}

        {summary?.failure && (
          <Alert tone="warning" title="The latest run failed">
            {new Date(finishedAt(summary.failure)).toLocaleString()}
            {summary.failure.error_message && ` — ${summary.failure.error_message}`}
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
