import {
  Drawer,
  Group,
  JsonInput,
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
import { useHasPermission } from "@medbrains/stores";
import type {
  CancerStaging,
  ChemoProtocol,
  CreateCancerStagingRequest,
  CreateChemoProtocolRequest,
  CreateDialysisSessionRequest,
  CreateRadiationRequest,
  CreateSpecialtyRecordRequest,
  CreateSpecialtyTemplateRequest,
  DialysisSession,
  RadiationSession,
  SpecialtyRecord,
  SpecialtyTemplate,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { specialtyService } from "@/services/specialty.service";
import { DialyzerPicker } from "./dialysis/dialyzer-picker";
import { MachinesPanel } from "./dialysis/machines-panel";
import { ShiftsPanel } from "./dialysis/shifts-panel";

export function OtherSpecialtiesPage() {
  useRequirePermission(P.SPECIALTY.OTHER.RECORDS_LIST);
  const qc = useQueryClient();
  const canTemplates = useHasPermission(P.SPECIALTY.OTHER.TEMPLATES_MANAGE);
  const canRecords = useHasPermission(P.SPECIALTY.OTHER.RECORDS_CREATE);
  const canDialysis = useHasPermission(P.SPECIALTY.OTHER.DIALYSIS_MANAGE);
  // The chemo handlers gate on specialty.other.records.create, not on a
  // chemo-specific code — the dialysis/oncology tabs each have their own.
  const canChemo = useHasPermission(P.SPECIALTY.OTHER.RECORDS_CREATE);

  const [tab, setTab] = useState<string | null>("templates");
  const [tmplOpen, tmplHandlers] = useDisclosure(false);
  const [recOpen, recHandlers] = useDisclosure(false);
  const [dialOpen, dialHandlers] = useDisclosure(false);
  const [chemoOpen, chemoHandlers] = useDisclosure(false);
  const [stagingOpen, stagingHandlers] = useDisclosure(false);
  const [radOpen, radHandlers] = useDisclosure(false);
  const canOncology = useHasPermission(P.SPECIALTY.OTHER.ONCOLOGY_CREATE);

  const { data: templates = [], isLoading: tmplLoading } = useQuery({
    queryKey: ["specialty-templates"],
    queryFn: () => specialtyService.listSpecialtyTemplates(),
  });
  const { data: records = [] } = useQuery({
    queryKey: ["specialty-records"],
    queryFn: () => specialtyService.listSpecialtyRecords(),
  });
  const { data: dialysis = [] } = useQuery({
    queryKey: ["dialysis-sessions"],
    queryFn: () => specialtyService.listDialysisSessions(),
  });
  const { data: chemo = [] } = useQuery({
    queryKey: ["chemo-protocols"],
    queryFn: () => specialtyService.listChemoProtocols(),
  });
  const { data: stagings = [] } = useQuery({
    queryKey: ["cancer-stagings"],
    queryFn: () => specialtyService.listCancerStagings(),
  });
  const { data: radiation = [] } = useQuery({
    queryKey: ["radiation-sessions"],
    queryFn: () => specialtyService.listRadiationSessions(),
  });

  const [tmplForm, setTmplForm] = useState<CreateSpecialtyTemplateRequest>({
    specialty: "",
    template_name: "",
    template_code: "",
    form_schema: {},
  });
  const [recForm, setRecForm] = useState<CreateSpecialtyRecordRequest>({
    patient_id: "",
    specialty: "",
    form_data: {},
  });
  const [dialForm, setDialForm] = useState<CreateDialysisSessionRequest>({ patient_id: "" });
  const [chemoForm, setChemoForm] = useState<CreateChemoProtocolRequest>({
    patient_id: "",
    protocol_name: "",
  });
  const { data: anthraCumulative } = useQuery({
    queryKey: ["anthra-cumulative", chemoForm.patient_id, chemoForm.anthracycline_agent],
    queryFn: () =>
      specialtyService.anthracyclineCumulative(
        chemoForm.patient_id,
        chemoForm.anthracycline_agent ?? "",
      ),
    enabled: !!chemoForm.patient_id && !!chemoForm.anthracycline_agent?.trim(),
  });
  const [stagingForm, setStagingForm] = useState<CreateCancerStagingRequest>({
    patient_id: "",
    primary_site: "",
  });
  const [radForm, setRadForm] = useState<CreateRadiationRequest>({
    patient_id: "",
    site: "",
  });

  const createTmpl = useMutation({
    mutationFn: (data: CreateSpecialtyTemplateRequest) =>
      specialtyService.createSpecialtyTemplate(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["specialty-templates"] });
      tmplHandlers.close();
      notifications.show({ title: "Created", message: "Template created", color: "success" });
    },
  });

  const createRec = useMutation({
    mutationFn: (data: CreateSpecialtyRecordRequest) =>
      specialtyService.createSpecialtyRecord(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["specialty-records"] });
      recHandlers.close();
      notifications.show({ title: "Created", message: "Record created", color: "success" });
    },
  });

  const createDial = useMutation({
    mutationFn: (data: CreateDialysisSessionRequest) =>
      specialtyService.createDialysisSession(data),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["dialysis-sessions"] });
      dialHandlers.close();
      if (result.uf_rate_exceeds_safe && result.uf_rate_ml_kg_hr != null) {
        notifications.show({
          title: "High ultrafiltration rate",
          message: `Planned UF ${result.uf_rate_ml_kg_hr.toFixed(1)} mL/kg/hr exceeds the safe ceiling (~13). Extend the session or lower the goal to avoid intradialytic hypotension.`,
          color: "orange",
          autoClose: false,
        });
      } else {
        notifications.show({ title: "Created", message: "Session created", color: "success" });
      }
    },
    onError: (e: Error) =>
      notifications.show({ title: "Failed", message: e.message, color: "danger" }),
  });

  const createChemo = useMutation({
    mutationFn: (data: CreateChemoProtocolRequest) => specialtyService.createChemoProtocol(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chemo-protocols"] });
      chemoHandlers.close();
      notifications.show({ title: "Created", message: "Protocol created", color: "success" });
    },
  });

  const createStaging = useMutation({
    mutationFn: (data: CreateCancerStagingRequest) => specialtyService.createCancerStaging(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cancer-stagings"] });
      stagingHandlers.close();
      notifications.show({ title: "Created", message: "Staging recorded", color: "success" });
    },
  });

  const createRad = useMutation({
    mutationFn: (data: CreateRadiationRequest) => specialtyService.createRadiationSession(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiation-sessions"] });
      radHandlers.close();
      notifications.show({
        title: "Created",
        message: "Radiation session recorded",
        color: "success",
      });
    },
  });

  const tmplCols: Column<SpecialtyTemplate>[] = [
    {
      key: "specialty",
      label: "Specialty",
      render: (r) => <Badge tone="neutral">{r.specialty}</Badge>,
    },
    {
      key: "name",
      label: "Template",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.template_name}
        </Text>
      ),
    },
    { key: "code", label: "Code", render: (r) => <Text size="sm">{r.template_code}</Text> },
    {
      key: "date",
      label: "Created",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  const recCols: Column<SpecialtyRecord>[] = [
    {
      key: "specialty",
      label: "Specialty",
      render: (r) => <Badge tone="neutral">{r.specialty}</Badge>,
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "template",
      label: "Template",
      render: (r) => <Text size="sm">{r.template_id?.slice(0, 8) ?? "Custom"}</Text>,
    },
    {
      key: "date",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  const dialCols: Column<DialysisSession>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "machine",
      label: "Machine #",
      render: (r) => <Text size="sm">{r.machine_number ?? "—"}</Text>,
    },
    {
      key: "access",
      label: "Access",
      render: (r) => <Text size="sm">{r.access_type ?? "—"}</Text>,
    },
    {
      key: "pre_weight",
      label: "Pre (kg)",
      render: (r) => <Text size="sm">{r.pre_weight_kg ?? "—"}</Text>,
    },
    {
      key: "post_weight",
      label: "Post (kg)",
      render: (r) => <Text size="sm">{r.post_weight_kg ?? "—"}</Text>,
    },
    {
      key: "uf",
      label: "UF Goal/Achieved",
      render: (r) => (
        <Text size="sm">
          {r.uf_goal_ml ?? "—"}/{r.uf_achieved_ml ?? "—"}
        </Text>
      ),
    },
    { key: "ktv", label: "Kt/V", render: (r) => <Text size="sm">{r.kt_v ?? "—"}</Text> },
    { key: "urr", label: "URR %", render: (r) => <Text size="sm">{r.urr_pct ?? "—"}</Text> },
  ];

  const chemoCols: Column<ChemoProtocol>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "protocol",
      label: "Protocol",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.protocol_name}
        </Text>
      ),
    },
    {
      key: "cancer",
      label: "Cancer Type",
      render: (r) => <Text size="sm">{r.cancer_type ?? "—"}</Text>,
    },
    { key: "staging", label: "Staging", render: (r) => <Text size="sm">{r.staging ?? "—"}</Text> },
    { key: "cycle", label: "Cycle #", render: (r) => <Text size="sm">{r.cycle_number}</Text> },
    {
      key: "toxicity",
      label: "Toxicity",
      render: (r) => (
        <Text size="sm">{r.toxicity_grade != null ? `Grade ${r.toxicity_grade}` : "—"}</Text>
      ),
    },
    {
      key: "recist",
      label: "RECIST",
      render: (r) => <Text size="sm">{r.recist_response ?? "—"}</Text>,
    },
    {
      key: "tumor_board",
      label: "Tumor Board",
      render: (r) =>
        r.tumor_board_reviewed ? (
          <Badge tone="success">Reviewed</Badge>
        ) : (
          <Badge tone="neutral">Pending</Badge>
        ),
    },
  ];

  const stagingCols: Column<CancerStaging>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    { key: "primary_site", label: "Site", render: (r) => <Text size="sm">{r.primary_site}</Text> },
    {
      key: "tnm",
      label: "TNM",
      render: (r) => (
        <Text size="sm">
          {r.t_stage ?? "—"} {r.n_stage ?? ""} {r.m_stage ?? ""}
        </Text>
      ),
    },
    {
      key: "overall_stage",
      label: "Stage",
      render: (r) => <Badge tone="neutral">{r.overall_stage ?? "—"}</Badge>,
    },
    {
      key: "date",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  const radCols: Column<RadiationSession>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    { key: "site", label: "Site", render: (r) => <Text size="sm">{r.site}</Text> },
    {
      key: "dose",
      label: "Dose / fractions",
      render: (r) => (
        <Text size="sm">
          {r.total_dose_gy ? `${r.total_dose_gy} Gy` : "—"}
          {r.fractions ? ` / ${r.fractions}` : ""}
        </Text>
      ),
    },
    {
      key: "session_number",
      label: "Session #",
      render: (r) => <Text size="sm">{r.session_number ?? "—"}</Text>,
    },
    {
      key: "date",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Other Specialties"
        subtitle="Specialty templates, dialysis, chemotherapy, and generic clinical records"
        actions={
          <Group>
            {canTemplates && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={tmplHandlers.open}
              >
                New Template
              </Button>
            )}
            {canRecords && (
              <Button
                tone="secondary"
                leftSection={<IconPlus size={16} />}
                onClick={recHandlers.open}
              >
                New Record
              </Button>
            )}
          </Group>
        }
      />
      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="templates">Templates</Tabs.Tab>
          <Tabs.Tab value="records">Records</Tabs.Tab>
          <Tabs.Tab value="dialysis">Dialysis</Tabs.Tab>
          <Tabs.Tab value="chemo">Chemotherapy</Tabs.Tab>
          <Tabs.Tab value="staging">Staging</Tabs.Tab>
          <Tabs.Tab value="radiation">Radiation</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="templates" pt="md">
          <DataTable
            columns={tmplCols}
            data={templates}
            loading={tmplLoading}
            rowKey={(r) => r.id}
          />
        </Tabs.Panel>
        <Tabs.Panel value="records" pt="md">
          <DataTable columns={recCols} data={records} loading={false} rowKey={(r) => r.id} />
        </Tabs.Panel>
        <Tabs.Panel value="dialysis" pt="md">
          <Group justify="flex-end" mb="md">
            {canDialysis && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={dialHandlers.open}
              >
                New Session
              </Button>
            )}
          </Group>
          <Tabs defaultValue="sessions" variant="pills">
            <Tabs.List mb="md">
              <Tabs.Tab value="sessions">Sessions</Tabs.Tab>
              <Tabs.Tab value="shifts">Shifts</Tabs.Tab>
              <Tabs.Tab value="machines">Machines</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="sessions">
              <DataTable columns={dialCols} data={dialysis} loading={false} rowKey={(r) => r.id} />
            </Tabs.Panel>
            <Tabs.Panel value="shifts">
              <ShiftsPanel />
            </Tabs.Panel>
            <Tabs.Panel value="machines">
              <MachinesPanel />
            </Tabs.Panel>
          </Tabs>
        </Tabs.Panel>
        <Tabs.Panel value="chemo" pt="md">
          <Group justify="flex-end" mb="md">
            {canChemo && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={chemoHandlers.open}
              >
                New Protocol
              </Button>
            )}
          </Group>
          <DataTable columns={chemoCols} data={chemo} loading={false} rowKey={(r) => r.id} />
        </Tabs.Panel>
        <Tabs.Panel value="staging" pt="md">
          <Group justify="flex-end" mb="md">
            {canOncology && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={stagingHandlers.open}
              >
                New staging
              </Button>
            )}
          </Group>
          <DataTable columns={stagingCols} data={stagings} loading={false} rowKey={(r) => r.id} />
        </Tabs.Panel>
        <Tabs.Panel value="radiation" pt="md">
          <Group justify="flex-end" mb="md">
            {canOncology && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={radHandlers.open}
              >
                New session
              </Button>
            )}
          </Group>
          <DataTable columns={radCols} data={radiation} loading={false} rowKey={(r) => r.id} />
        </Tabs.Panel>
      </Tabs>
      <Drawer
        opened={tmplOpen}
        onClose={tmplHandlers.close}
        title="New Specialty Template"
        size="lg"
        position="right"
      >
        <Stack>
          <TextInput
            label="Specialty"
            required
            placeholder="e.g. Pediatrics, Ophthalmology"
            value={tmplForm.specialty}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setTmplForm((p) => ({ ...p, specialty: next }));
            }}
          />
          <TextInput
            label="Template Name"
            required
            value={tmplForm.template_name}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setTmplForm((p) => ({ ...p, template_name: next }));
            }}
          />
          <TextInput
            label="Template Code"
            required
            value={tmplForm.template_code}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setTmplForm((p) => ({ ...p, template_code: next }));
            }}
          />
          <JsonInput
            label="Form Schema (JSON)"
            minRows={4}
            value={JSON.stringify(tmplForm.form_schema, null, 2)}
            onChange={(v) => {
              try {
                setTmplForm((p) => ({ ...p, form_schema: JSON.parse(v) }));
              } catch {
                /* ignore parse errors while typing */
              }
            }}
          />
          <Button
            tone="primary"
            onClick={() => createTmpl.mutate(tmplForm)}
            loading={createTmpl.isPending}
          >
            Create Template
          </Button>
        </Stack>
      </Drawer>
      <Drawer
        opened={recOpen}
        onClose={recHandlers.close}
        title="New Specialty Record"
        size="lg"
        position="right"
      >
        <Stack>
          <PatientSearchSelect
            value={recForm.patient_id}
            onChange={(v) => setRecForm((p) => ({ ...p, patient_id: v }))}
            required
          />
          <TextInput
            label="Specialty"
            required
            value={recForm.specialty}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setRecForm((p) => ({ ...p, specialty: next }));
            }}
          />
          <Select
            label="Template"
            data={templates.map((t) => ({
              value: t.id,
              label: `${t.specialty} — ${t.template_name}`,
            }))}
            value={recForm.template_id ?? null}
            onChange={(v) => setRecForm((p) => ({ ...p, template_id: v ?? undefined }))}
          />
          <JsonInput
            label="Form Data (JSON)"
            minRows={4}
            value={JSON.stringify(recForm.form_data, null, 2)}
            onChange={(v) => {
              try {
                setRecForm((p) => ({ ...p, form_data: JSON.parse(v) }));
              } catch {
                /* ignore */
              }
            }}
          />
          <Button
            tone="primary"
            onClick={() => createRec.mutate(recForm)}
            loading={createRec.isPending}
          >
            Create Record
          </Button>
        </Stack>
      </Drawer>
      <Drawer
        opened={dialOpen}
        onClose={dialHandlers.close}
        title="New Dialysis Session"
        size="lg"
        position="right"
      >
        <Stack>
          <PatientSearchSelect
            value={dialForm.patient_id}
            onChange={(v) => setDialForm((p) => ({ ...p, patient_id: v }))}
            required
          />
          {dialForm.patient_id && (
            <DialyzerPicker
              patientId={dialForm.patient_id}
              dialyzerId={dialForm.dialyzer_id}
              slotId={dialForm.slot_id}
              onDialyzer={(id) => setDialForm((p) => ({ ...p, dialyzer_id: id }))}
              onSlot={(id) => setDialForm((p) => ({ ...p, slot_id: id }))}
            />
          )}
          {!dialForm.slot_id && (
            <TextInput
              label="Machine # (unbooked session)"
              value={dialForm.machine_number ?? ""}
              onChange={(e) => {
                const next = e.currentTarget.value;
                setDialForm((p) => ({ ...p, machine_number: next }));
              }}
            />
          )}
          <TextInput
            label="Access Type"
            value={dialForm.access_type ?? ""}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setDialForm((p) => ({ ...p, access_type: next }));
            }}
          />
          <NumberInput
            label="Pre Weight (kg)"
            value={dialForm.pre_weight_kg ?? ""}
            onChange={(v) =>
              setDialForm((p) => ({ ...p, pre_weight_kg: typeof v === "number" ? v : undefined }))
            }
          />
          <NumberInput
            label="UF Goal (ml)"
            value={dialForm.uf_goal_ml ?? ""}
            onChange={(v) =>
              setDialForm((p) => ({ ...p, uf_goal_ml: typeof v === "number" ? v : undefined }))
            }
          />
          <NumberInput
            label="Planned duration (min)"
            description="Checked against the safe ultrafiltration rate (~13 mL/kg/hr)"
            value={dialForm.duration_minutes ?? ""}
            onChange={(v) =>
              setDialForm((p) => ({
                ...p,
                duration_minutes: typeof v === "number" ? v : undefined,
              }))
            }
          />
          <Button
            tone="primary"
            onClick={() => createDial.mutate(dialForm)}
            loading={createDial.isPending}
          >
            Start Session
          </Button>
        </Stack>
      </Drawer>
      <Drawer
        opened={chemoOpen}
        onClose={chemoHandlers.close}
        title="New Chemo Protocol"
        size="lg"
        position="right"
      >
        <Stack>
          <PatientSearchSelect
            value={chemoForm.patient_id}
            onChange={(v) => setChemoForm((p) => ({ ...p, patient_id: v }))}
            required
          />
          <TextInput
            label="Protocol Name"
            required
            value={chemoForm.protocol_name}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setChemoForm((p) => ({ ...p, protocol_name: next }));
            }}
          />
          <TextInput
            label="Cancer Type"
            value={chemoForm.cancer_type ?? ""}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setChemoForm((p) => ({ ...p, cancer_type: next }));
            }}
          />
          <TextInput
            label="Staging"
            value={chemoForm.staging ?? ""}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setChemoForm((p) => ({ ...p, staging: next }));
            }}
          />
          <NumberInput
            label="Cycle #"
            value={chemoForm.cycle_number ?? ""}
            onChange={(v) =>
              setChemoForm((p) => ({ ...p, cycle_number: typeof v === "number" ? v : undefined }))
            }
          />
          <TextInput
            label="Anthracycline agent (if any)"
            placeholder="e.g. Doxorubicin"
            value={chemoForm.anthracycline_agent ?? ""}
            onChange={(e) => {
              const next = e.currentTarget.value || undefined;
              setChemoForm((p) => ({ ...p, anthracycline_agent: next }));
            }}
          />
          <NumberInput
            label="This cycle's anthracycline dose (mg/m²)"
            value={chemoForm.anthracycline_dose_mg_m2 ?? ""}
            min={0}
            onChange={(v) =>
              setChemoForm((p) => ({
                ...p,
                anthracycline_dose_mg_m2: typeof v === "number" ? v : undefined,
              }))
            }
          />
          {anthraCumulative && anthraCumulative.ceiling_mg_m2 != null && (
            <Alert
              tone={
                anthraCumulative.over_ceiling
                  ? "danger"
                  : anthraCumulative.near_ceiling
                    ? "warning"
                    : "info"
              }
              title={`Cumulative ${anthraCumulative.agent}: ${anthraCumulative.cumulative_mg_m2} / ${anthraCumulative.ceiling_mg_m2} mg/m²`}
            >
              {anthraCumulative.over_ceiling
                ? "Lifetime cardiotoxicity ceiling exceeded — cardiology review and echocardiogram before any further anthracycline."
                : anthraCumulative.near_ceiling
                  ? `Approaching the ceiling (${anthraCumulative.remaining_mg_m2} mg/m² remaining) — assess LVEF before the next cycle.`
                  : `${anthraCumulative.remaining_mg_m2} mg/m² remaining before the cardiotoxicity ceiling.`}
            </Alert>
          )}
          <Switch
            label="Tumor Board Reviewed"
            checked={chemoForm.tumor_board_reviewed ?? false}
            onChange={(e) => {
              const next = e.currentTarget.checked;
              setChemoForm((p) => ({ ...p, tumor_board_reviewed: next }));
            }}
          />
          <Button
            tone="primary"
            onClick={() => createChemo.mutate(chemoForm)}
            loading={createChemo.isPending}
          >
            Create Protocol
          </Button>
        </Stack>
      </Drawer>
      <Drawer
        opened={stagingOpen}
        onClose={stagingHandlers.close}
        title="New cancer staging"
        size="lg"
        position="right"
      >
        <Stack>
          <PatientSearchSelect
            value={stagingForm.patient_id}
            onChange={(v) => setStagingForm((p) => ({ ...p, patient_id: v }))}
            required
          />
          <TextInput
            label="Primary site"
            required
            value={stagingForm.primary_site}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setStagingForm((p) => ({ ...p, primary_site: next }));
            }}
          />
          <TextInput
            label="Histology"
            value={stagingForm.histology ?? ""}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setStagingForm((p) => ({ ...p, histology: next }));
            }}
          />
          <Group grow>
            <TextInput
              label="T"
              value={stagingForm.t_stage ?? ""}
              onChange={(e) => {
                const next = e.currentTarget.value;
                setStagingForm((p) => ({ ...p, t_stage: next }));
              }}
            />
            <TextInput
              label="N"
              value={stagingForm.n_stage ?? ""}
              onChange={(e) => {
                const next = e.currentTarget.value;
                setStagingForm((p) => ({ ...p, n_stage: next }));
              }}
            />
            <TextInput
              label="M"
              value={stagingForm.m_stage ?? ""}
              onChange={(e) => {
                const next = e.currentTarget.value;
                setStagingForm((p) => ({ ...p, m_stage: next }));
              }}
            />
          </Group>
          <TextInput
            label="Overall stage"
            placeholder="IIIA"
            value={stagingForm.overall_stage ?? ""}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setStagingForm((p) => ({ ...p, overall_stage: next }));
            }}
          />
          <Button
            tone="primary"
            onClick={() => createStaging.mutate(stagingForm)}
            loading={createStaging.isPending}
            disabled={!stagingForm.patient_id || !stagingForm.primary_site}
          >
            Save staging
          </Button>
        </Stack>
      </Drawer>
      <Drawer
        opened={radOpen}
        onClose={radHandlers.close}
        title="New radiation session"
        size="lg"
        position="right"
      >
        <Stack>
          <PatientSearchSelect
            value={radForm.patient_id}
            onChange={(v) => setRadForm((p) => ({ ...p, patient_id: v }))}
            required
          />
          <TextInput
            label="Site"
            required
            value={radForm.site}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setRadForm((p) => ({ ...p, site: next }));
            }}
          />
          <TextInput
            label="Technique"
            value={radForm.technique ?? ""}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setRadForm((p) => ({ ...p, technique: next }));
            }}
          />
          <Group grow>
            <NumberInput
              label="Total dose (Gy)"
              value={radForm.total_dose_gy ? Number(radForm.total_dose_gy) : ""}
              onChange={(v) =>
                setRadForm((p) => ({
                  ...p,
                  total_dose_gy: typeof v === "number" ? String(v) : undefined,
                }))
              }
            />
            <NumberInput
              label="Fractions"
              value={radForm.fractions ?? ""}
              onChange={(v) =>
                setRadForm((p) => ({ ...p, fractions: typeof v === "number" ? v : undefined }))
              }
            />
            <NumberInput
              label="Session #"
              value={radForm.session_number ?? ""}
              onChange={(v) =>
                setRadForm((p) => ({ ...p, session_number: typeof v === "number" ? v : undefined }))
              }
            />
          </Group>
          <Button
            tone="primary"
            onClick={() => createRad.mutate(radForm)}
            loading={createRad.isPending}
            disabled={!radForm.patient_id || !radForm.site}
          >
            Save session
          </Button>
        </Stack>
      </Drawer>
    </div>
  );
}
