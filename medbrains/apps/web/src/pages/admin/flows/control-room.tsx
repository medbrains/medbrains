/**
 * Admin → Flows → control room (RFC §5.2 #1): patients waiting at each
 * station now, the longest wait against the timetable as a word (calm, busy,
 * overdue), and the station losing the most time today. Click a station for
 * its patients, its holder and its timetable.
 */
import {
  Anchor,
  Group,
  List,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { FlowStationLoad } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { PageHeader } from "@/components";
import { Alert, Badge, Breadcrumb, Button, Card, Panel } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { DISCHARGE_FLOW, sopFlowsService } from "@/services/sopFlows.service";
import { duration } from "./duration";

const LABEL = {
  calm: { text: "Calm", tone: "success" },
  busy: { text: "Busy", tone: "warning" },
  overdue: { text: "Overdue", tone: "danger" },
} as const;

function StationCard({
  s,
  selected,
  onSelect,
}: {
  s: FlowStationLoad;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${s.name}: ${s.count} waiting, ${LABEL[s.label].text}`}
    >
      <Card withBorder padding="sm">
        <Stack gap={4}>
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600}>{s.name}</Text>
            <Badge tone={LABEL[s.label].tone}>{LABEL[s.label].text}</Badge>
          </Group>
          <Text size="xl" fw={700}>
            {s.count}
            <Text span size="sm" c="dimmed" fw={400}>
              {" "}
              waiting
            </Text>
          </Text>
          <Text size="sm" c="dimmed">
            {s.longest_minutes === null
              ? "Nobody waiting"
              : `Longest wait ${duration(s.longest_minutes)}`}
            {s.sla_minutes ? ` · timetable ${duration(s.sla_minutes)}` : ""}
          </Text>
        </Stack>
      </Card>
    </UnstyledButton>
  );
}

function StationDetail({ s, patientsVisible }: { s: FlowStationLoad; patientsVisible: boolean }) {
  return (
    <Panel title={s.name} description={`${s.path} · held by ${s.holder.toLowerCase()}`}>
      {!patientsVisible ? (
        <Text size="sm">Patient names need IPD admissions access; you can see the counts.</Text>
      ) : s.patients.length === 0 ? (
        <Text size="sm">Nobody is waiting here now.</Text>
      ) : (
        <List spacing="xs" aria-label={`Patients at ${s.name}`}>
          {s.patients.map((p) => (
            <List.Item key={p.admission_id}>
              <Anchor component={Link} to={`/ipd/admissions/${p.admission_id}`}>
                {p.label}
              </Anchor>{" "}
              — {duration(p.minutes)} here{p.overdue ? ", overdue" : ""}
              {p.version ? ` (version ${p.version})` : ""}
            </List.Item>
          ))}
        </List>
      )}
    </Panel>
  );
}

export function FlowControlRoomPage() {
  useRequirePermission(P.FLOWS.VIEW);
  const { code = DISCHARGE_FLOW } = useParams();
  const canView = useHasPermission(P.FLOWS.VIEW);
  const [selected, setSelected] = useState<string | null>(null);
  const room = useQuery({
    queryKey: ["flows", code, "control-room"],
    queryFn: () => sopFlowsService.controlRoom(code),
    enabled: canView,
    refetchInterval: 60_000,
  });
  const station = room.data?.stations.find((s) => s.key === selected);
  return (
    <Stack gap="md">
      <PageHeader
        title="Discharge control room"
        subtitle="Where patients are on the discharge flow now, and who holds them"
      />
      <Breadcrumb
        items={[
          { label: "Flows", href: "/admin/flows" },
          { label: "Switchboard", href: `/admin/flows/${encodeURIComponent(code)}` },
          { label: "Control room" },
        ]}
      />
      {room.isLoading && <Loader aria-label="Loading the control room" />}
      {room.error && (
        // An outage is never shown as an empty board.
        <Alert tone="danger" title="Could not load the control room">
          <Stack gap="xs">
            <Text size="sm">{room.error.message}</Text>
            <Group>
              <Button tone="secondary" size="xs" onClick={() => void room.refetch()}>
                Try again
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}
      {room.data && (
        <>
          <Alert tone={room.data.spotlight_station ? "warning" : "neutral"} title="Today">
            {room.data.spotlight}
          </Alert>
          <Text size="xs" c="dimmed">
            As of {new Date(room.data.as_of).toLocaleTimeString()}
            {room.isStale ? " (refreshing)" : ""}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {room.data.stations
              .filter((s) => s.sla_minutes !== null)
              .map((s) => (
                <StationCard
                  key={s.key}
                  s={s}
                  selected={selected === s.key}
                  onSelect={() => setSelected(selected === s.key ? null : s.key)}
                />
              ))}
          </SimpleGrid>
          {station && <StationDetail s={station} patientsVisible={room.data.patients_visible} />}
        </>
      )}
    </Stack>
  );
}
