import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconPencil, IconShieldOff } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  PsychPatient,
  PsychAssessment,
  PsychEctSession,
  PsychRestraint,
  PsychMhrbNotification,
  CreatePsychPatientRequest,
  PsychAdmissionCategory,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../../components";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import type { Column } from "../../components/DataTable";

const ADMISSION_CATEGORIES: { value: PsychAdmissionCategory; label: string }[] = [
  { value: "independent", label: "Independent" },
  { value: "supported", label: "Supported" },
  { value: "minor_supported", label: "Minor / Supported" },
  { value: "emergency", label: "Emergency" },
];

export function PsychiatryPage() {
  useRequirePermission(P.SPECIALTY.PSYCHIATRY.PATIENTS_LIST);
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.SPECIALTY.PSYCHIATRY.PATIENTS_CREATE);
  const canRestraint = useHasPermission(P.SPECIALTY.PSYCHIATRY.RESTRAINT_MANAGE);

  const [tab, setTab] = useState<string | null>("patients");
  const [patOpen, patHandlers] = useDisclosure(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["psych-patients"],
    queryFn: () => api.listPsychPatients(),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["psych-assessments", selectedId],
    queryFn: () => api.listPsychAssessments(selectedId!),
    enabled: !!selectedId,
  });

  const { data: ectSessions = [] } = useQuery({
    queryKey: ["psych-ect", selectedId],
    queryFn: () => api.listEctSessions(selectedId!),
    enabled: !!selectedId,
  });

  const { data: restraints = [] } = useQuery({
    queryKey: ["psych-restraints", selectedId],
    queryFn: () => api.listRestraints(selectedId!),
    enabled: !!selectedId,
  });

  const { data: mhrb = [] } = useQuery({
    queryKey: ["psych-mhrb", selectedId],
    queryFn: () => api.listMhrbNotifications(selectedId!),
    enabled: !!selectedId,
  });

  const [patForm, setPatForm] = useState<CreatePsychPatientRequest>({
    patient_id: "", admission_category: "independent",
  });

  const createPat = useMutation({
    mutationFn: (data: CreatePsychPatientRequest) => api.createPsychPatient(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["psych-patients"] });
      patHandlers.close();
      notifications.show({ title: "Created", message: "Psychiatric patient registered", color: "success" });
    },
  });

  const releaseRestraint = useMutation({
    mutationFn: (id: string) => api.releaseRestraint(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["psych-restraints"] });
      notifications.show({ title: "Released", message: "Restraint released", color: "success" });
    },
  });

  const patCols: Column<PsychPatient>[] = [
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "category", label: "Category", render: (r) => <Badge>{r.admission_category.replace(/_/g, " ")}</Badge> },
    { key: "substance", label: "Substance Abuse", render: (r) => r.substance_abuse_flag ? <Badge color="orange">Yes</Badge> : <Text size="sm">No</Text> },
    { key: "restricted", label: "Restricted", render: (r) => r.is_restricted ? <Badge color="danger">RESTRICTED</Badge> : <Text size="sm">No</Text> },
    { key: "nominated", label: "Nominated Rep", render: (r) => <Text size="sm">{r.nominated_rep_name ?? "None"}</Text> },
    {
      key: "actions", label: "", render: (r) => (
        <ActionIcon variant="subtle" onClick={() => setSelectedId(r.id)} aria-label="Edit">
          <IconPencil size={16} />
        </ActionIcon>
      ),
    },
  ];

  const assessCols: Column<PsychAssessment>[] = [
    { key: "type", label: "Type", render: (r) => <Badge>{r.assessment_type}</Badge> },
    { key: "ham_d", label: "HAM-D", render: (r) => <Text size="sm">{r.ham_d_score ?? "---"}</Text> },
    { key: "bprs", label: "BPRS", render: (r) => <Text size="sm">{r.bprs_score ?? "---"}</Text> },
    { key: "date", label: "Date", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  const ectCols: Column<PsychEctSession>[] = [
    { key: "session", label: "Session #", render: (r) => <Text size="sm">{r.session_number}</Text> },
    { key: "laterality", label: "Laterality", render: (r) => <Badge>{r.laterality.replace(/_/g, " ")}</Badge> },
    { key: "consent", label: "Consent", render: (r) => r.consent_obtained ? <Badge color="success">Yes</Badge> : <Badge color="danger">No</Badge> },
    { key: "stimulus", label: "Stimulus", render: (r) => <Text size="sm">{r.stimulus_dose ?? "---"}</Text> },
    { key: "seizure", label: "Seizure Duration", render: (r) => <Text size="sm">{r.seizure_duration ?? "---"}</Text> },
    { key: "date", label: "Date", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  const restraintCols: Column<PsychRestraint>[] = [
    { key: "type", label: "Type", render: (r) => <Badge color={r.restraint_type === "seclusion" ? "danger" : r.restraint_type === "chemical" ? "orange" : "warning"}>{r.restraint_type}</Badge> },
    { key: "start", label: "Start", render: (r) => <Text size="sm">{new Date(r.start_time).toLocaleString()}</Text> },
    { key: "review_due", label: "Review Due", render: (r) => <Text size="sm" c={new Date(r.review_due_at) < new Date() && !r.reviewed_at ? "danger" : undefined}>{new Date(r.review_due_at).toLocaleString()}</Text> },
    { key: "released", label: "Released", render: (r) => r.released_at ? <Badge color="success">Yes</Badge> : <Badge color="danger">Active</Badge> },
    {
      key: "actions", label: "", render: (r) => !r.released_at && canRestraint ? (
        <ActionIcon variant="subtle" color="success" onClick={() => releaseRestraint.mutate(r.id)} aria-label="Shield Off">
          <IconShieldOff size={16} />
        </ActionIcon>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Psychiatry"
        subtitle="MHCA 2017 compliant psychiatric care management"
        actions={canCreate ? <Button leftSection={<IconPlus size={16} />} onClick={patHandlers.open}>Register Patient</Button> : undefined}
      />

      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="patients">Patients</Tabs.Tab>
          <Tabs.Tab value="assessments">Assessments</Tabs.Tab>
          <Tabs.Tab value="ect">ECT Register</Tabs.Tab>
          <Tabs.Tab value="restraint">Seclusion & Restraint</Tabs.Tab>
          <Tabs.Tab value="mhrb">MHRB</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="patients" pt="md">
          <DataTable columns={patCols} data={patients} loading={isLoading} rowKey={(r) => r.id} />
        </Tabs.Panel>
        <Tabs.Panel value="assessments" pt="md">
          {selectedId ? <DataTable columns={assessCols} data={assessments} loading={false} rowKey={(r) => r.id} /> : <Text c="dimmed">Select a patient to view assessments</Text>}
        </Tabs.Panel>
        <Tabs.Panel value="ect" pt="md">
          {selectedId ? <DataTable columns={ectCols} data={ectSessions} loading={false} rowKey={(r) => r.id} /> : <Text c="dimmed">Select a patient to view ECT sessions</Text>}
        </Tabs.Panel>
        <Tabs.Panel value="restraint" pt="md">
          {selectedId ? <DataTable columns={restraintCols} data={restraints} loading={false} rowKey={(r) => r.id} /> : <Text c="dimmed">Select a patient to view restraint records</Text>}
        </Tabs.Panel>
        <Tabs.Panel value="mhrb" pt="md">
          {selectedId ? (
            <DataTable
              columns={[
                { key: "type", label: "Type", render: (r: PsychMhrbNotification) => <Badge>{r.notification_type}</Badge> },
                { key: "ref", label: "Reference", render: (r: PsychMhrbNotification) => <Text size="sm">{r.reference_number ?? "---"}</Text> },
                { key: "status", label: "Status", render: (r: PsychMhrbNotification) => <Badge>{r.status}</Badge> },
                { key: "date", label: "Date", render: (r: PsychMhrbNotification) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
              ]}
              data={mhrb}
              loading={false}
              rowKey={(r) => r.id}
            />
          ) : <Text c="dimmed">Select a patient to view MHRB notifications</Text>}
        </Tabs.Panel>
      </Tabs>

      <Drawer opened={patOpen} onClose={patHandlers.close} title="Register Psychiatric Patient" size="lg" position="right">
        <Stack>
          <TextInput label="Patient ID" required value={patForm.patient_id} onChange={(e) => setPatForm((p) => ({ ...p, patient_id: e.currentTarget.value }))} />
          <Select label="Admission Category" required data={ADMISSION_CATEGORIES} value={patForm.admission_category} onChange={(v) => setPatForm((p) => ({ ...p, admission_category: (v ?? "independent") as PsychAdmissionCategory }))} />
          <Textarea label="Advance Directive" value={patForm.advance_directive_text ?? ""} onChange={(e) => setPatForm((p) => ({ ...p, advance_directive_text: e.currentTarget.value }))} />
          <TextInput label="Nominated Rep Name" value={patForm.nominated_rep_name ?? ""} onChange={(e) => setPatForm((p) => ({ ...p, nominated_rep_name: e.currentTarget.value }))} />
          <TextInput label="Nominated Rep Contact" value={patForm.nominated_rep_contact ?? ""} onChange={(e) => setPatForm((p) => ({ ...p, nominated_rep_contact: e.currentTarget.value }))} />
          <TextInput label="Nominated Rep Relation" value={patForm.nominated_rep_relation ?? ""} onChange={(e) => setPatForm((p) => ({ ...p, nominated_rep_relation: e.currentTarget.value }))} />
          <Switch label="Substance Abuse" checked={patForm.substance_abuse_flag ?? false} onChange={(e) => setPatForm((p) => ({ ...p, substance_abuse_flag: e.currentTarget.checked }))} />
          <Button onClick={() => createPat.mutate(patForm)} loading={createPat.isPending}>Register Patient</Button>
        </Stack>
      </Drawer>
    </div>
  );
}
