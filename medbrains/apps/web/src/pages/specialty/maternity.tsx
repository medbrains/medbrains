import { useState } from "react";
import { ActionIcon, Badge, Button, Drawer, Group, NumberInput, Select, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconPencil } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  MaternityRegistration, AncVisit, LaborRecord, NewbornRecord, PostnatalRecord,
  CreateMaternityRegistrationRequest, AncRiskCategory,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../../components";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import type { Column } from "../../components/DataTable";

const RISK_COLORS: Record<string, string> = { low: "success", moderate: "warning", high: "orange", very_high: "danger" };
const RISK_CATEGORIES: { value: AncRiskCategory; label: string }[] = [
  { value: "low", label: "Low" }, { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" }, { value: "very_high", label: "Very High" },
];

export function MaternityPage() {
  useRequirePermission(P.SPECIALTY.MATERNITY.REGISTRATIONS_LIST);
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.SPECIALTY.MATERNITY.REGISTRATIONS_CREATE);

  const [tab, setTab] = useState<string | null>("registrations");
  const [regOpen, regHandlers] = useDisclosure(false);
  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);
  const [selectedLaborId, setSelectedLaborId] = useState<string | null>(null);

  const { data: registrations = [], isLoading } = useQuery({ queryKey: ["maternity-regs"], queryFn: () => api.listMaternityRegistrations() });
  const { data: ancVisits = [] } = useQuery({ queryKey: ["anc-visits", selectedRegId], queryFn: () => api.listAncVisits(selectedRegId!), enabled: !!selectedRegId });
  const { data: laborRecords = [] } = useQuery({ queryKey: ["labor-records", selectedRegId], queryFn: () => api.listLaborRecords(selectedRegId!), enabled: !!selectedRegId });
  const { data: newborns = [] } = useQuery({ queryKey: ["newborns", selectedLaborId], queryFn: () => api.listNewborns(selectedLaborId!), enabled: !!selectedLaborId });
  const { data: postnatal = [] } = useQuery({ queryKey: ["postnatal", selectedRegId], queryFn: () => api.listPostnatalRecords(selectedRegId!), enabled: !!selectedRegId });

  const [regForm, setRegForm] = useState<CreateMaternityRegistrationRequest>({ patient_id: "", registration_number: "" });

  const createReg = useMutation({
    mutationFn: (data: CreateMaternityRegistrationRequest) => api.createMaternityRegistration(data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["maternity-regs"] }); regHandlers.close(); notifications.show({ title: "Created", message: "Maternity registration created", color: "success" }); },
  });

  const regCols: Column<MaternityRegistration>[] = [
    { key: "reg_number", label: "Reg #", render: (r) => <Text size="sm" fw={500}>{r.registration_number}</Text> },
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "edd", label: "EDD", render: (r) => <Text size="sm">{r.edd_date ? new Date(r.edd_date).toLocaleDateString() : "—"}</Text> },
    { key: "gravida", label: "G/P/A/L", render: (r) => <Text size="sm">{r.gravida}/{r.para}/{r.abortion}/{r.living}</Text> },
    { key: "risk", label: "Risk", render: (r) => <Badge color={RISK_COLORS[r.risk_category] ?? "slate"}>{r.risk_category.replace(/_/g, " ")}</Badge> },
    { key: "high_risk", label: "High Risk", render: (r) => r.is_high_risk ? <Badge color="danger">HIGH RISK</Badge> : <Text size="sm">No</Text> },
    { key: "blood", label: "Blood Group", render: (r) => <Text size="sm">{r.blood_group ?? "—"}</Text> },
    {
      key: "actions", label: "", render: (r) => (
        <ActionIcon variant="subtle" onClick={() => setSelectedRegId(r.id)} aria-label="Edit">
          <IconPencil size={16} />
        </ActionIcon>
      ),
    },
  ];

  const ancCols: Column<AncVisit>[] = [
    { key: "visit", label: "Visit #", render: (r) => <Text size="sm">{r.visit_number}</Text> },
    { key: "weeks", label: "Weeks", render: (r) => <Text size="sm">{r.gestational_weeks ?? "—"}</Text> },
    { key: "weight", label: "Weight (kg)", render: (r) => <Text size="sm">{r.weight_kg ?? "—"}</Text> },
    { key: "bp", label: "BP", render: (r) => <Text size="sm">{r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : "—"}</Text> },
    { key: "fhr", label: "FHR", render: (r) => <Text size="sm">{r.fetal_heart_rate ?? "—"}</Text> },
    { key: "hb", label: "Hb", render: (r) => <Text size="sm">{r.hemoglobin ?? "—"}</Text> },
    { key: "pcpndt", label: "PCPNDT Form F", render: (r) => r.pcpndt_form_f_filed ? <Badge color="success">Filed</Badge> : <Badge color="slate">No</Badge> },
    { key: "date", label: "Date", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  const laborCols: Column<LaborRecord>[] = [
    { key: "stage", label: "Stage", render: (r) => <Badge>{r.current_stage.replace(/_/g, " ")}</Badge> },
    { key: "delivery", label: "Delivery", render: (r) => <Text size="sm">{r.delivery_type?.replace(/_/g, " ") ?? "In progress"}</Text> },
    { key: "apgar1", label: "Apgar 1m", render: (r) => <Text size="sm">{r.apgar_1min ?? "—"}</Text> },
    { key: "apgar5", label: "Apgar 5m", render: (r) => <Text size="sm">{r.apgar_5min ?? "—"}</Text> },
    { key: "baby_weight", label: "Baby (g)", render: (r) => <Text size="sm">{r.baby_weight_gm ?? "—"}</Text> },
    { key: "onset", label: "Onset", render: (r) => <Text size="sm">{r.labor_onset_time ? new Date(r.labor_onset_time).toLocaleString() : "—"}</Text> },
    {
      key: "actions", label: "", render: (r) => (
        <ActionIcon variant="subtle" onClick={() => setSelectedLaborId(r.id)} aria-label="Edit">
          <IconPencil size={16} />
        </ActionIcon>
      ),
    },
  ];

  const newbornCols: Column<NewbornRecord>[] = [
    { key: "birth_date", label: "Birth Date", render: (r) => <Text size="sm">{new Date(r.birth_date).toLocaleDateString()}</Text> },
    { key: "gender", label: "Gender", render: (r) => <Badge>{r.gender}</Badge> },
    { key: "weight", label: "Weight (g)", render: (r) => <Text size="sm">{r.weight_gm}</Text> },
    { key: "apgar1", label: "Apgar 1m", render: (r) => <Text size="sm">{r.apgar_1min ?? "—"}</Text> },
    { key: "apgar5", label: "Apgar 5m", render: (r) => <Text size="sm">{r.apgar_5min ?? "—"}</Text> },
    { key: "nicu", label: "NICU", render: (r) => r.nicu_admission_needed ? <Badge color="danger">Yes</Badge> : <Text size="sm">No</Text> },
    { key: "cert", label: "Birth Cert #", render: (r) => <Text size="sm">{r.birth_certificate_number ?? "—"}</Text> },
  ];

  return (
    <div>
      <PageHeader
        title="Maternity & OB-GYN"
        subtitle="Antenatal care, labor & delivery, newborn and postnatal records"
        actions={canCreate ? <Button leftSection={<IconPlus size={16} />} onClick={regHandlers.open}>New Registration</Button> : undefined}
      />
      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="registrations">Registrations</Tabs.Tab>
          <Tabs.Tab value="anc">ANC Visits</Tabs.Tab>
          <Tabs.Tab value="labor">Labor & Delivery</Tabs.Tab>
          <Tabs.Tab value="newborn">Newborn & Postnatal</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="registrations" pt="md">
          <DataTable columns={regCols} data={registrations} loading={isLoading} rowKey={(r) => r.id} />
        </Tabs.Panel>
        <Tabs.Panel value="anc" pt="md">
          {selectedRegId ? <DataTable columns={ancCols} data={ancVisits} loading={false} rowKey={(r) => r.id} /> : <Text c="dimmed">Select a registration to view ANC visits</Text>}
        </Tabs.Panel>
        <Tabs.Panel value="labor" pt="md">
          {selectedRegId ? <DataTable columns={laborCols} data={laborRecords} loading={false} rowKey={(r) => r.id} /> : <Text c="dimmed">Select a registration to view labor records</Text>}
        </Tabs.Panel>
        <Tabs.Panel value="newborn" pt="md">
          {selectedLaborId ? (
            <Stack>
              <Text fw={600}>Newborn Records</Text>
              <DataTable columns={newbornCols} data={newborns} loading={false} rowKey={(r) => r.id} />
            </Stack>
          ) : selectedRegId ? (
            <Stack>
              <Text fw={600}>Postnatal Records</Text>
              <DataTable
                columns={[
                  { key: "day", label: "Day PP", render: (r: PostnatalRecord) => <Text size="sm">{r.day_postpartum}</Text> },
                  { key: "baby_weight", label: "Baby Weight (g)", render: (r: PostnatalRecord) => <Text size="sm">{r.baby_weight_gm ?? "—"}</Text> },
                  { key: "date", label: "Date", render: (r: PostnatalRecord) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
                ]}
                data={postnatal}
                loading={false}
                rowKey={(r) => r.id}
              />
            </Stack>
          ) : <Text c="dimmed">Select a registration or labor record</Text>}
        </Tabs.Panel>
      </Tabs>
      <Drawer opened={regOpen} onClose={regHandlers.close} title="New Maternity Registration" size="lg" position="right">
        <Stack>
          <TextInput label="Patient ID" required value={regForm.patient_id} onChange={(e) => setRegForm((p) => ({ ...p, patient_id: e.currentTarget.value }))} />
          <TextInput label="Registration Number" required value={regForm.registration_number} onChange={(e) => setRegForm((p) => ({ ...p, registration_number: e.currentTarget.value }))} />
          <TextInput label="LMP Date" placeholder="YYYY-MM-DD" value={regForm.lmp_date ?? ""} onChange={(e) => setRegForm((p) => ({ ...p, lmp_date: e.currentTarget.value }))} />
          <TextInput label="EDD Date" placeholder="YYYY-MM-DD" value={regForm.edd_date ?? ""} onChange={(e) => setRegForm((p) => ({ ...p, edd_date: e.currentTarget.value }))} />
          <Group grow>
            <NumberInput label="Gravida" value={regForm.gravida ?? ""} onChange={(v) => setRegForm((p) => ({ ...p, gravida: typeof v === "number" ? v : undefined }))} />
            <NumberInput label="Para" value={regForm.para ?? ""} onChange={(v) => setRegForm((p) => ({ ...p, para: typeof v === "number" ? v : undefined }))} />
            <NumberInput label="Abortion" value={regForm.abortion ?? ""} onChange={(v) => setRegForm((p) => ({ ...p, abortion: typeof v === "number" ? v : undefined }))} />
            <NumberInput label="Living" value={regForm.living ?? ""} onChange={(v) => setRegForm((p) => ({ ...p, living: typeof v === "number" ? v : undefined }))} />
          </Group>
          <Select label="Risk Category" data={RISK_CATEGORIES} value={regForm.risk_category ?? null} onChange={(v) => setRegForm((p) => ({ ...p, risk_category: (v as AncRiskCategory) ?? undefined }))} />
          <TextInput label="Blood Group" value={regForm.blood_group ?? ""} onChange={(e) => setRegForm((p) => ({ ...p, blood_group: e.currentTarget.value }))} />
          <Button onClick={() => createReg.mutate(regForm)} loading={createReg.isPending}>Register</Button>
        </Stack>
      </Drawer>
    </div>
  );
}
