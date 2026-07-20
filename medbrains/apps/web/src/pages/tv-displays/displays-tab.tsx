// TV-Displays DisplaysTab — split from tv-displays.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { TvDisplayFormInput } from "@medbrains/schemas";
import { tvDisplayFormSchema } from "@medbrains/schemas";
import type {
  CreateTvDisplayRequest,
  DepartmentRow,
  TvDisplay,
  UpdateTvDisplayRequest,
} from "@medbrains/types";
import { TOKEN_BOARD_SURFACE_LIST } from "@medbrains/types";
import { IconExternalLink, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import {
  defaultTvDisplayFormValues,
  tvDisplayAllowsPatientNames,
  tvDisplayFormToCreateRequest,
  tvDisplayFormToUpdateRequest,
  tvDisplayToForm,
} from "@/forms/tv-displays.form";
import { confirmDestructive } from "@/lib/confirm";
import { tvDisplaysService } from "@/services/tvDisplays.service";
import { displayLaunchTarget } from "./shared";

const DISPLAY_TYPES = [
  ...TOKEN_BOARD_SURFACE_LIST.map((surface) => ({
    value: surface.targets.tvDisplayType,
    label: surface.title,
  })),
  { value: "bed_status", label: "Bed Status Board" },
  { value: "digital_signage", label: "Digital Signage" },
  { value: "dashboard", label: "Dashboard" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" },
  { value: "bn", label: "Bengali" },
];

const displayTypeLabels: Record<string, string> = {
  ...Object.fromEntries(
    TOKEN_BOARD_SURFACE_LIST.map((surface) => [surface.targets.tvDisplayType, surface.title]),
  ),
  bed_status: "Bed Status",
  digital_signage: "Signage",
  dashboard: "Dashboard",
};

export function DisplaysTab({
  canCreate,
  canUpdate,
  canDelete,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedDisplay, setSelectedDisplay] = useState<TvDisplay | null>(null);
  const displayForm = useForm<TvDisplayFormInput>({
    resolver: zodResolver(tvDisplayFormSchema),
    defaultValues: defaultTvDisplayFormValues,
  });
  const selectedDisplayType = displayForm.watch("display_type");
  const canShowPatientNames = tvDisplayAllowsPatientNames(selectedDisplayType);

  const { data: displays = [], isLoading } = useQuery({
    queryKey: ["tv-displays"],
    queryFn: () => tvDisplaysService.listTvDisplays(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => tvDisplaysService.listDepartments(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTvDisplayRequest) => tvDisplaysService.createTvDisplay(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tv-displays"] });
      toast.success("Display created", { title: "Success" });
      close();
    },
    onError: () => {
      toast.error("Failed to create display", { title: "Error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTvDisplayRequest }) =>
      tvDisplaysService.updateTvDisplay(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tv-displays"] });
      toast.success("Display updated", { title: "Success" });
      close();
    },
    onError: () => {
      toast.error("Failed to update display", { title: "Error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tvDisplaysService.deleteTvDisplay(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tv-displays"] });
      toast.success("Display deleted", { title: "Success" });
    },
    onError: () => {
      toast.error("Failed to delete display", { title: "Error" });
    },
  });

  const columns: Column<TvDisplay>[] = [
    { key: "location_name", label: "Location", render: (row) => row.location_name },
    {
      key: "display_type",
      label: "Type",
      render: (row) => (
        <Badge tone="primary">{displayTypeLabels[row.display_type] || row.display_type}</Badge>
      ),
    },
    {
      key: "department_id",
      label: "Department",
      render: (row) => {
        const dept = departments.find((d: DepartmentRow) => d.id === row.department_id);
        return dept?.name || "All";
      },
    },
    {
      key: "launch_target",
      label: "Launch Target",
      render: (row) => {
        const target = displayLaunchTarget(row.display_type, row.department_id);
        if (!target) return <Text c="dimmed">Not linked</Text>;
        return (
          <Stack gap={2}>
            <Group gap="xs">
              <Text size="sm" fw={600}>
                {target.label}
              </Text>
              {target.appCodes.map((appCode) => (
                <Badge key={appCode} tone="neutral" size="xs">
                  {appCode}
                </Badge>
              ))}
            </Group>
            <Text size="xs" c="dimmed">
              {target.href}
            </Text>
          </Stack>
        );
      },
    },
    {
      key: "language",
      label: "Languages",
      render: (row) => (
        <Group gap="xs">
          {row.language.map((lang) => (
            <Badge key={lang} tone="neutral" size="xs" variant="outline">
              {lang.toUpperCase()}
            </Badge>
          ))}
        </Group>
      ),
    },
    {
      key: "show_patient_name",
      label: "Options",
      render: (row) => {
        const patientNamesAllowed = tvDisplayAllowsPatientNames(row.display_type);
        return (
          <Group gap="xs">
            {patientNamesAllowed && row.show_patient_name && (
              <Badge tone="warning" size="xs">
                Names enabled
              </Badge>
            )}
            {(!patientNamesAllowed || !row.show_patient_name) && (
              <Badge tone="success" size="xs">
                Token-only
              </Badge>
            )}
            {!patientNamesAllowed && row.show_patient_name && (
              <Badge tone="danger" size="xs">
                Names blocked
              </Badge>
            )}
            {row.show_wait_time && (
              <Badge tone="primary" size="xs">
                Wait
              </Badge>
            )}
            {row.announcement_enabled && (
              <Badge tone="warning" size="xs">
                Announcements
              </Badge>
            )}
          </Group>
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (row) => {
        const target = displayLaunchTarget(row.display_type, row.department_id);
        return (
          <Group gap="xs">
            {target && (
              <Tooltip label={`Open ${target.label}`}>
                <IconButton
                  onClick={() => {
                    window.location.href = target.href;
                  }}
                  tone="default"
                  aria-label={`Open ${target.label}`}
                >
                  <IconExternalLink size={16} />
                </IconButton>
              </Tooltip>
            )}
            {canUpdate && (
              <Tooltip label="Edit">
                <IconButton
                  tone="default"
                  onClick={() => {
                    setSelectedDisplay(row);
                    displayForm.reset(tvDisplayToForm(row));
                    open();
                  }}
                  aria-label="Edit"
                >
                  <IconPencil size={16} />
                </IconButton>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip label="Delete">
                <IconButton
                  tone="danger"
                  onClick={() =>
                    confirmDestructive({
                      title: "Delete",
                      message: "Permanently delete this record? This cannot be undone.",
                      onConfirm: () => deleteMutation.mutate(row.id),
                    })
                  }
                  aria-label="Delete"
                >
                  <IconTrash size={16} />
                </IconButton>
              </Tooltip>
            )}
          </Group>
        );
      },
    },
  ];

  const handleSubmit = displayForm.handleSubmit((values) => {
    if (selectedDisplay) {
      updateMutation.mutate({
        id: selectedDisplay.id,
        data: tvDisplayFormToUpdateRequest(values),
      });
    } else {
      createMutation.mutate(tvDisplayFormToCreateRequest(values));
    }
  });

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setSelectedDisplay(null);
              displayForm.reset(defaultTvDisplayFormValues);
              open();
            }}
          >
            Add Display
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={displays} loading={isLoading} rowKey={(row) => row.id} />

      <Drawer
        opened={opened}
        onClose={close}
        title={selectedDisplay ? "Edit Display" : "Add Display"}
        position="right"
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Location Name"
              placeholder="e.g., OPD Waiting Hall"
              error={displayForm.formState.errors.location_name?.message}
              {...displayForm.register("location_name")}
              required
            />
            <Controller
              control={displayForm.control}
              name="display_type"
              render={({ field, fieldState }) => (
                <Select
                  label="Display Type"
                  data={DISPLAY_TYPES}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "opd_queue")}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="department_id"
              render={({ field, fieldState }) => (
                <Select
                  label="Department"
                  placeholder="All departments"
                  data={departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }))}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={fieldState.error?.message}
                  clearable
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="doctors_per_screen"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Doctors Per Screen"
                  min={1}
                  max={8}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="language"
              render={({ field, fieldState }) => (
                <MultiSelect
                  label="Languages"
                  data={LANGUAGES}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="scroll_speed"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Scroll Speed (seconds)"
                  min={1}
                  max={30}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="show_patient_name"
              render={({ field }) => (
                <Switch
                  label="Show patient name on authorized staff displays"
                  description={
                    canShowPatientNames
                      ? "Enable only for controlled team-room displays."
                      : "Public token boards are enforced as token-only displays."
                  }
                  checked={canShowPatientNames && field.value}
                  disabled={!canShowPatientNames}
                  onChange={(event) =>
                    field.onChange(canShowPatientNames && event.currentTarget.checked)
                  }
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="show_wait_time"
              render={({ field }) => (
                <Switch
                  label="Show Wait Time"
                  description="Allowed on public token boards when it does not reveal patient identity or clinical context."
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="announcement_enabled"
              render={({ field }) => (
                <Switch
                  label="Enable Announcements"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
            <Group justify="flex-end" mt="md">
              <Button tone="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                tone="primary"
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {selectedDisplay ? "Update" : "Create"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </>
  );
}
