import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
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
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconSettings,
  IconPackage,
  IconFlame,
  IconTruckDelivery,
  IconEye,
  IconPencil,
  IconArrowBack,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  CssdInstrument,
  CssdInstrumentSet,
  CssdSterilizer,
  CssdSterilizationLoad,
  CssdIssuance,
  CssdIndicatorResult,
  CssdMaintenanceLog,
  CreateCssdInstrumentRequest,
  CreateCssdSetRequest,
  CreateCssdSterilizerRequest,
  CreateCssdLoadRequest,
  CreateCssdIssuanceRequest,
  RecordCssdIndicatorRequest,
  CreateCssdMaintenanceRequest,
  SterilizationMethod,
  LoadStatus,
  IndicatorType,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { useRequirePermission } from "../hooks/useRequirePermission";

// ── Label Maps ──────────────────────────────────────────

const statusColors: Record<string, string> = {
  available: "success",
  in_use: "primary",
  decontaminating: "warning",
  sterilizing: "orange",
  sterile: "teal",
  damaged: "danger",
  condemned: "slate",
};

const loadStatusColors: Record<string, string> = {
  loading: "slate",
  running: "primary",
  completed: "success",
  failed: "danger",
};

const methodLabels: Record<SterilizationMethod, string> = {
  steam: "Steam (Autoclave)",
  eto: "ETO (Ethylene Oxide)",
  plasma: "Plasma",
  dry_heat: "Dry Heat",
  flash: "Flash",
};

// Dropdown options for categorical fields
const INSTRUMENT_CATEGORIES = [
  { value: "surgical", label: "Surgical Instruments" },
  { value: "diagnostic", label: "Diagnostic Instruments" },
  { value: "dental", label: "Dental Instruments" },
  { value: "ophthalmic", label: "Ophthalmic Instruments" },
  { value: "orthopedic", label: "Orthopedic Instruments" },
  { value: "endoscopy", label: "Endoscopy Equipment" },
  { value: "laparoscopy", label: "Laparoscopy Instruments" },
  { value: "cardiology", label: "Cardiology Instruments" },
  { value: "neurology", label: "Neurology Instruments" },
  { value: "urology", label: "Urology Instruments" },
  { value: "gynecology", label: "Gynecology Instruments" },
  { value: "ent", label: "ENT Instruments" },
  { value: "other", label: "Other" },
];

const MAINTENANCE_TYPES = [
  { value: "preventive", label: "Preventive Maintenance" },
  { value: "corrective", label: "Corrective Maintenance" },
  { value: "calibration", label: "Calibration" },
  { value: "validation", label: "Validation" },
  { value: "inspection", label: "Inspection" },
  { value: "repair", label: "Repair" },
  { value: "replacement", label: "Part Replacement" },
  { value: "cleaning", label: "Deep Cleaning" },
  { value: "other", label: "Other" },
];

// ── Instruments Tab ─────────────────────────────────────

function InstrumentsTab() {
  const canManage = useHasPermission(P.CSSD.INSTRUMENTS_MANAGE);
  const canManageSets = useHasPermission(P.CSSD.SETS_MANAGE);
  const qc = useQueryClient();
  const [instrOpened, { open: openInstr, close: closeInstr }] = useDisclosure(false);
  const [setOpened, { open: openSet, close: closeSet }] = useDisclosure(false);

  const { data: instruments = [], isLoading } = useQuery({
    queryKey: ["cssd-instruments"],
    queryFn: () => api.listCssdInstruments(),
  });

  const { data: sets = [] } = useQuery({
    queryKey: ["cssd-sets"],
    queryFn: () => api.listCssdSets(),
  });

  const [instrForm, setInstrForm] = useState<CreateCssdInstrumentRequest>({ barcode: "", name: "" });
  const createInstrMut = useMutation({
    mutationFn: (data: CreateCssdInstrumentRequest) => api.createCssdInstrument(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-instruments"] });
      notifications.show({ title: "Instrument added", message: "", color: "success" });
      closeInstr();
      setInstrForm({ barcode: "", name: "" });
    },
  });

  const [setForm, setSetForm] = useState<CreateCssdSetRequest>({ set_code: "", set_name: "" });
  const createSetMut = useMutation({
    mutationFn: (data: CreateCssdSetRequest) => api.createCssdSet(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-sets"] });
      notifications.show({ title: "Set created", message: "", color: "success" });
      closeSet();
      setSetForm({ set_code: "", set_name: "" });
    },
  });

  const instrColumns = [
    { key: "barcode" as const, label: "Barcode", render: (i: CssdInstrument) => i.barcode },
    { key: "name" as const, label: "Name", render: (i: CssdInstrument) => i.name },
    { key: "category" as const, label: "Category", render: (i: CssdInstrument) => i.category ?? "—" },
    { key: "status" as const, label: "Status", render: (i: CssdInstrument) => <Badge color={statusColors[i.status] ?? "slate"}>{i.status}</Badge> },
    { key: "lifecycle_uses" as const, label: "Uses", render: (i: CssdInstrument) => i.max_uses ? `${i.lifecycle_uses}/${i.max_uses}` : String(i.lifecycle_uses) },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Instruments: {instruments.length} | Sets: {sets.length}</Text>
        <Group>
          {canManageSets && (
            <Button variant="outline" leftSection={<IconPackage size={16} />} onClick={openSet}>New Set</Button>
          )}
          {canManage && (
            <Button leftSection={<IconPlus size={16} />} onClick={openInstr}>Add Instrument</Button>
          )}
        </Group>
      </Group>

      <DataTable columns={instrColumns} data={instruments} loading={isLoading} rowKey={(i) => i.id} emptyTitle="No instruments registered" />

      {sets.length > 0 && (
        <>
          <Text fw={600} mt="md">Instrument Sets</Text>
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
                  <Table.Td>{s.is_active ? <Badge color="success">Active</Badge> : <Badge color="slate">Inactive</Badge>}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      <Drawer opened={instrOpened} onClose={closeInstr} title="Add Instrument" position="right" size="sm">
        <Stack>
          <TextInput label="Barcode" required value={instrForm.barcode} onChange={(e) => setInstrForm({ ...instrForm, barcode: e.currentTarget.value })} />
          <TextInput label="Name" required value={instrForm.name} onChange={(e) => setInstrForm({ ...instrForm, name: e.currentTarget.value })} />
          <Select label="Category" data={INSTRUMENT_CATEGORIES} value={instrForm.category ?? null} onChange={(v) => setInstrForm({ ...instrForm, category: v || undefined })} clearable searchable />
          <TextInput label="Manufacturer" value={instrForm.manufacturer ?? ""} onChange={(e) => setInstrForm({ ...instrForm, manufacturer: e.currentTarget.value || undefined })} />
          <NumberInput label="Max Uses (lifecycle)" value={instrForm.max_uses ?? ""} onChange={(v) => setInstrForm({ ...instrForm, max_uses: v === "" ? undefined : Number(v) })} />
          <Textarea label="Notes" value={instrForm.notes ?? ""} onChange={(e) => setInstrForm({ ...instrForm, notes: e.currentTarget.value || undefined })} />
          <Button loading={createInstrMut.isPending} onClick={() => createInstrMut.mutate(instrForm)}>Save</Button>
        </Stack>
      </Drawer>

      <Drawer opened={setOpened} onClose={closeSet} title="Create Instrument Set" position="right" size="sm">
        <Stack>
          <TextInput label="Set Code" required value={setForm.set_code} onChange={(e) => setSetForm({ ...setForm, set_code: e.currentTarget.value })} />
          <TextInput label="Set Name" required value={setForm.set_name} onChange={(e) => setSetForm({ ...setForm, set_name: e.currentTarget.value })} />
          <TextInput label="Department" value={setForm.department ?? ""} onChange={(e) => setSetForm({ ...setForm, department: e.currentTarget.value || undefined })} />
          <Textarea label="Description" value={setForm.description ?? ""} onChange={(e) => setSetForm({ ...setForm, description: e.currentTarget.value || undefined })} />
          <Button loading={createSetMut.isPending} onClick={() => createSetMut.mutate(setForm)}>Save</Button>
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
    queryFn: () => api.listCssdLoads(),
  });

  const { data: sterilizers = [] } = useQuery({
    queryKey: ["cssd-sterilizers"],
    queryFn: () => api.listCssdSterilizers(),
  });

  const [loadForm, setLoadForm] = useState<CreateCssdLoadRequest>({ sterilizer_id: "", method: "steam" });
  const createLoadMut = useMutation({
    mutationFn: (data: CreateCssdLoadRequest) => api.createCssdLoad(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-loads"] });
      notifications.show({ title: "Load created", message: "", color: "success" });
      closeLoad();
      setLoadForm({ sterilizer_id: "", method: "steam" });
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LoadStatus }) =>
      api.updateCssdLoadStatus(id, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-loads"] });
      notifications.show({ title: "Load status updated", message: "", color: "primary" });
    },
  });

  // Indicators for detail view
  const { data: indicators = [] } = useQuery({
    queryKey: ["cssd-indicators", selectedLoad?.id],
    queryFn: () => api.listCssdIndicators(selectedLoad?.id ?? ""),
    enabled: !!selectedLoad,
  });

  const [indicatorForm, setIndicatorForm] = useState<RecordCssdIndicatorRequest>({
    indicator_type: "chemical",
    result_pass: true,
  });
  const indicatorMut = useMutation({
    mutationFn: (data: RecordCssdIndicatorRequest) =>
      api.recordCssdIndicator(selectedLoad?.id ?? "", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-indicators", selectedLoad?.id] });
      notifications.show({ title: "Indicator recorded", message: "", color: "success" });
      setIndicatorForm({ indicator_type: "chemical", result_pass: true });
    },
  });

  const columns = [
    { key: "load_number" as const, label: "Load #", render: (l: CssdSterilizationLoad) => l.load_number },
    { key: "method" as const, label: "Method", render: (l: CssdSterilizationLoad) => methodLabels[l.method] ?? l.method },
    { key: "status" as const, label: "Status", render: (l: CssdSterilizationLoad) => <Badge color={loadStatusColors[l.status] ?? "slate"}>{l.status}</Badge> },
    { key: "is_flash" as const, label: "Flash", render: (l: CssdSterilizationLoad) => l.is_flash ? <Badge color="orange">Flash</Badge> : "—" },
    { key: "created_at" as const, label: "Created", render: (l: CssdSterilizationLoad) => new Date(l.created_at).toLocaleString() },
    {
      key: "id" as const,
      label: "Actions",
      render: (l: CssdSterilizationLoad) => (
        <Group gap="xs">
          <Tooltip label="Details & Indicators">
            <ActionIcon variant="subtle" onClick={() => { setSelectedLoad(l); openDetail(); }} aria-label="View details">
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {canCreate && l.status === "loading" && (
            <Tooltip label="Start Cycle">
              <ActionIcon variant="subtle" color="primary" onClick={() => updateStatusMut.mutate({ id: l.id, status: "running" })} aria-label="Fire">
                <IconFlame size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canCreate && l.status === "running" && (
            <Tooltip label="Complete">
              <ActionIcon variant="subtle" color="success" onClick={() => updateStatusMut.mutate({ id: l.id, status: "completed" })} aria-label="Edit">
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
          <Button leftSection={<IconPlus size={16} />} onClick={openLoad}>New Load</Button>
        )}
      </Group>

      <DataTable columns={columns} data={loads} loading={isLoading} rowKey={(l) => l.id} emptyTitle="No sterilization loads" />

      <Drawer opened={loadOpened} onClose={closeLoad} title="Create Sterilization Load" position="right" size="sm">
        <Stack>
          <Select
            label="Sterilizer"
            data={sterilizers.map((s) => ({ value: s.id, label: s.name }))}
            value={loadForm.sterilizer_id}
            onChange={(v) => setLoadForm({ ...loadForm, sterilizer_id: v ?? "" })}
          />
          <Select
            label="Method"
            data={Object.entries(methodLabels).map(([v, l]) => ({ value: v, label: l }))}
            value={loadForm.method}
            onChange={(v) => setLoadForm({ ...loadForm, method: (v ?? "steam") as SterilizationMethod })}
          />
          <Checkbox label="Flash Sterilization" checked={loadForm.is_flash ?? false} onChange={(e) => setLoadForm({ ...loadForm, is_flash: e.currentTarget.checked })} />
          {loadForm.is_flash && (
            <TextInput label="Flash Reason" value={loadForm.flash_reason ?? ""} onChange={(e) => setLoadForm({ ...loadForm, flash_reason: e.currentTarget.value || undefined })} />
          )}
          <Textarea label="Notes" value={loadForm.notes ?? ""} onChange={(e) => setLoadForm({ ...loadForm, notes: e.currentTarget.value || undefined })} />
          <Button loading={createLoadMut.isPending} onClick={() => createLoadMut.mutate(loadForm)}>Create</Button>
        </Stack>
      </Drawer>

      <Drawer opened={detailOpened} onClose={closeDetail} title={`Load ${selectedLoad?.load_number ?? ""}`} position="right" size="xl">
        <Stack>
          {selectedLoad && (
            <>
              <Card withBorder>
                <Stack gap="xs">
                  <Group>
                    <Badge color={loadStatusColors[selectedLoad.status]}>{selectedLoad.status}</Badge>
                    {selectedLoad.is_flash && <Badge color="orange">Flash</Badge>}
                  </Group>
                  <Text size="sm"><b>Method:</b> {methodLabels[selectedLoad.method]}</Text>
                  {selectedLoad.temperature_c && <Text size="sm"><b>Temperature:</b> {String(selectedLoad.temperature_c)}°C</Text>}
                  {selectedLoad.pressure_psi && <Text size="sm"><b>Pressure:</b> {String(selectedLoad.pressure_psi)} PSI</Text>}
                  {selectedLoad.cycle_time_minutes && <Text size="sm"><b>Cycle Time:</b> {String(selectedLoad.cycle_time_minutes)} min</Text>}
                </Stack>
              </Card>

              <Text fw={600} mt="md">Cycle Indicators ({indicators.length})</Text>
              {indicators.length > 0 && (
                <Card withBorder>
                  <Stack gap="xs">
                    {indicators.map((ind: CssdIndicatorResult) => (
                      <Group key={ind.id} justify="space-between">
                        <Group gap="xs">
                          <Badge variant="light">{ind.indicator_type === "biological" ? "BI" : "CI"}</Badge>
                          <Text size="sm">{ind.indicator_type === "biological" ? "Biological" : "Chemical"}</Text>
                        </Group>
                        <Badge color={ind.result_pass ? "success" : "danger"}>
                          {ind.result_pass ? "Pass" : "Fail"}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              )}

              <Text fw={600} mt="md">Indicator Details</Text>
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
                        <Table.Td>{ind.result_pass ? <Badge color="success">Pass</Badge> : <Badge color="danger">Fail</Badge>}</Table.Td>
                        <Table.Td>{[ind.indicator_brand, ind.indicator_lot].filter(Boolean).join(" / ") || "—"}</Table.Td>
                        <Table.Td>{new Date(ind.read_at).toLocaleString()}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}

              {canCreate && (
                <>
                  <Text fw={600}>Record Indicator</Text>
                  <Select
                    label="Type"
                    data={[{ value: "chemical", label: "Chemical" }, { value: "biological", label: "Biological" }]}
                    value={indicatorForm.indicator_type}
                    onChange={(v) => setIndicatorForm({ ...indicatorForm, indicator_type: (v ?? "chemical") as IndicatorType })}
                  />
                  <Checkbox label="Pass" checked={indicatorForm.result_pass} onChange={(e) => setIndicatorForm({ ...indicatorForm, result_pass: e.currentTarget.checked })} />
                  <Group grow>
                    <TextInput label="Brand" value={indicatorForm.indicator_brand ?? ""} onChange={(e) => setIndicatorForm({ ...indicatorForm, indicator_brand: e.currentTarget.value || undefined })} />
                    <TextInput label="Lot #" value={indicatorForm.indicator_lot ?? ""} onChange={(e) => setIndicatorForm({ ...indicatorForm, indicator_lot: e.currentTarget.value || undefined })} />
                  </Group>
                  <Button loading={indicatorMut.isPending} onClick={() => indicatorMut.mutate(indicatorForm)}>Record</Button>
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
    queryFn: () => api.listCssdIssuances(),
  });

  const [form, setForm] = useState<CreateCssdIssuanceRequest>({ issued_to_department: "" });
  const createMut = useMutation({
    mutationFn: (data: CreateCssdIssuanceRequest) => api.createCssdIssuance(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-issuances"] });
      notifications.show({ title: "Pack issued", message: "", color: "success" });
      close();
      setForm({ issued_to_department: "" });
    },
  });

  const returnMut = useMutation({
    mutationFn: (id: string) => api.returnCssdIssuance(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-issuances"] });
      notifications.show({ title: "Pack returned", message: "", color: "primary" });
    },
  });

  const recallMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.recallCssdIssuance(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-issuances"] });
      notifications.show({ title: "Pack recalled", message: "", color: "orange" });
    },
  });

  const columns = [
    { key: "issued_to_department" as const, label: "Department", render: (i: CssdIssuance) => i.issued_to_department },
    { key: "issued_at" as const, label: "Issued At", render: (i: CssdIssuance) => new Date(i.issued_at).toLocaleString() },
    { key: "returned_at" as const, label: "Returned", render: (i: CssdIssuance) => i.returned_at ? new Date(i.returned_at).toLocaleString() : "—" },
    { key: "is_recalled" as const, label: "Status", render: (i: CssdIssuance) => {
      if (i.is_recalled) return <Badge color="danger">Recalled</Badge>;
      if (i.returned_at) return <Badge color="slate">Returned</Badge>;
      return <Badge color="success">Issued</Badge>;
    }},
    {
      key: "id" as const,
      label: "Actions",
      render: (i: CssdIssuance) => (
        <Group gap="xs">
          {canCreate && !i.returned_at && !i.is_recalled && (
            <>
              <Tooltip label="Return">
                <ActionIcon variant="subtle" color="primary" onClick={() => returnMut.mutate(i.id)} aria-label="Arrow Back">
                  <IconArrowBack size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Recall">
                <ActionIcon variant="subtle" color="danger" onClick={() => recallMut.mutate({ id: i.id, reason: "Quality concern" })} aria-label="Warning">
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
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Issue Pack</Button>
        )}
      </Group>

      <DataTable columns={columns} data={issuances} loading={isLoading} rowKey={(i) => i.id} emptyTitle="No issuances" />

      <Drawer opened={opened} onClose={close} title="Issue Sterile Pack" position="right" size="sm">
        <Stack>
          <TextInput label="Department" required value={form.issued_to_department} onChange={(e) => setForm({ ...form, issued_to_department: e.currentTarget.value })} />
          <PatientSearchSelect value={form.issued_to_patient_id ?? ""} onChange={(id) => setForm({ ...form, issued_to_patient_id: id || undefined })} label="Patient (optional)" />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Issue</Button>
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
    queryFn: () => api.listCssdSterilizers(),
  });

  const [form, setForm] = useState<CreateCssdSterilizerRequest>({ name: "" });
  const createMut = useMutation({
    mutationFn: (data: CreateCssdSterilizerRequest) => api.createCssdSterilizer(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-sterilizers"] });
      notifications.show({ title: "Sterilizer added", message: "", color: "success" });
      close();
      setForm({ name: "" });
    },
  });

  // Maintenance logs
  const { data: maintLogs = [] } = useQuery({
    queryKey: ["cssd-maintenance", selectedSterilizer?.id],
    queryFn: () => api.listCssdMaintenanceLogs(selectedSterilizer?.id ?? ""),
    enabled: !!selectedSterilizer,
  });

  const [maintForm, setMaintForm] = useState<CreateCssdMaintenanceRequest>({ maintenance_type: "" });
  const maintMut = useMutation({
    mutationFn: (data: CreateCssdMaintenanceRequest) =>
      api.createCssdMaintenanceLog(selectedSterilizer?.id ?? "", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-maintenance", selectedSterilizer?.id] });
      void qc.invalidateQueries({ queryKey: ["cssd-sterilizers"] });
      notifications.show({ title: "Maintenance logged", message: "", color: "success" });
      setMaintForm({ maintenance_type: "" });
    },
  });

  const columns = [
    { key: "name" as const, label: "Name", render: (s: CssdSterilizer) => s.name },
    { key: "model" as const, label: "Model", render: (s: CssdSterilizer) => s.model ?? "—" },
    { key: "method" as const, label: "Method", render: (s: CssdSterilizer) => methodLabels[s.method] ?? s.method },
    { key: "is_active" as const, label: "Status", render: (s: CssdSterilizer) => s.is_active ? <Badge color="success">Active</Badge> : <Badge color="slate">Inactive</Badge> },
    { key: "next_maintenance_at" as const, label: "Next Maint.", render: (s: CssdSterilizer) => s.next_maintenance_at ? new Date(s.next_maintenance_at).toLocaleDateString() : "—" },
    {
      key: "id" as const,
      label: "Actions",
      render: (s: CssdSterilizer) => (
        <Tooltip label="Maintenance Logs">
          <ActionIcon variant="subtle" onClick={() => { setSelectedSterilizer(s); openMaint(); }} aria-label="Settings">
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
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Add Sterilizer</Button>
        )}
      </Group>

      <DataTable columns={columns} data={sterilizers} loading={isLoading} rowKey={(s) => s.id} emptyTitle="No sterilizers registered" />

      <Drawer opened={opened} onClose={close} title="Add Sterilizer" position="right" size="sm">
        <Stack>
          <TextInput label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <TextInput label="Model" value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.currentTarget.value || undefined })} />
          <TextInput label="Serial Number" value={form.serial_number ?? ""} onChange={(e) => setForm({ ...form, serial_number: e.currentTarget.value || undefined })} />
          <Select
            label="Method"
            data={Object.entries(methodLabels).map(([v, l]) => ({ value: v, label: l }))}
            value={form.method ?? "steam"}
            onChange={(v) => setForm({ ...form, method: (v ?? "steam") as SterilizationMethod })}
          />
          <NumberInput label="Chamber Size (Liters)" decimalScale={1} value={form.chamber_size_liters ?? ""} onChange={(v) => setForm({ ...form, chamber_size_liters: v === "" ? undefined : Number(v) })} />
          <TextInput label="Location" value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Save</Button>
        </Stack>
      </Drawer>

      <Drawer opened={maintOpened} onClose={closeMaint} title={`Maintenance — ${selectedSterilizer?.name ?? ""}`} position="right" size="xl">
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
              <Select label="Type" required data={MAINTENANCE_TYPES} value={maintForm.maintenance_type} onChange={(v) => setMaintForm({ ...maintForm, maintenance_type: v ?? "" })} searchable />
              <TextInput label="Performed By" value={maintForm.performed_by ?? ""} onChange={(e) => setMaintForm({ ...maintForm, performed_by: e.currentTarget.value || undefined })} />
              <Textarea label="Findings" value={maintForm.findings ?? ""} onChange={(e) => setMaintForm({ ...maintForm, findings: e.currentTarget.value || undefined })} />
              <Textarea label="Actions Taken" value={maintForm.actions_taken ?? ""} onChange={(e) => setMaintForm({ ...maintForm, actions_taken: e.currentTarget.value || undefined })} />
              <NumberInput label="Cost" decimalScale={2} value={maintForm.cost ?? ""} onChange={(v) => setMaintForm({ ...maintForm, cost: v === "" ? undefined : Number(v) })} />
              <Button loading={maintMut.isPending} onClick={() => maintMut.mutate(maintForm)}>Log</Button>
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
          <Tabs.Tab value="instruments" leftSection={<IconPackage size={16} />}>Instruments</Tabs.Tab>
          <Tabs.Tab value="sterilization" leftSection={<IconFlame size={16} />}>Sterilization</Tabs.Tab>
          <Tabs.Tab value="issuance" leftSection={<IconTruckDelivery size={16} />}>Issuance</Tabs.Tab>
          <Tabs.Tab value="equipment" leftSection={<IconSettings size={16} />}>Equipment</Tabs.Tab>
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
