import { useState } from "react";
import { ActionIcon, Badge, Button, Drawer, Group, NumberInput, Stack, Switch, Tabs, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  DnrOrder, PainAssessment, MortuaryRecord, NuclearMedSource,
  CreateDnrOrderRequest, CreatePainAssessmentRequest, CreateMortuaryRecordRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../../components";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import type { Column } from "../../components/DataTable";

const DNR_COLORS: Record<string, string> = { active: "danger", expired: "slate", revoked: "warning" };
const BODY_COLORS: Record<string, string> = { received: "primary", cold_storage: "info", inquest_pending: "orange", pm_scheduled: "warning", pm_completed: "teal", released: "success", unclaimed: "danger", disposed: "slate" };

export function PalliativePage() {
  useRequirePermission(P.SPECIALTY.PALLIATIVE.DNR_LIST);
  const qc = useQueryClient();
  const canDnr = useHasPermission(P.SPECIALTY.PALLIATIVE.DNR_MANAGE);
  const canPain = useHasPermission(P.SPECIALTY.PALLIATIVE.PAIN_CREATE);
  const canMortuary = useHasPermission(P.SPECIALTY.PALLIATIVE.MORTUARY_MANAGE);

  const [tab, setTab] = useState<string | null>("dnr");
  const [dnrOpen, dnrHandlers] = useDisclosure(false);
  const [painOpen, painHandlers] = useDisclosure(false);
  const [mortuaryOpen, mortuaryHandlers] = useDisclosure(false);

  const { data: dnrOrders = [], isLoading: dnrLoading } = useQuery({ queryKey: ["dnr-orders"], queryFn: () => api.listDnrOrders() });
  const { data: painRecords = [] } = useQuery({ queryKey: ["pain-assessments"], queryFn: () => api.listPainAssessments() });
  const { data: mortuaryRecords = [] } = useQuery({ queryKey: ["mortuary-records"], queryFn: () => api.listMortuaryRecords() });
  const { data: nucSources = [] } = useQuery({ queryKey: ["nuclear-sources"], queryFn: () => api.listNuclearSources() });

  const [dnrForm, setDnrForm] = useState<CreateDnrOrderRequest>({ patient_id: "" });
  const [painForm, setPainForm] = useState<CreatePainAssessmentRequest>({ patient_id: "", pain_score: 0 });
  const [mortForm, setMortForm] = useState<CreateMortuaryRecordRequest>({ body_receipt_number: "", deceased_name: "" });

  const createDnr = useMutation({
    mutationFn: (data: CreateDnrOrderRequest) => api.createDnrOrder(data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["dnr-orders"] }); dnrHandlers.close(); notifications.show({ title: "Created", message: "DNR order created (48hr review)", color: "success" }); },
  });

  const revokeDnr = useMutation({
    mutationFn: (id: string) => api.revokeDnrOrder(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["dnr-orders"] }); notifications.show({ title: "Revoked", message: "DNR order revoked", color: "warning" }); },
  });

  const createPain = useMutation({
    mutationFn: (data: CreatePainAssessmentRequest) => api.createPainAssessment(data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["pain-assessments"] }); painHandlers.close(); notifications.show({ title: "Created", message: "Pain assessment recorded", color: "success" }); },
  });

  const createMort = useMutation({
    mutationFn: (data: CreateMortuaryRecordRequest) => api.createMortuaryRecord(data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["mortuary-records"] }); mortuaryHandlers.close(); notifications.show({ title: "Created", message: "Mortuary record created", color: "success" }); },
  });

  const dnrCols: Column<DnrOrder>[] = [
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "status", label: "Status", render: (r) => <Badge color={DNR_COLORS[r.status] ?? "slate"}>{r.status.toUpperCase()}</Badge> },
    { key: "review_due", label: "Review Due", render: (r) => <Text size="sm" c={new Date(r.review_due_at) < new Date() ? "danger" : undefined}>{new Date(r.review_due_at).toLocaleString()}</Text> },
    { key: "scope", label: "Scope", render: (r) => <Text size="sm">{r.scope ?? "Full DNR"}</Text> },
    { key: "authorized", label: "Authorized By", render: (r) => <Text size="sm">{r.authorized_by.slice(0, 8)}</Text> },
    {
      key: "actions", label: "", render: (r) => r.status === "active" && canDnr ? (
        <ActionIcon variant="subtle" color="danger" onClick={() => revokeDnr.mutate(r.id)} aria-label="Close"><IconX size={16} /></ActionIcon>
      ) : null,
    },
  ];

  const painCols: Column<PainAssessment>[] = [
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "pain_score", label: "Pain Score", render: (r) => <Badge color={r.pain_score >= 7 ? "danger" : r.pain_score >= 4 ? "orange" : "success"}>{r.pain_score}/10</Badge> },
    { key: "who_ladder", label: "WHO Ladder", render: (r) => <Text size="sm">Step {r.who_ladder_step ?? "---"}</Text> },
    { key: "opioid", label: "Morphine Eq (mg)", render: (r) => <Text size="sm">{r.opioid_dose_morphine_eq ?? "---"}</Text> },
    { key: "breakthrough", label: "Breakthroughs", render: (r) => <Text size="sm">{r.breakthrough_doses ?? "---"}</Text> },
    { key: "date", label: "Date", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  const mortCols: Column<MortuaryRecord>[] = [
    { key: "receipt", label: "Receipt #", render: (r) => <Text size="sm" fw={500}>{r.body_receipt_number}</Text> },
    { key: "name", label: "Deceased", render: (r) => <Text size="sm">{r.deceased_name}</Text> },
    { key: "mlc", label: "MLC", render: (r) => r.is_mlc ? <Badge color="danger">MLC</Badge> : <Text size="sm">No</Text> },
    { key: "status", label: "Status", render: (r) => <Badge color={BODY_COLORS[r.status] ?? "slate"}>{r.status.replace(/_/g, " ")}</Badge> },
    { key: "storage", label: "Storage Slot", render: (r) => <Text size="sm">{r.cold_storage_slot ?? "---"}</Text> },
    { key: "organ", label: "Organ Donation", render: (r) => <Text size="sm">{r.organ_donation_status ?? "---"}</Text> },
  ];

  const nucSourceCols: Column<NuclearMedSource>[] = [
    { key: "isotope", label: "Isotope", render: (r) => <Text size="sm" fw={500}>{r.isotope}</Text> },
    { key: "activity", label: "Activity (mCi)", render: (r) => <Text size="sm">{r.activity_mci}</Text> },
    { key: "half_life", label: "Half-life (h)", render: (r) => <Text size="sm">{r.half_life_hours}</Text> },
    { key: "aerb", label: "AERB License", render: (r) => <Text size="sm">{r.aerb_license_number ?? "---"}</Text> },
    { key: "active", label: "Active", render: (r) => r.is_active ? <Badge color="success">Yes</Badge> : <Badge color="slate">No</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Palliative, Mortuary & Nuclear Medicine"
        subtitle="End-of-life care, body management, and radiopharmaceuticals"
        actions={
          <Group>
            {canDnr && <Button leftSection={<IconPlus size={16} />} onClick={dnrHandlers.open}>New DNR</Button>}
            {canPain && <Button variant="light" leftSection={<IconPlus size={16} />} onClick={painHandlers.open}>Pain Assessment</Button>}
            {canMortuary && <Button variant="light" leftSection={<IconPlus size={16} />} onClick={mortuaryHandlers.open}>Mortuary Record</Button>}
          </Group>
        }
      />
      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="dnr">DNR Orders</Tabs.Tab>
          <Tabs.Tab value="pain">Pain Assessment</Tabs.Tab>
          <Tabs.Tab value="mortuary">Mortuary</Tabs.Tab>
          <Tabs.Tab value="nucmed">Nuclear Medicine</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="dnr" pt="md"><DataTable columns={dnrCols} data={dnrOrders} loading={dnrLoading} rowKey={(r) => r.id} /></Tabs.Panel>
        <Tabs.Panel value="pain" pt="md"><DataTable columns={painCols} data={painRecords} loading={false} rowKey={(r) => r.id} /></Tabs.Panel>
        <Tabs.Panel value="mortuary" pt="md"><DataTable columns={mortCols} data={mortuaryRecords} loading={false} rowKey={(r) => r.id} /></Tabs.Panel>
        <Tabs.Panel value="nucmed" pt="md">
          <Stack>
            <Text fw={600}>Radioactive Sources</Text>
            <DataTable columns={nucSourceCols} data={nucSources} loading={false} rowKey={(r) => r.id} />
          </Stack>
        </Tabs.Panel>
      </Tabs>
      <Drawer opened={dnrOpen} onClose={dnrHandlers.close} title="New DNR Order" size="md" position="right">
        <Stack>
          <TextInput label="Patient ID" required value={dnrForm.patient_id} onChange={(e) => setDnrForm((p) => ({ ...p, patient_id: e.currentTarget.value }))} />
          <TextInput label="Admission ID" value={dnrForm.admission_id ?? ""} onChange={(e) => setDnrForm((p) => ({ ...p, admission_id: e.currentTarget.value }))} />
          <TextInput label="Scope" placeholder="Full DNR, Limited, etc." value={dnrForm.scope ?? ""} onChange={(e) => setDnrForm((p) => ({ ...p, scope: e.currentTarget.value }))} />
          <Button onClick={() => createDnr.mutate(dnrForm)} loading={createDnr.isPending}>Create DNR Order</Button>
        </Stack>
      </Drawer>
      <Drawer opened={painOpen} onClose={painHandlers.close} title="Pain Assessment" size="md" position="right">
        <Stack>
          <TextInput label="Patient ID" required value={painForm.patient_id} onChange={(e) => setPainForm((p) => ({ ...p, patient_id: e.currentTarget.value }))} />
          <NumberInput label="Pain Score (0-10)" required min={0} max={10} value={painForm.pain_score} onChange={(v) => setPainForm((p) => ({ ...p, pain_score: typeof v === "number" ? v : 0 }))} />
          <NumberInput label="WHO Ladder Step (1-3)" min={1} max={3} value={painForm.who_ladder_step ?? ""} onChange={(v) => setPainForm((p) => ({ ...p, who_ladder_step: typeof v === "number" ? v : undefined }))} />
          <NumberInput label="Opioid Dose (Morphine Eq mg)" value={painForm.opioid_dose_morphine_eq ?? ""} onChange={(v) => setPainForm((p) => ({ ...p, opioid_dose_morphine_eq: typeof v === "number" ? v : undefined }))} />
          <NumberInput label="Breakthrough Doses" value={painForm.breakthrough_doses ?? ""} onChange={(v) => setPainForm((p) => ({ ...p, breakthrough_doses: typeof v === "number" ? v : undefined }))} />
          <Button onClick={() => createPain.mutate(painForm)} loading={createPain.isPending}>Record Assessment</Button>
        </Stack>
      </Drawer>
      <Drawer opened={mortuaryOpen} onClose={mortuaryHandlers.close} title="New Mortuary Record" size="md" position="right">
        <Stack>
          <TextInput label="Body Receipt Number" required value={mortForm.body_receipt_number} onChange={(e) => setMortForm((p) => ({ ...p, body_receipt_number: e.currentTarget.value }))} />
          <TextInput label="Deceased Name" required value={mortForm.deceased_name} onChange={(e) => setMortForm((p) => ({ ...p, deceased_name: e.currentTarget.value }))} />
          <Switch label="MLC Case" checked={mortForm.is_mlc ?? false} onChange={(e) => setMortForm((p) => ({ ...p, is_mlc: e.currentTarget.checked }))} />
          <TextInput label="MLC Case ID" value={mortForm.mlc_case_id ?? ""} onChange={(e) => setMortForm((p) => ({ ...p, mlc_case_id: e.currentTarget.value }))} />
          <TextInput label="Cold Storage Slot" value={mortForm.cold_storage_slot ?? ""} onChange={(e) => setMortForm((p) => ({ ...p, cold_storage_slot: e.currentTarget.value }))} />
          <Button onClick={() => createMort.mutate(mortForm)} loading={createMort.isPending}>Create Record</Button>
        </Stack>
      </Drawer>
    </div>
  );
}
