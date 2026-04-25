import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Drawer,
  Grid,
  Group,
  JsonInput,
  Modal,
  NumberInput,
  Radio,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  MultiSelect,
  Code,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconSearch,
  IconShieldCheck,
  IconX,
  IconCertificate,
  IconScale,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  ConsentTemplate,
  ConsentAuditEntry,
  ConsentSignatureMetadata,
  ConsentSummaryItem,
  CreateConsentTemplateRequest,
  UpdateConsentTemplateRequest,
  CreateConsentSignatureRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Constants ──────────────────────────────────────────

const TEMPLATE_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "surgical", label: "Surgical" },
  { value: "anesthesia", label: "Anesthesia" },
  { value: "blood_transfusion", label: "Blood Transfusion" },
  { value: "investigation", label: "Investigation" },
  { value: "data_sharing", label: "Data Sharing" },
  { value: "research", label: "Research" },
  { value: "photography", label: "Photography" },
  { value: "teaching", label: "Teaching" },
  { value: "refusal", label: "Refusal" },
  { value: "advance_directive", label: "Advance Directive" },
  { value: "organ_donation", label: "Organ Donation" },
  { value: "communication", label: "Communication" },
  { value: "death_certificate", label: "Death Certificate" },
  { value: "medico_legal_opinion", label: "Medico-Legal Opinion" },
  { value: "custom", label: "Custom" },
];

const MANNER_OF_DEATH_OPTIONS = [
  { value: "natural", label: "Natural" },
  { value: "accident", label: "Accident" },
  { value: "suicide", label: "Suicide" },
  { value: "homicide", label: "Homicide" },
  { value: "undetermined", label: "Undetermined" },
  { value: "pending_investigation", label: "Pending Investigation" },
];

const INJURY_CLASSIFICATION_OPTIONS = [
  { value: "simple", label: "Simple" },
  { value: "grievous", label: "Grievous" },
  { value: "dangerous", label: "Dangerous to life" },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: "gray",
  surgical: "danger",
  anesthesia: "violet",
  blood_transfusion: "danger",
  investigation: "primary",
  data_sharing: "primary",
  research: "violet",
  photography: "info",
  teaching: "teal",
  refusal: "warning",
  advance_directive: "warning",
  organ_donation: "teal",
  communication: "success",
  death_certificate: "danger",
  medico_legal_opinion: "warning",
  custom: "gray",
};

const AUDIT_ACTION_COLORS: Record<string, string> = {
  created: "gray",
  granted: "success",
  signed: "success",
  denied: "danger",
  refused: "danger",
  withdrawn: "warning",
  revoked: "danger",
  expired: "warning",
  renewed: "primary",
  amended: "primary",
};

const STATUS_COLORS: Record<string, string> = {
  granted: "success",
  signed: "success",
  pending: "warning",
  denied: "danger",
  refused: "danger",
  withdrawn: "warning",
  expired: "gray",
  missing: "danger",
};

const SIGNATURE_TYPES = [
  { value: "pen_on_paper", label: "Pen on Paper" },
  { value: "digital_pen", label: "Digital Pen" },
  { value: "aadhaar_esign", label: "Aadhaar e-Sign" },
  { value: "biometric_thumb", label: "Biometric Thumb" },
  { value: "otp", label: "OTP" },
  { value: "video_consent", label: "Video Consent" },
  { value: "verbal_witness", label: "Verbal (Witness)" },
];

const REQUIRED_FIELD_OPTIONS = [
  { value: "witness_name", label: "Witness Name" },
  { value: "witness_signature", label: "Witness Signature" },
  { value: "doctor_signature", label: "Doctor Signature" },
  { value: "patient_signature", label: "Patient Signature" },
  { value: "guardian_name", label: "Guardian Name" },
  { value: "guardian_signature", label: "Guardian Signature" },
  { value: "interpreter_name", label: "Interpreter Name" },
  { value: "video_recording", label: "Video Recording" },
];

// ── Page ───────────────────────────────────────────────

export function ConsentPage() {
  useRequirePermission(P.CONSENT.TEMPLATES_LIST);

  const canCreateTemplate = useHasPermission(P.CONSENT.TEMPLATES_CREATE);
  const canUpdateTemplate = useHasPermission(P.CONSENT.TEMPLATES_UPDATE);
  const canDeleteTemplate = useHasPermission(P.CONSENT.TEMPLATES_DELETE);
  const canViewAudit = useHasPermission(P.CONSENT.AUDIT_LIST);
  const canVerify = useHasPermission(P.CONSENT.VERIFY);
  const canRevoke = useHasPermission(P.CONSENT.REVOKE);
  const canViewSignatures = useHasPermission(P.CONSENT.SIGNATURES_LIST);
  const canManageSignatures = useHasPermission(P.CONSENT.SIGNATURES_MANAGE);

  return (
    <div>
      <PageHeader
        title="Consent Management"
        subtitle="Consent templates, audit trail, verification, and digital signatures"
      />
      <Tabs defaultValue="templates">
        <Tabs.List>
          <Tabs.Tab value="templates">Templates</Tabs.Tab>
          {canViewAudit && <Tabs.Tab value="audit">Audit Trail</Tabs.Tab>}
          {canVerify && <Tabs.Tab value="verification">Verification</Tabs.Tab>}
          {canViewSignatures && <Tabs.Tab value="signatures">Signatures</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="templates" pt="md">
          <TemplatesTab
            canCreate={canCreateTemplate}
            canUpdate={canUpdateTemplate}
            canDelete={canDeleteTemplate}
          />
        </Tabs.Panel>
        <Tabs.Panel value="audit" pt="md">
          <AuditTab />
        </Tabs.Panel>
        <Tabs.Panel value="verification" pt="md">
          <VerificationTab canRevoke={canRevoke} />
        </Tabs.Panel>
        <Tabs.Panel value="signatures" pt="md">
          <SignaturesTab canManage={canManageSignatures} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — Templates
// ══════════════════════════════════════════════════════════

function TemplatesTab({
  canCreate,
  canUpdate,
  canDelete,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<ConsentTemplate | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [deathCertOpened, { open: openDeathCert, close: closeDeathCert }] = useDisclosure(false);
  const [mloOpened, { open: openMlo, close: closeMlo }] = useDisclosure(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["consent-templates", categoryFilter],
    queryFn: () =>
      api.listConsentTemplates({
        category: categoryFilter ?? undefined,
      }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateConsentTemplateRequest) => api.createConsentTemplate(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-templates"] });
      close();
      notifications.show({ title: "Created", message: "Template created", color: "success" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateConsentTemplateRequest }) =>
      api.updateConsentTemplate(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-templates"] });
      close();
      setEditing(null);
      notifications.show({ title: "Updated", message: "Template updated", color: "success" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteConsentTemplate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-templates"] });
      notifications.show({ title: "Deleted", message: "Template removed", color: "danger" });
    },
  });

  const columns: Column<ConsentTemplate>[] = [
    { key: "code", label: "Code", render: (r) => <Code>{r.code}</Code> },
    { key: "name", label: "Name", render: (r) => <Text size="sm">{r.name}</Text> },
    {
      key: "category",
      label: "Category",
      render: (r) => (
        <Badge color={CATEGORY_COLORS[r.category] ?? "gray"} variant="light" size="sm">
          {r.category.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "version", label: "Ver", render: (r) => <Text size="sm">v{r.version}</Text> },
    {
      key: "validity",
      label: "Validity",
      render: (r) => (
        <Text size="sm">{r.validity_days ? `${r.validity_days} days` : "No expiry"}</Text>
      ),
    },
    {
      key: "flags",
      label: "Requirements",
      render: (r) => (
        <Group gap={4}>
          {r.requires_witness && (
            <Badge size="xs" variant="outline" color="warning">
              Witness
            </Badge>
          )}
          {r.requires_doctor && (
            <Badge size="xs" variant="outline" color="primary">
              Doctor
            </Badge>
          )}
          {r.is_read_aloud_required && (
            <Badge size="xs" variant="outline" color="violet">
              Read-aloud
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "active",
      label: "Active",
      render: (r) => (
        <Badge color={r.is_active ? "success" : "gray"} variant="light" size="sm">
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {canUpdate && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => {
                setEditing(r);
                open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </ActionIcon>
          )}
          {canDelete && (
            <ActionIcon
              variant="subtle"
              color="danger"
              size="sm"
              onClick={() => deleteMut.mutate(r.id)}
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  const deathCertMut = useMutation({
    mutationFn: (d: CreateConsentTemplateRequest) => api.createConsentTemplate(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-templates"] });
      closeDeathCert();
      notifications.show({ title: "Created", message: "Death certificate template created", color: "success" });
    },
  });

  const mloMut = useMutation({
    mutationFn: (d: CreateConsentTemplateRequest) => api.createConsentTemplate(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-templates"] });
      closeMlo();
      notifications.show({ title: "Created", message: "Medico-legal opinion template created", color: "success" });
    },
  });

  return (
    <>
      <Group mb="md" justify="space-between">
        <Select
          placeholder="Filter by category"
          data={TEMPLATE_CATEGORIES}
          value={categoryFilter}
          onChange={setCategoryFilter}
          clearable
          w={220}
        />
        <Group gap="xs">
          {canCreate && (
            <Button
              variant="outline"
              color="primary"
              leftSection={<IconCertificate size={16} />}
              onClick={openDeathCert}
            >
              Death Certificate
            </Button>
          )}
          {canCreate && (
            <Button
              variant="outline"
              color="primary"
              leftSection={<IconScale size={16} />}
              onClick={openMlo}
            >
              Medico-Legal Opinion
            </Button>
          )}
          {canCreate && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditing(null);
                open();
              }}
            >
              New Template
            </Button>
          )}
        </Group>
      </Group>
      <DataTable
        columns={columns}
        data={templates}
        loading={isLoading}
        rowKey={(r) => r.id}
      />
      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setEditing(null);
        }}
        title={editing ? "Edit Template" : "New Template"}
        position="right"
        size="lg"
      >
        <TemplateForm
          initial={editing}
          onSubmit={(vals) => {
            if (editing) {
              updateMut.mutate({ id: editing.id, data: vals });
            } else {
              createMut.mutate(vals as CreateConsentTemplateRequest);
            }
          }}
          loading={createMut.isPending || updateMut.isPending}
        />
      </Drawer>
      <Drawer
        opened={deathCertOpened}
        onClose={closeDeathCert}
        title="Death Certificate — Form 4 / 4A"
        position="right"
        size="xl"
      >
        <DeathCertificateForm
          onSubmit={(vals) => deathCertMut.mutate(vals)}
          loading={deathCertMut.isPending}
        />
      </Drawer>
      <Drawer
        opened={mloOpened}
        onClose={closeMlo}
        title="Medico-Legal Opinion"
        position="right"
        size="xl"
      >
        <MedicoLegalOpinionForm
          onSubmit={(vals) => mloMut.mutate(vals)}
          loading={mloMut.isPending}
        />
      </Drawer>
    </>
  );
}

function TemplateForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: ConsentTemplate | null;
  onSubmit: (v: CreateConsentTemplateRequest | UpdateConsentTemplateRequest) => void;
  loading: boolean;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<string | null>(initial?.category ?? "general");
  const [version, setVersion] = useState<number>(initial?.version ?? 1);
  const [bodyText, setBodyText] = useState(
    initial?.body_text ? JSON.stringify(initial.body_text, null, 2) : '{"en": ""}',
  );
  const [risksSection, setRisksSection] = useState(
    initial?.risks_section ? JSON.stringify(initial.risks_section, null, 2) : "",
  );
  const [alternativesSection, setAlternativesSection] = useState(
    initial?.alternatives_section ? JSON.stringify(initial.alternatives_section, null, 2) : "",
  );
  const [benefitsSection, setBenefitsSection] = useState(
    initial?.benefits_section ? JSON.stringify(initial.benefits_section, null, 2) : "",
  );
  const [requiredFields, setRequiredFields] = useState<string[]>(initial?.required_fields ?? []);
  const [requiresWitness, setRequiresWitness] = useState(initial?.requires_witness ?? false);
  const [requiresDoctor, setRequiresDoctor] = useState(initial?.requires_doctor ?? true);
  const [validityDays, setValidityDays] = useState<number | string>(initial?.validity_days ?? "");
  const [isReadAloud, setIsReadAloud] = useState(initial?.is_read_aloud_required ?? false);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState<number>(initial?.sort_order ?? 0);

  const handleSubmit = () => {
    const parseJson = (s: string) => {
      if (!s.trim()) return undefined;
      try {
        return JSON.parse(s) as Record<string, string>;
      } catch {
        return undefined;
      }
    };

    const data: CreateConsentTemplateRequest = {
      code,
      name,
      category: (category ?? "general") as CreateConsentTemplateRequest["category"],
      version,
      body_text: parseJson(bodyText),
      risks_section: parseJson(risksSection),
      alternatives_section: parseJson(alternativesSection),
      benefits_section: parseJson(benefitsSection),
      required_fields: requiredFields,
      requires_witness: requiresWitness,
      requires_doctor: requiresDoctor,
      validity_days: typeof validityDays === "number" ? validityDays : undefined,
      is_read_aloud_required: isReadAloud,
      is_active: isActive,
      sort_order: sortOrder,
    };
    onSubmit(data);
  };

  return (
    <Stack>
      <TextInput label="Code" required value={code} onChange={(e) => setCode(e.target.value)} disabled={!!initial} />
      <TextInput label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Select label="Category" data={TEMPLATE_CATEGORIES} value={category} onChange={setCategory} />
      <NumberInput label="Version" value={version} onChange={(v) => setVersion(Number(v))} min={1} />
      <JsonInput label="Body Text (JSON by language)" value={bodyText} onChange={setBodyText} minRows={4} formatOnBlur autosize />
      <JsonInput label="Risks Section (optional)" value={risksSection} onChange={setRisksSection} minRows={2} formatOnBlur autosize />
      <JsonInput label="Alternatives Section (optional)" value={alternativesSection} onChange={setAlternativesSection} minRows={2} formatOnBlur autosize />
      <JsonInput label="Benefits Section (optional)" value={benefitsSection} onChange={setBenefitsSection} minRows={2} formatOnBlur autosize />
      <MultiSelect
        label="Required Fields"
        data={REQUIRED_FIELD_OPTIONS}
        value={requiredFields}
        onChange={setRequiredFields}
      />
      <Group>
        <Switch label="Requires Witness" checked={requiresWitness} onChange={(e) => setRequiresWitness(e.currentTarget.checked)} />
        <Switch label="Requires Doctor" checked={requiresDoctor} onChange={(e) => setRequiresDoctor(e.currentTarget.checked)} />
        <Switch label="Read-Aloud Required" checked={isReadAloud} onChange={(e) => setIsReadAloud(e.currentTarget.checked)} />
        <Switch label="Active" checked={isActive} onChange={(e) => setIsActive(e.currentTarget.checked)} />
      </Group>
      <NumberInput label="Validity (days, blank = no expiry)" value={validityDays} onChange={setValidityDays} min={1} />
      <NumberInput label="Sort Order" value={sortOrder} onChange={(v) => setSortOrder(Number(v))} />
      <Button onClick={handleSubmit} loading={loading}>
        {initial ? "Update" : "Create"}
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Death Certificate Form — Indian Form 4 / 4A
// ══════════════════════════════════════════════════════════

function DeathCertificateForm({
  onSubmit,
  loading,
}: {
  onSubmit: (v: CreateConsentTemplateRequest) => void;
  loading: boolean;
}) {
  const [formType, setFormType] = useState<string>("form_4");
  const [deceasedName, setDeceasedName] = useState("");
  const [age, setAge] = useState<number | string>("");
  const [sex, setSex] = useState<string | null>(null);
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [timeOfDeath, setTimeOfDeath] = useState("");
  const [placeOfDeath, setPlaceOfDeath] = useState("");
  const [causeImmediate, setCauseImmediate] = useState("");
  const [causeAntecedent, setCauseAntecedent] = useState("");
  const [causeUnderlying, setCauseUnderlying] = useState("");
  const [causeOtherSignificant, setCauseOtherSignificant] = useState("");
  const [mannerOfDeath, setMannerOfDeath] = useState<string | null>("natural");
  const [durationOfIllness, setDurationOfIllness] = useState("");
  const [autopsyRequested, setAutopsyRequested] = useState(false);
  const [isMedicoLegal, setIsMedicoLegal] = useState(false);
  const [certifyingDoctor, setCertifyingDoctor] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
    const code = `DEATH-CERT-${timestamp}`;

    const content: Record<string, string> = {
      form_type: formType,
      deceased_name: deceasedName,
      age: String(age),
      sex: sex ?? "",
      date_of_death: dateOfDeath,
      time_of_death: timeOfDeath,
      place_of_death: placeOfDeath,
      cause_immediate: causeImmediate,
      cause_antecedent: causeAntecedent,
      cause_underlying: causeUnderlying,
      cause_other_significant: causeOtherSignificant,
      manner_of_death: mannerOfDeath ?? "natural",
      duration_of_illness: durationOfIllness,
      autopsy_requested: String(autopsyRequested),
      is_medico_legal: String(isMedicoLegal),
      certifying_doctor: certifyingDoctor,
      registration_number: registrationNumber,
      witness_name: witnessName,
      notes,
    };

    onSubmit({
      code,
      name: `Death Certificate — ${deceasedName || "Unnamed"} — ${dateOfDeath || "No Date"}`,
      category: "custom" as CreateConsentTemplateRequest["category"],
      version: 1,
      body_text: content,
      requires_witness: true,
      requires_doctor: true,
      is_active: true,
      sort_order: 0,
    });
  };

  return (
    <Stack>
      <Title order={5}>Indian Registration of Births and Deaths Act</Title>
      <Radio.Group value={formType} onChange={setFormType} label="Form Type" withAsterisk>
        <Group mt={4}>
          <Radio value="form_4" label="Form 4 — Certificate of Cause of Death" />
          <Radio value="form_4a" label="Form 4A — Certificate (Institutional)" />
        </Group>
      </Radio.Group>

      <Divider label="Deceased Details" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <TextInput label="Name of Deceased" required value={deceasedName} onChange={(e) => setDeceasedName(e.target.value)} />
        </Grid.Col>
        <Grid.Col span={3}>
          <NumberInput label="Age (years)" value={age} onChange={setAge} min={0} max={150} />
        </Grid.Col>
        <Grid.Col span={3}>
          <Select label="Sex" data={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]} value={sex} onChange={setSex} />
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={4}>
          <TextInput label="Date of Death" type="date" required value={dateOfDeath} onChange={(e) => setDateOfDeath(e.target.value)} />
        </Grid.Col>
        <Grid.Col span={4}>
          <TextInput label="Time of Death" type="time" required value={timeOfDeath} onChange={(e) => setTimeOfDeath(e.target.value)} />
        </Grid.Col>
        <Grid.Col span={4}>
          <TextInput label="Place of Death" value={placeOfDeath} onChange={(e) => setPlaceOfDeath(e.target.value)} />
        </Grid.Col>
      </Grid>

      <Divider label="Cause of Death (WHO ICD format)" labelPosition="left" />

      <Text size="xs" c="dimmed">
        Part I: Disease or condition directly leading to death and its chain of causation.
      </Text>
      <TextInput label="(a) Immediate Cause" required value={causeImmediate} onChange={(e) => setCauseImmediate(e.target.value)} description="Disease or condition directly leading to death" />
      <TextInput label="(b) Antecedent Cause" value={causeAntecedent} onChange={(e) => setCauseAntecedent(e.target.value)} description="Due to (or as a consequence of)" />
      <TextInput label="(c) Underlying Cause" value={causeUnderlying} onChange={(e) => setCauseUnderlying(e.target.value)} description="Due to (or as a consequence of)" />

      <Text size="xs" c="dimmed" mt="xs">
        Part II: Other significant conditions contributing to the death but not related to the cause.
      </Text>
      <Textarea label="Other Significant Conditions" value={causeOtherSignificant} onChange={(e) => setCauseOtherSignificant(e.target.value)} minRows={2} />

      <Divider label="Manner and Circumstances" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <Select label="Manner of Death" data={MANNER_OF_DEATH_OPTIONS} value={mannerOfDeath} onChange={setMannerOfDeath} />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput label="Duration of Illness" value={durationOfIllness} onChange={(e) => setDurationOfIllness(e.target.value)} placeholder="e.g. 3 months, 2 years" />
        </Grid.Col>
      </Grid>

      <Group>
        <Switch label="Autopsy Requested" checked={autopsyRequested} onChange={(e) => setAutopsyRequested(e.currentTarget.checked)} />
        <Switch label="Medico-Legal Case" checked={isMedicoLegal} onChange={(e) => setIsMedicoLegal(e.currentTarget.checked)} color="danger" />
      </Group>

      {isMedicoLegal && (
        <Badge color="danger" variant="light" size="lg">
          MLC — Police intimation and inquest required under CrPC
        </Badge>
      )}

      <Divider label="Certification" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <TextInput label="Certifying Doctor Name" required value={certifyingDoctor} onChange={(e) => setCertifyingDoctor(e.target.value)} />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput label="Medical Registration No." required value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
        </Grid.Col>
      </Grid>
      <TextInput label="Witness Name" value={witnessName} onChange={(e) => setWitnessName(e.target.value)} />
      <Textarea label="Additional Notes" value={notes} onChange={(e) => setNotes(e.target.value)} minRows={2} />

      <Button onClick={handleSubmit} loading={loading} color="primary" leftSection={<IconCertificate size={16} />}>
        Create Death Certificate Template
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Medico-Legal Opinion Form
// ══════════════════════════════════════════════════════════

function MedicoLegalOpinionForm({
  onSubmit,
  loading,
}: {
  onSubmit: (v: CreateConsentTemplateRequest) => void;
  loading: boolean;
}) {
  const [caseReference, setCaseReference] = useState("");
  const [examinationDate, setExaminationDate] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState<number | string>("");
  const [patientSex, setPatientSex] = useState<string | null>(null);
  const [historyOfIncident, setHistoryOfIncident] = useState("");
  const [findingsOnExamination, setFindingsOnExamination] = useState("");
  const [investigationsDone, setInvestigationsDone] = useState("");
  const [opinion, setOpinion] = useState("");
  const [injuryClassification, setInjuryClassification] = useState<string | null>(null);
  const [weaponUsedLikely, setWeaponUsedLikely] = useState("");
  const [timeSinceInjuryEstimate, setTimeSinceInjuryEstimate] = useState("");
  const [fitnessForDischarge, setFitnessForDischarge] = useState<string>("yes");
  const [dischargeConditions, setDischargeConditions] = useState("");
  const [examiningDoctor, setExaminingDoctor] = useState("");
  const [doctorRegistrationNo, setDoctorRegistrationNo] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
    const code = `MLO-${timestamp}`;

    const content: Record<string, string> = {
      case_reference: caseReference,
      examination_date: examinationDate,
      patient_name: patientName,
      patient_age: String(patientAge),
      patient_sex: patientSex ?? "",
      history_of_incident: historyOfIncident,
      findings_on_examination: findingsOnExamination,
      investigations_done: investigationsDone,
      opinion,
      injury_classification: injuryClassification ?? "",
      weapon_used_likely: weaponUsedLikely,
      time_since_injury_estimate: timeSinceInjuryEstimate,
      fitness_for_discharge: fitnessForDischarge,
      discharge_conditions: dischargeConditions,
      examining_doctor: examiningDoctor,
      doctor_registration_no: doctorRegistrationNo,
      notes,
    };

    onSubmit({
      code,
      name: `Medico-Legal Opinion — ${patientName || "Unnamed"} — ${caseReference || "No Ref"}`,
      category: "custom" as CreateConsentTemplateRequest["category"],
      version: 1,
      body_text: content,
      requires_witness: false,
      requires_doctor: true,
      is_active: true,
      sort_order: 0,
    });
  };

  return (
    <Stack>
      <Title order={5}>Medico-Legal Opinion / Certificate</Title>
      <Text size="xs" c="dimmed">
        As per Indian Penal Code (IPC) Sections 319-326, Classification of Injuries Act, and
        Medico-Legal Practice Guidelines.
      </Text>

      <Divider label="Case Details" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <TextInput label="Case Reference / FIR No." required value={caseReference} onChange={(e) => setCaseReference(e.target.value)} description="MLC number or FIR reference" />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput label="Date of Examination" type="date" required value={examinationDate} onChange={(e) => setExaminationDate(e.target.value)} />
        </Grid.Col>
      </Grid>

      <Divider label="Patient Details" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <TextInput label="Patient Name" required value={patientName} onChange={(e) => setPatientName(e.target.value)} />
        </Grid.Col>
        <Grid.Col span={3}>
          <NumberInput label="Age" value={patientAge} onChange={setPatientAge} min={0} max={150} />
        </Grid.Col>
        <Grid.Col span={3}>
          <Select label="Sex" data={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]} value={patientSex} onChange={setPatientSex} />
        </Grid.Col>
      </Grid>

      <Divider label="Clinical Examination" labelPosition="left" />

      <Textarea
        label="History of Incident"
        required
        value={historyOfIncident}
        onChange={(e) => setHistoryOfIncident(e.target.value)}
        minRows={3}
        description="As narrated by patient/attendant/police"
      />

      <Textarea
        label="Findings on Examination"
        required
        value={findingsOnExamination}
        onChange={(e) => setFindingsOnExamination(e.target.value)}
        minRows={4}
        description="Describe all injuries with location, size, shape, type (laceration/contusion/abrasion/fracture)"
      />

      <Textarea
        label="Investigations Done"
        value={investigationsDone}
        onChange={(e) => setInvestigationsDone(e.target.value)}
        minRows={2}
        description="X-ray, CT, blood tests, and their findings"
      />

      <Divider label="Medical Opinion" labelPosition="left" />

      <Textarea
        label="Opinion"
        required
        value={opinion}
        onChange={(e) => setOpinion(e.target.value)}
        minRows={4}
        description="Nature of injuries, causative agent, age of injury, and prognosis"
      />

      <Grid>
        <Grid.Col span={6}>
          <Select
            label="Classification of Injury"
            data={INJURY_CLASSIFICATION_OPTIONS}
            value={injuryClassification}
            onChange={setInjuryClassification}
            description="As per IPC Sec 319-326"
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Weapon/Object Used (Likely)"
            value={weaponUsedLikely}
            onChange={(e) => setWeaponUsedLikely(e.target.value)}
            description="Sharp/blunt/firearm/other"
          />
        </Grid.Col>
      </Grid>

      <TextInput
        label="Time Since Injury (Estimate)"
        value={timeSinceInjuryEstimate}
        onChange={(e) => setTimeSinceInjuryEstimate(e.target.value)}
        placeholder="e.g. approximately 6-12 hours"
      />

      <Divider label="Fitness for Discharge" labelPosition="left" />

      <Radio.Group value={fitnessForDischarge} onChange={setFitnessForDischarge} label="Fitness for Discharge">
        <Group mt={4}>
          <Radio value="yes" label="Yes — Fit for discharge" />
          <Radio value="no" label="No — Requires admission" />
          <Radio value="conditional" label="Conditional — With restrictions" />
        </Group>
      </Radio.Group>

      {fitnessForDischarge === "conditional" && (
        <Textarea
          label="Discharge Conditions"
          value={dischargeConditions}
          onChange={(e) => setDischargeConditions(e.target.value)}
          minRows={2}
          description="Specify restrictions and follow-up requirements"
        />
      )}

      <Divider label="Certification" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <TextInput label="Examining Doctor Name" required value={examiningDoctor} onChange={(e) => setExaminingDoctor(e.target.value)} />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput label="Medical Registration No." required value={doctorRegistrationNo} onChange={(e) => setDoctorRegistrationNo(e.target.value)} />
        </Grid.Col>
      </Grid>

      <Textarea label="Additional Notes" value={notes} onChange={(e) => setNotes(e.target.value)} minRows={2} />

      <Button onClick={handleSubmit} loading={loading} color="primary" leftSection={<IconScale size={16} />}>
        Create Medico-Legal Opinion Template
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2 — Audit Trail
// ══════════════════════════════════════════════════════════

function AuditTab() {
  const [patientId, setPatientId] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["consent-audit", patientId, actionFilter, sourceFilter],
    queryFn: () =>
      api.listConsentAudit({
        patient_id: patientId || undefined,
        action: actionFilter ?? undefined,
        consent_source: sourceFilter ?? undefined,
      }),
  });

  const [detailEntry, setDetailEntry] = useState<ConsentAuditEntry | null>(null);

  const columns: Column<ConsentAuditEntry>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <Text size="sm" ff="monospace">{r.patient_id.slice(0, 8)}</Text>,
    },
    {
      key: "consent_source",
      label: "Source",
      render: (r) => (
        <Badge color={r.consent_source === "patient_consent" ? "primary" : "violet"} variant="light" size="sm">
          {r.consent_source === "patient_consent" ? "Patient" : "Procedure"}
        </Badge>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (r) => (
        <Badge color={AUDIT_ACTION_COLORS[r.action] ?? "gray"} variant="light" size="sm">
          {r.action}
        </Badge>
      ),
    },
    {
      key: "status_change",
      label: "Status Change",
      render: (r) => (
        <Text size="sm">
          {r.old_status ?? "—"} → {r.new_status ?? "—"}
        </Text>
      ),
    },
    {
      key: "changed_by",
      label: "Changed By",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.changed_by?.slice(0, 8) ?? "—"}
        </Text>
      ),
    },
    {
      key: "change_reason",
      label: "Reason",
      render: (r) => <Text size="sm" lineClamp={1}>{r.change_reason ?? "—"}</Text>,
    },
    {
      key: "created_at",
      label: "Timestamp",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>,
    },
    {
      key: "detail",
      label: "",
      render: (r) => (
        <ActionIcon variant="subtle" size="sm" onClick={() => setDetailEntry(r)} aria-label="Search">
          <IconSearch size={14} />
        </ActionIcon>
      ),
    },
  ];

  return (
    <>
      <Group mb="md">
        <TextInput
          placeholder="Patient ID"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          w={280}
          leftSection={<IconSearch size={14} />}
        />
        <Select
          placeholder="Action"
          data={[
            { value: "created", label: "Created" },
            { value: "granted", label: "Granted" },
            { value: "signed", label: "Signed" },
            { value: "denied", label: "Denied" },
            { value: "refused", label: "Refused" },
            { value: "withdrawn", label: "Withdrawn" },
            { value: "revoked", label: "Revoked" },
            { value: "expired", label: "Expired" },
            { value: "renewed", label: "Renewed" },
            { value: "amended", label: "Amended" },
          ]}
          value={actionFilter}
          onChange={setActionFilter}
          clearable
          w={180}
        />
        <Select
          placeholder="Source"
          data={[
            { value: "patient_consent", label: "Patient Consent" },
            { value: "procedure_consent", label: "Procedure Consent" },
          ]}
          value={sourceFilter}
          onChange={setSourceFilter}
          clearable
          w={200}
        />
      </Group>
      <DataTable columns={columns} data={entries} loading={isLoading} rowKey={(r) => r.id} />
      <Modal opened={!!detailEntry} onClose={() => setDetailEntry(null)} title="Audit Entry Detail" size="lg">
        {detailEntry && (
          <Stack gap="xs">
            <Text size="sm"><strong>ID:</strong> {detailEntry.id}</Text>
            <Text size="sm"><strong>Patient:</strong> {detailEntry.patient_id}</Text>
            <Text size="sm"><strong>Consent ID:</strong> {detailEntry.consent_id}</Text>
            <Text size="sm"><strong>Source:</strong> {detailEntry.consent_source}</Text>
            <Text size="sm"><strong>Action:</strong> {detailEntry.action}</Text>
            <Text size="sm"><strong>Status:</strong> {detailEntry.old_status ?? "—"} → {detailEntry.new_status ?? "—"}</Text>
            <Text size="sm"><strong>Changed By:</strong> {detailEntry.changed_by ?? "—"}</Text>
            <Text size="sm"><strong>Reason:</strong> {detailEntry.change_reason ?? "—"}</Text>
            <Text size="sm"><strong>IP:</strong> {detailEntry.ip_address ?? "—"}</Text>
            <Text size="sm"><strong>User Agent:</strong> {detailEntry.user_agent ?? "—"}</Text>
            <Text size="sm"><strong>Timestamp:</strong> {new Date(detailEntry.created_at).toLocaleString()}</Text>
            <Text size="sm" fw={600}>Metadata:</Text>
            <Code block>{JSON.stringify(detailEntry.metadata, null, 2)}</Code>
          </Stack>
        )}
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Verification
// ══════════════════════════════════════════════════════════

function VerificationTab({ canRevoke }: { canRevoke: boolean }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [searched, setSearched] = useState(false);

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ["consent-summary", patientId],
    queryFn: () => api.getPatientConsentSummary(patientId),
    enabled: !!patientId && searched,
  });

  const revokeMut = useMutation({
    mutationFn: (item: ConsentSummaryItem) =>
      api.revokeConsent({
        consent_source: item.source,
        consent_id: item.consent_id,
        patient_id: patientId,
        reason: "Revoked via consent management UI",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-summary"] });
      notifications.show({ title: "Revoked", message: "Consent has been revoked", color: "orange" });
    },
  });

  const columns: Column<ConsentSummaryItem>[] = [
    { key: "consent_type", label: "Type", render: (r) => <Text size="sm">{r.consent_type.replace(/_/g, " ")}</Text> },
    {
      key: "source",
      label: "Source",
      render: (r) => (
        <Badge color={r.source === "patient_consent" ? "primary" : "violet"} variant="light" size="sm">
          {r.source === "patient_consent" ? "Patient" : "Procedure"}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge color={STATUS_COLORS[r.status] ?? "gray"} variant="light" size="sm">
          {r.status}
        </Badge>
      ),
    },
    {
      key: "valid_until",
      label: "Valid Until",
      render: (r) => <Text size="sm">{r.valid_until ?? "No expiry"}</Text>,
    },
    {
      key: "consent_id",
      label: "Consent ID",
      render: (r) => <Text size="sm" ff="monospace">{r.consent_id.slice(0, 8)}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        if (!canRevoke) return null;
        if (r.status === "withdrawn" || r.status === "expired" || r.status === "denied" || r.status === "refused") {
          return null;
        }
        return (
          <ActionIcon
            variant="subtle"
            color="warning"
            size="sm"
            onClick={() => revokeMut.mutate(r)}
            loading={revokeMut.isPending}
            aria-label="Close"
          >
            <IconX size={14} />
          </ActionIcon>
        );
      },
    },
  ];

  return (
    <>
      <Group mb="md">
        <TextInput
          placeholder="Enter Patient ID (UUID)"
          value={patientId}
          onChange={(e) => {
            setPatientId(e.target.value);
            setSearched(false);
          }}
          w={380}
          leftSection={<IconSearch size={14} />}
        />
        <Button
          leftSection={<IconShieldCheck size={16} />}
          onClick={() => setSearched(true)}
          disabled={!patientId}
        >
          Check Consents
        </Button>
      </Group>
      {searched && (
        <DataTable
          columns={columns}
          data={summary}
          loading={isLoading}
          rowKey={(r) => `${r.source}-${r.consent_id}`}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4 — Signatures
// ══════════════════════════════════════════════════════════

function SignaturesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const { data: signatures = [], isLoading } = useQuery({
    queryKey: ["consent-signatures", sourceFilter],
    queryFn: () =>
      api.listConsentSignatures({
        consent_source: sourceFilter ?? undefined,
      }),
  });

  const [detailSig, setDetailSig] = useState<ConsentSignatureMetadata | null>(null);

  const createMut = useMutation({
    mutationFn: (d: CreateConsentSignatureRequest) => api.createConsentSignature(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-signatures"] });
      close();
      notifications.show({ title: "Created", message: "Signature recorded", color: "success" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteConsentSignature(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-signatures"] });
      notifications.show({ title: "Deleted", message: "Signature removed", color: "danger" });
    },
  });

  const columns: Column<ConsentSignatureMetadata>[] = [
    {
      key: "consent_source",
      label: "Source",
      render: (r) => (
        <Badge color={r.consent_source === "patient_consent" ? "primary" : "violet"} variant="light" size="sm">
          {r.consent_source === "patient_consent" ? "Patient" : "Procedure"}
        </Badge>
      ),
    },
    {
      key: "consent_id",
      label: "Consent ID",
      render: (r) => <Text size="sm" ff="monospace">{r.consent_id.slice(0, 8)}</Text>,
    },
    {
      key: "signature_type",
      label: "Type",
      render: (r) => (
        <Badge variant="light" size="sm">
          {r.signature_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "witness_name",
      label: "Witness",
      render: (r) => <Text size="sm">{r.witness_name ?? "—"}</Text>,
    },
    {
      key: "captured_at",
      label: "Captured",
      render: (r) => <Text size="sm">{new Date(r.captured_at).toLocaleString()}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          <ActionIcon variant="subtle" size="sm" onClick={() => setDetailSig(r)} aria-label="Search">
            <IconSearch size={14} />
          </ActionIcon>
          {canManage && (
            <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => deleteMut.mutate(r.id)} aria-label="Delete">
              <IconTrash size={14} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group mb="md" justify="space-between">
        <Select
          placeholder="Filter by source"
          data={[
            { value: "patient_consent", label: "Patient Consent" },
            { value: "procedure_consent", label: "Procedure Consent" },
          ]}
          value={sourceFilter}
          onChange={setSourceFilter}
          clearable
          w={220}
        />
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Add Signature
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={signatures} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Record Signature" position="right" size="lg">
        <SignatureForm
          onSubmit={(vals) => createMut.mutate(vals)}
          loading={createMut.isPending}
        />
      </Drawer>
      <Modal opened={!!detailSig} onClose={() => setDetailSig(null)} title="Signature Detail" size="lg">
        {detailSig && (
          <Stack gap="xs">
            <Text size="sm"><strong>ID:</strong> {detailSig.id}</Text>
            <Text size="sm"><strong>Source:</strong> {detailSig.consent_source}</Text>
            <Text size="sm"><strong>Consent ID:</strong> {detailSig.consent_id}</Text>
            <Text size="sm"><strong>Type:</strong> {detailSig.signature_type.replace(/_/g, " ")}</Text>
            {detailSig.signature_image_url && (
              <Text size="sm"><strong>Signature Image:</strong> {detailSig.signature_image_url}</Text>
            )}
            {detailSig.video_consent_url && (
              <Text size="sm"><strong>Video:</strong> {detailSig.video_consent_url}</Text>
            )}
            {detailSig.aadhaar_esign_ref && (
              <Text size="sm"><strong>Aadhaar Ref:</strong> {detailSig.aadhaar_esign_ref}</Text>
            )}
            <Text size="sm"><strong>Witness:</strong> {detailSig.witness_name ?? "—"} ({detailSig.witness_designation ?? "—"})</Text>
            <Text size="sm"><strong>Doctor Signature:</strong> {detailSig.doctor_signature_url ?? "—"}</Text>
            <Text size="sm"><strong>Captured:</strong> {new Date(detailSig.captured_at).toLocaleString()}</Text>
            <Text size="sm"><strong>Captured By:</strong> {detailSig.captured_by ?? "—"}</Text>
          </Stack>
        )}
      </Modal>
    </>
  );
}

function SignatureForm({
  onSubmit,
  loading,
}: {
  onSubmit: (v: CreateConsentSignatureRequest) => void;
  loading: boolean;
}) {
  const [consentSource, setConsentSource] = useState<string | null>("patient_consent");
  const [consentId, setConsentId] = useState("");
  const [sigType, setSigType] = useState<string | null>("pen_on_paper");
  const [sigImageUrl, setSigImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [aadhaarRef, setAadhaarRef] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [witnessDesignation, setWitnessDesignation] = useState("");
  const [witnessSigUrl, setWitnessSigUrl] = useState("");
  const [doctorSigUrl, setDoctorSigUrl] = useState("");

  const handleSubmit = () => {
    onSubmit({
      consent_source: consentSource ?? "patient_consent",
      consent_id: consentId,
      signature_type: (sigType ?? "pen_on_paper") as CreateConsentSignatureRequest["signature_type"],
      signature_image_url: sigImageUrl || undefined,
      video_consent_url: videoUrl || undefined,
      aadhaar_esign_ref: aadhaarRef || undefined,
      witness_name: witnessName || undefined,
      witness_designation: witnessDesignation || undefined,
      witness_signature_url: witnessSigUrl || undefined,
      doctor_signature_url: doctorSigUrl || undefined,
    });
  };

  return (
    <Stack>
      <Select
        label="Consent Source"
        data={[
          { value: "patient_consent", label: "Patient Consent" },
          { value: "procedure_consent", label: "Procedure Consent" },
        ]}
        value={consentSource}
        onChange={setConsentSource}
        required
      />
      <TextInput label="Consent ID (UUID)" required value={consentId} onChange={(e) => setConsentId(e.target.value)} />
      <Select label="Signature Type" data={SIGNATURE_TYPES} value={sigType} onChange={setSigType} required />
      <TextInput label="Signature Image URL" value={sigImageUrl} onChange={(e) => setSigImageUrl(e.target.value)} />
      <TextInput label="Video Consent URL" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
      <TextInput label="Aadhaar e-Sign Reference" value={aadhaarRef} onChange={(e) => setAadhaarRef(e.target.value)} />
      <TextInput label="Witness Name" value={witnessName} onChange={(e) => setWitnessName(e.target.value)} />
      <Textarea label="Witness Designation" value={witnessDesignation} onChange={(e) => setWitnessDesignation(e.target.value)} />
      <TextInput label="Witness Signature URL" value={witnessSigUrl} onChange={(e) => setWitnessSigUrl(e.target.value)} />
      <TextInput label="Doctor Signature URL" value={doctorSigUrl} onChange={(e) => setDoctorSigUrl(e.target.value)} />
      <Button onClick={handleSubmit} loading={loading}>
        Record Signature
      </Button>
    </Stack>
  );
}
