// Ambulance MaintenanceTab — split from ambulance.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { AmbulanceMaintenanceFormInput } from "@medbrains/schemas";
import { ambulanceMaintenanceFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AmbulanceMaintenanceRow,
  AmbulanceMaintenanceStatus,
  AmbulanceRow,
  CreateAmbulanceMaintenanceRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlayerPlay, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  ambulanceMaintenanceTypeOptions,
  ambulanceOptionalNumber,
  ambulanceOptionalText,
} from "@/forms/ambulance.form";
import { ambulanceService } from "@/services/ambulance.service";
import { toDateInputValue, toIsoDateInputValue } from "./shared";

const MAINT_STATUS_COLORS: Record<AmbulanceMaintenanceStatus, BadgeTone> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  overdue: "danger",
  cancelled: "neutral",
};

const emptyMaintenanceForm: AmbulanceMaintenanceFormInput = {
  ambulance_id: "",
  maintenance_type: "routine_service",
  scheduled_date: "",
  description: "",
  vendor_name: "",
  cost: "",
};

export function MaintenanceTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.AMBULANCE.MAINTENANCE_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AmbulanceMaintenanceFormInput>({
    resolver: zodResolver(ambulanceMaintenanceFormSchema),
    defaultValues: emptyMaintenanceForm,
  });

  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances"],
    queryFn: () => ambulanceService.listAmbulances(),
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulance-maintenance", statusFilter],
    queryFn: () => ambulanceService.listAmbulanceMaintenance({ status: statusFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceMaintenanceRequest) =>
      ambulanceService.createAmbulanceMaintenance(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulance-maintenance"] });
      close();
      notifications.show({ title: "Scheduled", message: "Maintenance scheduled", color: "green" });
    },
    onError: (e: Error) =>
      notifications.show({
        title: "Could not schedule maintenance",
        message: e.message,
        color: "red",
      }),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AmbulanceMaintenanceStatus }) =>
      ambulanceService.updateAmbulanceMaintenanceStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulance-maintenance"] });
      notifications.show({ title: "Updated", message: "Maintenance updated", color: "blue" });
    },
    onError: (e: Error) =>
      notifications.show({
        title: "Could not update maintenance",
        message: e.message,
        color: "red",
      }),
  });

  const columns: Column<AmbulanceMaintenanceRow>[] = [
    {
      key: "ambulance_id",
      label: "Ambulance",
      render: (r) => {
        const a = ambulances.find((x: AmbulanceRow) => x.id === r.ambulance_id);
        return <Text size="sm">{a?.ambulance_code ?? r.ambulance_id.slice(0, 8)}</Text>;
      },
    },
    {
      key: "maintenance_type",
      label: "Type",
      render: (r) => (
        <Badge size="sm" tone="neutral" variant="light">
          {r.maintenance_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "scheduled_date",
      label: "Scheduled",
      render: (r) => <Text size="sm">{r.scheduled_date}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={MAINT_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "cost",
      label: "Cost",
      render: (r) => <Text size="sm">{r.cost != null ? `₹${r.cost}` : "—"}</Text>,
    },
    {
      key: "vendor_name",
      label: "Vendor",
      render: (r) => <Text size="sm">{r.vendor_name ?? "—"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        if (!canManage || r.status === "completed" || r.status === "cancelled") return null;
        const next = r.status === "scheduled" ? "in_progress" : "completed";
        return (
          <Group gap={4}>
            <Tooltip label={next === "in_progress" ? "Start" : "Complete"}>
              <IconButton
                tone="primary"
                size="sm"
                onClick={() => updateStatusMut.mutate({ id: r.id, status: next })}
                aria-label={next === "in_progress" ? "Start" : "Complete"}
              >
                {next === "in_progress" ? <IconPlayerPlay size={14} /> : <IconCheck size={14} />}
              </IconButton>
            </Tooltip>
          </Group>
        );
      },
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={Object.keys(MAINT_STATUS_COLORS).map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          }))}
          w={200}
        />
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(emptyMaintenanceForm);
              open();
            }}
          >
            Schedule Maintenance
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer
        opened={opened}
        onClose={close}
        title="Schedule Maintenance"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={handleSubmit((values) =>
            createMut.mutate({
              ambulance_id: values.ambulance_id,
              maintenance_type: values.maintenance_type,
              scheduled_date: values.scheduled_date,
              description: ambulanceOptionalText(values.description),
              vendor_name: ambulanceOptionalText(values.vendor_name),
              cost: ambulanceOptionalNumber(values.cost),
            }),
          )}
        >
          <Controller
            name="ambulance_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Ambulance"
                required
                searchable
                data={ambulances.map((a: AmbulanceRow) => ({
                  value: a.id,
                  label: a.ambulance_code,
                }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.ambulance_id?.message}
              />
            )}
          />
          <Controller
            name="maintenance_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Type"
                required
                data={ambulanceMaintenanceTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "routine_service")}
                error={errors.maintenance_type?.message}
              />
            )}
          />
          <Controller
            name="scheduled_date"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Scheduled Date"
                required
                value={toDateInputValue(field.value)}
                onChange={(date) => field.onChange(toIsoDateInputValue(date))}
                error={errors.scheduled_date?.message}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => <Textarea label="Description" {...field} />}
          />
          <Controller
            name="vendor_name"
            control={control}
            render={({ field }) => <TextInput label="Vendor" {...field} />}
          />
          <Controller
            name="cost"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Estimated Cost"
                prefix="₹"
                value={field.value}
                onChange={field.onChange}
                error={errors.cost?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Schedule
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Reports Tab ─────────────────────────────────────────
