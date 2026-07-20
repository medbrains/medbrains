// Ambulance FleetTab — split from ambulance.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
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
import type { AmbulanceFleetFormInput } from "@medbrains/schemas";
import { ambulanceFleetFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AmbulanceRow,
  CreateAmbulanceRequest,
  UpdateAmbulanceRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  ambulanceFuelTypeOptions,
  ambulanceOptionalInteger,
  ambulanceOptionalText,
  ambulanceTypeOptions,
  normalizeAmbulanceFuelType,
} from "@/forms/ambulance.form";
import { ambulanceService } from "@/services/ambulance.service";
import { isExpired, isExpiringSoon } from "./shared";

const AMB_STATUS_COLORS: Record<string, BadgeTone> = {
  available: "success",
  on_trip: "info",
  maintenance: "warning",
  off_duty: "neutral",
  decommissioned: "danger",
};

const emptyFleetForm: AmbulanceFleetFormInput = {
  vehicle_number: "",
  ambulance_type: "bls",
  make: "",
  model: "",
  year_of_manufacture: "",
  chassis_number: "",
  engine_number: "",
  fuel_type: "",
  has_ventilator: false,
  has_defibrillator: false,
  has_oxygen: true,
  gps_device_id: "",
  notes: "",
};

function toFleetForm(row: AmbulanceRow): AmbulanceFleetFormInput {
  return {
    vehicle_number: row.vehicle_number,
    ambulance_type: row.ambulance_type,
    make: row.make ?? "",
    model: row.model ?? "",
    year_of_manufacture: row.year_of_manufacture ?? "",
    chassis_number: row.chassis_number ?? "",
    engine_number: row.engine_number ?? "",
    fuel_type: normalizeAmbulanceFuelType(row.fuel_type),
    has_ventilator: row.has_ventilator,
    has_defibrillator: row.has_defibrillator,
    has_oxygen: row.has_oxygen,
    gps_device_id: row.gps_device_id ?? "",
    notes: row.notes ?? "",
  };
}

export function FleetTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.AMBULANCE.FLEET_CREATE);
  const canUpdate = useHasPermission(P.AMBULANCE.FLEET_UPDATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<AmbulanceRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AmbulanceFleetFormInput>({
    resolver: zodResolver(ambulanceFleetFormSchema),
    defaultValues: emptyFleetForm,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulances", statusFilter],
    queryFn: () => ambulanceService.listAmbulances({ status: statusFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceRequest) => ambulanceService.createAmbulance(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulances"] });
      close();
      notifications.show({ title: "Ambulance added", message: "Fleet updated", color: "green" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not add ambulance", message: e.message, color: "red" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAmbulanceRequest }) =>
      ambulanceService.updateAmbulance(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulances"] });
      close();
      setEditing(null);
      notifications.show({ title: "Updated", message: "Ambulance updated", color: "green" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not update ambulance", message: e.message, color: "red" }),
  });

  const columns: Column<AmbulanceRow>[] = [
    {
      key: "ambulance_code",
      label: "Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.ambulance_code}
        </Text>
      ),
    },
    {
      key: "vehicle_number",
      label: "Vehicle #",
      render: (r) => <Text size="sm">{r.vehicle_number}</Text>,
    },
    {
      key: "ambulance_type",
      label: "Type",
      render: (r) => (
        <Badge size="sm" tone="neutral" variant="light">
          {r.ambulance_type.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={AMB_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "make",
      label: "Make/Model",
      render: (r) => <Text size="sm">{[r.make, r.model].filter(Boolean).join(" ") || "—"}</Text>,
    },
    {
      key: "certificates",
      label: "Certificates",
      render: (r) => {
        const certs = [
          { label: "Fitness", d: r.fitness_certificate_expiry },
          { label: "Insurance", d: r.insurance_expiry },
          { label: "PUC", d: r.pollution_certificate_expiry },
          { label: "Permit", d: r.permit_expiry },
        ];
        const issues = certs.filter((c) => isExpired(c.d) || isExpiringSoon(c.d));
        if (issues.length === 0)
          return (
            <Badge size="xs" tone="success">
              OK
            </Badge>
          );
        return (
          <Group gap={4}>
            {issues.map((c) => (
              <Tooltip
                key={c.label}
                label={`${c.label}: ${isExpired(c.d) ? "EXPIRED" : "Expiring soon"}`}
              >
                <Badge size="xs" tone={isExpired(c.d) ? "danger" : "warning"}>
                  {c.label}
                </Badge>
              </Tooltip>
            ))}
          </Group>
        );
      },
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate ? (
          <IconButton
            size="sm"
            onClick={() => {
              setEditing(r);
              reset(toFleetForm(r));
              open();
            }}
            aria-label="Edit"
          >
            <IconPencil size={14} />
          </IconButton>
        ) : null,
    },
  ];

  const submitFleet = (values: AmbulanceFleetFormInput) => {
    const payload: CreateAmbulanceRequest = {
      vehicle_number: values.vehicle_number.trim(),
      ambulance_type: values.ambulance_type,
      make: ambulanceOptionalText(values.make),
      model: ambulanceOptionalText(values.model),
      year_of_manufacture: ambulanceOptionalInteger(values.year_of_manufacture),
      chassis_number: ambulanceOptionalText(values.chassis_number),
      engine_number: ambulanceOptionalText(values.engine_number),
      fuel_type: values.fuel_type || undefined,
      has_ventilator: values.has_ventilator,
      has_defibrillator: values.has_defibrillator,
      has_oxygen: values.has_oxygen,
      gps_device_id: ambulanceOptionalText(values.gps_device_id),
      notes: ambulanceOptionalText(values.notes),
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={Object.keys(AMB_STATUS_COLORS).map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          }))}
          w={200}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null);
              reset(emptyFleetForm);
              open();
            }}
          >
            Add Ambulance
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setEditing(null);
        }}
        title={editing ? "Edit Ambulance" : "Add Ambulance"}
        position="right"
        size="md"
      >
        <Stack component="form" onSubmit={handleSubmit(submitFleet)}>
          <Controller
            name="vehicle_number"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Vehicle Number"
                required
                {...field}
                error={errors.vehicle_number?.message}
              />
            )}
          />
          <Controller
            name="ambulance_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Type"
                required
                data={ambulanceTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "bls")}
                error={errors.ambulance_type?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              name="make"
              control={control}
              render={({ field }) => <TextInput label="Make" {...field} />}
            />
            <Controller
              name="model"
              control={control}
              render={({ field }) => <TextInput label="Model" {...field} />}
            />
          </Group>
          <Controller
            name="year_of_manufacture"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Year"
                value={field.value}
                onChange={field.onChange}
                error={errors.year_of_manufacture?.message}
              />
            )}
          />
          <Controller
            name="chassis_number"
            control={control}
            render={({ field }) => <TextInput label="Chassis #" {...field} />}
          />
          <Controller
            name="engine_number"
            control={control}
            render={({ field }) => <TextInput label="Engine #" {...field} />}
          />
          <Controller
            name="fuel_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Fuel Type"
                data={ambulanceFuelTypeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.fuel_type?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              name="has_ventilator"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Ventilator"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
            <Controller
              name="has_defibrillator"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Defibrillator"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
            <Controller
              name="has_oxygen"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Oxygen"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
          </Group>
          <Controller
            name="gps_device_id"
            control={control}
            render={({ field }) => <TextInput label="GPS Device ID" {...field} />}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending || updateMut.isPending}>
            {editing ? "Update" : "Create"}
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Trips Tab ───────────────────────────────────────────
