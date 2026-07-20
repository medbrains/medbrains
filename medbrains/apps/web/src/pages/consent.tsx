import {
  Center,
  Code,
  Drawer,
  Group,
  JsonInput,
  Loader,
  MultiSelect,
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
  ConsentTemplate,
  ConsentTemplateListItem,
  CreateConsentTemplateRequest,
  UpdateConsentTemplateRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCertificate, IconPencil, IconPlus, IconScale, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm";
import { consentService } from "@/services/consent.service";
import { AuditTab } from "./consent/audit-tab";
import { DeathCertificateForm } from "./consent/death-certificate-form";
import { MedicoLegalOpinionForm } from "./consent/medico-legal-opinion-form";
import { SignaturesTab } from "./consent/signatures-tab";
import { VerificationTab } from "./consent/verification-tab";

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

const CATEGORY_COLORS: Record<string, BadgeTone> = {
  general: "neutral",
  surgical: "danger",
  anesthesia: "accent",
  blood_transfusion: "danger",
  investigation: "primary",
  data_sharing: "primary",
  research: "accent",
  photography: "info",
  teaching: "success",
  refusal: "warning",
  advance_directive: "warning",
  organ_donation: "success",
  communication: "success",
  death_certificate: "danger",
  medico_legal_opinion: "warning",
  custom: "neutral",
};

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
  const [editing, setEditing] = useState<ConsentTemplateListItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [deathCertOpened, { open: openDeathCert, close: closeDeathCert }] = useDisclosure(false);
  const [mloOpened, { open: openMlo, close: closeMlo }] = useDisclosure(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["consent-templates", categoryFilter],
    queryFn: () =>
      consentService.listConsentTemplates({
        category: categoryFilter ?? undefined,
      }),
  });

  // The list omits the heavy body/section JSONB — fetch the full template for
  // the editor (the form reads body_text + the section fields).
  const { data: editingFull, isLoading: editingLoading } = useQuery({
    queryKey: ["consent-template", editing?.id],
    queryFn: () => consentService.getConsentTemplate(editing?.id ?? ""),
    enabled: Boolean(editing?.id),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateConsentTemplateRequest) => consentService.createConsentTemplate(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-templates"] });
      close();
      notifications.show({ title: "Created", message: "Template created", color: "success" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not create template", message: e.message, color: "red" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateConsentTemplateRequest }) =>
      consentService.updateConsentTemplate(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-templates"] });
      close();
      setEditing(null);
      notifications.show({ title: "Updated", message: "Template updated", color: "success" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not update template", message: e.message, color: "red" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => consentService.deleteConsentTemplate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-templates"] });
      notifications.show({ title: "Deleted", message: "Template removed", color: "danger" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not delete template", message: e.message, color: "red" }),
  });

  const columns: Column<ConsentTemplateListItem>[] = [
    { key: "code", label: "Code", render: (r) => <Code>{r.code}</Code> },
    { key: "name", label: "Name", render: (r) => <Text size="sm">{r.name}</Text> },
    {
      key: "category",
      label: "Category",
      render: (r) => (
        <Badge tone={CATEGORY_COLORS[r.category] ?? "neutral"} size="sm">
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
            <Badge size="xs" variant="outline" tone="warning">
              Witness
            </Badge>
          )}
          {r.requires_doctor && (
            <Badge size="xs" variant="outline" tone="primary">
              Doctor
            </Badge>
          )}
          {r.is_read_aloud_required && (
            <Badge size="xs" variant="outline" tone="accent">
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
        <Badge tone={r.is_active ? "success" : "neutral"} size="sm">
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
            <IconButton
              size="sm"
              onClick={() => {
                setEditing(r);
                open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </IconButton>
          )}
          {canDelete && (
            <IconButton
              tone="danger"
              size="sm"
              onClick={() =>
                confirmDestructive({
                  title: "Delete consent",
                  message: "Permanently delete this consent record? This cannot be undone.",
                  onConfirm: () => deleteMut.mutate(r.id),
                })
              }
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </IconButton>
          )}
        </Group>
      ),
    },
  ];

  const deathCertMut = useMutation({
    mutationFn: (d: CreateConsentTemplateRequest) => consentService.createConsentTemplate(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-templates"] });
      closeDeathCert();
      notifications.show({
        title: "Created",
        message: "Death certificate template created",
        color: "success",
      });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not create template", message: e.message, color: "red" }),
  });

  const mloMut = useMutation({
    mutationFn: (d: CreateConsentTemplateRequest) => consentService.createConsentTemplate(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-templates"] });
      closeMlo();
      notifications.show({
        title: "Created",
        message: "Medico-legal opinion template created",
        color: "success",
      });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not create template", message: e.message, color: "red" }),
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
              tone="secondary"
              leftSection={<IconCertificate size={16} />}
              onClick={openDeathCert}
            >
              Death Certificate
            </Button>
          )}
          {canCreate && (
            <Button tone="secondary" leftSection={<IconScale size={16} />} onClick={openMlo}>
              Medico-Legal Opinion
            </Button>
          )}
          {canCreate && (
            <Button
              tone="primary"
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
      <DataTable columns={columns} data={templates} loading={isLoading} rowKey={(r) => r.id} />
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
        {editing && editingLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : (
          <TemplateForm
            key={editing?.id ?? "new"}
            initial={editing ? (editingFull ?? null) : null}
            onSubmit={(vals) => {
              if (editing) {
                updateMut.mutate({ id: editing.id, data: vals });
              } else {
                createMut.mutate(vals as CreateConsentTemplateRequest);
              }
            }}
            loading={createMut.isPending || updateMut.isPending}
          />
        )}
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
      <TextInput
        label="Code"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        disabled={!!initial}
      />
      <TextInput label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Select label="Category" data={TEMPLATE_CATEGORIES} value={category} onChange={setCategory} />
      <NumberInput
        label="Version"
        value={version}
        onChange={(v) => setVersion(Number(v))}
        min={1}
      />
      <JsonInput
        label="Body Text (JSON by language)"
        value={bodyText}
        onChange={setBodyText}
        minRows={4}
        formatOnBlur
        autosize
      />
      <JsonInput
        label="Risks Section (optional)"
        value={risksSection}
        onChange={setRisksSection}
        minRows={2}
        formatOnBlur
        autosize
      />
      <JsonInput
        label="Alternatives Section (optional)"
        value={alternativesSection}
        onChange={setAlternativesSection}
        minRows={2}
        formatOnBlur
        autosize
      />
      <JsonInput
        label="Benefits Section (optional)"
        value={benefitsSection}
        onChange={setBenefitsSection}
        minRows={2}
        formatOnBlur
        autosize
      />
      <MultiSelect
        label="Required Fields"
        data={REQUIRED_FIELD_OPTIONS}
        value={requiredFields}
        onChange={setRequiredFields}
      />
      <Group>
        <Switch
          label="Requires Witness"
          checked={requiresWitness}
          onChange={(e) => setRequiresWitness(e.currentTarget.checked)}
        />
        <Switch
          label="Requires Doctor"
          checked={requiresDoctor}
          onChange={(e) => setRequiresDoctor(e.currentTarget.checked)}
        />
        <Switch
          label="Read-Aloud Required"
          checked={isReadAloud}
          onChange={(e) => setIsReadAloud(e.currentTarget.checked)}
        />
        <Switch
          label="Active"
          checked={isActive}
          onChange={(e) => setIsActive(e.currentTarget.checked)}
        />
      </Group>
      <NumberInput
        label="Validity (days, blank = no expiry)"
        value={validityDays}
        onChange={setValidityDays}
        min={1}
      />
      <NumberInput label="Sort Order" value={sortOrder} onChange={(v) => setSortOrder(Number(v))} />
      <Button tone="primary" onClick={handleSubmit} loading={loading}>
        {initial ? "Update" : "Create"}
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Death Certificate Form — Indian Form 4 / 4A
// ══════════════════════════════════════════════════════════
