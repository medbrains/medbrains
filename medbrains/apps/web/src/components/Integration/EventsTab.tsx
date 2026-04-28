import {
  Accordion,
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { api } from "@medbrains/api";
import type { EventRegistryRow } from "@medbrains/types";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

const PHASE_COLORS: Record<string, string> = {
  before: "yellow",
  after: "blue",
};

const MODULE_OPTIONS = [
  { label: "All Modules", value: "" },
  { label: "Patients", value: "patients" },
  { label: "OPD", value: "opd" },
  { label: "IPD", value: "ipd" },
  { label: "Lab", value: "lab" },
  { label: "Pharmacy", value: "pharmacy" },
  { label: "Billing", value: "billing" },
  { label: "Radiology", value: "radiology" },
  { label: "Emergency", value: "emergency" },
  { label: "Admin", value: "admin" },
];

export function EventsTab() {
  const navigate = useNavigate();
  const [moduleFilter, setModuleFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["orchestration", "events", moduleFilter],
    queryFn: () =>
      api.listOrchestrationEvents(
        moduleFilter ? { module: moduleFilter } : undefined,
      ),
  });

  const events = data?.events ?? [];

  const grouped = useMemo(() => {
    const filtered = search
      ? events.filter(
          (e) =>
            e.event_code.toLowerCase().includes(search.toLowerCase()) ||
            (e.description ?? "").toLowerCase().includes(search.toLowerCase()),
        )
      : events;

    const map = new Map<string, EventRegistryRow[]>();
    for (const ev of filtered) {
      const list = map.get(ev.module) ?? [];
      list.push(ev);
      map.set(ev.module, list);
    }
    return map;
  }, [events, search]);

  return (
    <Stack gap="sm">
      <Group>
        <TextInput
          placeholder="Search events..."
          leftSection={<IconSearch size={14} />}
          size="xs"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          data={MODULE_OPTIONS}
          value={moduleFilter}
          onChange={(v) => setModuleFilter(v ?? "")}
          size="xs"
          w={160}
          placeholder="Filter module"
        />
      </Group>

      {grouped.size === 0 && (
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No events found
        </Text>
      )}

      <Accordion variant="separated">
        {[...grouped.entries()].map(([mod, modEvents]) => (
          <Accordion.Item key={mod} value={mod}>
            <Accordion.Control>
              <Group>
                <Text fw={600} tt="capitalize">
                  {mod}
                </Text>
                <Badge size="xs" variant="light">
                  {modEvents.length}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {modEvents.map((ev) => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    onCreatePipeline={() =>
                      navigate(
                        `/admin/integration-builder?event=${ev.event_code}`,
                      )
                    }
                  />
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}

interface EventRowProps {
  event: EventRegistryRow;
  onCreatePipeline: () => void;
}

function EventRow({ event, onCreatePipeline }: EventRowProps) {
  return (
    <Group justify="space-between" py={4}>
      <Group gap="xs">
        <Badge variant="light" size="sm" ff="monospace">
          {event.event_code}
        </Badge>
        <Text size="xs" c="dimmed">
          {event.description ?? `${event.entity}.${event.action}`}
        </Text>
        <Badge
          size="xs"
          color={PHASE_COLORS[event.phase] ?? "gray"}
          variant="dot"
        >
          {event.phase}
        </Badge>
        {event.is_blocking && (
          <Badge size="xs" color="red" variant="filled">
            blocking
          </Badge>
        )}
      </Group>
      <Button
        size="compact-xs"
        variant="subtle"
        leftSection={<IconPlus size={12} />}
        onClick={onCreatePipeline}
      >
        Create Pipeline
      </Button>
    </Group>
  );
}
