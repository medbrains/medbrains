// Security PatientSafetyTab — split from security.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { SecurityPatientTagFormInput } from "@medbrains/schemas";
import { securityPatientTagFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  ResolveSecurityTagAlertRequest,
  SecurityPatientTag,
  SecurityTagAlert,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  defaultSecurityPatientTagFormValues,
  securityPatientTagFormToRequest,
} from "@/forms/security.form";
import { securityService } from "@/services/security.service";

const TAG_TYPES = [
  { value: "infant_rfid", label: "Infant RFID" },
  { value: "wander_guard", label: "Wander Guard" },
  { value: "elopement_risk", label: "Elopement Risk" },
];

const ALERT_STATUS_COLORS: Record<string, BadgeTone> = {
  active: "success",
  alert_triggered: "danger",
  resolved: "primary",
  deactivated: "neutral",
};

export function PatientSafetyTab() {
  const canManage = useHasPermission(P.SECURITY.PATIENT_SAFETY_MANAGE);
  const qc = useQueryClient();

  const { data: tags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ["sec-patient-tags"],
    queryFn: () => securityService.listSecurityPatientTags(),
  });
  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["sec-tag-alerts"],
    queryFn: () => securityService.listSecurityTagAlerts(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ["sec-zones"],
    queryFn: () => securityService.listSecurityZones(),
  });
  const [opened, { open, close }] = useDisclosure(false);
  const tagForm = useForm<SecurityPatientTagFormInput>({
    resolver: zodResolver(securityPatientTagFormSchema),
    defaultValues: defaultSecurityPatientTagFormValues,
  });
  const handleOpen = () => {
    tagForm.reset(defaultSecurityPatientTagFormValues);
    open();
  };

  const createTagMut = useMutation({
    mutationFn: (values: SecurityPatientTagFormInput) =>
      securityService.createSecurityPatientTag(securityPatientTagFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-patient-tags"] });
      tagForm.reset(defaultSecurityPatientTagFormValues);
      close();
      notifications.show({
        title: "Tag Activated",
        message: "Patient safety tag activated",
        color: "success",
      });
    },
  });
  const deactivateTagMut = useMutation({
    mutationFn: (id: string) => securityService.deactivateSecurityPatientTag(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-patient-tags"] });
      notifications.show({
        title: "Tag Deactivated",
        message: "Patient tag deactivated",
        color: "orange",
      });
    },
  });
  const resolveAlertMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResolveSecurityTagAlertRequest }) =>
      securityService.resolveSecurityTagAlert(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-tag-alerts"] });
      notifications.show({
        title: "Alert Resolved",
        message: "Tag alert resolved",
        color: "success",
      });
    },
  });

  const tagColumns: Column<SecurityPatientTag>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "tag_type",
      label: "Tag Type",
      render: (r) => <Badge tone="neutral">{r.tag_type.replace("_", " ")}</Badge>,
    },
    {
      key: "tag_identifier",
      label: "Tag ID",
      render: (r) => <Text size="sm">{r.tag_identifier ?? "—"}</Text>,
    },
    {
      key: "allowed_zone_id",
      label: "Zone",
      render: (r) => (
        <Text size="sm">{zones.find((z) => z.id === r.allowed_zone_id)?.zone_code ?? "—"}</Text>
      ),
    },
    {
      key: "alert_status",
      label: "Status",
      render: (r) => (
        <Badge tone={ALERT_STATUS_COLORS[r.alert_status] ?? "neutral"}>
          {r.alert_status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "activated_at",
      label: "Activated",
      render: (r) => <Text size="sm">{new Date(r.activated_at).toLocaleString()}</Text>,
    },
    ...(canManage
      ? [
          {
            key: "actions" as const,
            label: "Actions",
            render: (r: SecurityPatientTag) =>
              r.alert_status !== "deactivated" ? (
                <Tooltip label="Deactivate Tag">
                  <IconButton
                    tone="danger"
                    onClick={() => deactivateTagMut.mutate(r.id)}
                    aria-label="Deactivate Tag"
                  >
                    <IconX size={16} />
                  </IconButton>
                </Tooltip>
              ) : (
                <Text c="dimmed">—</Text>
              ),
          },
        ]
      : []),
  ];

  const alertColumns: Column<SecurityTagAlert>[] = [
    {
      key: "alert_type",
      label: "Alert Type",
      render: (r) => <Badge tone="danger">{r.alert_type.replace("_", " ")}</Badge>,
    },
    {
      key: "triggered_at",
      label: "Triggered",
      render: (r) => <Text size="sm">{new Date(r.triggered_at).toLocaleString()}</Text>,
    },
    {
      key: "zone_id",
      label: "Zone",
      render: (r) => (
        <Text size="sm">{zones.find((z) => z.id === r.zone_id)?.zone_code ?? "—"}</Text>
      ),
    },
    {
      key: "is_resolved",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_resolved ? "success" : "danger"}>
          {r.is_resolved ? "Resolved" : "Active"}
        </Badge>
      ),
    },
    {
      key: "was_false_alarm",
      label: "False Alarm",
      render: (r) =>
        r.is_resolved ? (
          r.was_false_alarm ? (
            <Badge tone="warning">Yes</Badge>
          ) : (
            <Text c="dimmed">No</Text>
          )
        ) : (
          <Text c="dimmed">—</Text>
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions" as const,
            label: "Actions",
            render: (r: SecurityTagAlert) =>
              !r.is_resolved ? (
                <Group gap="xs">
                  <Tooltip label="Resolve">
                    <IconButton
                      tone="success"
                      onClick={() =>
                        resolveAlertMut.mutate({ id: r.id, body: { was_false_alarm: false } })
                      }
                      aria-label="Resolve"
                    >
                      <IconCheck size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip label="False Alarm">
                    <IconButton
                      tone="default"
                      onClick={() =>
                        resolveAlertMut.mutate({
                          id: r.id,
                          body: { was_false_alarm: true, resolution_notes: "False alarm" },
                        })
                      }
                      aria-label="False Alarm"
                    >
                      <IconX size={16} />
                    </IconButton>
                  </Tooltip>
                </Group>
              ) : (
                <Text c="dimmed">—</Text>
              ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      <Text fw={600} size="lg">
        Active Patient Tags
      </Text>
      <Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpen}>
            Activate Tag
          </Button>
        )}
      </Group>
      <DataTable columns={tagColumns} data={tags} loading={tagsLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">
        Tag Alerts
      </Text>
      <DataTable
        columns={alertColumns}
        data={alerts}
        loading={alertsLoading}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={opened}
        onClose={close}
        title="Activate Patient Safety Tag"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={tagForm.handleSubmit((values) => createTagMut.mutate(values))}
        >
          <Controller
            control={tagForm.control}
            name="patient_id"
            render={({ field, fieldState }) => (
              <PatientSearchSelect
                value={field.value}
                onChange={field.onChange}
                required
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={tagForm.control}
            name="tag_type"
            render={({ field, fieldState }) => (
              <Select
                label="Tag Type"
                required
                data={TAG_TYPES}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Tag Identifier"
            {...tagForm.register("tag_identifier")}
            error={tagForm.formState.errors.tag_identifier?.message}
          />
          <Controller
            control={tagForm.control}
            name="allowed_zone_id"
            render={({ field, fieldState }) => (
              <Select
                label="Allowed Zone"
                data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={tagForm.control}
            name="mother_id"
            render={({ field }) => (
              <PatientSearchSelect
                label="Mother (for infant tags)"
                value={field.value}
                onChange={field.onChange}
                error={tagForm.formState.errors.mother_id?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createTagMut.isPending}>
            Activate Tag
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Code Debriefs Tab
// ══════════════════════════════════════════════════════════
