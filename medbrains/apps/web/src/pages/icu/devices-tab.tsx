// IPD DevicesTab — split from icu.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Checkbox,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { IcuBundleCheckFormInput, IcuDeviceFormInput } from "@medbrains/schemas";
import { icuBundleCheckFormSchema, icuDeviceFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { IcuBundleCheck, IcuDevice, IcuDeviceType } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconReportMedical, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import {
  DEFAULT_ICU_BUNDLE_CHECK_FORM_VALUES,
  DEFAULT_ICU_DEVICE_FORM_VALUES,
  ICU_DEVICE_TYPE_OPTIONS,
  normalizeIcuDeviceType,
  toCreateIcuBundleCheckRequest,
  toCreateIcuDeviceRequest,
} from "@/forms/icu.form";
import { icuService } from "@/services/icu.service";

const deviceTypeLabels: Record<IcuDeviceType, string> = {
  central_line: "Central Line",
  urinary_catheter: "Urinary Catheter",
  ventilator: "Ventilator",
  arterial_line: "Arterial Line",
  peripheral_iv: "Peripheral IV",
  nasogastric_tube: "NG Tube",
  chest_tube: "Chest Tube",
  tracheostomy: "Tracheostomy",
};

export function DevicesTab({ admissionId }: { admissionId: string }) {
  const canManage = useHasPermission(P.ICU.DEVICES_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedDevice, setSelectedDevice] = useState<IcuDevice | null>(null);
  const [bundleOpened, { open: openBundle, close: closeBundle }] = useDisclosure(false);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["icu-devices", admissionId],
    queryFn: () => icuService.listIcuDevices(admissionId),
    enabled: !!admissionId,
  });

  const {
    control: deviceControl,
    handleSubmit: handleDeviceSubmit,
    reset: resetDeviceForm,
    formState: { errors: deviceErrors },
  } = useForm<IcuDeviceFormInput>({
    resolver: zodResolver(icuDeviceFormSchema),
    defaultValues: DEFAULT_ICU_DEVICE_FORM_VALUES,
  });

  const createMut = useMutation({
    mutationFn: (values: IcuDeviceFormInput) =>
      icuService.createIcuDevice(admissionId, toCreateIcuDeviceRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-devices", admissionId] });
      notifications.show({ title: "Device tracked", message: "", color: "success" });
      close();
      resetDeviceForm(DEFAULT_ICU_DEVICE_FORM_VALUES);
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not track device", message: e.message, color: "red" }),
  });

  const removeMut = useMutation({
    mutationFn: (deviceId: string) => icuService.removeIcuDevice(admissionId, deviceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-devices", admissionId] });
      notifications.show({ title: "Device removed", message: "", color: "primary" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not remove device", message: e.message, color: "red" }),
  });

  // Bundle check state
  const { data: bundleChecks = [] } = useQuery({
    queryKey: ["icu-bundle-checks", selectedDevice?.id],
    queryFn: () => icuService.listIcuBundleChecks(admissionId, selectedDevice?.id ?? ""),
    enabled: !!selectedDevice,
  });

  const {
    control: bundleControl,
    handleSubmit: handleBundleSubmit,
    reset: resetBundleForm,
  } = useForm<IcuBundleCheckFormInput>({
    resolver: zodResolver(icuBundleCheckFormSchema),
    defaultValues: DEFAULT_ICU_BUNDLE_CHECK_FORM_VALUES,
  });

  const bundleMut = useMutation({
    mutationFn: (values: IcuBundleCheckFormInput) =>
      icuService.createIcuBundleCheck(
        admissionId,
        selectedDevice?.id ?? "",
        toCreateIcuBundleCheckRequest(values),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-bundle-checks", selectedDevice?.id] });
      notifications.show({ title: "Bundle check saved", message: "", color: "success" });
      resetBundleForm(DEFAULT_ICU_BUNDLE_CHECK_FORM_VALUES);
    },
    onError: (e: Error) =>
      notifications.show({
        title: "Could not save bundle check",
        message: e.message,
        color: "red",
      }),
  });

  const columns = [
    {
      key: "device_type",
      label: "Type",
      render: (d: IcuDevice) => deviceTypeLabels[d.device_type] ?? d.device_type,
    },
    { key: "site", label: "Site", render: (d: IcuDevice) => d.site ?? "—" },
    {
      key: "inserted_at",
      label: "Inserted",
      render: (d: IcuDevice) => new Date(d.inserted_at).toLocaleDateString(),
    },
    {
      key: "is_active",
      label: "Status",
      render: (d: IcuDevice) =>
        d.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Removed</Badge>,
    },
    {
      key: "id",
      label: "Actions",
      render: (d: IcuDevice) => (
        <Group gap="xs">
          <Tooltip label="Bundle Checks">
            <IconButton
              onClick={() => {
                setSelectedDevice(d);
                openBundle();
              }}
              aria-label="Bundle Checks"
            >
              <IconReportMedical size={16} />
            </IconButton>
          </Tooltip>
          {canManage && d.is_active && (
            <Tooltip label="Remove Device">
              <IconButton
                tone="danger"
                onClick={() => removeMut.mutate(d.id)}
                aria-label="Remove Device"
              >
                <IconTrash size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canManage && admissionId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Add Device
          </Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable
          columns={columns}
          data={devices}
          loading={isLoading}
          rowKey={(d) => d.id}
          emptyTitle="No devices tracked"
        />
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select an admission to manage devices
        </Text>
      )}

      <Drawer opened={opened} onClose={close} title="Track New Device" position="right" size="sm">
        <Stack component="form" onSubmit={handleDeviceSubmit((values) => createMut.mutate(values))}>
          <Controller
            control={deviceControl}
            name="device_type"
            render={({ field }) => (
              <Select
                label="Device Type"
                data={ICU_DEVICE_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(normalizeIcuDeviceType(value))}
                error={deviceErrors.device_type?.message}
              />
            )}
          />
          <Controller
            control={deviceControl}
            name="site"
            render={({ field }) => (
              <TextInput label="Insertion Site" {...field} error={deviceErrors.site?.message} />
            )}
          />
          <Controller
            control={deviceControl}
            name="notes"
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={bundleOpened}
        onClose={closeBundle}
        title={`Bundle Checks — ${selectedDevice ? deviceTypeLabels[selectedDevice.device_type] : ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          {bundleChecks.length > 0 && (
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Compliant</Table.Th>
                  <Table.Th>Still Needed</Table.Th>
                  <Table.Th>Notes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {bundleChecks.map((bc: IcuBundleCheck) => (
                  <Table.Tr key={bc.id}>
                    <Table.Td>{new Date(bc.checked_at).toLocaleString()}</Table.Td>
                    <Table.Td>
                      {bc.is_compliant ? (
                        <Badge tone="success">Yes</Badge>
                      ) : (
                        <Badge tone="danger">No</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{bc.still_needed ? "Yes" : "No"}</Table.Td>
                    <Table.Td>{bc.notes ?? "—"}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {canManage && (
            <Stack
              component="form"
              onSubmit={handleBundleSubmit((values) => bundleMut.mutate(values))}
            >
              <Text fw={600}>New Bundle Check</Text>
              <Controller
                control={bundleControl}
                name="is_compliant"
                render={({ field }) => (
                  <Checkbox
                    label="Compliant"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={bundleControl}
                name="still_needed"
                render={({ field }) => (
                  <Checkbox
                    label="Device Still Needed"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={bundleControl}
                name="notes"
                render={({ field }) => <Textarea label="Notes" {...field} />}
              />
              <Button tone="primary" loading={bundleMut.isPending} type="submit">
                Save Check
              </Button>
            </Stack>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Nutrition Tab ───────────────────────────────────────────
