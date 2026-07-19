// IPD SurveillanceTab — split from infection-control.tsx (pure move).

import {
  Drawer,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { HaiType, InfectionSurveillanceEvent } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button } from "@/components/ui";
import { infectionControlService } from "@/services/infectionControl.service";
import { statusColorTone } from "./shared";

const DEVICE_TYPES = [
  { value: "central_line", label: "Central Line" },
  { value: "urinary_catheter", label: "Urinary Catheter" },
  { value: "ventilator", label: "Ventilator" },
  { value: "peripheral_iv", label: "Peripheral IV" },
  { value: "feeding_tube", label: "Feeding Tube" },
  { value: "tracheostomy", label: "Tracheostomy" },
  { value: "drain", label: "Drain" },
  { value: "other", label: "Other" },
];

export function SurveillanceTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.SURVEILLANCE_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [haiFilter, setHaiFilter] = useState<string | null>(null);
  const [subView, setSubView] = useState<string>("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["ic-surveillance", haiFilter],
    queryFn: () =>
      infectionControlService.listSurveillanceEvents({ hai_type: haiFilter ?? undefined }),
  });

  // Feature 1: SSI-specific tracking
  const ssiEvents = useMemo(() => events.filter((e) => e.hai_type === "ssi"), [events]);

  const [form, setForm] = useState({
    patient_id: "",
    hai_type: "clabsi" as HaiType,
    infection_date: "",
    organism: "",
    device_type: "",
    department_id: "",
    notes: "",
  });

  const createMut = useMutation({
    mutationFn: () =>
      infectionControlService.createSurveillanceEvent({
        patient_id: form.patient_id,
        hai_type: form.hai_type,
        infection_date: form.infection_date,
        organism: form.organism || undefined,
        device_type: form.device_type || undefined,
        department_id: form.department_id || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-surveillance"] });
      notifications.show({ title: "Event recorded", message: "", color: "success" });
      close();
    },
  });

  const columns = [
    {
      key: "hai_type" as const,
      label: "HAI Type",
      render: (r: InfectionSurveillanceEvent) => (
        <Badge tone={statusColorTone(r.hai_type)}>{r.hai_type.toUpperCase()}</Badge>
      ),
    },
    {
      key: "infection_status" as const,
      label: "Status",
      render: (r: InfectionSurveillanceEvent) => (
        <Badge tone={statusColorTone(r.infection_status)}>
          {r.infection_status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "organism" as const,
      label: "Organism",
      render: (r: InfectionSurveillanceEvent) => r.organism ?? "---",
    },
    {
      key: "device_type" as const,
      label: "Device",
      render: (r: InfectionSurveillanceEvent) => r.device_type ?? "---",
    },
    {
      key: "infection_date" as const,
      label: "Date",
      render: (r: InfectionSurveillanceEvent) => new Date(r.infection_date).toLocaleDateString(),
    },
    {
      key: "notes" as const,
      label: "Notes",
      render: (r: InfectionSurveillanceEvent) => r.notes ?? "---",
    },
  ];

  const ssiColumns = [
    {
      key: "infection_status" as const,
      label: "Status",
      render: (r: InfectionSurveillanceEvent) => (
        <Badge tone={statusColorTone(r.infection_status)}>
          {r.infection_status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "organism" as const,
      label: "Organism",
      render: (r: InfectionSurveillanceEvent) => r.organism ?? "---",
    },
    {
      key: "device_type" as const,
      label: "Procedure Type",
      render: (r: InfectionSurveillanceEvent) => r.device_type ?? "---",
    },
    {
      key: "infection_date" as const,
      label: "Infection Date",
      render: (r: InfectionSurveillanceEvent) => new Date(r.infection_date).toLocaleDateString(),
    },
    {
      key: "days_post_op" as const,
      label: "Days Post-Op",
      render: (r: InfectionSurveillanceEvent) => {
        if (!r.insertion_date) return "---";
        const insertDate = new Date(r.insertion_date);
        const infectDate = new Date(r.infection_date);
        const days = Math.floor(
          (infectDate.getTime() - insertDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return String(days);
      },
    },
    {
      key: "notes" as const,
      label: "Notes",
      render: (r: InfectionSurveillanceEvent) => r.notes ?? "---",
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <SegmentedControl
            value={subView}
            onChange={setSubView}
            data={[
              { value: "all", label: "All HAI" },
              { value: "ssi", label: "SSI Tracking" },
            ]}
          />
          {subView === "all" && (
            <Select
              placeholder="HAI Type"
              data={["clabsi", "cauti", "vap", "ssi", "cdiff", "mrsa", "other"]}
              value={haiFilter}
              onChange={setHaiFilter}
              clearable
              w={160}
            />
          )}
          <Text c="dimmed" size="sm">
            {subView === "all" ? events.length : ssiEvents.length} event(s)
          </Text>
        </Group>
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Report HAI
          </Button>
        )}
      </Group>

      {subView === "all" ? (
        <DataTable
          columns={columns}
          data={events}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No HAI events"
        />
      ) : (
        <DataTable
          columns={ssiColumns}
          data={ssiEvents}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No SSI events"
        />
      )}

      <Drawer opened={opened} onClose={close} title="Report HAI Event" position="right" size="xl">
        <Stack>
          <PatientSearchSelect
            value={form.patient_id}
            onChange={(v) => setForm({ ...form, patient_id: v })}
            required
          />
          <Select
            label="HAI Type"
            required
            data={["clabsi", "cauti", "vap", "ssi", "cdiff", "mrsa", "other"]}
            value={form.hai_type}
            onChange={(v) => setForm({ ...form, hai_type: (v ?? "other") as HaiType })}
          />
          <TextInput
            label="Infection Date"
            type="date"
            required
            value={form.infection_date}
            onChange={(e) => setForm({ ...form, infection_date: e.currentTarget.value })}
          />
          <TextInput
            label="Organism"
            value={form.organism}
            onChange={(e) => setForm({ ...form, organism: e.currentTarget.value })}
          />
          <Select
            label="Device Type"
            data={DEVICE_TYPES}
            value={form.device_type || null}
            onChange={(v) => setForm({ ...form, device_type: v ?? "" })}
            clearable
            searchable
          />
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
          />
          <Button tone="primary" loading={createMut.isPending} onClick={() => createMut.mutate()}>
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Stewardship Tab ─────────────────────────────────────
