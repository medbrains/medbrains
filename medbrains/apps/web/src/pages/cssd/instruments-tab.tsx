// CSSD InstrumentsTab — split from cssd.tsx (pure move).

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
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { CssdInstrumentFormInput, CssdSetFormInput } from "@medbrains/schemas";
import { cssdInstrumentFormSchema, cssdSetFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateCssdInstrumentRequest,
  CreateCssdSetRequest,
  CssdInstrument,
  CssdInstrumentSet,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPackage, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import {
  cssdInstrumentCategoryOptions,
  cssdOptionalInteger,
  cssdOptionalText,
} from "@/forms/cssd.form";
import { cssdService } from "@/services/cssd.service";

const statusColors: Record<string, BadgeTone> = {
  available: "success",
  in_use: "primary",
  decontaminating: "warning",
  sterilizing: "warning",
  sterile: "success",
  damaged: "danger",
  condemned: "neutral",
};

export function InstrumentsTab() {
  const canManage = useHasPermission(P.CSSD.INSTRUMENTS_MANAGE);
  const canManageSets = useHasPermission(P.CSSD.SETS_MANAGE);
  const canListSets = useHasPermission(P.CSSD.SETS_LIST);
  const qc = useQueryClient();
  const [instrOpened, { open: openInstr, close: closeInstr }] = useDisclosure(false);
  const [setOpened, { open: openSet, close: closeSet }] = useDisclosure(false);

  const { data: instruments = [], isLoading } = useQuery({
    queryKey: ["cssd-instruments"],
    queryFn: () => cssdService.listCssdInstruments(),
  });

  const { data: sets = [] } = useQuery({
    queryKey: ["cssd-sets"],
    queryFn: () => cssdService.listCssdSets(),
    enabled: canListSets,
  });

  const instrForm = useForm<CssdInstrumentFormInput>({
    resolver: zodResolver(cssdInstrumentFormSchema),
    defaultValues: {
      barcode: "",
      name: "",
      category: "",
      manufacturer: "",
      max_uses: "",
      notes: "",
    },
  });
  const {
    control: instrControl,
    handleSubmit: handleInstrSubmit,
    reset: resetInstr,
    formState: { errors: instrErrors },
  } = instrForm;
  const createInstrMut = useMutation({
    mutationFn: (data: CreateCssdInstrumentRequest) => cssdService.createCssdInstrument(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-instruments"] });
      notifications.show({ title: "Instrument added", message: "", color: "success" });
      closeInstr();
      resetInstr();
    },
  });

  const setForm = useForm<CssdSetFormInput>({
    resolver: zodResolver(cssdSetFormSchema),
    defaultValues: {
      set_code: "",
      set_name: "",
      department: "",
      description: "",
    },
  });
  const {
    control: setControl,
    handleSubmit: handleSetSubmit,
    reset: resetSet,
    formState: { errors: setErrors },
  } = setForm;
  const createSetMut = useMutation({
    mutationFn: (data: CreateCssdSetRequest) => cssdService.createCssdSet(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-sets"] });
      notifications.show({ title: "Set created", message: "", color: "success" });
      closeSet();
      resetSet();
    },
  });

  const submitInstrument = (values: CssdInstrumentFormInput) => {
    createInstrMut.mutate({
      barcode: values.barcode.trim(),
      name: values.name.trim(),
      category: values.category || undefined,
      manufacturer: cssdOptionalText(values.manufacturer),
      max_uses: cssdOptionalInteger(values.max_uses),
      notes: cssdOptionalText(values.notes),
    });
  };

  const submitSet = (values: CssdSetFormInput) => {
    createSetMut.mutate({
      set_code: values.set_code.trim(),
      set_name: values.set_name.trim(),
      department: cssdOptionalText(values.department),
      description: cssdOptionalText(values.description),
    });
  };

  const instrColumns = [
    { key: "barcode" as const, label: "Barcode", render: (i: CssdInstrument) => i.barcode },
    { key: "name" as const, label: "Name", render: (i: CssdInstrument) => i.name },
    {
      key: "category" as const,
      label: "Category",
      render: (i: CssdInstrument) => i.category ?? "—",
    },
    {
      key: "status" as const,
      label: "Status",
      render: (i: CssdInstrument) => (
        <Badge tone={statusColors[i.status] ?? "neutral"}>{i.status}</Badge>
      ),
    },
    {
      key: "lifecycle_uses" as const,
      label: "Uses",
      render: (i: CssdInstrument) =>
        i.max_uses ? `${i.lifecycle_uses}/${i.max_uses}` : String(i.lifecycle_uses),
    },
  ];

  const setColumns = [
    { key: "set_code" as const, label: "Code", render: (s: CssdInstrumentSet) => s.set_code },
    { key: "set_name" as const, label: "Name", render: (s: CssdInstrumentSet) => s.set_name },
    {
      key: "department" as const,
      label: "Department",
      render: (s: CssdInstrumentSet) => s.department ?? "—",
    },
    {
      key: "is_active" as const,
      label: "Active",
      render: (s: CssdInstrumentSet) =>
        s.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>,
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>
          Instruments: {instruments.length} | Sets: {sets.length}
        </Text>
        <Group>
          {canManageSets && (
            <Button tone="secondary" leftSection={<IconPackage size={16} />} onClick={openSet}>
              New Set
            </Button>
          )}
          {canManage && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openInstr}>
              Add Instrument
            </Button>
          )}
        </Group>
      </Group>

      <DataTable
        columns={instrColumns}
        data={instruments}
        loading={isLoading}
        rowKey={(i) => i.id}
        emptyTitle="No instruments registered"
      />

      {sets.length > 0 && (
        <>
          <Text fw={600} mt="md">
            Instrument Sets
          </Text>
          <DataTable columns={setColumns} data={sets} rowKey={(s) => s.id} />
        </>
      )}

      <Drawer
        opened={instrOpened}
        onClose={closeInstr}
        title="Add Instrument"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleInstrSubmit(submitInstrument)}>
          <Controller
            name="barcode"
            control={instrControl}
            render={({ field }) => (
              <TextInput label="Barcode" required {...field} error={instrErrors.barcode?.message} />
            )}
          />
          <Controller
            name="name"
            control={instrControl}
            render={({ field }) => (
              <TextInput label="Name" required {...field} error={instrErrors.name?.message} />
            )}
          />
          <Controller
            name="category"
            control={instrControl}
            render={({ field }) => (
              <Select
                label="Category"
                data={cssdInstrumentCategoryOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                searchable
                error={instrErrors.category?.message}
              />
            )}
          />
          <Controller
            name="manufacturer"
            control={instrControl}
            render={({ field }) => (
              <TextInput
                label="Manufacturer"
                {...field}
                error={instrErrors.manufacturer?.message}
              />
            )}
          />
          <Controller
            name="max_uses"
            control={instrControl}
            render={({ field }) => (
              <NumberInput
                label="Max Uses (lifecycle)"
                value={field.value}
                onChange={field.onChange}
                error={instrErrors.max_uses?.message}
              />
            )}
          />
          <Controller
            name="notes"
            control={instrControl}
            render={({ field }) => (
              <Textarea label="Notes" {...field} error={instrErrors.notes?.message} />
            )}
          />
          <Button tone="primary" loading={createInstrMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={setOpened}
        onClose={closeSet}
        title="Create Instrument Set"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleSetSubmit(submitSet)}>
          <Controller
            name="set_code"
            control={setControl}
            render={({ field }) => (
              <TextInput label="Set Code" required {...field} error={setErrors.set_code?.message} />
            )}
          />
          <Controller
            name="set_name"
            control={setControl}
            render={({ field }) => (
              <TextInput label="Set Name" required {...field} error={setErrors.set_name?.message} />
            )}
          />
          <Controller
            name="department"
            control={setControl}
            render={({ field }) => (
              <TextInput label="Department" {...field} error={setErrors.department?.message} />
            )}
          />
          <Controller
            name="description"
            control={setControl}
            render={({ field }) => (
              <Textarea label="Description" {...field} error={setErrors.description?.message} />
            )}
          />
          <Button tone="primary" loading={createSetMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Sterilization Tab ───────────────────────────────────
