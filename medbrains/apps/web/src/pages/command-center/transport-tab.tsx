// Command-center TransportTab — split from command-center.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Modal, Select, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  CommandCenterAssignTransportFormInput,
  CommandCenterTransportFormInput,
} from "@medbrains/schemas";
import {
  commandCenterAssignTransportFormSchema,
  commandCenterTransportFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { TransportRequestRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAmbulance, IconCheck, IconClock, IconPlus, IconTruck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, StatCard } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import type { AssignTransportInput, CreateTransportInput } from "@/services/commandCenter.service";
import { commandCenterService } from "@/services/commandCenter.service";
import { REFETCH } from "./shared";

const TRANSPORT_MODES = [
  { value: "wheelchair", label: "Wheelchair" },
  { value: "stretcher", label: "Stretcher" },
  { value: "ambulance", label: "Ambulance" },
  { value: "walking", label: "Walking" },
  { value: "bed", label: "Bed" },
];

const TRANSPORT_PRIORITIES = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
];

const EMPTY_TRANSPORT_FORM: CommandCenterTransportFormInput = {
  patient_id: "",
  from_location_id: "",
  to_location_id: "",
  transport_mode: "wheelchair",
  priority: "routine",
  notes: "",
};
const EMPTY_ASSIGN_TRANSPORT_FORM: CommandCenterAssignTransportFormInput = {
  assigned_to: "",
};

function transportModeColor(m: string): BadgeTone {
  switch (m) {
    case "ambulance":
      return "danger";
    case "stretcher":
      return "warning";
    case "wheelchair":
      return "primary";
    case "bed":
      return "accent";
    default:
      return "neutral";
  }
}

function transportPriorityColor(p: string): BadgeTone {
  switch (p) {
    case "emergency":
      return "danger";
    case "urgent":
      return "warning";
    default:
      return "neutral";
  }
}

function transportStatusColor(s: string): BadgeTone {
  switch (s) {
    case "requested":
      return "primary";
    case "assigned":
      return "info";
    case "in_transit":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formToTransportPayload(form: CommandCenterTransportFormInput): CreateTransportInput {
  return {
    patient_id: optionalTrimmed(form.patient_id),
    from_location_id: form.from_location_id.trim(),
    to_location_id: form.to_location_id.trim(),
    transport_mode: form.transport_mode,
    priority: form.priority,
    notes: optionalTrimmed(form.notes),
  };
}

export function TransportTab() {
  const canManage = useHasPermission(P.COMMAND_CENTER.TRANSPORT.MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [assignModalId, setAssignModalId] = useState<string | null>(null);
  const qc = useQueryClient();
  const {
    control: transportControl,
    formState: { errors: transportErrors },
    handleSubmit: handleTransportSubmit,
    register: registerTransport,
    reset: resetTransport,
  } = useForm<CommandCenterTransportFormInput>({
    resolver: zodResolver(commandCenterTransportFormSchema),
    defaultValues: EMPTY_TRANSPORT_FORM,
  });
  const {
    control: assignControl,
    formState: { errors: assignErrors },
    handleSubmit: handleAssignSubmit,
    reset: resetAssign,
  } = useForm<CommandCenterAssignTransportFormInput>({
    resolver: zodResolver(commandCenterAssignTransportFormSchema),
    defaultValues: EMPTY_ASSIGN_TRANSPORT_FORM,
  });

  const { data: transport, isLoading } = useQuery({
    queryKey: ["command-center", "transport"],
    queryFn: () => commandCenterService.listTransportRequests(),
    refetchInterval: REFETCH,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateTransportInput) => commandCenterService.createTransportRequest(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command-center", "transport"] });
      closeCreate();
      resetTransport(EMPTY_TRANSPORT_FORM);
      notifications.show({ title: "Success", message: "Transport request created" });
    },
  });

  const assignMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignTransportInput }) =>
      commandCenterService.assignTransport(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command-center", "transport"] });
      setAssignModalId(null);
      resetAssign(EMPTY_ASSIGN_TRANSPORT_FORM);
      notifications.show({ title: "Success", message: "Transport assigned" });
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => commandCenterService.completeTransport(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command-center", "transport"] });
      notifications.show({ title: "Success", message: "Transport completed" });
    },
  });

  // Stats
  const all = transport ?? [];
  const active = all.filter((t) => t.status === "requested" || t.status === "assigned").length;
  const inTransit = all.filter((t) => t.status === "in_transit").length;
  const completedToday = all.filter((t) => {
    if (t.status !== "completed" || !t.completed_at) return false;
    const d = new Date(t.completed_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;
  const completedWithTime = all.filter(
    (t) => t.status === "completed" && t.requested_at && t.completed_at,
  );
  const avgResponse =
    completedWithTime.length > 0
      ? completedWithTime.reduce((sum, t) => {
          if (!t.completed_at) return sum;
          const diff = new Date(t.completed_at).getTime() - new Date(t.requested_at).getTime();
          return sum + diff / 60000;
        }, 0) / completedWithTime.length
      : 0;

  const openCreateTransport = () => {
    resetTransport(EMPTY_TRANSPORT_FORM);
    openCreate();
  };

  const closeCreateTransport = () => {
    resetTransport(EMPTY_TRANSPORT_FORM);
    closeCreate();
  };

  const closeAssignTransport = () => {
    setAssignModalId(null);
    resetAssign(EMPTY_ASSIGN_TRANSPORT_FORM);
  };

  const submitTransport = handleTransportSubmit((values) => {
    createMut.mutate(formToTransportPayload(values));
  });

  const submitAssign = handleAssignSubmit((values) => {
    if (assignModalId) {
      assignMut.mutate({ id: assignModalId, data: { assigned_to: values.assigned_to.trim() } });
    }
  });

  const cols: Column<TransportRequestRow>[] = [
    {
      key: "patient",
      label: "Patient",
      render: (r) => <Text size="sm">{r.patient_name ?? "N/A"}</Text>,
    },
    {
      key: "from",
      label: "From",
      render: (r) => <Text size="sm">{r.from_location ?? "-"}</Text>,
    },
    {
      key: "to",
      label: "To",
      render: (r) => <Text size="sm">{r.to_location ?? "-"}</Text>,
    },
    {
      key: "mode",
      label: "Mode",
      render: (r) => (
        <Badge tone={transportModeColor(r.transport_mode)} size="sm" variant="light">
          {r.transport_mode}
        </Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge tone={transportPriorityColor(r.priority)} size="sm" variant="filled">
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={transportStatusColor(r.status)} size="sm" variant="filled">
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "requested_by",
      label: "Requested By",
      render: (r) => <Text size="xs">{r.requested_by_name}</Text>,
    },
    {
      key: "assigned_to",
      label: "Assigned To",
      render: (r) => <Text size="xs">{r.assigned_to_name ?? "-"}</Text>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => {
        if (!canManage) return null;
        return (
          <Group gap={4}>
            {r.status === "requested" && (
              <Button tone="secondary" size="compact-xs" onClick={() => setAssignModalId(r.id)}>
                Assign
              </Button>
            )}
            {r.status === "in_transit" && (
              <Button
                tone="primary"
                size="compact-xs"
                onClick={() => completeMut.mutate(r.id)}
                loading={completeMut.isPending}
              >
                Complete
              </Button>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <Stack gap="md">
      {/* Stats */}
      <SimpleGrid cols={4}>
        <StatCard
          label="Active Requests"
          value={active}
          icon={<IconTruck size={18} />}
          color="primary"
        />
        <StatCard
          label="In Transit"
          value={inTransit}
          icon={<IconAmbulance size={18} />}
          color="warning"
        />
        <StatCard
          label="Completed Today"
          value={completedToday}
          icon={<IconCheck size={18} />}
          color="success"
        />
        <StatCard
          label="Avg Response (min)"
          value={avgResponse.toFixed(0)}
          icon={<IconClock size={18} />}
          color="info"
        />
      </SimpleGrid>

      {/* Transport Table */}
      <DataTable<TransportRequestRow>
        columns={cols}
        data={all.filter((t) => t.status !== "completed" && t.status !== "cancelled")}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyIcon={<IconTruck size={40} />}
        emptyTitle="No active transport requests"
        toolbar={
          canManage ? (
            <Group justify="flex-end">
              <Button
                tone="primary"
                leftSection={<IconPlus size={14} />}
                size="xs"
                onClick={openCreateTransport}
              >
                New Transport Request
              </Button>
            </Group>
          ) : undefined
        }
      />

      {/* Create Transport Modal */}
      <Modal
        opened={createOpen}
        onClose={closeCreateTransport}
        title="New Transport Request"
        size="md"
      >
        <Stack component="form" gap="sm" onSubmit={submitTransport}>
          <Controller
            control={transportControl}
            name="patient_id"
            render={({ field }) => (
              <PatientSearchSelect
                label="Patient (optional)"
                value={field.value}
                onChange={field.onChange}
                error={transportErrors.patient_id?.message}
              />
            )}
          />
          <TextInput
            label="From Location ID"
            required
            error={transportErrors.from_location_id?.message}
            {...registerTransport("from_location_id")}
          />
          <TextInput
            label="To Location ID"
            required
            error={transportErrors.to_location_id?.message}
            {...registerTransport("to_location_id")}
          />
          <Controller
            name="transport_mode"
            control={transportControl}
            render={({ field }) => (
              <Select
                label="Mode"
                data={TRANSPORT_MODES}
                value={field.value}
                onChange={field.onChange}
                error={transportErrors.transport_mode?.message}
              />
            )}
          />
          <Controller
            name="priority"
            control={transportControl}
            render={({ field }) => (
              <Select
                label="Priority"
                data={TRANSPORT_PRIORITIES}
                value={field.value}
                onChange={field.onChange}
                error={transportErrors.priority?.message}
              />
            )}
          />
          <TextInput
            label="Notes"
            error={transportErrors.notes?.message}
            {...registerTransport("notes")}
          />
          <Group justify="flex-end" mt="sm">
            <Button tone="ghost" onClick={closeCreateTransport}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={createMut.isPending}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Assign Modal */}
      <Modal
        opened={assignModalId !== null}
        onClose={closeAssignTransport}
        title="Assign Transport"
        size="sm"
      >
        <Stack component="form" gap="sm" onSubmit={submitAssign}>
          <Controller
            control={assignControl}
            name="assigned_to"
            render={({ field }) => (
              <EmployeeSearchSelect
                label="Assign to"
                required
                value={field.value}
                onChange={field.onChange}
                error={assignErrors.assigned_to?.message}
              />
            )}
          />
          <Group justify="flex-end" mt="sm">
            <Button tone="ghost" onClick={closeAssignTransport}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={assignMut.isPending}>
              Assign
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 5: Alerts & Thresholds
// ══════════════════════════════════════════════════════════
