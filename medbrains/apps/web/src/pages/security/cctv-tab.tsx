// Security CctvTab — split from security.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { SecurityCameraFormInput } from "@medbrains/schemas";
import { securityCameraFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { SecurityCamera } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import {
  defaultSecurityCameraFormValues,
  securityCameraFormToRequest,
} from "@/forms/security.form";
import { securityService } from "@/services/security.service";

const CAMERA_TYPES = [
  { value: "dome", label: "Dome" },
  { value: "bullet", label: "Bullet" },
  { value: "ptz", label: "PTZ" },
  { value: "box", label: "Box" },
  { value: "fisheye", label: "Fisheye" },
];

export function CctvTab() {
  const canManage = useHasPermission(P.SECURITY.CCTV_MANAGE);
  const qc = useQueryClient();

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ["sec-cameras"],
    queryFn: () => securityService.listSecurityCameras(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ["sec-zones"],
    queryFn: () => securityService.listSecurityZones(),
  });
  const [opened, { open, close }] = useDisclosure(false);
  const cameraForm = useForm<SecurityCameraFormInput>({
    resolver: zodResolver(securityCameraFormSchema),
    defaultValues: defaultSecurityCameraFormValues,
  });
  const handleOpen = () => {
    cameraForm.reset(defaultSecurityCameraFormValues);
    open();
  };
  const createMut = useMutation({
    mutationFn: (values: SecurityCameraFormInput) =>
      securityService.createSecurityCamera(securityCameraFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-cameras"] });
      cameraForm.reset(defaultSecurityCameraFormValues);
      close();
      notifications.show({ title: "Camera Added", message: "Camera registered", color: "success" });
    },
  });

  const columns: Column<SecurityCamera>[] = [
    { key: "name", label: "Name", render: (r) => <Text fw={600}>{r.name}</Text> },
    {
      key: "zone_id",
      label: "Zone",
      render: (r) => (
        <Text size="sm">{zones.find((z) => z.id === r.zone_id)?.zone_code ?? "—"}</Text>
      ),
    },
    { key: "camera_type", label: "Type", render: (r) => <Text>{r.camera_type ?? "—"}</Text> },
    { key: "resolution", label: "Resolution", render: (r) => <Text>{r.resolution ?? "—"}</Text> },
    {
      key: "retention_days",
      label: "Retention",
      render: (r) => <Text>{r.retention_days} days</Text>,
    },
    {
      key: "is_recording",
      label: "Recording",
      render: (r) => (
        <Badge tone={r.is_recording ? "success" : "danger"}>
          {r.is_recording ? "Recording" : "Offline"}
        </Badge>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpen}>
            Add Camera
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={cameras} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Add Camera" position="right" size="xl">
        <Stack
          component="form"
          onSubmit={cameraForm.handleSubmit((values) => createMut.mutate(values))}
        >
          <TextInput
            label="Camera Name"
            required
            {...cameraForm.register("name")}
            error={cameraForm.formState.errors.name?.message}
          />
          <TextInput
            label="Camera ID"
            {...cameraForm.register("camera_id")}
            error={cameraForm.formState.errors.camera_id?.message}
          />
          <Controller
            control={cameraForm.control}
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
            label="Location Description"
            {...cameraForm.register("location_description")}
            error={cameraForm.formState.errors.location_description?.message}
          />
          <Controller
            control={cameraForm.control}
            name="camera_type"
            render={({ field, fieldState }) => (
              <Select
                label="Camera Type"
                data={CAMERA_TYPES}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Resolution"
            placeholder="1080p"
            {...cameraForm.register("resolution")}
            error={cameraForm.formState.errors.resolution?.message}
          />
          <Controller
            control={cameraForm.control}
            name="retention_days"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Retention Days"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={365}
              />
            )}
          />
          <TextInput
            label="IP Address"
            {...cameraForm.register("ip_address")}
            error={cameraForm.formState.errors.ip_address?.message}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Add Camera
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Incidents Tab
// ══════════════════════════════════════════════════════════
