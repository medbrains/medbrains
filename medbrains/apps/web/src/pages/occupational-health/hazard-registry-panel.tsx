// IPD HazardRegistryPanel — split from occupational-health.tsx (pure move).

import { Drawer, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CreateOccHealthHazardRequest, OccHealthHazard } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { occupationalHealthService } from "@/services/occupationalHealth.service";
import { statusColorTone } from "./shared";

const HAZARD_TYPES = [
  { value: "biological", label: "Biological" },
  { value: "chemical", label: "Chemical" },
  { value: "physical", label: "Physical" },
  { value: "ergonomic", label: "Ergonomic" },
  { value: "psychosocial", label: "Psychosocial" },
  { value: "radiation", label: "Radiation" },
  { value: "other", label: "Other" },
];

export function HazardRegistryPanel() {
  const canCreate = useHasPermission(P.OCC_HEALTH.SCREENINGS_CREATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const { data: hazards = [], isLoading } = useQuery({
    queryKey: ["occ-health-hazards"],
    queryFn: () => occupationalHealthService.listOccHealthHazards(),
  });

  const [form, setForm] = useState<CreateOccHealthHazardRequest>({
    hazard_type: "biological",
    location: "",
    risk_level: "low",
    assessed_date: new Date().toISOString().slice(0, 10),
  });

  const createMut = useMutation({
    mutationFn: () => occupationalHealthService.createOccHealthHazard(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-health-hazards"] });
      createHandlers.close();
      setForm({
        hazard_type: "biological",
        location: "",
        risk_level: "low",
        assessed_date: new Date().toISOString().slice(0, 10),
      });
      notifications.show({
        title: "Hazard Created",
        message: "Hazard registry entry created successfully",
        color: "success",
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  const columns: Column<OccHealthHazard>[] = [
    {
      key: "hazard_type",
      label: "Type",
      render: (r) => (
        <Badge tone="neutral" size="sm">
          {HAZARD_TYPES.find((t) => t.value === r.hazard_type)?.label ?? r.hazard_type}
        </Badge>
      ),
    },
    {
      key: "location",
      label: "Location",
      render: (r) => <Text size="sm">{r.location}</Text>,
    },
    {
      key: "risk_level",
      label: "Risk Level",
      render: (r) => (
        <Badge tone={statusColorTone(r.risk_level)} variant="filled" size="sm">
          {r.risk_level}
        </Badge>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (r) => (
        <Text size="sm" lineClamp={2}>
          {r.description ?? "---"}
        </Text>
      ),
    },
    {
      key: "mitigation",
      label: "Mitigation",
      render: (r) => (
        <Text size="sm" lineClamp={2}>
          {r.mitigation ?? "---"}
        </Text>
      ),
    },
    {
      key: "assessed_date",
      label: "Assessed",
      render: (r) => <Text size="sm">{r.assessed_date}</Text>,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Add Hazard
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={hazards}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No hazards registered"
        emptyDescription="Add workplace hazards to build a comprehensive registry"
      />

      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Register Workplace Hazard"
        position="right"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Hazard Type"
            required
            data={HAZARD_TYPES}
            value={form.hazard_type}
            onChange={(v) => setForm({ ...form, hazard_type: v ?? "biological" })}
          />
          <TextInput
            label="Location"
            required
            placeholder="e.g. ICU Ward 3, Radiology Lab"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.currentTarget.value })}
          />
          <Select
            label="Risk Level"
            required
            data={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ]}
            value={form.risk_level}
            onChange={(v) => setForm({ ...form, risk_level: v ?? "low" })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <Textarea
            label="Mitigation Measures"
            value={form.mitigation ?? ""}
            onChange={(e) => setForm({ ...form, mitigation: e.currentTarget.value || undefined })}
          />
          <DateInput
            label="Assessment Date"
            required
            value={form.assessed_date ? new Date(form.assessed_date) : null}
            onChange={(d) =>
              setForm({ ...form, assessed_date: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.location || !form.assessed_date}
          >
            Register Hazard
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 6 — Analytics
// ══════════════════════════════════════════════════════════
