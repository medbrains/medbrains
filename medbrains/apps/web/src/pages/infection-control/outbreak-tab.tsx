// IPD OutbreakTab — split from infection-control.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Timeline,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateOutbreakRequest,
  OutbreakContact,
  OutbreakEvent,
  OutbreakStatusType,
  UpdateOutbreakRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, IconButton } from "@/components/ui";
import { infectionControlService } from "@/services/infectionControl.service";
import { statusColorTone } from "./shared";

export function OutbreakTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.OUTBREAK_CREATE);
  const canUpdate = useHasPermission(P.INFECTION_CONTROL.OUTBREAK_UPDATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<OutbreakEvent | null>(null);

  const { data: outbreaks = [], isLoading } = useQuery({
    queryKey: ["ic-outbreaks", statusFilter],
    queryFn: () =>
      infectionControlService.listOutbreaks({ outbreak_status: statusFilter ?? undefined }),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["ic-outbreak-contacts", selected?.id],
    queryFn: () =>
      selected ? infectionControlService.listOutbreakContacts(selected.id) : Promise.resolve([]),
    enabled: !!selected,
  });

  // Feature 5: Outbreak timeline chart
  const timelineChartData = useMemo(() => {
    if (!selected) return [];
    const data: { date: string; cases: number }[] = [];
    data.push({
      date: new Date(selected.detected_date).toLocaleDateString(),
      cases: selected.initial_cases,
    });
    if (selected.total_cases > selected.initial_cases) {
      data.push({
        date: new Date(selected.created_at).toLocaleDateString(),
        cases: selected.total_cases,
      });
    }
    return data;
  }, [selected]);

  const [form, setForm] = useState<CreateOutbreakRequest>({
    organism: "",
    detected_date: "",
    initial_cases: 1,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateOutbreakRequest) => infectionControlService.createOutbreak(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-outbreaks"] });
      notifications.show({ title: "Outbreak reported", message: "", color: "success" });
      close();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOutbreakRequest }) =>
      infectionControlService.updateOutbreak(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-outbreaks"] });
      notifications.show({ title: "Outbreak updated", message: "", color: "success" });
    },
  });

  const statusTransitions: Record<string, string[]> = {
    suspected: ["confirmed"],
    confirmed: ["contained"],
    contained: ["closed"],
  };

  const columns = [
    {
      key: "outbreak_number" as const,
      label: "Number",
      render: (r: OutbreakEvent) => <Text fw={500}>{r.outbreak_number}</Text>,
    },
    { key: "organism" as const, label: "Organism", render: (r: OutbreakEvent) => r.organism },
    {
      key: "outbreak_status" as const,
      label: "Status",
      render: (r: OutbreakEvent) => (
        <Badge tone={statusColorTone(r.outbreak_status)}>{r.outbreak_status}</Badge>
      ),
    },
    {
      key: "total_cases" as const,
      label: "Cases",
      render: (r: OutbreakEvent) => String(r.total_cases),
    },
    {
      key: "detected_date" as const,
      label: "Detected",
      render: (r: OutbreakEvent) => new Date(r.detected_date).toLocaleDateString(),
    },
    {
      key: "hicc_notified" as const,
      label: "HICC",
      render: (r: OutbreakEvent) =>
        r.hicc_notified ? (
          <Badge tone="success" size="sm">
            Notified
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            No
          </Badge>
        ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (r: OutbreakEvent) => (
        <Group gap="xs">
          <Tooltip label="View details">
            <IconButton
              onClick={() => {
                setSelected(r);
                openDetail();
              }}
              aria-label="View details"
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {canUpdate &&
            (statusTransitions[r.outbreak_status] ?? []).map((next) => (
              <Button
                tone="secondary"
                key={next}
                size="compact-xs"
                onClick={() =>
                  updateMut.mutate({
                    id: r.id,
                    data: { outbreak_status: next as OutbreakStatusType },
                  })
                }
              >
                {next}
              </Button>
            ))}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["suspected", "confirmed", "contained", "closed"]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
          <Text c="dimmed" size="sm">
            {outbreaks.length} outbreak(s)
          </Text>
        </Group>
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Report Outbreak
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={outbreaks}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No outbreaks"
      />

      <Drawer opened={opened} onClose={close} title="Report Outbreak" position="right" size="xl">
        <Stack>
          <TextInput
            label="Organism"
            required
            value={form.organism}
            onChange={(e) => setForm({ ...form, organism: e.currentTarget.value })}
          />
          <TextInput
            label="Detected Date"
            type="datetime-local"
            required
            value={form.detected_date}
            onChange={(e) => setForm({ ...form, detected_date: e.currentTarget.value })}
          />
          <NumberInput
            label="Initial Cases"
            value={form.initial_cases ?? 1}
            onChange={(v) => setForm({ ...form, initial_cases: Number(v) })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Report
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title={`Outbreak: ${selected?.outbreak_number ?? ""}`}
        position="right"
        size="lg"
      >
        {selected && (
          <Stack>
            <Text fw={600}>{selected.organism}</Text>
            <Group>
              <Badge tone={statusColorTone(selected.outbreak_status)}>
                {selected.outbreak_status}
              </Badge>
              <Text size="sm">Cases: {selected.total_cases}</Text>
            </Group>
            {selected.description && <Text size="sm">{selected.description}</Text>}
            {selected.root_cause && <Text size="sm">Root Cause: {selected.root_cause}</Text>}

            {timelineChartData.length > 0 && (
              <Paper p="md" withBorder mt="md">
                <Title order={6} mb="md">
                  Outbreak Progression
                </Title>
                <Timeline active={timelineChartData.length - 1} bulletSize={24} lineWidth={2}>
                  <Timeline.Item title="Detection">
                    <Text size="sm" c="dimmed">
                      Detected: {new Date(selected.detected_date).toLocaleDateString()}
                    </Text>
                    <Text size="sm">Initial cases: {selected.initial_cases}</Text>
                  </Timeline.Item>
                  {selected.total_cases > selected.initial_cases && (
                    <Timeline.Item title="Escalation">
                      <Text size="sm">Total cases: {selected.total_cases}</Text>
                    </Timeline.Item>
                  )}
                  {selected.containment_date && (
                    <Timeline.Item title="Containment">
                      <Text size="sm" c="dimmed">
                        {new Date(selected.containment_date).toLocaleDateString()}
                      </Text>
                    </Timeline.Item>
                  )}
                  {selected.closure_date && (
                    <Timeline.Item title="Closure">
                      <Text size="sm" c="dimmed">
                        {new Date(selected.closure_date).toLocaleDateString()}
                      </Text>
                    </Timeline.Item>
                  )}
                </Timeline>
              </Paper>
            )}

            <Text fw={600} mt="md">
              Contacts ({contacts.length})
            </Text>
            {contacts.map((c: OutbreakContact) => (
              <Group
                key={c.id}
                p="xs"
                style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
              >
                <Text size="sm">{c.contact_type}</Text>
                {c.quarantine_required && (
                  <Badge tone="danger" size="sm">
                    Quarantine
                  </Badge>
                )}
                {c.screening_result && <Text size="sm">Screen: {c.screening_result}</Text>}
              </Group>
            ))}
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}

// ── Sharps Safety Tab ───────────────────────────────────
