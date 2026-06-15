import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Card,
  Checkbox,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  CssdIndicatorFormInput,
  CssdInstrumentFormInput,
  CssdIssuanceFormInput,
  CssdLoadFormInput,
  CssdMaintenanceFormInput,
  CssdSetFormInput,
  CssdSterilizerFormInput,
} from "@medbrains/schemas";
import {
  cssdIndicatorFormSchema,
  cssdInstrumentFormSchema,
  cssdIssuanceFormSchema,
  cssdLoadFormSchema,
  cssdMaintenanceFormSchema,
  cssdSetFormSchema,
  cssdSterilizerFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateCssdInstrumentRequest,
  CreateCssdIssuanceRequest,
  CreateCssdLoadRequest,
  CreateCssdMaintenanceRequest,
  CreateCssdSetRequest,
  CreateCssdSterilizerRequest,
  CssdIndicatorResult,
  CssdInstrument,
  CssdInstrumentSet,
  CssdIssuance,
  CssdMaintenanceLog,
  CssdSterilizationLoad,
  CssdSterilizer,
  LoadStatus,
  RecordCssdIndicatorRequest,
  SterilizationMethod,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconArrowBack,
  IconEye,
  IconFlame,
  IconPackage,
  IconPencil,
  IconPlus,
  IconSettings,
  IconTruckDelivery,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import {
  cssdIndicatorTypeOptions,
  cssdInstrumentCategoryOptions,
  cssdMaintenanceTypeOptions,
  cssdMethodOptions,
  cssdOptionalInteger,
  cssdOptionalNumber,
  cssdOptionalText,
} from "@/forms/cssd.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { cssdService } from "@/services/cssd.service";

// ── Label Maps ──────────────────────────────────────────

const statusColors: Record<string, BadgeTone> = {
  available: "success",
  in_use: "primary",
  decontaminating: "warning",
  sterilizing: "warning",
  sterile: "success",
  damaged: "danger",
  condemned: "neutral",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  available: "success",
  sterile: "success",
  completed: "success",
  verified: "success",
  active: "success",
  pass: "success",
  loading: "neutral",
  pending: "neutral",
  running: "primary",
  in_use: "primary",
  decontaminating: "warning",
  preparing: "warning",
  sterilizing: "warning",
  damaged: "danger",
  failed: "danger",
  condemned: "danger",
  gray: "neutral",
  slate: "neutral",
  teal: "success",
  orange: "warning",
  red: "danger",
  blue: "info",
  primary: "primary",
  violet: "accent",
};

function statusBadgeTone(s: string): BadgeTone {
  return STATUS_TONE[s] ?? "neutral";
}

const methodLabels: Record<SterilizationMethod, string> = {
  steam: "Steam (Autoclave)",
  eto: "ETO (Ethylene Oxide)",
  plasma: "Plasma",
  dry_heat: "Dry Heat",
  flash: "Flash",
};

// ── Instruments Tab ─────────────────────────────────────

function InstrumentsTab() {
  const canManage = useHasPermission(P.CSSD.INSTRUMENTS_MANAGE);
  const canManageSets = useHasPermission(P.CSSD.SETS_MANAGE);
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
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Department</Table.Th>
                <Table.Th>Active</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sets.map((s: CssdInstrumentSet) => (
                <Table.Tr key={s.id}>
                  <Table.Td>{s.set_code}</Table.Td>
                  <Table.Td>{s.set_name}</Table.Td>
                  <Table.Td>{s.department ?? "—"}</Table.Td>
                  <Table.Td>
                    {s.is_active ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
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

function SterilizationTab() {
  const canCreate = useHasPermission(P.CSSD.STERILIZATION_CREATE);
  const qc = useQueryClient();
  const [loadOpened, { open: openLoad, close: closeLoad }] = useDisclosure(false);
  const [selectedLoad, setSelectedLoad] = useState<CssdSterilizationLoad | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data: loads = [], isLoading } = useQuery({
    queryKey: ["cssd-loads"],
    queryFn: () => cssdService.listCssdLoads(),
  });

  const { data: sterilizers = [] } = useQuery({
    queryKey: ["cssd-sterilizers"],
    queryFn: () => cssdService.listCssdSterilizers(),
  });

  const loadForm = useForm<CssdLoadFormInput>({
    resolver: zodResolver(cssdLoadFormSchema),
    defaultValues: {
      sterilizer_id: "",
      method: "steam",
      is_flash: false,
      flash_reason: "",
      notes: "",
    },
  });
  const {
    control: loadControl,
    handleSubmit: handleLoadSubmit,
    reset: resetLoad,
    watch: watchLoad,
    formState: { errors: loadErrors },
  } = loadForm;
  const createLoadMut = useMutation({
    mutationFn: (data: CreateCssdLoadRequest) => cssdService.createCssdLoad(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-loads"] });
      notifications.show({ title: "Load created", message: "", color: "success" });
      closeLoad();
      resetLoad();
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LoadStatus }) =>
      cssdService.updateCssdLoadStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-loads"] });
      notifications.show({ title: "Load status updated", message: "", color: "primary" });
    },
  });

  // Indicators for detail view
  const { data: indicators = [] } = useQuery({
    queryKey: ["cssd-indicators", selectedLoad?.id],
    queryFn: () => cssdService.listCssdIndicators(selectedLoad?.id ?? ""),
    enabled: !!selectedLoad,
  });

  const indicatorForm = useForm<CssdIndicatorFormInput>({
    resolver: zodResolver(cssdIndicatorFormSchema),
    defaultValues: {
      indicator_type: "chemical",
      result_pass: true,
      indicator_brand: "",
      indicator_lot: "",
    },
  });
  const {
    control: indicatorControl,
    handleSubmit: handleIndicatorSubmit,
    reset: resetIndicator,
    formState: { errors: indicatorErrors },
  } = indicatorForm;
  const indicatorMut = useMutation({
    mutationFn: (data: RecordCssdIndicatorRequest) =>
      cssdService.recordCssdIndicator(selectedLoad?.id ?? "", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-indicators", selectedLoad?.id] });
      notifications.show({ title: "Indicator recorded", message: "", color: "success" });
      resetIndicator();
    },
  });

  const submitLoad = (values: CssdLoadFormInput) => {
    createLoadMut.mutate({
      sterilizer_id: values.sterilizer_id.trim(),
      method: values.method,
      is_flash: values.is_flash,
      flash_reason: values.is_flash ? cssdOptionalText(values.flash_reason) : undefined,
      notes: cssdOptionalText(values.notes),
    });
  };

  const submitIndicator = (values: CssdIndicatorFormInput) => {
    indicatorMut.mutate({
      indicator_type: values.indicator_type,
      result_pass: values.result_pass,
      indicator_brand: cssdOptionalText(values.indicator_brand),
      indicator_lot: cssdOptionalText(values.indicator_lot),
    });
  };

  const columns = [
    {
      key: "load_number" as const,
      label: "Load #",
      render: (l: CssdSterilizationLoad) => l.load_number,
    },
    {
      key: "method" as const,
      label: "Method",
      render: (l: CssdSterilizationLoad) => methodLabels[l.method] ?? l.method,
    },
    {
      key: "status" as const,
      label: "Status",
      render: (l: CssdSterilizationLoad) => (
        <Badge tone={statusBadgeTone(l.status)}>{l.status}</Badge>
      ),
    },
    {
      key: "is_flash" as const,
      label: "Flash",
      render: (l: CssdSterilizationLoad) =>
        l.is_flash ? <Badge tone="warning">Flash</Badge> : "—",
    },
    {
      key: "created_at" as const,
      label: "Created",
      render: (l: CssdSterilizationLoad) => new Date(l.created_at).toLocaleString(),
    },
    {
      key: "id" as const,
      label: "Actions",
      render: (l: CssdSterilizationLoad) => (
        <Group gap="xs">
          <Tooltip label="Details & Indicators">
            <ActionIcon
              variant="subtle"
              onClick={() => {
                setSelectedLoad(l);
                openDetail();
              }}
              aria-label="View details"
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {canCreate && l.status === "loading" && (
            <Tooltip label="Start Cycle">
              <ActionIcon
                variant="subtle"
                color="primary"
                onClick={() => updateStatusMut.mutate({ id: l.id, status: "running" })}
                aria-label="Fire"
              >
                <IconFlame size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canCreate && l.status === "running" && (
            <Tooltip label="Complete">
              <ActionIcon
                variant="subtle"
                color="success"
                onClick={() => updateStatusMut.mutate({ id: l.id, status: "completed" })}
                aria-label="Edit"
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openLoad}>
            New Load
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={loads}
        loading={isLoading}
        rowKey={(l) => l.id}
        emptyTitle="No sterilization loads"
      />

      <Drawer
        opened={loadOpened}
        onClose={closeLoad}
        title="Create Sterilization Load"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleLoadSubmit(submitLoad)}>
          <Controller
            name="sterilizer_id"
            control={loadControl}
            render={({ field }) => (
              <Select
                label="Sterilizer"
                data={sterilizers.map((s) => ({ value: s.id, label: s.name }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={loadErrors.sterilizer_id?.message}
              />
            )}
          />
          <Controller
            name="method"
            control={loadControl}
            render={({ field }) => (
              <Select
                label="Method"
                data={cssdMethodOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "steam")}
                error={loadErrors.method?.message}
              />
            )}
          />
          <Controller
            name="is_flash"
            control={loadControl}
            render={({ field }) => (
              <Checkbox
                label="Flash Sterilization"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {watchLoad("is_flash") && (
            <Controller
              name="flash_reason"
              control={loadControl}
              render={({ field }) => (
                <TextInput
                  label="Flash Reason"
                  {...field}
                  error={loadErrors.flash_reason?.message}
                />
              )}
            />
          )}
          <Controller
            name="notes"
            control={loadControl}
            render={({ field }) => (
              <Textarea label="Notes" {...field} error={loadErrors.notes?.message} />
            )}
          />
          <Button tone="primary" loading={createLoadMut.isPending} type="submit">
            Create
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title={`Load ${selectedLoad?.load_number ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          {selectedLoad && (
            <>
              <Card withBorder>
                <Stack gap="xs">
                  <Group>
                    <Badge tone={statusBadgeTone(selectedLoad.status)}>{selectedLoad.status}</Badge>
                    {selectedLoad.is_flash && <Badge tone="warning">Flash</Badge>}
                  </Group>
                  <Text size="sm">
                    <b>Method:</b> {methodLabels[selectedLoad.method]}
                  </Text>
                  {selectedLoad.temperature_c && (
                    <Text size="sm">
                      <b>Temperature:</b> {String(selectedLoad.temperature_c)}°C
                    </Text>
                  )}
                  {selectedLoad.pressure_psi && (
                    <Text size="sm">
                      <b>Pressure:</b> {String(selectedLoad.pressure_psi)} PSI
                    </Text>
                  )}
                  {selectedLoad.cycle_time_minutes && (
                    <Text size="sm">
                      <b>Cycle Time:</b> {String(selectedLoad.cycle_time_minutes)} min
                    </Text>
                  )}
                </Stack>
              </Card>

              <Text fw={600} mt="md">
                Cycle Indicators ({indicators.length})
              </Text>
              {indicators.length > 0 && (
                <Card withBorder>
                  <Stack gap="xs">
                    {indicators.map((ind: CssdIndicatorResult) => (
                      <Group key={ind.id} justify="space-between">
                        <Group gap="xs">
                          <Badge>{ind.indicator_type === "biological" ? "BI" : "CI"}</Badge>
                          <Text size="sm">
                            {ind.indicator_type === "biological" ? "Biological" : "Chemical"}
                          </Text>
                        </Group>
                        <Badge tone={ind.result_pass ? "success" : "danger"}>
                          {ind.result_pass ? "Pass" : "Fail"}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              )}

              <Text fw={600} mt="md">
                Indicator Details
              </Text>
              {indicators.length > 0 && (
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Result</Table.Th>
                      <Table.Th>Brand/Lot</Table.Th>
                      <Table.Th>Time</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {indicators.map((ind: CssdIndicatorResult) => (
                      <Table.Tr key={ind.id}>
                        <Table.Td>{ind.indicator_type}</Table.Td>
                        <Table.Td>
                          {ind.result_pass ? (
                            <Badge tone="success">Pass</Badge>
                          ) : (
                            <Badge tone="danger">Fail</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {[ind.indicator_brand, ind.indicator_lot].filter(Boolean).join(" / ") ||
                            "—"}
                        </Table.Td>
                        <Table.Td>{new Date(ind.read_at).toLocaleString()}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}

              {canCreate && (
                <>
                  <Text fw={600}>Record Indicator</Text>
                  <Stack component="form" onSubmit={handleIndicatorSubmit(submitIndicator)}>
                    <Controller
                      name="indicator_type"
                      control={indicatorControl}
                      render={({ field }) => (
                        <Select
                          label="Type"
                          data={cssdIndicatorTypeOptions}
                          value={field.value}
                          onChange={(value) => field.onChange(value ?? "chemical")}
                          error={indicatorErrors.indicator_type?.message}
                        />
                      )}
                    />
                    <Controller
                      name="result_pass"
                      control={indicatorControl}
                      render={({ field }) => (
                        <Checkbox
                          label="Pass"
                          checked={field.value}
                          onChange={(event) => field.onChange(event.currentTarget.checked)}
                        />
                      )}
                    />
                    <Group grow>
                      <Controller
                        name="indicator_brand"
                        control={indicatorControl}
                        render={({ field }) => (
                          <TextInput
                            label="Brand"
                            {...field}
                            error={indicatorErrors.indicator_brand?.message}
                          />
                        )}
                      />
                      <Controller
                        name="indicator_lot"
                        control={indicatorControl}
                        render={({ field }) => (
                          <TextInput
                            label="Lot #"
                            {...field}
                            error={indicatorErrors.indicator_lot?.message}
                          />
                        )}
                      />
                    </Group>
                    <Button tone="primary" loading={indicatorMut.isPending} type="submit">
                      Record
                    </Button>
                  </Stack>
                </>
              )}
            </>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Issuance Tab ────────────────────────────────────────

function IssuanceTab() {
  const canCreate = useHasPermission(P.CSSD.ISSUANCE_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: issuances = [], isLoading } = useQuery({
    queryKey: ["cssd-issuances"],
    queryFn: () => cssdService.listCssdIssuances(),
  });

  const issuanceForm = useForm<CssdIssuanceFormInput>({
    resolver: zodResolver(cssdIssuanceFormSchema),
    defaultValues: {
      issued_to_department: "",
      issued_to_patient_id: "",
      notes: "",
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = issuanceForm;
  const createMut = useMutation({
    mutationFn: (data: CreateCssdIssuanceRequest) => cssdService.createCssdIssuance(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-issuances"] });
      notifications.show({ title: "Pack issued", message: "", color: "success" });
      close();
      reset();
    },
  });

  const submitIssuance = (values: CssdIssuanceFormInput) => {
    createMut.mutate({
      issued_to_department: values.issued_to_department.trim(),
      issued_to_patient_id: cssdOptionalText(values.issued_to_patient_id),
      notes: cssdOptionalText(values.notes),
    });
  };

  const returnMut = useMutation({
    mutationFn: (id: string) => cssdService.returnCssdIssuance(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-issuances"] });
      notifications.show({ title: "Pack returned", message: "", color: "primary" });
    },
  });

  const recallMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cssdService.recallCssdIssuance(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-issuances"] });
      notifications.show({ title: "Pack recalled", message: "", color: "orange" });
    },
  });

  const columns = [
    {
      key: "issued_to_department" as const,
      label: "Department",
      render: (i: CssdIssuance) => i.issued_to_department,
    },
    {
      key: "issued_at" as const,
      label: "Issued At",
      render: (i: CssdIssuance) => new Date(i.issued_at).toLocaleString(),
    },
    {
      key: "returned_at" as const,
      label: "Returned",
      render: (i: CssdIssuance) => (i.returned_at ? new Date(i.returned_at).toLocaleString() : "—"),
    },
    {
      key: "is_recalled" as const,
      label: "Status",
      render: (i: CssdIssuance) => {
        if (i.is_recalled) return <Badge tone="danger">Recalled</Badge>;
        if (i.returned_at) return <Badge tone="neutral">Returned</Badge>;
        return <Badge tone="success">Issued</Badge>;
      },
    },
    {
      key: "id" as const,
      label: "Actions",
      render: (i: CssdIssuance) => (
        <Group gap="xs">
          {canCreate && !i.returned_at && !i.is_recalled && (
            <>
              <Tooltip label="Return">
                <ActionIcon
                  variant="subtle"
                  color="primary"
                  onClick={() => returnMut.mutate(i.id)}
                  aria-label="Arrow Back"
                >
                  <IconArrowBack size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Recall">
                <ActionIcon
                  variant="subtle"
                  color="danger"
                  onClick={() => recallMut.mutate({ id: i.id, reason: "Quality concern" })}
                  aria-label="Warning"
                >
                  <IconAlertTriangle size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Issue Pack
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={issuances}
        loading={isLoading}
        rowKey={(i) => i.id}
        emptyTitle="No issuances"
      />

      <Drawer opened={opened} onClose={close} title="Issue Sterile Pack" position="right" size="sm">
        <Stack component="form" onSubmit={handleSubmit(submitIssuance)}>
          <Controller
            name="issued_to_department"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Department"
                required
                {...field}
                error={errors.issued_to_department?.message}
              />
            )}
          />
          <Controller
            name="issued_to_patient_id"
            control={control}
            render={({ field }) => (
              <PatientSearchSelect
                value={field.value}
                onChange={field.onChange}
                label="Patient (optional)"
              />
            )}
          />
          {errors.issued_to_patient_id?.message && (
            <Text size="xs" c="danger">
              {errors.issued_to_patient_id.message}
            </Text>
          )}
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Textarea label="Notes" {...field} error={errors.notes?.message} />
            )}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Issue
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Equipment Tab ───────────────────────────────────────

function EquipmentTab() {
  const canManage = useHasPermission(P.CSSD.EQUIPMENT_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedSterilizer, setSelectedSterilizer] = useState<CssdSterilizer | null>(null);
  const [maintOpened, { open: openMaint, close: closeMaint }] = useDisclosure(false);

  const { data: sterilizers = [], isLoading } = useQuery({
    queryKey: ["cssd-sterilizers"],
    queryFn: () => cssdService.listCssdSterilizers(),
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
    enabled: !!selectedSterilizer,
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
          <ActionIcon
            variant="subtle"
            onClick={() => {
              setSelectedSterilizer(s);
              openMaint();
            }}
            aria-label="Settings"
          >
            <IconSettings size={16} />
          </ActionIcon>
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

export function CssdPage() {
  useRequirePermission(P.CSSD.INSTRUMENTS_LIST);

  return (
    <div>
      <PageHeader
        title="CSSD"
        subtitle="Central Sterile Supply Department — instruments, sterilization, issuance, equipment"
      />

      <Tabs defaultValue="instruments" mt="md">
        <Tabs.List>
          <Tabs.Tab value="instruments" leftSection={<IconPackage size={16} />}>
            Instruments
          </Tabs.Tab>
          <Tabs.Tab value="sterilization" leftSection={<IconFlame size={16} />}>
            Sterilization
          </Tabs.Tab>
          <Tabs.Tab value="issuance" leftSection={<IconTruckDelivery size={16} />}>
            Issuance
          </Tabs.Tab>
          <Tabs.Tab value="equipment" leftSection={<IconSettings size={16} />}>
            Equipment
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="instruments" pt="md">
          <InstrumentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="sterilization" pt="md">
          <SterilizationTab />
        </Tabs.Panel>
        <Tabs.Panel value="issuance" pt="md">
          <IssuanceTab />
        </Tabs.Panel>
        <Tabs.Panel value="equipment" pt="md">
          <EquipmentTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
