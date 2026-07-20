// Ambulance TripsTab — split from ambulance.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { AmbulanceTripFormInput } from "@medbrains/schemas";
import { ambulanceTripFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AmbulanceDriverRow,
  AmbulanceRow,
  AmbulanceTripRow,
  AmbulanceTripStatus,
  CreateAmbulanceTripRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlayerPlay, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  ambulanceOptionalText,
  ambulanceTripPriorityOptions,
  ambulanceTripTypeOptions,
} from "@/forms/ambulance.form";
import { ambulanceService } from "@/services/ambulance.service";

const TRIP_TYPE_COLORS: Record<string, BadgeTone> = {
  emergency: "danger",
  scheduled: "info",
  inter_facility: "success",
  discharge: "success",
};

const PRIORITY_COLORS: Record<string, BadgeTone> = {
  critical: "danger",
  urgent: "warning",
  routine: "info",
};

const TRIP_STATUS_COLORS: Record<AmbulanceTripStatus, BadgeTone> = {
  requested: "neutral",
  dispatched: "info",
  en_route_pickup: "info",
  at_pickup: "success",
  en_route_drop: "accent",
  at_drop: "accent",
  completed: "success",
  cancelled: "danger",
};

const emptyTripForm: AmbulanceTripFormInput = {
  trip_type: "emergency",
  priority: "routine",
  ambulance_id: "",
  driver_id: "",
  patient_name: "",
  patient_phone: "",
  pickup_address: "",
  drop_address: "",
};

export function TripsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.AMBULANCE.TRIPS_CREATE);
  const canUpdate = useHasPermission(P.AMBULANCE.TRIPS_UPDATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AmbulanceTripFormInput>({
    resolver: zodResolver(ambulanceTripFormSchema),
    defaultValues: emptyTripForm,
  });

  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances"],
    queryFn: () => ambulanceService.listAmbulances({ status: "available" }),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["ambulance-drivers-active"],
    queryFn: () => ambulanceService.listAmbulanceDrivers({ is_active: true }),
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulance-trips", statusFilter, typeFilter],
    queryFn: () =>
      ambulanceService.listAmbulanceTrips({
        status: statusFilter ?? undefined,
        trip_type: typeFilter ?? undefined,
      }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceTripRequest) => ambulanceService.createAmbulanceTrip(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulance-trips"] });
      void qc.invalidateQueries({ queryKey: ["ambulances"] });
      close();
      notifications.show({ title: "Trip created", message: "Trip booked", color: "green" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not create trip", message: e.message, color: "red" }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AmbulanceTripStatus }) =>
      ambulanceService.updateAmbulanceTripStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulance-trips"] });
      void qc.invalidateQueries({ queryKey: ["ambulances"] });
      notifications.show({
        title: "Status updated",
        message: "Trip status changed",
        color: "blue",
      });
    },
    onError: (e: Error) =>
      notifications.show({
        title: "Could not update trip status",
        message: e.message,
        color: "red",
      }),
  });

  const getNextStatus = (current: AmbulanceTripStatus): AmbulanceTripStatus | null => {
    const flow: Partial<Record<AmbulanceTripStatus, AmbulanceTripStatus>> = {
      requested: "dispatched",
      dispatched: "en_route_pickup",
      en_route_pickup: "at_pickup",
      at_pickup: "en_route_drop",
      en_route_drop: "at_drop",
      at_drop: "completed",
    };
    return flow[current] ?? null;
  };

  const columns: Column<AmbulanceTripRow>[] = [
    {
      key: "trip_code",
      label: "Trip Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.trip_code}
        </Text>
      ),
    },
    {
      key: "trip_type",
      label: "Type",
      render: (r) => (
        <Badge size="sm" tone={TRIP_TYPE_COLORS[r.trip_type] ?? "neutral"}>
          {r.trip_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge size="sm" tone={PRIORITY_COLORS[r.priority] ?? "neutral"}>
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={TRIP_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "patient_name",
      label: "Patient",
      render: (r) => <Text size="sm">{r.patient_name ?? "—"}</Text>,
    },
    {
      key: "pickup_address",
      label: "Pickup",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.pickup_address}
        </Text>
      ),
    },
    {
      key: "drop_address",
      label: "Drop",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.drop_address ?? "—"}
        </Text>
      ),
    },
    {
      key: "response_time",
      label: "Response",
      render: (r) => {
        if (!r.dispatched_at || !r.pickup_arrived_at) return <Text size="sm">—</Text>;
        const mins = Math.round(
          (new Date(r.pickup_arrived_at).getTime() - new Date(r.dispatched_at).getTime()) / 60000,
        );
        return (
          <Badge size="sm" tone={mins <= 15 ? "success" : mins <= 30 ? "warning" : "danger"}>
            {mins}m
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        if (!canUpdate) return null;
        const next = getNextStatus(r.status);
        if (!next) return null;
        return (
          <Group gap={4}>
            <Tooltip label={next.replace(/_/g, " ")}>
              <IconButton
                tone="primary"
                size="sm"
                onClick={() => statusMut.mutate({ id: r.id, status: next })}
                aria-label="Play"
              >
                <IconPlayerPlay size={14} />
              </IconButton>
            </Tooltip>
            {r.status !== "completed" && r.status !== "cancelled" && (
              <Tooltip label="Cancel">
                <IconButton
                  tone="danger"
                  size="sm"
                  onClick={() => statusMut.mutate({ id: r.id, status: "cancelled" })}
                  aria-label="Cancel"
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <Select
            placeholder="Status"
            clearable
            value={statusFilter}
            onChange={setStatusFilter}
            data={Object.keys(TRIP_STATUS_COLORS).map((s) => ({
              value: s,
              label: s.replace(/_/g, " "),
            }))}
            w={180}
          />
          <Select
            placeholder="Type"
            clearable
            value={typeFilter}
            onChange={setTypeFilter}
            data={Object.keys(TRIP_TYPE_COLORS).map((s) => ({
              value: s,
              label: s.replace(/_/g, " "),
            }))}
            w={160}
          />
        </Group>
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(emptyTripForm);
              open();
            }}
          >
            New Trip
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer
        opened={opened}
        onClose={close}
        title="Book Ambulance Trip"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={handleSubmit((values) =>
            createMut.mutate({
              trip_type: values.trip_type,
              priority: values.priority,
              ambulance_id: ambulanceOptionalText(values.ambulance_id),
              driver_id: ambulanceOptionalText(values.driver_id),
              patient_name: ambulanceOptionalText(values.patient_name),
              patient_phone: ambulanceOptionalText(values.patient_phone),
              pickup_address: values.pickup_address.trim(),
              drop_address: ambulanceOptionalText(values.drop_address),
            }),
          )}
        >
          <Controller
            name="trip_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Trip Type"
                required
                data={ambulanceTripTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "emergency")}
                error={errors.trip_type?.message}
              />
            )}
          />
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select
                label="Priority"
                data={ambulanceTripPriorityOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "routine")}
                error={errors.priority?.message}
              />
            )}
          />
          <Controller
            name="ambulance_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Ambulance"
                clearable
                searchable
                data={ambulances.map((a: AmbulanceRow) => ({
                  value: a.id,
                  label: `${a.ambulance_code} (${a.ambulance_type.toUpperCase()})`,
                }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
              />
            )}
          />
          <Controller
            name="driver_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Driver"
                clearable
                searchable
                data={drivers.map((d: AmbulanceDriverRow) => ({
                  value: d.employee_id,
                  label: `${d.license_number} (${d.license_type})`,
                }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
              />
            )}
          />
          <Controller
            name="patient_name"
            control={control}
            render={({ field }) => <TextInput label="Patient Name" {...field} />}
          />
          <Controller
            name="patient_phone"
            control={control}
            render={({ field }) => (
              <TextInput label="Patient Phone" {...field} error={errors.patient_phone?.message} />
            )}
          />
          <Controller
            name="pickup_address"
            control={control}
            render={({ field }) => (
              <Textarea
                label="Pickup Address"
                required
                {...field}
                error={errors.pickup_address?.message}
              />
            )}
          />
          <Controller
            name="drop_address"
            control={control}
            render={({ field }) => <Textarea label="Drop Address" {...field} />}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Book Trip
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Drivers Tab ─────────────────────────────────────────
