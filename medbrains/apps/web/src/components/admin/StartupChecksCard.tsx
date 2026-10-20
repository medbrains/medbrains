/**
 * What the server found about its own setup when it last started: missing keys,
 * a simulator left on, a database role that skips row level security, a default
 * password. Problems first; every status says its level in words, not colour
 * alone.
 */
import { Card, Group, Stack, Text } from "@mantine/core";
import type { StartupCheck } from "@medbrains/types";
import { IconChecklist } from "@tabler/icons-react";
import { useMemo } from "react";
import { Badge, type BadgeTone, Table } from "@/components/ui";

interface StartupChecksCardProps {
  checks: StartupCheck[] | undefined;
}

const LEVEL: Record<StartupCheck["level"], { label: string; tone: BadgeTone; rank: number }> = {
  fail: { label: "Fail", tone: "danger", rank: 0 },
  warn: { label: "Warning", tone: "warning", rank: 1 },
  ok: { label: "OK", tone: "success", rank: 2 },
};

export function StartupChecksCard({ checks }: StartupChecksCardProps) {
  const sorted = useMemo(
    () => [...(checks ?? [])].sort((a, b) => LEVEL[a.level].rank - LEVEL[b.level].rank),
    [checks],
  );
  const problems = sorted.filter((c) => c.level !== "ok").length;

  return (
    <Card withBorder padding="lg">
      <Group gap="xs" mb="sm">
        <IconChecklist size={20} aria-hidden />
        <Text fw={600}>Startup checks</Text>
        <Text size="xs" c="dimmed">
          (found when this server last started — fix, then restart)
        </Text>
      </Group>
      {checks === undefined ? (
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      ) : sorted.length === 0 ? (
        <Text size="sm" c="dimmed">
          This server has not reported its startup checks. It may be running an older release.
        </Text>
      ) : (
        <Stack gap="sm">
          <Text size="sm">
            {problems === 0
              ? `All ${sorted.length} checks passed.`
              : `${problems} of ${sorted.length} checks need attention.`}
          </Text>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Status</Table.Th>
                <Table.Th>Check</Table.Th>
                <Table.Th>Finding</Table.Th>
                <Table.Th>How to fix</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sorted.map((c) => (
                <Table.Tr key={c.check}>
                  <Table.Td>
                    <Badge tone={LEVEL[c.level].tone} size="sm">
                      {LEVEL[c.level].label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace">
                      {c.check}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{c.detail}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{c.fix ?? "—"}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      )}
    </Card>
  );
}
