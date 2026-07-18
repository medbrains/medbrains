// Emergency MassCasualtyTab — split from emergency.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
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
import { useDisclosure } from "@mantine/hooks";
import type {
  MassCasualtyEventFormInput,
  MassCasualtyEventUpdateFormInput,
} from "@medbrains/schemas";
import { massCasualtyEventFormSchema, massCasualtyEventUpdateFormSchema } from "@medbrains/schemas";
import type {
  CreateMassCasualtyEventRequest,
  MassCasualtyEvent,
  UpdateMassCasualtyEventRequest,
} from "@medbrains/types";
import { IconBell, IconCheck, IconPencil, IconUsers } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { Alert, Button, IconButton, toast } from "@/components/ui";
import {
  emergencyMassCasualtyStatusOptions,
  emergencyMassCasualtyTypeOptions,
  emergencyOptionalInteger,
  emergencyOptionalText,
} from "@/forms/emergency.form";
import { emergencyService } from "@/services/emergency.service";

const emptyMassCasualtyEventForm: MassCasualtyEventFormInput = {
  event_name: "",
  event_type: "",
  location: "",
  estimated_casualties: "",
  notes: "",
};

const emptyMassCasualtyEventUpdateForm: MassCasualtyEventUpdateFormInput = {
  status: "ongoing",
  actual_casualties: "",
  notes: "",
};

export function MassCasualtyTab({
  canView,
  canCreate,
  canUpdate,
  canClose,
}: {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canClose: boolean;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [updateOpened, { open: openUpdate, close: closeUpdate }] = useDisclosure(false);
  const [eventToUpdate, setEventToUpdate] = useState<MassCasualtyEvent | null>(null);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["mass-casualty"],
    queryFn: () => emergencyService.listMassCasualtyEvents(),
    enabled: canView,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MassCasualtyEventFormInput>({
    resolver: zodResolver(massCasualtyEventFormSchema),
    defaultValues: emptyMassCasualtyEventForm,
  });
  const {
    control: updateControl,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdate,
    formState: { errors: updateErrors },
  } = useForm<MassCasualtyEventUpdateFormInput>({
    resolver: zodResolver(massCasualtyEventUpdateFormSchema),
    defaultValues: emptyMassCasualtyEventUpdateForm,
  });
  const mutation = useMutation({
    mutationFn: (d: CreateMassCasualtyEventRequest) => emergencyService.createMassCasualtyEvent(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mass-casualty"] });
      close();
      toast.error("Mass casualty event activated", { title: "Code Yellow" });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }: { id: string; data: UpdateMassCasualtyEventRequest }) =>
      emergencyService.updateMassCasualtyEvent(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mass-casualty"] });
      closeUpdate();
      setEventToUpdate(null);
      resetUpdate(emptyMassCasualtyEventUpdateForm);
      toast.success("Mass casualty event status updated", { title: "Mass Casualty Updated" });
    },
  });

  const submitMassCasualtyEvent = (values: MassCasualtyEventFormInput) => {
    mutation.mutate({
      event_name: values.event_name.trim(),
      event_type: values.event_type || undefined,
      location: emergencyOptionalText(values.location),
      estimated_casualties: emergencyOptionalInteger(values.estimated_casualties),
      notes: emergencyOptionalText(values.notes),
    });
  };

  const editableMassCasualtyStatus = (
    status: MassCasualtyEvent["status"],
  ): MassCasualtyEventUpdateFormInput["status"] => {
    switch (status) {
      case "activated":
      case "ongoing":
      case "scaling_down":
        return status;
      case "deactivated":
        return "scaling_down";
    }
  };

  const handleOpenUpdate = (event: MassCasualtyEvent) => {
    setEventToUpdate(event);
    resetUpdate({
      status: editableMassCasualtyStatus(event.status),
      actual_casualties: event.actual_casualties ?? event.estimated_casualties ?? "",
      notes: event.notes ?? "",
    });
    openUpdate();
  };

  const handleCloseUpdate = () => {
    closeUpdate();
    setEventToUpdate(null);
    resetUpdate(emptyMassCasualtyEventUpdateForm);
  };

  const submitMassCasualtyUpdate = (values: MassCasualtyEventUpdateFormInput) => {
    if (!eventToUpdate) {
      return;
    }
    updateMutation.mutate({
      id: eventToUpdate.id,
      data: {
        status: values.status,
        actual_casualties: emergencyOptionalInteger(values.actual_casualties),
        notes: emergencyOptionalText(values.notes),
      },
    });
  };

  const deactivateMassCasualtyEvent = (event: MassCasualtyEvent) => {
    if (!canClose || event.status === "deactivated") return;
    const actualCasualties = event.actual_casualties ?? event.estimated_casualties;
    const payload: UpdateMassCasualtyEventRequest = {
      status: "deactivated",
      notes: "Deactivated from emergency dashboard",
    };
    if (actualCasualties !== null) {
      payload.actual_casualties = actualCasualties;
    }
    updateMutation.mutate({
      id: event.id,
      data: payload,
    });
  };

  const mcStatusColor = (s: string) => {
    switch (s) {
      case "activated":
        return "danger";
      case "ongoing":
        return "orange";
      case "scaling_down":
        return "warning";
      case "deactivated":
        return "success";
      default:
        return "gray";
    }
  };

  const columns = [
    {
      key: "event_name",
      label: "Event",
      render: (r: MassCasualtyEvent) => <Text fw={600}>{r.event_name}</Text>,
    },
    {
      key: "event_type",
      label: "Type",
      render: (r: MassCasualtyEvent) =>
        r.event_type ? <TableValueBadge value={r.event_type} kind="priority" /> : "---",
    },
    {
      key: "status",
      label: "Status",
      render: (r: MassCasualtyEvent) => (
        <TableValueBadge value={r.status} color={mcStatusColor(r.status)} variant="filled" />
      ),
    },
    {
      key: "activated_at",
      label: "Activated",
      render: (r: MassCasualtyEvent) => new Date(r.activated_at).toLocaleString(),
    },
    {
      key: "estimated_casualties",
      label: "Est. Casualties",
      render: (r: MassCasualtyEvent) => r.estimated_casualties ?? "---",
    },
    {
      key: "actual_casualties",
      label: "Actual",
      render: (r: MassCasualtyEvent) => r.actual_casualties ?? "---",
    },
    { key: "location", label: "Location", render: (r: MassCasualtyEvent) => r.location ?? "---" },
    ...(canUpdate || canClose
      ? [
          {
            key: "actions",
            label: "Actions",
            render: (r: MassCasualtyEvent) => (
              <Group gap="xs">
                {canUpdate && r.status !== "deactivated" && (
                  <Tooltip label="Update response">
                    <IconButton
                      tone="primary"
                      aria-label="Update mass casualty response"
                      disabled={updateMutation.isPending}
                      onClick={() => handleOpenUpdate(r)}
                    >
                      <IconPencil size={16} />
                    </IconButton>
                  </Tooltip>
                )}
                {canClose && (
                  <Tooltip
                    label={r.status === "deactivated" ? "Already deactivated" : "Deactivate event"}
                  >
                    <IconButton
                      tone="success"
                      aria-label="Deactivate mass casualty event"
                      disabled={r.status === "deactivated" || updateMutation.isPending}
                      onClick={() => deactivateMassCasualtyEvent(r)}
                    >
                      <IconCheck size={16} />
                    </IconButton>
                  </Tooltip>
                )}
              </Group>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button
            tone="danger"
            leftSection={<IconBell size={16} />}
            onClick={() => {
              reset(emptyMassCasualtyEventForm);
              open();
            }}
          >
            Activate Mass Casualty
          </Button>
        </Group>
      )}
      {canView ? (
        <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Mass casualty event list is not available for your role. You can activate a new event
            when creation is allowed.
          </Text>
        </Card>
      )}

      <Drawer
        opened={updateOpened}
        onClose={handleCloseUpdate}
        title={eventToUpdate ? `Update ${eventToUpdate.event_name}` : "Update Mass Casualty Event"}
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={handleUpdateSubmit(submitMassCasualtyUpdate)}>
          {eventToUpdate && (
            <Alert tone="warning" icon={<IconUsers size={16} />}>
              <Text size="sm" fw={600}>
                {eventToUpdate.event_name}
              </Text>
              <Text size="sm" c="dimmed">
                {eventToUpdate.location ?? "Location not recorded"} - activated{" "}
                {new Date(eventToUpdate.activated_at).toLocaleString()}
              </Text>
            </Alert>
          )}
          <Controller
            name="status"
            control={updateControl}
            render={({ field }) => (
              <Select
                label="Response status"
                required
                data={emergencyMassCasualtyStatusOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "ongoing")}
                error={updateErrors.status?.message}
              />
            )}
          />
          <Controller
            name="actual_casualties"
            control={updateControl}
            render={({ field }) => (
              <NumberInput
                label="Actual casualties"
                value={field.value}
                onChange={field.onChange}
                error={updateErrors.actual_casualties?.message}
              />
            )}
          />
          <Controller
            name="notes"
            control={updateControl}
            render={({ field }) => (
              <Textarea
                label="Operational notes"
                placeholder="Triage summary, resources deployed, notifications completed"
                minRows={4}
                {...field}
              />
            )}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleCloseUpdate}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={updateMutation.isPending}>
              Save Update
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <Drawer
        opened={opened}
        onClose={close}
        title="Activate Mass Casualty Event"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(submitMassCasualtyEvent)}>
          <Controller
            name="event_name"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Event Name"
                required
                {...field}
                error={errors.event_name?.message}
              />
            )}
          />
          <Controller
            name="event_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Event Type"
                data={emergencyMassCasualtyTypeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.event_type?.message}
              />
            )}
          />
          <Controller
            name="location"
            control={control}
            render={({ field }) => <TextInput label="Location" {...field} />}
          />
          <Controller
            name="estimated_casualties"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Estimated Casualties"
                value={field.value}
                onChange={field.onChange}
                error={errors.estimated_casualties?.message}
              />
            )}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="danger" type="submit" loading={mutation.isPending}>
            Activate Mass Casualty
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
