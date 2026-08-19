// CSSD EquipmentTab — split from cssd.tsx (pure move).

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
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { CssdMaintenanceFormInput, CssdSterilizerFormInput } from "@medbrains/schemas";
import { cssdMaintenanceFormSchema, cssdSterilizerFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateCssdMaintenanceRequest,
  CreateCssdSterilizerRequest,
  CssdMaintenanceLog,
  CssdSterilizer,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconSettings } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import {
  cssdMaintenanceTypeOptions,
  cssdMethodOptions,
  cssdOptionalNumber,
  cssdOptionalText,
} from "@/forms/cssd.form";
import { cssdService } from "@/services/cssd.service";
import { methodLabels } from "./shared";

export function EquipmentTab() {
  const canManage = useHasPermission(P.CSSD.EQUIPMENT_MANAGE);
  // The register and its maintenance history are `cssd.equipment.list`, not the
  // manage code this tab already held.
  const canListEquipment = useHasPermission(P.CSSD.EQUIPMENT_LIST);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedSterilizer, setSelectedSterilizer] = useState<CssdSterilizer | null>(null);
  const [maintOpened, { open: openMaint, close: closeMaint }] = useDisclosure(false);

  const { data: sterilizers = [], isLoading } = useQuery({
    queryKey: ["cssd-sterilizers"],
    queryFn: () => cssdService.listCssdSterilizers(),
    enabled: canListEquipment,
  });

  const sterilizerForm = useForm<CssdSterilizerFormInput>({
    resolver: zodResolver(cssdSterilizerFormSchema),
    defaultValues: {
      name: "",
      model: "",
      serial_number: "",
      method: "steam",
      chamber_size_liters: "",
      location: "",
    },
  });
  const {
    control: sterilizerControl,
    handleSubmit: handleSterilizerSubmit,
    reset: resetSterilizer,
    formState: { errors: sterilizerErrors },
  } = sterilizerForm;
  const createMut = useMutation({
    mutationFn: (data: CreateCssdSterilizerRequest) => cssdService.createCssdSterilizer(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-sterilizers"] });
      notifications.show({ title: "Sterilizer added", message: "", color: "success" });
      close();
      resetSterilizer();
    },
  });

  // Maintenance logs
  const { data: maintLogs = [] } = useQuery({
    queryKey: ["cssd-maintenance", selectedSterilizer?.id],
    queryFn: () => cssdService.listCssdMaintenanceLogs(selectedSterilizer?.id ?? ""),
    enabled: !!selectedSterilizer && canListEquipment,
  });

  const maintenanceForm = useForm<CssdMaintenanceFormInput>({
    resolver: zodResolver(cssdMaintenanceFormSchema),
    defaultValues: {
      maintenance_type: "preventive",
      performed_by: "",
      findings: "",
      actions_taken: "",
      cost: "",
    },
  });
  const {
    control: maintenanceControl,
    handleSubmit: handleMaintenanceSubmit,
    reset: resetMaintenance,
    formState: { errors: maintenanceErrors },
  } = maintenanceForm;
  const maintMut = useMutation({
    mutationFn: (data: CreateCssdMaintenanceRequest) =>
      cssdService.createCssdMaintenanceLog(selectedSterilizer?.id ?? "", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-maintenance", selectedSterilizer?.id] });
      void qc.invalidateQueries({ queryKey: ["cssd-sterilizers"] });
      notifications.show({ title: "Maintenance logged", message: "", color: "success" });
      resetMaintenance();
    },
  });

  const submitSterilizer = (values: CssdSterilizerFormInput) => {
    createMut.mutate({
      name: values.name.trim(),
      model: cssdOptionalText(values.model),
      serial_number: cssdOptionalText(values.serial_number),
      method: values.method,
      chamber_size_liters: cssdOptionalNumber(values.chamber_size_liters),
      location: cssdOptionalText(values.location),
    });
  };

  const submitMaintenance = (values: CssdMaintenanceFormInput) => {
    maintMut.mutate({
      maintenance_type: values.maintenance_type,
      performed_by: cssdOptionalText(values.performed_by),
      findings: cssdOptionalText(values.findings),
      actions_taken: cssdOptionalText(values.actions_taken),
      cost: cssdOptionalNumber(values.cost),
    });
  };

  const columns = [
    { key: "name" as const, label: "Name", render: (s: CssdSterilizer) => s.name },
    { key: "model" as const, label: "Model", render: (s: CssdSterilizer) => s.model ?? "—" },
    {
      key: "method" as const,
      label: "Method",
      render: (s: CssdSterilizer) => methodLabels[s.method] ?? s.method,
    },
    {
      key: "is_active" as const,
      label: "Status",
      render: (s: CssdSterilizer) =>
        s.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>,
    },
    {
      key: "next_maintenance_at" as const,
      label: "Next Maint.",
      render: (s: CssdSterilizer) =>
        s.next_maintenance_at ? new Date(s.next_maintenance_at).toLocaleDateString() : "—",
    },
    {
      key: "id" as const,
      label: "Actions",
      render: (s: CssdSterilizer) => (
        <Tooltip label="Maintenance Logs">
          <IconButton
            tone="default"
            onClick={() => {
              setSelectedSterilizer(s);
              openMaint();
            }}
            aria-label="Settings"
          >
            <IconSettings size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Add Sterilizer
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={sterilizers}
        loading={isLoading}
        rowKey={(s) => s.id}
        emptyTitle="No sterilizers registered"
      />

      <Drawer opened={opened} onClose={close} title="Add Sterilizer" position="right" size="sm">
        <Stack component="form" onSubmit={handleSterilizerSubmit(submitSterilizer)}>
          <Controller
            name="name"
            control={sterilizerControl}
            render={({ field }) => (
              <TextInput label="Name" required {...field} error={sterilizerErrors.name?.message} />
            )}
          />
          <Controller
            name="model"
            control={sterilizerControl}
            render={({ field }) => (
              <TextInput label="Model" {...field} error={sterilizerErrors.model?.message} />
            )}
          />
          <Controller
            name="serial_number"
            control={sterilizerControl}
            render={({ field }) => (
              <TextInput
                label="Serial Number"
                {...field}
                error={sterilizerErrors.serial_number?.message}
              />
            )}
          />
          <Controller
            name="method"
            control={sterilizerControl}
            render={({ field }) => (
              <Select
                label="Method"
                data={cssdMethodOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "steam")}
                error={sterilizerErrors.method?.message}
              />
            )}
          />
          <Controller
            name="chamber_size_liters"
            control={sterilizerControl}
            render={({ field }) => (
              <NumberInput
                label="Chamber Size (Liters)"
                decimalScale={1}
                value={field.value}
                onChange={field.onChange}
                error={sterilizerErrors.chamber_size_liters?.message}
              />
            )}
          />
          <Controller
            name="location"
            control={sterilizerControl}
            render={({ field }) => (
              <TextInput label="Location" {...field} error={sterilizerErrors.location?.message} />
            )}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={maintOpened}
        onClose={closeMaint}
        title={`Maintenance — ${selectedSterilizer?.name ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          {maintLogs.length > 0 && (
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>By</Table.Th>
                  <Table.Th>Findings</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {maintLogs.map((m: CssdMaintenanceLog) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>{new Date(m.performed_at).toLocaleDateString()}</Table.Td>
                    <Table.Td>{m.maintenance_type}</Table.Td>
                    <Table.Td>{m.performed_by ?? "—"}</Table.Td>
                    <Table.Td>{m.findings ?? "—"}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {canManage && (
            <>
              <Text fw={600}>Log Maintenance</Text>
              <Stack component="form" onSubmit={handleMaintenanceSubmit(submitMaintenance)}>
                <Controller
                  name="maintenance_type"
                  control={maintenanceControl}
                  render={({ field }) => (
                    <Select
                      label="Type"
                      required
                      data={cssdMaintenanceTypeOptions}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "preventive")}
                      searchable
                      error={maintenanceErrors.maintenance_type?.message}
                    />
                  )}
                />
                <Controller
                  name="performed_by"
                  control={maintenanceControl}
                  render={({ field }) => (
                    <TextInput
                      label="Performed By"
                      {...field}
                      error={maintenanceErrors.performed_by?.message}
                    />
                  )}
                />
                <Controller
                  name="findings"
                  control={maintenanceControl}
                  render={({ field }) => (
                    <Textarea
                      label="Findings"
                      {...field}
                      error={maintenanceErrors.findings?.message}
                    />
                  )}
                />
                <Controller
                  name="actions_taken"
                  control={maintenanceControl}
                  render={({ field }) => (
                    <Textarea
                      label="Actions Taken"
                      {...field}
                      error={maintenanceErrors.actions_taken?.message}
                    />
                  )}
                />
                <Controller
                  name="cost"
                  control={maintenanceControl}
                  render={({ field }) => (
                    <NumberInput
                      label="Cost"
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={maintenanceErrors.cost?.message}
                    />
                  )}
                />
                <Button tone="primary" loading={maintMut.isPending} type="submit">
                  Log
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Main CSSD Page ──────────────────────────────────────
