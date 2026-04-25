import { useState } from "react";
import { Badge, Button, Drawer, Group, JsonInput, NumberInput, Select, Stack, Switch, Tabs, Text, TextInput } from "@mantine/core";
import { PatientSearchSelect } from "../../components/PatientSearchSelect";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  SpecialtyTemplate, SpecialtyRecord, DialysisSession, ChemoProtocol,
  CreateSpecialtyTemplateRequest, CreateSpecialtyRecordRequest,
  CreateDialysisSessionRequest, CreateChemoProtocolRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../../components";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import type { Column } from "../../components/DataTable";

export function OtherSpecialtiesPage() {
  useRequirePermission(P.SPECIALTY.OTHER.RECORDS_LIST);
  const qc = useQueryClient();
  const canTemplates = useHasPermission(P.SPECIALTY.OTHER.TEMPLATES_MANAGE);
  const canRecords = useHasPermission(P.SPECIALTY.OTHER.RECORDS_CREATE);
  const canDialysis = useHasPermission(P.SPECIALTY.OTHER.DIALYSIS_MANAGE);
  const canChemo = useHasPermission(P.SPECIALTY.OTHER.CHEMO_MANAGE);

  const [tab, setTab] = useState<string | null>("templates");
  const [tmplOpen, tmplHandlers] = useDisclosure(false);
  const [recOpen, recHandlers] = useDisclosure(false);
  const [dialOpen, dialHandlers] = useDisclosure(false);
  const [chemoOpen, chemoHandlers] = useDisclosure(false);

  const { data: templates = [], isLoading: tmplLoading } = useQuery({ queryKey: ["specialty-templates"], queryFn: () => api.listSpecialtyTemplates() });
  const { data: records = [] } = useQuery({ queryKey: ["specialty-records"], queryFn: () => api.listSpecialtyRecords() });
  const { data: dialysis = [] } = useQuery({ queryKey: ["dialysis-sessions"], queryFn: () => api.listDialysisSessions() });
  const { data: chemo = [] } = useQuery({ queryKey: ["chemo-protocols"], queryFn: () => api.listChemoProtocols() });

  const [tmplForm, setTmplForm] = useState<CreateSpecialtyTemplateRequest>({ specialty: "", template_name: "", template_code: "", form_schema: {} });
  const [recForm, setRecForm] = useState<CreateSpecialtyRecordRequest>({ patient_id: "", specialty: "", form_data: {} });
  const [dialForm, setDialForm] = useState<CreateDialysisSessionRequest>({ patient_id: "" });
  const [chemoForm, setChemoForm] = useState<CreateChemoProtocolRequest>({ patient_id: "", protocol_name: "" });

  const createTmpl = useMutation({
    mutationFn: (data: CreateSpecialtyTemplateRequest) => api.createSpecialtyTemplate(data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["specialty-templates"] }); tmplHandlers.close(); notifications.show({ title: "Created", message: "Template created", color: "success" }); },
  });

  const createRec = useMutation({
    mutationFn: (data: CreateSpecialtyRecordRequest) => api.createSpecialtyRecord(data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["specialty-records"] }); recHandlers.close(); notifications.show({ title: "Created", message: "Record created", color: "success" }); },
  });

  const createDial = useMutation({
    mutationFn: (data: CreateDialysisSessionRequest) => api.createDialysisSession(data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["dialysis-sessions"] }); dialHandlers.close(); notifications.show({ title: "Created", message: "Session created", color: "success" }); },
  });

  const createChemo = useMutation({
    mutationFn: (data: CreateChemoProtocolRequest) => api.createChemoProtocol(data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["chemo-protocols"] }); chemoHandlers.close(); notifications.show({ title: "Created", message: "Protocol created", color: "success" }); },
  });

  const tmplCols: Column<SpecialtyTemplate>[] = [
    { key: "specialty", label: "Specialty", render: (r) => <Badge>{r.specialty}</Badge> },
    { key: "name", label: "Template", render: (r) => <Text size="sm" fw={500}>{r.template_name}</Text> },
    { key: "code", label: "Code", render: (r) => <Text size="sm">{r.template_code}</Text> },
    { key: "date", label: "Created", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  const recCols: Column<SpecialtyRecord>[] = [
    { key: "specialty", label: "Specialty", render: (r) => <Badge>{r.specialty}</Badge> },
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "template", label: "Template", render: (r) => <Text size="sm">{r.template_id?.slice(0, 8) ?? "Custom"}</Text> },
    { key: "date", label: "Date", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  const dialCols: Column<DialysisSession>[] = [
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "machine", label: "Machine #", render: (r) => <Text size="sm">{r.machine_number ?? "—"}</Text> },
    { key: "access", label: "Access", render: (r) => <Text size="sm">{r.access_type ?? "—"}</Text> },
    { key: "pre_weight", label: "Pre (kg)", render: (r) => <Text size="sm">{r.pre_weight_kg ?? "—"}</Text> },
    { key: "post_weight", label: "Post (kg)", render: (r) => <Text size="sm">{r.post_weight_kg ?? "—"}</Text> },
    { key: "uf", label: "UF Goal/Achieved", render: (r) => <Text size="sm">{r.uf_goal_ml ?? "—"}/{r.uf_achieved_ml ?? "—"}</Text> },
    { key: "ktv", label: "Kt/V", render: (r) => <Text size="sm">{r.kt_v ?? "—"}</Text> },
    { key: "urr", label: "URR %", render: (r) => <Text size="sm">{r.urr_pct ?? "—"}</Text> },
  ];

  const chemoCols: Column<ChemoProtocol>[] = [
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "protocol", label: "Protocol", render: (r) => <Text size="sm" fw={500}>{r.protocol_name}</Text> },
    { key: "cancer", label: "Cancer Type", render: (r) => <Text size="sm">{r.cancer_type ?? "—"}</Text> },
    { key: "staging", label: "Staging", render: (r) => <Text size="sm">{r.staging ?? "—"}</Text> },
    { key: "cycle", label: "Cycle #", render: (r) => <Text size="sm">{r.cycle_number}</Text> },
    { key: "toxicity", label: "Toxicity", render: (r) => <Text size="sm">{r.toxicity_grade != null ? `Grade ${r.toxicity_grade}` : "—"}</Text> },
    { key: "recist", label: "RECIST", render: (r) => <Text size="sm">{r.recist_response ?? "—"}</Text> },
    { key: "tumor_board", label: "Tumor Board", render: (r) => r.tumor_board_reviewed ? <Badge color="success">Reviewed</Badge> : <Badge color="slate">Pending</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Other Specialties"
        subtitle="Specialty templates, dialysis, chemotherapy, and generic clinical records"
        actions={
          <Group>
            {canTemplates && <Button leftSection={<IconPlus size={16} />} onClick={tmplHandlers.open}>New Template</Button>}
            {canRecords && <Button variant="light" leftSection={<IconPlus size={16} />} onClick={recHandlers.open}>New Record</Button>}
          </Group>
        }
      />
      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="templates">Templates</Tabs.Tab>
          <Tabs.Tab value="records">Records</Tabs.Tab>
          <Tabs.Tab value="dialysis">Dialysis</Tabs.Tab>
          <Tabs.Tab value="chemo">Chemotherapy</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="templates" pt="md"><DataTable columns={tmplCols} data={templates} loading={tmplLoading} rowKey={(r) => r.id} /></Tabs.Panel>
        <Tabs.Panel value="records" pt="md"><DataTable columns={recCols} data={records} loading={false} rowKey={(r) => r.id} /></Tabs.Panel>
        <Tabs.Panel value="dialysis" pt="md">
          <Group justify="flex-end" mb="md">{canDialysis && <Button leftSection={<IconPlus size={16} />} onClick={dialHandlers.open}>New Session</Button>}</Group>
          <DataTable columns={dialCols} data={dialysis} loading={false} rowKey={(r) => r.id} />
        </Tabs.Panel>
        <Tabs.Panel value="chemo" pt="md">
          <Group justify="flex-end" mb="md">{canChemo && <Button leftSection={<IconPlus size={16} />} onClick={chemoHandlers.open}>New Protocol</Button>}</Group>
          <DataTable columns={chemoCols} data={chemo} loading={false} rowKey={(r) => r.id} />
        </Tabs.Panel>
      </Tabs>
      <Drawer opened={tmplOpen} onClose={tmplHandlers.close} title="New Specialty Template" size="lg" position="right">
        <Stack>
          <TextInput label="Specialty" required placeholder="e.g. Pediatrics, Ophthalmology" value={tmplForm.specialty} onChange={(e) => setTmplForm((p) => ({ ...p, specialty: e.currentTarget.value }))} />
          <TextInput label="Template Name" required value={tmplForm.template_name} onChange={(e) => setTmplForm((p) => ({ ...p, template_name: e.currentTarget.value }))} />
          <TextInput label="Template Code" required value={tmplForm.template_code} onChange={(e) => setTmplForm((p) => ({ ...p, template_code: e.currentTarget.value }))} />
          <JsonInput label="Form Schema (JSON)" minRows={4} value={JSON.stringify(tmplForm.form_schema, null, 2)} onChange={(v) => { try { setTmplForm((p) => ({ ...p, form_schema: JSON.parse(v) })); } catch { /* ignore parse errors while typing */ } }} />
          <Button onClick={() => createTmpl.mutate(tmplForm)} loading={createTmpl.isPending}>Create Template</Button>
        </Stack>
      </Drawer>
      <Drawer opened={recOpen} onClose={recHandlers.close} title="New Specialty Record" size="lg" position="right">
        <Stack>
          <PatientSearchSelect value={recForm.patient_id} onChange={(v) => setRecForm((p) => ({ ...p, patient_id: v }))} required />
          <TextInput label="Specialty" required value={recForm.specialty} onChange={(e) => setRecForm((p) => ({ ...p, specialty: e.currentTarget.value }))} />
          <Select label="Template" data={templates.map((t) => ({ value: t.id, label: `${t.specialty} — ${t.template_name}` }))} value={recForm.template_id ?? null} onChange={(v) => setRecForm((p) => ({ ...p, template_id: v ?? undefined }))} />
          <JsonInput label="Form Data (JSON)" minRows={4} value={JSON.stringify(recForm.form_data, null, 2)} onChange={(v) => { try { setRecForm((p) => ({ ...p, form_data: JSON.parse(v) })); } catch { /* ignore */ } }} />
          <Button onClick={() => createRec.mutate(recForm)} loading={createRec.isPending}>Create Record</Button>
        </Stack>
      </Drawer>
      <Drawer opened={dialOpen} onClose={dialHandlers.close} title="New Dialysis Session" size="lg" position="right">
        <Stack>
          <PatientSearchSelect value={dialForm.patient_id} onChange={(v) => setDialForm((p) => ({ ...p, patient_id: v }))} required />
          <TextInput label="Machine #" value={dialForm.machine_number ?? ""} onChange={(e) => setDialForm((p) => ({ ...p, machine_number: e.currentTarget.value }))} />
          <TextInput label="Access Type" value={dialForm.access_type ?? ""} onChange={(e) => setDialForm((p) => ({ ...p, access_type: e.currentTarget.value }))} />
          <NumberInput label="Pre Weight (kg)" value={dialForm.pre_weight_kg ?? ""} onChange={(v) => setDialForm((p) => ({ ...p, pre_weight_kg: typeof v === "number" ? v : undefined }))} />
          <NumberInput label="UF Goal (ml)" value={dialForm.uf_goal_ml ?? ""} onChange={(v) => setDialForm((p) => ({ ...p, uf_goal_ml: typeof v === "number" ? v : undefined }))} />
          <Button onClick={() => createDial.mutate(dialForm)} loading={createDial.isPending}>Start Session</Button>
        </Stack>
      </Drawer>
      <Drawer opened={chemoOpen} onClose={chemoHandlers.close} title="New Chemo Protocol" size="lg" position="right">
        <Stack>
          <PatientSearchSelect value={chemoForm.patient_id} onChange={(v) => setChemoForm((p) => ({ ...p, patient_id: v }))} required />
          <TextInput label="Protocol Name" required value={chemoForm.protocol_name} onChange={(e) => setChemoForm((p) => ({ ...p, protocol_name: e.currentTarget.value }))} />
          <TextInput label="Cancer Type" value={chemoForm.cancer_type ?? ""} onChange={(e) => setChemoForm((p) => ({ ...p, cancer_type: e.currentTarget.value }))} />
          <TextInput label="Staging" value={chemoForm.staging ?? ""} onChange={(e) => setChemoForm((p) => ({ ...p, staging: e.currentTarget.value }))} />
          <NumberInput label="Cycle #" value={chemoForm.cycle_number ?? ""} onChange={(v) => setChemoForm((p) => ({ ...p, cycle_number: typeof v === "number" ? v : undefined }))} />
          <Switch label="Tumor Board Reviewed" checked={chemoForm.tumor_board_reviewed ?? false} onChange={(e) => setChemoForm((p) => ({ ...p, tumor_board_reviewed: e.currentTarget.checked }))} />
          <Button onClick={() => createChemo.mutate(chemoForm)} loading={createChemo.isPending}>Create Protocol</Button>
        </Stack>
      </Drawer>
    </div>
  );
}
