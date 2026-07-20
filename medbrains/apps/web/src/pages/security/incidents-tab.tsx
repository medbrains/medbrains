// Security IncidentsTab — split from security.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { SecurityIncidentFormInput } from "@medbrains/schemas";
import { securityIncidentFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { SecurityIncident, UpdateSecurityIncidentRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  defaultSecurityIncidentFormValues,
  securityIncidentFormToRequest,
} from "@/forms/security.form";
import { securityService } from "@/services/security.service";

const INCIDENT_SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const INCIDENT_CATEGORIES = [
  { value: "theft", label: "Theft" },
  { value: "assault", label: "Assault" },
  { value: "trespass", label: "Trespass" },
  { value: "property_damage", label: "Property Damage" },
  { value: "policy_violation", label: "Policy Violation" },
  { value: "elopement", label: "Elopement" },
  { value: "other", label: "Other" },
];

const SEVERITY_COLORS: Record<string, BadgeTone> = {
  low: "primary",
  medium: "warning",
  high: "warning",
  critical: "danger",
};

const STATUS_COLORS: Record<string, BadgeTone> = {
  reported: "primary",
  investigating: "warning",
  resolved: "success",
  closed: "neutral",
};

export function IncidentsTab() {
  const canCreate = useHasPermission(P.SECURITY.INCIDENTS_CREATE);
  const canUpdate = useHasPermission(P.SECURITY.INCIDENTS_UPDATE);
  const qc = useQueryClient();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["sec-incidents"],
    queryFn: () => securityService.listSecurityIncidents(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ["sec-zones"],
    queryFn: () => securityService.listSecurityZones(),
  });
  const [opened, { open, close }] = useDisclosure(false);
  const incidentForm = useForm<SecurityIncidentFormInput>({
    resolver: zodResolver(securityIncidentFormSchema),
    defaultValues: defaultSecurityIncidentFormValues,
  });
  const policeNotified = incidentForm.watch("police_notified");
  const handleOpen = () => {
    incidentForm.reset(defaultSecurityIncidentFormValues);
    open();
  };
  const createMut = useMutation({
    mutationFn: (values: SecurityIncidentFormInput) =>
      securityService.createSecurityIncident(securityIncidentFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-incidents"] });
      incidentForm.reset(defaultSecurityIncidentFormValues);
      close();
      notifications.show({
        title: "Incident Reported",
        message: "Security incident created",
        color: "success",
      });
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSecurityIncidentRequest }) =>
      securityService.updateSecurityIncident(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-incidents"] });
      notifications.show({
        title: "Incident Updated",
        message: "Status updated",
        color: "success",
      });
    },
  });

  const columns: Column<SecurityIncident>[] = [
    {
      key: "incident_number",
      label: "Incident #",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.incident_number}
        </Text>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      render: (r) => <Badge tone={SEVERITY_COLORS[r.severity] ?? "neutral"}>{r.severity}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={STATUS_COLORS[r.status] ?? "neutral"}>{r.status}</Badge>,
    },
    {
      key: "category",
      label: "Category",
      render: (r) => <Text>{r.category.replace("_", " ")}</Text>,
    },
    {
      key: "zone_id",
      label: "Zone",
      render: (r) => (
        <Text size="sm">{zones.find((z) => z.id === r.zone_id)?.zone_code ?? "—"}</Text>
      ),
    },
    {
      key: "occurred_at",
      label: "Occurred",
      render: (r) => <Text size="sm">{new Date(r.occurred_at).toLocaleString()}</Text>,
    },
    {
      key: "police_notified",
      label: "Police",
      render: (r) =>
        r.police_notified ? <Badge tone="danger">Yes</Badge> : <Text c="dimmed">No</Text>,
    },
    ...(canUpdate
      ? [
          {
            key: "actions" as const,
            label: "Actions",
            render: (r: SecurityIncident) =>
              r.status === "reported" ? (
                <Tooltip label="Start Investigation">
                  <IconButton
                    tone="default"
                    onClick={() =>
                      updateMut.mutate({ id: r.id, body: { status: "investigating" } })
                    }
                    aria-label="Start Investigation"
                  >
                    <IconPencil size={16} />
                  </IconButton>
                </Tooltip>
              ) : r.status === "investigating" ? (
                <Tooltip label="Resolve">
                  <IconButton
                    tone="success"
                    onClick={() => updateMut.mutate({ id: r.id, body: { status: "resolved" } })}
                    aria-label="Resolve"
                  >
                    <IconCheck size={16} />
                  </IconButton>
                </Tooltip>
              ) : (
                <Text c="dimmed">—</Text>
              ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpen}>
            Report Incident
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={incidents} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={opened}
        onClose={close}
        title="Report Security Incident"
        position="right"
        size="lg"
      >
        <Stack
          component="form"
          onSubmit={incidentForm.handleSubmit((values) => createMut.mutate(values))}
        >
          <Controller
            control={incidentForm.control}
            name="severity"
            render={({ field, fieldState }) => (
              <Select
                label="Severity"
                data={INCIDENT_SEVERITIES}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={incidentForm.control}
            name="category"
            render={({ field, fieldState }) => (
              <Select
                label="Category"
                required
                data={INCIDENT_CATEGORIES}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={incidentForm.control}
            name="zone_id"
            render={({ field, fieldState }) => (
              <Select
                label="Zone"
                data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Location"
            {...incidentForm.register("location_description")}
            error={incidentForm.formState.errors.location_description?.message}
          />
          <Textarea
            label="Description"
            required
            minRows={3}
            {...incidentForm.register("description")}
            error={incidentForm.formState.errors.description?.message}
          />
          <Controller
            control={incidentForm.control}
            name="police_notified"
            render={({ field }) => (
              <Switch
                label="Police Notified"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {policeNotified && (
            <TextInput
              label="Police Report Number"
              {...incidentForm.register("police_report_number")}
              error={incidentForm.formState.errors.police_report_number?.message}
            />
          )}
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Submit Report
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Patient Safety Tab
// ══════════════════════════════════════════════════════════
