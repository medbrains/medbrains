import { Sparkline } from "@mantine/charts";
import { Group, Stack, Text, Title } from "@mantine/core";
import { Alert, Badge, Modal, Table } from "@/components/ui";
import { useFlowZone } from "./use-flow";

interface ZoneDetailProps {
  zoneId: string | null;
  onClose: () => void;
}

const show = (n: number | null | undefined, unit = "") =>
  n === null || n === undefined ? "Unknown" : `${Math.round(n)}${unit}`;

/** Why a zone is the colour it is: its numbers, in words, and its last 4 hours. */
export function ZoneDetail({ zoneId, onClose }: ZoneDetailProps) {
  const zone = useFlowZone(zoneId);
  const z = zone.data?.zone;
  const rows: [string, string][] = z
    ? [
        ["People now", `${show(z.people_est)} est.`],
        ["Patients", show(z.patients)],
        ["Waiting in queue", show(z.waiting)],
        [
          "Wait",
          z.wait_minutes === null
            ? "Unknown"
            : `~${show(z.wait_minutes)} min (target ${z.goal_wait_minutes ?? 15})`,
        ],
        ["Counters calling", show(z.open_counters)],
        ["Called in the last 30 min", show(z.served_30m)],
        ["Booked in the next hour", show(zone.data?.booked_next_hour)],
        ["Visitors inside", show(z.visitors)],
        ["Staff on duty", show(z.staff)],
        ["Limits", `comfort ${show(z.comfort_limit)}, capacity ${show(z.capacity)}`],
        ["Attendant factor", `× ${z.attendant_factor}`],
      ]
    : [];
  const people = (zone.data?.series ?? []).map((p) => p.people_est ?? 0);
  return (
    <Modal opened={Boolean(zoneId)} onClose={onClose} title={z ? z.name : "Zone"} size="md">
      {zone.isError && (
        <Alert tone="danger">This zone could not be loaded. It is not empty: try again.</Alert>
      )}
      {z && (
        <Stack gap="md">
          <Group gap="xs">
            <Badge tone="info">Estimated</Badge>
            <Text size="xs" c="dimmed">
              From queues, check-ins, visitor passes and rosters, not a headcount.
            </Text>
          </Group>
          <Stack gap={4}>
            <Title order={3} size="h5">
              Why it looks like this
            </Title>
            {zone.data?.reasons.length === 0 ? (
              <Text size="sm">Within its limits and on target.</Text>
            ) : (
              zone.data?.reasons.map((r) => (
                <Text key={r} size="sm">
                  {r}
                </Text>
              ))
            )}
          </Stack>
          <Table>
            <Table.Tbody>
              {rows.map(([label, value]) => (
                <Table.Tr key={label}>
                  <Table.Th scope="row">{label}</Table.Th>
                  <Table.Td>{value}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {z.counters.length > 0 && (
            <Stack gap={4}>
              <Title order={3} size="h5">
                Counters
              </Title>
              {z.counters.map((c) => (
                <Text key={c.label} size="sm">
                  {c.label}: {c.waiting} waiting
                </Text>
              ))}
            </Stack>
          )}
          {people.length > 1 && (
            <Stack gap={4}>
              <Title order={3} size="h5">
                Last 4 hours
              </Title>
              <Sparkline h={48} data={people} curveType="linear" aria-hidden="true" />
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th scope="col">Time</Table.Th>
                    <Table.Th scope="col">People (est.)</Table.Th>
                    <Table.Th scope="col">Wait (min)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {zone.data?.series.map((p) => (
                    <Table.Tr key={p.at}>
                      <Table.Td>
                        {new Date(p.at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Table.Td>
                      <Table.Td>{show(p.people_est)}</Table.Td>
                      <Table.Td>{show(p.wait_minutes)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          )}
        </Stack>
      )}
    </Modal>
  );
}
