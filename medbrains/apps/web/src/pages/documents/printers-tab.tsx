// IPD PrintersTab — split from documents.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { CreatePrinterFormInput } from "@medbrains/schemas";
import { createPrinterFormSchema, printerTypeValues } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreatePrinterRequest, PrinterConfig } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconSettings } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { documentsService } from "@/services/documents.service";
import {
  CONNECTION_TYPES,
  capabilityString,
  LOGICAL_PRINTER_PROFILES,
  optionLabel,
  PRINT_COPY_MODES,
  PRINT_FORMATS,
} from "./shared";

const PRINTER_TYPE_LABELS: Record<(typeof printerTypeValues)[number], string> = {
  laser: "Laser / Inkjet",
  thermal: "Thermal receipt",
  label: "Label",
  wristband: "Wristband",
  virtual: "Virtual / browser",
};

const PRINTER_TYPES = printerTypeValues.map((value) => ({
  value,
  label: PRINTER_TYPE_LABELS[value],
}));

const DEFAULT_PRINTER_FORM: CreatePrinterFormInput = {
  name: "",
  printer_type: "laser",
  connection_type: "network",
  connection_string: "",
  default_format: "a4_portrait",
  profile_code: "opd-a4",
  copy_modes: ["customer", "office"],
};

function printerCapabilities(form: CreatePrinterFormInput) {
  return {
    copy_modes: form.copy_modes,
    profile_code: form.profile_code,
  };
}

export function PrintersTab() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.DOCUMENTS.PRINTERS_MANAGE);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);

  const { data: printers = [], isLoading } = useQuery({
    queryKey: ["printers"],
    queryFn: () => documentsService.listPrinters(),
  });

  const {
    control,
    handleSubmit,
    register,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreatePrinterFormInput>({
    defaultValues: DEFAULT_PRINTER_FORM,
    resolver: zodResolver(createPrinterFormSchema),
  });

  const selectedProfile = watch("profile_code");
  const selectedCopyModes = watch("copy_modes");
  const directPrinterCount = printers.filter(
    (printer) => printer.connection_type !== "browser",
  ).length;
  const mappedCopyModeCount = new Set(
    printers.flatMap((printer) => capabilityString(printer.capabilities, "copy_modes")),
  ).size;

  const createMutation = useMutation({
    mutationFn: (payload: CreatePrinterRequest) => documentsService.createPrinter(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["printers"] });
      toast.success("Printer profile is ready for document routing", { title: "Printer created" });
      reset(DEFAULT_PRINTER_FORM);
      closeDrawer();
    },
  });

  const openCreateDrawer = () => {
    reset(DEFAULT_PRINTER_FORM);
    openDrawer();
  };

  const onSubmit = handleSubmit((values) => {
    const payload: CreatePrinterRequest = {
      name: values.name.trim(),
      printer_type: values.printer_type,
      connection_type: values.connection_type,
      connection_string: values.connection_string.trim() || undefined,
      default_format: values.default_format,
      capabilities: printerCapabilities(values),
    };
    createMutation.mutate(payload);
  });

  const columns = [
    {
      key: "name",
      label: "Printer",
      render: (row: PrinterConfig) => (
        <Stack gap={4}>
          <Group gap="xs">
            <Text size="sm" fw={600}>
              {row.name}
            </Text>
            <Badge tone={row.is_active ? "success" : "neutral"}>
              {row.is_active ? "Active" : "Inactive"}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {optionLabel(PRINTER_TYPES, row.printer_type)}
          </Text>
        </Stack>
      ),
    },
    {
      key: "profile",
      label: "Profile",
      render: (row: PrinterConfig) => {
        const profile = capabilityString(row.capabilities, "profile_code")[0];
        return <Text size="sm">{optionLabel(LOGICAL_PRINTER_PROFILES, profile)}</Text>;
      },
    },
    {
      key: "copy_modes",
      label: "Copy Routing",
      render: (row: PrinterConfig) => {
        const copyModes = capabilityString(row.capabilities, "copy_modes");
        if (copyModes.length === 0) return <Text size="sm">—</Text>;
        return (
          <Group gap={4}>
            {copyModes.map((mode) => (
              <Badge key={mode} tone="success">
                {optionLabel(PRINT_COPY_MODES, mode)}
              </Badge>
            ))}
          </Group>
        );
      },
    },
    {
      key: "connection",
      label: "Connection",
      render: (row: PrinterConfig) => (
        <Stack gap={2}>
          <Text size="sm">{optionLabel(CONNECTION_TYPES, row.connection_type)}</Text>
          <Text size="xs" c="dimmed">
            {row.connection_string ?? "Browser/default dialog"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "default_format",
      label: "Format",
      render: (row: PrinterConfig) => (
        <Text size="sm">{optionLabel(PRINT_FORMATS, row.default_format)}</Text>
      ),
    },
  ];

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <SimpleGrid cols={{ base: 1, sm: 3 }} style={{ flex: 1 }}>
            <Card withBorder radius="sm">
              <Text size="xs" c="dimmed" tt="uppercase">
                Profiles
              </Text>
              <Text size="xl" fw={700}>
                {printers.length}
              </Text>
            </Card>
            <Card withBorder radius="sm">
              <Text size="xs" c="dimmed" tt="uppercase">
                Direct Printers
              </Text>
              <Text size="xl" fw={700}>
                {directPrinterCount}
              </Text>
            </Card>
            <Card withBorder radius="sm">
              <Text size="xs" c="dimmed" tt="uppercase">
                Copy Types
              </Text>
              <Text size="xl" fw={700}>
                {mappedCopyModeCount}
              </Text>
            </Card>
          </SimpleGrid>
          {canManage && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreateDrawer}>
              Add Printer
            </Button>
          )}
        </Group>

        <DataTable
          columns={columns}
          data={printers}
          loading={isLoading}
          rowKey={(printer) => printer.id}
          virtualized="auto"
          tableMaxHeight="62vh"
          emptyIcon={<IconSettings size={36} />}
          emptyTitle="No printer profiles"
          emptyDescription="Add printer profiles for customer, office, clinical, MRD, and department copies."
        />
      </Stack>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        title="Add Printer Profile"
        position="right"
        size="lg"
      >
        <Stack component="form" gap="sm" onSubmit={onSubmit}>
          <TextInput
            label="Printer name"
            required
            {...register("name")}
            error={errors.name?.message}
          />
          <Controller
            name="printer_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Printer type"
                data={PRINTER_TYPES}
                value={field.value}
                onChange={(value) => field.onChange(value ?? DEFAULT_PRINTER_FORM.printer_type)}
                error={errors.printer_type?.message}
                required
              />
            )}
          />
          <Controller
            name="connection_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Connection"
                data={CONNECTION_TYPES}
                value={field.value}
                onChange={(value) => field.onChange(value ?? DEFAULT_PRINTER_FORM.connection_type)}
                error={errors.connection_type?.message}
                required
              />
            )}
          />
          <TextInput
            label="Connection string"
            placeholder="10.10.12.25:9100"
            {...register("connection_string")}
            error={errors.connection_string?.message}
          />
          <Controller
            name="default_format"
            control={control}
            render={({ field }) => (
              <Select
                label="Default print format"
                data={PRINT_FORMATS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? DEFAULT_PRINTER_FORM.default_format)}
                error={errors.default_format?.message}
                required
              />
            )}
          />
          <Controller
            name="profile_code"
            control={control}
            render={({ field }) => (
              <Select
                label="Logical profile"
                data={LOGICAL_PRINTER_PROFILES}
                value={field.value}
                onChange={(value) => field.onChange(value ?? DEFAULT_PRINTER_FORM.profile_code)}
                error={errors.profile_code?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            name="copy_modes"
            control={control}
            render={({ field }) => (
              <MultiSelect
                label="Copy routing"
                data={PRINT_COPY_MODES}
                value={field.value}
                onChange={field.onChange}
                error={errors.copy_modes?.message}
                required
              />
            )}
          />
          <Card withBorder radius="sm">
            <Stack gap="xs">
              <Group gap="xs">
                <Badge>{optionLabel(LOGICAL_PRINTER_PROFILES, selectedProfile)}</Badge>
                {selectedCopyModes.map((mode) => (
                  <Badge key={mode} tone="success">
                    {optionLabel(PRINT_COPY_MODES, mode)}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </Card>
          <Group justify="flex-end" mt="md">
            <Button tone="ghost" onClick={closeDrawer} type="button">
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={createMutation.isPending}>
              Create
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────
