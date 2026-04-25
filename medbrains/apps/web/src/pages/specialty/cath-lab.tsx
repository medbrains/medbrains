import { useState } from "react";
import { PatientSearchSelect } from "../../components/PatientSearchSelect";
import { EmployeeSearchSelect } from "../../components/EmployeeSearchSelect";
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconPencil } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  CathProcedure,
  CathHemodynamic,
  CathDevice,
  CathStemiTimeline,
  CathPostMonitoring,
  CreateCathProcedureRequest,
  CathProcedureType,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../../components";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import type { Column } from "../../components/DataTable";

const PROCEDURE_TYPES: { value: CathProcedureType; label: string }[] = [
  { value: "diagnostic_cath", label: "Diagnostic Catheterization" },
  { value: "pci", label: "PCI" },
  { value: "pacemaker", label: "Pacemaker" },
  { value: "icd", label: "ICD" },
  { value: "eps", label: "Electrophysiology" },
  { value: "ablation", label: "Ablation" },
  { value: "valve_intervention", label: "Valve Intervention" },
  { value: "structural", label: "Structural" },
  { value: "peripheral", label: "Peripheral" },
];

export function CathLabPage() {
  useRequirePermission(P.SPECIALTY.CATH_LAB.PROCEDURES_LIST);
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.SPECIALTY.CATH_LAB.PROCEDURES_CREATE);

  const [tab, setTab] = useState<string | null>("procedures");
  const [procOpen, procHandlers] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // ── Queries ──
  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ["cath-procedures"],
    queryFn: () => api.listCathProcedures(),
  });

  const { data: hemos = [] } = useQuery({
    queryKey: ["cath-hemos", detailId],
    queryFn: () => api.listCathHemodynamics(detailId!),
    enabled: !!detailId,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["cath-devices", detailId],
    queryFn: () => api.listCathDevices(detailId!),
    enabled: !!detailId,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["stemi-timeline", detailId],
    queryFn: () => api.listStemiTimeline(detailId!),
    enabled: !!detailId,
  });

  const { data: monitoring = [] } = useQuery({
    queryKey: ["post-monitoring", detailId],
    queryFn: () => api.listPostMonitoring(detailId!),
    enabled: !!detailId,
  });

  // ── Create Procedure ──
  const [procForm, setProcForm] = useState<CreateCathProcedureRequest>({
    patient_id: "",
    procedure_type: "diagnostic_cath",
    operator_id: "",
  });

  const createProc = useMutation({
    mutationFn: (data: CreateCathProcedureRequest) => api.createCathProcedure(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cath-procedures"] });
      procHandlers.close();
      notifications.show({ title: "Created", message: "Procedure created", color: "success" });
    },
  });

  // ── Columns ──
  const procCols: Column<CathProcedure>[] = [
    { key: "procedure_type", label: "Type", render: (r) => <Badge>{r.procedure_type.replace(/_/g, " ")}</Badge> },
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "is_stemi", label: "STEMI", render: (r) => r.is_stemi ? <Badge color="danger">STEMI</Badge> : <Text size="sm">No</Text> },
    { key: "door_to_balloon", label: "D2B (min)", render: (r) => <Text size="sm">{r.door_to_balloon_minutes ?? "—"}</Text> },
    { key: "fluoroscopy", label: "Fluoro (s)", render: (r) => <Text size="sm">{r.fluoroscopy_time_seconds ?? "—"}</Text> },
    { key: "contrast", label: "Contrast (ml)", render: (r) => <Text size="sm">{r.contrast_volume_ml ?? "—"}</Text> },
    { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
    {
      key: "actions", label: "", render: (r) => (
        <ActionIcon variant="subtle" onClick={() => setDetailId(r.id)} aria-label="Edit">
          <IconPencil size={16} />
        </ActionIcon>
      ),
    },
  ];

  const hemoCols: Column<CathHemodynamic>[] = [
    { key: "site", label: "Site", render: (r) => <Badge>{r.site}</Badge> },
    { key: "systolic", label: "Systolic", render: (r) => <Text size="sm">{r.systolic_mmhg ?? "—"}</Text> },
    { key: "diastolic", label: "Diastolic", render: (r) => <Text size="sm">{r.diastolic_mmhg ?? "—"}</Text> },
    { key: "mean", label: "Mean", render: (r) => <Text size="sm">{r.mean_mmhg ?? "—"}</Text> },
    { key: "saturation", label: "SpO2 %", render: (r) => <Text size="sm">{r.saturation_pct ?? "—"}</Text> },
  ];

  const deviceCols: Column<CathDevice>[] = [
    { key: "device_type", label: "Type", render: (r) => <Badge>{r.device_type}</Badge> },
    { key: "manufacturer", label: "Manufacturer", render: (r) => <Text size="sm">{r.manufacturer ?? "—"}</Text> },
    { key: "lot_number", label: "Lot #", render: (r) => <Text size="sm">{r.lot_number ?? "—"}</Text> },
    { key: "consignment", label: "Consignment", render: (r) => r.is_consignment ? <Badge color="orange">Yes</Badge> : <Text size="sm">No</Text> },
    { key: "billed", label: "Billed", render: (r) => r.billed ? <Badge color="success">Yes</Badge> : <Badge color="slate">No</Badge> },
  ];

  const stemiCols: Column<CathStemiTimeline>[] = [
    { key: "event", label: "Event", render: (r) => <Badge>{r.event.replace(/_/g, " ")}</Badge> },
    { key: "event_time", label: "Time", render: (r) => <Text size="sm">{new Date(r.event_time).toLocaleTimeString()}</Text> },
    { key: "recorded_by", label: "Recorded By", render: (r) => <Text size="sm">{r.recorded_by.slice(0, 8)}</Text> },
  ];

  const monitorCols: Column<CathPostMonitoring>[] = [
    { key: "monitored_at", label: "Time", render: (r) => <Text size="sm">{new Date(r.monitored_at).toLocaleString()}</Text> },
    { key: "sheath", label: "Sheath", render: (r) => <Text size="sm">{r.sheath_status ?? "—"}</Text> },
    { key: "access_site", label: "Access Site", render: (r) => <Text size="sm">{r.access_site_status ?? "—"}</Text> },
    { key: "ambulation", label: "Ambulation", render: (r) => r.ambulation_started ? <Badge color="success">Started</Badge> : <Badge color="slate">Pending</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Cath Lab"
        subtitle="Interventional cardiology procedures and STEMI pathway"
        actions={canCreate ? <Button leftSection={<IconPlus size={16} />} onClick={procHandlers.open}>New Procedure</Button> : undefined}
      />

      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="procedures">Procedures</Tabs.Tab>
          <Tabs.Tab value="stemi">STEMI Dashboard</Tabs.Tab>
          <Tabs.Tab value="consignment">Consignment Stock</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="procedures" pt="md">
          <DataTable columns={procCols} data={procedures} loading={isLoading} rowKey={(r) => r.id} />
        </Tabs.Panel>

        <Tabs.Panel value="stemi" pt="md">
          {detailId ? (
            <Stack>
              <Text fw={600}>STEMI Timeline</Text>
              <DataTable columns={stemiCols} data={timeline} loading={false} rowKey={(r) => r.id} />
            </Stack>
          ) : (
            <Text c="dimmed">Select a STEMI procedure from the Procedures tab to view timeline</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="consignment" pt="md">
          {detailId ? (
            <Stack>
              <Text fw={600}>Devices Used</Text>
              <DataTable columns={deviceCols} data={devices.filter((d) => d.is_consignment)} loading={false} rowKey={(r) => r.id} />
            </Stack>
          ) : (
            <Text c="dimmed">Select a procedure to view consignment devices</Text>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Procedure Detail Drawer */}
      <Drawer opened={!!detailId} onClose={() => setDetailId(null)} title="Procedure Detail" size="xl" position="right">
        <Tabs defaultValue="hemodynamics">
          <Tabs.List>
            <Tabs.Tab value="hemodynamics">Hemodynamics</Tabs.Tab>
            <Tabs.Tab value="devices">Devices</Tabs.Tab>
            <Tabs.Tab value="monitoring">Post-Monitoring</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="hemodynamics" pt="md">
            <DataTable columns={hemoCols} data={hemos} loading={false} rowKey={(r) => r.id} />
          </Tabs.Panel>
          <Tabs.Panel value="devices" pt="md">
            <DataTable columns={deviceCols} data={devices} loading={false} rowKey={(r) => r.id} />
          </Tabs.Panel>
          <Tabs.Panel value="monitoring" pt="md">
            <DataTable columns={monitorCols} data={monitoring} loading={false} rowKey={(r) => r.id} />
          </Tabs.Panel>
        </Tabs>
      </Drawer>

      {/* Create Procedure Drawer */}
      <Drawer opened={procOpen} onClose={procHandlers.close} title="New Cath Procedure" size="lg" position="right">
        <Stack>
          <PatientSearchSelect value={procForm.patient_id ?? ""} onChange={(id) => setProcForm((p) => ({ ...p, patient_id: id }))} required />
          <Select label="Procedure Type" required data={PROCEDURE_TYPES} value={procForm.procedure_type ?? null} onChange={(v) => setProcForm((p) => ({ ...p, procedure_type: (v ?? "diagnostic_cath") as CathProcedureType }))} />
          <EmployeeSearchSelect value={procForm.operator_id ?? ""} onChange={(id) => setProcForm((p) => ({ ...p, operator_id: id }))} label="Operator" required />
          <Switch label="STEMI" checked={procForm?.is_stemi ?? false} onChange={(e) => { if (e?.currentTarget) setProcForm((p) => ({ ...p, is_stemi: e.currentTarget.checked })); }} />
          <TextInput label="Contrast Type" value={procForm.contrast_type ?? ""} onChange={(e) => setProcForm((p) => ({ ...p, contrast_type: e.currentTarget.value }))} />
          <NumberInput label="Contrast Volume (ml)" value={procForm.contrast_volume_ml ?? ""} onChange={(v) => setProcForm((p) => ({ ...p, contrast_volume_ml: typeof v === "number" ? v : undefined }))} />
          <Button onClick={() => createProc.mutate(procForm)} loading={createProc.isPending}>Create Procedure</Button>
        </Stack>
      </Drawer>
    </div>
  );
}
