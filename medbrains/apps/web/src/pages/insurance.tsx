import {
  Drawer,
  Grid,
  Group,
  NumberInput,
  Paper,
  Progress,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  CreateAppealRequest,
  CreatePaRuleRequest,
  CreatePriorAuthRequestBody,
  FieldAccessLevel,
  InsuranceDashboard,
  InsuranceVerification,
  PaRequirementRule,
  PriorAuthAppeal,
  PriorAuthDetail,
  PriorAuthRequestRow,
  RespondPriorAuthRequest,
  RunVerificationRequest,
  UpdateAppealRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconChartBar,
  IconChecklist,
  IconClipboardText,
  IconFileText,
  IconGavel,
  IconPlus,
  IconSend,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { insuranceService } from "@/services/insurance.service";

// ── Color maps ─────────────────────────────────────────

const verificationColors: Record<string, BadgeTone> = {
  pending: "warning",
  active: "success",
  inactive: "neutral",
  unknown: "warning",
  error: "danger",
};

const paStatusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  pending_info: "warning",
  submitted: "primary",
  in_review: "primary",
  approved: "success",
  partially_approved: "success",
  denied: "danger",
  expired: "warning",
  cancelled: "neutral",
};

const urgencyColors: Record<string, BadgeTone> = {
  standard: "primary",
  urgent: "danger",
  retrospective: "warning",
};

const appealStatusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  submitted: "primary",
  in_review: "warning",
  upheld: "danger",
  overturned: "success",
  withdrawn: "neutral",
};

function canViewSensitiveField(access: FieldAccessLevel) {
  return access !== "hidden";
}

export function InsurancePage() {
  useRequirePermission(P.INSURANCE.VERIFICATION_LIST);
  const canViewPriorAuth = useHasPermission(P.INSURANCE.PRIOR_AUTH_LIST);
  const canViewAppeals = useHasPermission(P.INSURANCE.APPEALS_LIST);
  const canListRules = useHasPermission(P.INSURANCE.RULES_LIST);
  const canManageRules = useHasPermission(P.INSURANCE.RULES_MANAGE);
  const canViewRules = canListRules || canManageRules;
  const canViewDashboard = useHasPermission(P.INSURANCE.DASHBOARD_VIEW);

  return (
    <Tabs defaultValue="verification">
      <Tabs.List>
        <Tabs.Tab value="verification" leftSection={<IconShieldCheck size={16} />}>
          Verification
        </Tabs.Tab>
        {canViewPriorAuth && (
          <Tabs.Tab value="prior-auth" leftSection={<IconClipboardText size={16} />}>
            Prior Authorization
          </Tabs.Tab>
        )}
        {canViewAppeals && (
          <Tabs.Tab value="appeals" leftSection={<IconGavel size={16} />}>
            Appeals
          </Tabs.Tab>
        )}
        {canViewRules && (
          <Tabs.Tab value="rules" leftSection={<IconChecklist size={16} />}>
            PA Rules
          </Tabs.Tab>
        )}
        {canViewDashboard && (
          <Tabs.Tab value="dashboard" leftSection={<IconChartBar size={16} />}>
            Dashboard
          </Tabs.Tab>
        )}
      </Tabs.List>

      <Tabs.Panel value="verification" pt="md">
        <VerificationTab />
      </Tabs.Panel>
      {canViewPriorAuth && (
        <Tabs.Panel value="prior-auth" pt="md">
          <PriorAuthTab />
        </Tabs.Panel>
      )}
      {canViewAppeals && (
        <Tabs.Panel value="appeals" pt="md">
          <AppealsTab />
        </Tabs.Panel>
      )}
      {canViewRules && (
        <Tabs.Panel value="rules" pt="md">
          <RulesTab />
        </Tabs.Panel>
      )}
      {canViewDashboard && (
        <Tabs.Panel value="dashboard" pt="md">
          <DashboardTab />
        </Tabs.Panel>
      )}
    </Tabs>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 1 — Verification
// ═══════════════════════════════════════════════════════

function VerificationTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.INSURANCE.VERIFICATION_CREATE);
  const memberIdAccess = useFieldAccess("insurance.verification.member_id");
  const canViewMemberId = canViewSensitiveField(memberIdAccess);
  const [opened, { open, close }] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["insurance-verifications", filterStatus],
    queryFn: () => insuranceService.listVerifications({ status: filterStatus ?? undefined }),
  });

  const [form, setForm] = useState<RunVerificationRequest>({
    patient_id: "",
    patient_insurance_id: "",
    trigger_point: "manual",
  });

  const runMut = useMutation({
    mutationFn: (d: RunVerificationRequest) => insuranceService.runVerification(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-verifications"] });
      toast.success("Verification completed", { title: "Verification" });
      close();
    },
    onError: () => toast.error("Verification failed", { title: "Error" }),
  });

  const detail = data.find((v) => v.id === detailId);

  return (
    <Stack gap="md">
      <PageHeader
        title="Eligibility Verification"
        subtitle="Run and review insurance eligibility checks"
        actions={
          canCreate ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              Run Verification
            </Button>
          ) : undefined
        }
      />

      <Group>
        <Select
          placeholder="Filter by status"
          clearable
          data={["pending", "active", "inactive", "unknown", "error"]}
          value={filterStatus}
          onChange={setFilterStatus}
          w={200}
        />
      </Group>

      <DataTable
        data={data}
        loading={isLoading}
        rowKey={(r: InsuranceVerification) => r.id}
        columns={[
          {
            key: "patient_id",
            label: "Patient ID",
            render: (r: InsuranceVerification) => (
              <PatientNameCell patientId={r.patient_id} showUhid={false} />
            ),
          },
          {
            key: "payer_name",
            label: "Payer",
            render: (r: InsuranceVerification) => <Text size="sm">{r.payer_name ?? "—"}</Text>,
          },
          {
            key: "status",
            label: "Status",
            render: (r: InsuranceVerification) => (
              <Badge tone={verificationColors[r.status] ?? "neutral"}>{r.status}</Badge>
            ),
          },
          {
            key: "trigger_point",
            label: "Trigger",
            render: (r: InsuranceVerification) => <Text size="sm">{r.trigger_point}</Text>,
          },
          {
            key: "scheme_type",
            label: "Scheme",
            render: (r: InsuranceVerification) => (
              <Badge variant="outline" tone="neutral">
                {r.scheme_type ?? "N/A"}
              </Badge>
            ),
          },
          {
            key: "coverage",
            label: "Coverage",
            render: (r: InsuranceVerification) => (
              <Text size="sm">
                {r.coverage_start ?? "—"} → {r.coverage_end ?? "—"}
              </Text>
            ),
          },
          {
            key: "created_at",
            label: "Verified",
            render: (r: InsuranceVerification) => (
              <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (r: InsuranceVerification) => (
              <IconButton onClick={() => setDetailId(r.id)} aria-label="Document">
                <IconFileText size={16} />
              </IconButton>
            ),
          },
        ]}
      />

      {/* Run Verification Drawer */}
      <Drawer opened={opened} onClose={close} title="Run Verification" position="right" size="xl">
        <Stack gap="sm">
          <PatientSearchSelect
            value={form.patient_id}
            onChange={(patientId) => setForm({ ...form, patient_id: patientId })}
          />
          <TextInput
            label="Patient Insurance ID"
            required
            value={form.patient_insurance_id}
            onChange={(e) => setForm({ ...form, patient_insurance_id: e.currentTarget.value })}
          />
          <Select
            label="Trigger Point"
            data={["scheduling", "check_in", "admission", "manual"]}
            value={form.trigger_point}
            onChange={(v) => setForm({ ...form, trigger_point: v ?? "manual" })}
          />
          <Button tone="primary" loading={runMut.isPending} onClick={() => runMut.mutate(form)}>
            Verify
          </Button>
        </Stack>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        opened={!!detailId}
        onClose={() => setDetailId(null)}
        title="Verification Details"
        position="right"
        size="lg"
      >
        {detail && (
          <Stack gap="sm">
            <Group>
              <Badge size="lg" tone={verificationColors[detail.status] ?? "neutral"}>
                {detail.status}
              </Badge>
              {detail.scheme_type && (
                <Badge variant="outline" tone="neutral">
                  {detail.scheme_type}
                </Badge>
              )}
            </Group>
            <Grid>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Payer
                </Text>
                <Text size="sm" fw={500}>
                  {detail.payer_name ?? "—"}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Member ID
                </Text>
                <Text size="sm" fw={500}>
                  {canViewMemberId ? (detail.member_id ?? "—") : "Restricted"}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Coverage
                </Text>
                <Text size="sm">
                  {detail.coverage_start ?? "—"} → {detail.coverage_end ?? "—"}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Scheme Balance
                </Text>
                <Text size="sm" fw={500}>
                  {detail.scheme_balance != null ? `₹${detail.scheme_balance}` : "—"}
                </Text>
              </Grid.Col>
            </Grid>
            <Title order={5}>Benefits Breakdown</Title>
            <Grid>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Co-pay %
                </Text>
                <Text size="sm">{detail.co_pay_percent ?? "—"}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Co-insurance %
                </Text>
                <Text size="sm">{detail.co_insurance_percent ?? "—"}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Deductible
                </Text>
                <Text size="sm">
                  {detail.individual_deductible != null
                    ? `₹${detail.individual_deductible_met ?? 0} / ₹${detail.individual_deductible}`
                    : "—"}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Out-of-Pocket Max
                </Text>
                <Text size="sm">
                  {detail.out_of_pocket_max != null
                    ? `₹${detail.out_of_pocket_met ?? 0} / ₹${detail.out_of_pocket_max}`
                    : "—"}
                </Text>
              </Grid.Col>
            </Grid>
            {detail.error_message && (
              <Paper p="sm" bg="red.0">
                <Group gap="xs">
                  <IconAlertTriangle size={16} color="danger" />
                  <Text size="sm" c="danger">
                    {detail.error_code}: {detail.error_message}
                  </Text>
                </Group>
              </Paper>
            )}
            {detail.notes && (
              <>
                <Text size="xs" c="dimmed">
                  Notes
                </Text>
                <Text size="sm">{detail.notes}</Text>
              </>
            )}
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 2 — Prior Authorization
// ═══════════════════════════════════════════════════════

function PriorAuthTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.INSURANCE.PRIOR_AUTH_CREATE);
  const canUpdate = useHasPermission(P.INSURANCE.PRIOR_AUTH_UPDATE);
  const canSubmit = useHasPermission(P.INSURANCE.PRIOR_AUTH_SUBMIT);
  const authNumberAccess = useFieldAccess("insurance.prior_auth.auth_number");
  const denialDetailAccess = useFieldAccess("insurance.prior_auth.denial_reason");
  const canViewAuthNumber = canViewSensitiveField(authNumberAccess);
  const canEditAuthNumber = authNumberAccess === "edit";
  const canViewDenialDetails = canViewSensitiveField(denialDetailAccess);
  const canEditDenialDetails = denialDetailAccess === "edit";
  const [opened, { open, close }] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [respondId, setRespondId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["insurance-prior-auths", filterStatus],
    queryFn: () => insuranceService.listPriorAuths({ status: filterStatus ?? undefined }),
  });

  const detailQuery = useQuery({
    queryKey: ["insurance-prior-auth-detail", detailId],
    queryFn: () => (detailId ? insuranceService.getPriorAuth(detailId) : undefined),
    enabled: !!detailId,
  });

  const [form, setForm] = useState<CreatePriorAuthRequestBody>({
    patient_id: "",
    patient_insurance_id: "",
    service_type: "",
  });

  const createMut = useMutation({
    mutationFn: (d: CreatePriorAuthRequestBody) => insuranceService.createPriorAuth(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-prior-auths"] });
      toast.success("Created successfully", { title: "Prior Auth" });
      close();
    },
    onError: () => toast.error("Creation failed", { title: "Error" }),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => insuranceService.submitPriorAuth(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-prior-auths"] });
      void qc.invalidateQueries({ queryKey: ["insurance-prior-auth-detail"] });
      toast.success("Submitted successfully", { title: "Prior Auth" });
    },
    onError: () => toast.error("Submit failed", { title: "Error" }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => insuranceService.cancelPriorAuth(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-prior-auths"] });
      void qc.invalidateQueries({ queryKey: ["insurance-prior-auth-detail"] });
      toast.warning("Cancelled", { title: "Prior Auth" });
    },
  });

  const [respondForm, setRespondForm] = useState<RespondPriorAuthRequest>({
    status: "approved",
  });

  const respondMut = useMutation({
    mutationFn: (d: { id: string; body: RespondPriorAuthRequest }) =>
      insuranceService.respondPriorAuth(d.id, d.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-prior-auths"] });
      void qc.invalidateQueries({ queryKey: ["insurance-prior-auth-detail"] });
      toast.success("Response recorded", { title: "Prior Auth" });
      setRespondId(null);
    },
    onError: () => toast.error("Response failed", { title: "Error" }),
  });

  const tatColor = (pa: PriorAuthRequestRow): BadgeTone => {
    if (!pa.submitted_at || !pa.expected_tat_hours) return "neutral";
    const elapsed = (Date.now() - new Date(pa.submitted_at).getTime()) / 3_600_000;
    const ratio = elapsed / pa.expected_tat_hours;
    if (ratio > 1) return "danger";
    if (ratio > 0.75) return "warning";
    return "success";
  };

  const detail: PriorAuthDetail | undefined = detailQuery.data;

  const handleRespondPriorAuth = () => {
    if (!respondId) return;
    const body: RespondPriorAuthRequest = {
      status: respondForm.status,
      notes: respondForm.notes,
    };
    if (respondForm.status === "approved" || respondForm.status === "partially_approved") {
      Object.assign(body, {
        approved_amount: respondForm.approved_amount,
        approved_units: respondForm.approved_units,
      });
      if (canEditAuthNumber) {
        Object.assign(body, { auth_number: respondForm.auth_number });
      }
    }
    if (respondForm.status === "denied" && canEditDenialDetails) {
      Object.assign(body, {
        denial_code: respondForm.denial_code,
        denial_reason: respondForm.denial_reason,
      });
    }
    respondMut.mutate({ id: respondId, body });
  };

  const responseBlockedByFieldAccess = respondForm.status === "denied" && !canEditDenialDetails;

  return (
    <Stack gap="md">
      <PageHeader
        title="Prior Authorization"
        subtitle="Manage prior authorization requests"
        actions={
          canCreate ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New PA Request
            </Button>
          ) : undefined
        }
      />

      <Group>
        <Select
          placeholder="Filter by status"
          clearable
          data={[
            "draft",
            "pending_info",
            "submitted",
            "in_review",
            "approved",
            "partially_approved",
            "denied",
            "expired",
            "cancelled",
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
          w={200}
        />
      </Group>

      <DataTable
        data={data}
        loading={isLoading}
        rowKey={(r: PriorAuthRequestRow) => r.id}
        columns={[
          {
            key: "pa_number",
            label: "PA #",
            render: (r: PriorAuthRequestRow) => (
              <Text size="sm" fw={500}>
                {r.pa_number}
              </Text>
            ),
          },
          {
            key: "patient_id",
            label: "Patient",
            render: (r: PriorAuthRequestRow) => (
              <PatientNameCell patientId={r.patient_id} showUhid={false} />
            ),
          },
          {
            key: "service_type",
            label: "Service",
            render: (r: PriorAuthRequestRow) => <Text size="sm">{r.service_type}</Text>,
          },
          {
            key: "status",
            label: "Status",
            render: (r: PriorAuthRequestRow) => (
              <Badge tone={paStatusColors[r.status] ?? "neutral"}>
                {r.status.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "urgency",
            label: "Urgency",
            render: (r: PriorAuthRequestRow) => (
              <Badge variant="outline" tone={urgencyColors[r.urgency] ?? "primary"}>
                {r.urgency}
              </Badge>
            ),
          },
          {
            key: "tat",
            label: "TAT",
            render: (r: PriorAuthRequestRow) => (
              <Badge variant="dot" tone={tatColor(r)}>
                {r.expected_tat_hours ? `${r.expected_tat_hours}h` : "—"}
              </Badge>
            ),
          },
          {
            key: "escalated",
            label: "Escalated",
            render: (r: PriorAuthRequestRow) =>
              r.escalated ? (
                <Badge tone="danger" size="sm">
                  Yes
                </Badge>
              ) : (
                <Text size="sm">—</Text>
              ),
          },
          {
            key: "actions",
            label: "",
            render: (r: PriorAuthRequestRow) => (
              <Group gap={4}>
                <IconButton onClick={() => setDetailId(r.id)} aria-label="Document">
                  <IconFileText size={16} />
                </IconButton>
                {canSubmit && (r.status === "draft" || r.status === "pending_info") && (
                  <IconButton
                    tone="primary"
                    onClick={() => submitMut.mutate(r.id)}
                    loading={submitMut.isPending}
                    aria-label="Send"
                  >
                    <IconSend size={16} />
                  </IconButton>
                )}
              </Group>
            ),
          },
        ]}
      />

      {/* Create PA Drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        title="New Prior Authorization"
        position="right"
        size="lg"
      >
        <Stack gap="sm">
          <PatientSearchSelect
            value={form.patient_id}
            onChange={(patientId) => setForm({ ...form, patient_id: patientId })}
          />
          <TextInput
            label="Patient Insurance ID"
            required
            value={form.patient_insurance_id}
            onChange={(e) => setForm({ ...form, patient_insurance_id: e.currentTarget.value })}
          />
          <TextInput
            label="Service Type"
            required
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.currentTarget.value })}
          />
          <TextInput
            label="Service Code"
            value={form.service_code ?? ""}
            onChange={(e) => setForm({ ...form, service_code: e.currentTarget.value || undefined })}
          />
          <Textarea
            label="Service Description"
            value={form.service_description ?? ""}
            onChange={(e) =>
              setForm({ ...form, service_description: e.currentTarget.value || undefined })
            }
          />
          <Select
            label="Urgency"
            data={["standard", "urgent", "retrospective"]}
            value={form.urgency ?? "standard"}
            onChange={(v) =>
              setForm({
                ...form,
                urgency: (v as "standard" | "urgent" | "retrospective") ?? undefined,
              })
            }
          />
          <NumberInput
            label="Estimated Cost"
            min={0}
            decimalScale={2}
            value={form.estimated_cost ?? ""}
            onChange={(v) =>
              setForm({ ...form, estimated_cost: typeof v === "number" ? v : undefined })
            }
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Create PA Request
          </Button>
        </Stack>
      </Drawer>

      {/* PA Detail Drawer */}
      <Drawer
        opened={!!detailId}
        onClose={() => setDetailId(null)}
        title="Prior Auth Details"
        position="right"
        size="xl"
      >
        {detail && (
          <Stack gap="md">
            <Group>
              <Title order={4}>{detail.prior_auth.pa_number}</Title>
              <Badge tone={paStatusColors[detail.prior_auth.status] ?? "neutral"} size="lg">
                {detail.prior_auth.status.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline" tone={urgencyColors[detail.prior_auth.urgency] ?? "primary"}>
                {detail.prior_auth.urgency}
              </Badge>
            </Group>

            <Grid>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Service
                </Text>
                <Text size="sm" fw={500}>
                  {detail.prior_auth.service_type}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Service Code
                </Text>
                <Text size="sm">{detail.prior_auth.service_code ?? "—"}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  Estimated Cost
                </Text>
                <Text size="sm">
                  {detail.prior_auth.estimated_cost != null
                    ? `₹${detail.prior_auth.estimated_cost}`
                    : "—"}
                </Text>
              </Grid.Col>
              {canViewAuthNumber && (
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">
                    Auth Number
                  </Text>
                  <Text size="sm" fw={500}>
                    {detail.prior_auth.auth_number ?? "—"}
                  </Text>
                </Grid.Col>
              )}
              {detail.prior_auth.approved_amount != null && (
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">
                    Approved Amount
                  </Text>
                  <Text size="sm" c="success" fw={500}>
                    ₹{detail.prior_auth.approved_amount}
                  </Text>
                </Grid.Col>
              )}
              {detail.prior_auth.denial_reason && canViewDenialDetails && (
                <Grid.Col span={12}>
                  <Paper p="sm" bg="red.0">
                    <Text size="sm" c="danger" fw={500}>
                      Denial: {detail.prior_auth.denial_code} — {detail.prior_auth.denial_reason}
                    </Text>
                  </Paper>
                </Grid.Col>
              )}
              {detail.prior_auth.denial_reason && !canViewDenialDetails && (
                <Grid.Col span={12}>
                  <Paper p="sm" bg="red.0">
                    <Text size="sm" c="danger" fw={500}>
                      Denial details restricted
                    </Text>
                  </Paper>
                </Grid.Col>
              )}
            </Grid>

            {/* Status Timeline */}
            <Title order={5}>Status History</Title>
            <Stack gap="xs">
              {detail.status_log.map((log) => (
                <Group key={log.id} gap="sm">
                  <Badge size="xs" tone={paStatusColors[log.to_status] ?? "neutral"}>
                    {log.to_status.replace(/_/g, " ")}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {new Date(log.created_at).toLocaleString()}
                  </Text>
                  {log.notes && <Text size="xs">{log.notes}</Text>}
                </Group>
              ))}
            </Stack>

            {/* Documents */}
            <Title order={5}>Attached Documents ({detail.documents.length})</Title>
            <Stack gap="xs">
              {detail.documents.map((doc) => (
                <Group key={doc.id} gap="sm">
                  <IconFileText size={14} />
                  <Text size="sm">
                    {doc.document_type}: {doc.file_name ?? "inline"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </Text>
                </Group>
              ))}
            </Stack>

            {/* Actions */}
            <Group>
              {canUpdate && detail.prior_auth.status === "submitted" && (
                <Button tone="primary" onClick={() => setRespondId(detail.prior_auth.id)}>
                  Record Response
                </Button>
              )}
              {canSubmit &&
                (detail.prior_auth.status === "draft" ||
                  detail.prior_auth.status === "pending_info") && (
                  <Button
                    tone="primary"
                    leftSection={<IconSend size={16} />}
                    loading={submitMut.isPending}
                    onClick={() => submitMut.mutate(detail.prior_auth.id)}
                  >
                    Submit
                  </Button>
                )}
              {canUpdate &&
                detail.prior_auth.status !== "cancelled" &&
                detail.prior_auth.status !== "expired" && (
                  <Button
                    tone="subtle-danger"
                    loading={cancelMut.isPending}
                    onClick={() => cancelMut.mutate(detail.prior_auth.id)}
                  >
                    Cancel
                  </Button>
                )}
            </Group>
          </Stack>
        )}
      </Drawer>

      {/* Respond Drawer */}
      <Drawer
        opened={!!respondId}
        onClose={() => setRespondId(null)}
        title="Record Payer Response"
        position="right"
        size="md"
      >
        <Stack gap="sm">
          <Select
            label="Decision"
            required
            data={["approved", "partially_approved", "denied"]}
            value={respondForm.status}
            onChange={(v) =>
              setRespondForm({
                ...respondForm,
                status: (v as "approved" | "partially_approved" | "denied") ?? "approved",
              })
            }
          />
          {(respondForm.status === "approved" || respondForm.status === "partially_approved") && (
            <>
              {canViewAuthNumber && (
                <TextInput
                  label="Auth Number"
                  disabled={!canEditAuthNumber}
                  value={respondForm.auth_number ?? ""}
                  onChange={(e) =>
                    setRespondForm({
                      ...respondForm,
                      auth_number: e.currentTarget.value || undefined,
                    })
                  }
                />
              )}
              <NumberInput
                label="Approved Amount"
                min={0}
                decimalScale={2}
                value={respondForm.approved_amount ?? ""}
                onChange={(v) =>
                  setRespondForm({
                    ...respondForm,
                    approved_amount: typeof v === "number" ? v : undefined,
                  })
                }
              />
              <NumberInput
                label="Approved Units"
                min={0}
                value={respondForm.approved_units ?? ""}
                onChange={(v) =>
                  setRespondForm({
                    ...respondForm,
                    approved_units: typeof v === "number" ? v : undefined,
                  })
                }
              />
            </>
          )}
          {respondForm.status === "denied" &&
            (canViewDenialDetails ? (
              <>
                <TextInput
                  label="Denial Code"
                  disabled={!canEditDenialDetails}
                  value={respondForm.denial_code ?? ""}
                  onChange={(e) =>
                    setRespondForm({
                      ...respondForm,
                      denial_code: e.currentTarget.value || undefined,
                    })
                  }
                />
                <Textarea
                  label="Denial Reason"
                  disabled={!canEditDenialDetails}
                  value={respondForm.denial_reason ?? ""}
                  onChange={(e) =>
                    setRespondForm({
                      ...respondForm,
                      denial_reason: e.currentTarget.value || undefined,
                    })
                  }
                />
              </>
            ) : (
              <Text size="sm" c="danger">
                Denial details are restricted for this role.
              </Text>
            ))}
          <Textarea
            label="Notes"
            value={respondForm.notes ?? ""}
            onChange={(e) =>
              setRespondForm({ ...respondForm, notes: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={respondMut.isPending}
            onClick={handleRespondPriorAuth}
            disabled={responseBlockedByFieldAccess}
          >
            Record Response
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 3 — Appeals
// ═══════════════════════════════════════════════════════

function AppealsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.INSURANCE.APPEALS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["insurance-appeals", filterStatus],
    queryFn: () => insuranceService.listAppeals({ status: filterStatus ?? undefined }),
  });

  const [form, setForm] = useState<CreateAppealRequest>({
    prior_auth_id: "",
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAppealRequest) => insuranceService.createAppeal(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-appeals"] });
      toast.success("Created successfully", { title: "Appeal" });
      close();
    },
    onError: () => toast.error("Creation failed", { title: "Error" }),
  });

  const updateMut = useMutation({
    mutationFn: (d: { id: string; body: UpdateAppealRequest }) =>
      insuranceService.updateAppeal(d.id, d.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-appeals"] });
      toast.success("Updated", { title: "Appeal" });
    },
    onError: () => toast.error("Update failed", { title: "Error" }),
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Denial Appeals"
        subtitle="Manage appeals for denied prior authorizations"
        actions={
          canCreate ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Appeal
            </Button>
          ) : undefined
        }
      />

      <Group>
        <Select
          placeholder="Filter by status"
          clearable
          data={["draft", "submitted", "in_review", "upheld", "overturned", "withdrawn"]}
          value={filterStatus}
          onChange={setFilterStatus}
          w={200}
        />
      </Group>

      <DataTable
        data={data}
        loading={isLoading}
        rowKey={(r: PriorAuthAppeal) => r.id}
        columns={[
          {
            key: "appeal_number",
            label: "Appeal #",
            render: (r: PriorAuthAppeal) => (
              <Text size="sm" fw={500}>
                {r.appeal_number}
              </Text>
            ),
          },
          {
            key: "prior_auth_id",
            label: "PA ID",
            render: (r: PriorAuthAppeal) => <Text size="sm">{r.prior_auth_id.slice(0, 8)}...</Text>,
          },
          {
            key: "level",
            label: "Level",
            render: (r: PriorAuthAppeal) => (
              <Badge variant="outline" tone="neutral">
                {r.level}
              </Badge>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r: PriorAuthAppeal) => (
              <Badge tone={appealStatusColors[r.status] ?? "neutral"}>
                {r.status.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "deadline",
            label: "Deadline",
            render: (r: PriorAuthAppeal) => (
              <Text
                size="sm"
                c={r.deadline && new Date(r.deadline) < new Date() ? "danger" : undefined}
              >
                {r.deadline ?? "—"}
              </Text>
            ),
          },
          {
            key: "created_at",
            label: "Created",
            render: (r: PriorAuthAppeal) => (
              <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (r: PriorAuthAppeal) => (
              <Group gap={4}>
                {canCreate && r.status === "draft" && (
                  <IconButton
                    tone="primary"
                    onClick={() => updateMut.mutate({ id: r.id, body: { status: "submitted" } })}
                    aria-label="Send"
                  >
                    <IconSend size={16} />
                  </IconButton>
                )}
              </Group>
            ),
          },
        ]}
      />

      {/* Create Appeal Drawer */}
      <Drawer opened={opened} onClose={close} title="New Appeal" position="right" size="xl">
        <Stack gap="sm">
          <TextInput
            label="Prior Auth ID (denied PA)"
            required
            value={form.prior_auth_id}
            onChange={(e) => setForm({ ...form, prior_auth_id: e.currentTarget.value })}
          />
          <Textarea
            label="Reason"
            value={form.reason ?? ""}
            onChange={(e) => setForm({ ...form, reason: e.currentTarget.value || undefined })}
          />
          <Textarea
            label="Clinical Rationale"
            minRows={3}
            value={form.clinical_rationale ?? ""}
            onChange={(e) =>
              setForm({ ...form, clinical_rationale: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Supporting Evidence"
            minRows={2}
            value={form.supporting_evidence ?? ""}
            onChange={(e) =>
              setForm({ ...form, supporting_evidence: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Appeal Letter Content"
            minRows={4}
            value={form.letter_content ?? ""}
            onChange={(e) =>
              setForm({ ...form, letter_content: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Create Appeal
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 4 — PA Rules
// ═══════════════════════════════════════════════════════

function RulesTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.INSURANCE.RULES_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["insurance-rules"],
    queryFn: () => insuranceService.listPaRules(),
  });

  const [form, setForm] = useState<CreatePaRuleRequest>({ rule_name: "" });

  const createMut = useMutation({
    mutationFn: (d: CreatePaRuleRequest) => insuranceService.createPaRule(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-rules"] });
      toast.success("Created", { title: "PA Rule" });
      close();
    },
    onError: () => toast.error("Creation failed", { title: "Error" }),
  });

  const toggleMut = useMutation({
    mutationFn: (d: { id: string; is_active: boolean }) =>
      insuranceService.updatePaRule(d.id, { is_active: d.is_active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["insurance-rules"] }),
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="PA Requirement Rules"
        subtitle="Configure when prior authorization is required"
        actions={
          canManage ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              Add Rule
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={data}
        loading={isLoading}
        rowKey={(r: PaRequirementRule) => r.id}
        columns={[
          {
            key: "rule_name",
            label: "Rule Name",
            render: (r: PaRequirementRule) => (
              <Text size="sm" fw={500}>
                {r.rule_name}
              </Text>
            ),
          },
          {
            key: "service_type",
            label: "Service Type",
            render: (r: PaRequirementRule) => <Text size="sm">{r.service_type ?? "Any"}</Text>,
          },
          {
            key: "insurance_provider",
            label: "Provider",
            render: (r: PaRequirementRule) => (
              <Text size="sm">{r.insurance_provider ?? "Any"}</Text>
            ),
          },
          {
            key: "charge_code",
            label: "Code / Pattern",
            render: (r: PaRequirementRule) => (
              <Text size="sm">{r.charge_code ?? r.charge_code_pattern ?? "—"}</Text>
            ),
          },
          {
            key: "thresholds",
            label: "Thresholds",
            render: (r: PaRequirementRule) => (
              <Text size="sm">
                {r.cost_threshold != null ? `₹${r.cost_threshold}` : ""}
                {r.cost_threshold != null && r.los_threshold != null ? " / " : ""}
                {r.los_threshold != null ? `${r.los_threshold}d LOS` : ""}
                {r.cost_threshold == null && r.los_threshold == null ? "—" : ""}
              </Text>
            ),
          },
          {
            key: "priority",
            label: "Priority",
            render: (r: PaRequirementRule) => (
              <Badge variant="outline" tone="neutral">
                {r.priority}
              </Badge>
            ),
          },
          {
            key: "is_active",
            label: "Active",
            render: (r: PaRequirementRule) =>
              canManage ? (
                <Switch
                  checked={r.is_active}
                  onChange={(e) =>
                    toggleMut.mutate({ id: r.id, is_active: e.currentTarget.checked })
                  }
                />
              ) : (
                <Badge tone={r.is_active ? "success" : "neutral"}>
                  {r.is_active ? "Yes" : "No"}
                </Badge>
              ),
          },
        ]}
      />

      {/* Create Rule Drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        title="Add PA Requirement Rule"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <TextInput
            label="Rule Name"
            required
            value={form.rule_name}
            onChange={(e) => setForm({ ...form, rule_name: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Insurance Provider (blank = all)"
            value={form.insurance_provider ?? ""}
            onChange={(e) =>
              setForm({ ...form, insurance_provider: e.currentTarget.value || undefined })
            }
          />
          <Select
            label="Scheme Type"
            clearable
            data={["private", "cghs", "echs", "pmjay", "esis", "state_scheme"]}
            value={form.scheme_type ?? null}
            onChange={(v) => setForm({ ...form, scheme_type: v ?? undefined })}
          />
          <TextInput
            label="TPA Name"
            value={form.tpa_name ?? ""}
            onChange={(e) => setForm({ ...form, tpa_name: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Service Type"
            value={form.service_type ?? ""}
            onChange={(e) => setForm({ ...form, service_type: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Charge Code"
            value={form.charge_code ?? ""}
            onChange={(e) => setForm({ ...form, charge_code: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Charge Code Pattern (regex)"
            value={form.charge_code_pattern ?? ""}
            onChange={(e) =>
              setForm({ ...form, charge_code_pattern: e.currentTarget.value || undefined })
            }
          />
          <NumberInput
            label="Cost Threshold (₹)"
            min={0}
            decimalScale={2}
            value={form.cost_threshold ?? ""}
            onChange={(v) =>
              setForm({ ...form, cost_threshold: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="LOS Threshold (days)"
            min={0}
            value={form.los_threshold ?? ""}
            onChange={(v) =>
              setForm({ ...form, los_threshold: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Priority"
            min={0}
            value={form.priority ?? 0}
            onChange={(v) => setForm({ ...form, priority: typeof v === "number" ? v : undefined })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Create Rule
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 5 — Dashboard
// ═══════════════════════════════════════════════════════

function DashboardTab() {
  const canView = useHasPermission(P.INSURANCE.DASHBOARD_VIEW);
  const { data, isLoading } = useQuery({
    queryKey: ["insurance-dashboard"],
    queryFn: () => insuranceService.getInsuranceDashboard(),
    enabled: canView,
  });

  if (isLoading || !data) return <Text>Loading dashboard...</Text>;

  const d: InsuranceDashboard = data;
  const approvalRate =
    d.total_prior_auths > 0 ? (d.approved_prior_auths / d.total_prior_auths) * 100 : 0;

  return (
    <Stack gap="md">
      <PageHeader title="Insurance Dashboard" subtitle="Key metrics and trends" />

      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Total Verifications
            </Text>
            <Title order={3}>{d.total_verifications}</Title>
            <Text size="xs" c="success">
              {d.active_verifications} active
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Active PAs
            </Text>
            <Title order={3}>{d.pending_prior_auths}</Title>
            <Text size="xs" c="dimmed">
              of {d.total_prior_auths} total
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Denial Rate
            </Text>
            <Title order={3}>{d.denial_rate_percent.toFixed(1)}%</Title>
            <Progress value={d.denial_rate_percent} color="danger" size="sm" mt="xs" />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Pending Appeals
            </Text>
            <Title order={3}>{d.pending_appeals}</Title>
            <Text size="xs" c="dimmed">
              Avg TAT: {d.avg_tat_hours != null ? `${d.avg_tat_hours.toFixed(1)}h` : "—"}
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* PA Status Breakdown */}
      <Paper p="md" withBorder>
        <Title order={5} mb="sm">
          PA Status Breakdown
        </Title>
        <Group gap="lg">
          <Group gap="xs">
            <Badge tone="success" variant="dot" />
            <Text size="sm">
              Approved: {d.approved_prior_auths} ({approvalRate.toFixed(1)}%)
            </Text>
          </Group>
          <Group gap="xs">
            <Badge tone="danger" variant="dot" />
            <Text size="sm">Denied: {d.denied_prior_auths}</Text>
          </Group>
          <Group gap="xs">
            <Badge tone="primary" variant="dot" />
            <Text size="sm">Pending: {d.pending_prior_auths}</Text>
          </Group>
        </Group>
        <Progress.Root size="lg" mt="sm">
          {d.total_prior_auths > 0 && (
            <>
              <Progress.Section
                value={(d.approved_prior_auths / d.total_prior_auths) * 100}
                color="success"
              />
              <Progress.Section
                value={(d.denied_prior_auths / d.total_prior_auths) * 100}
                color="danger"
              />
              <Progress.Section
                value={(d.pending_prior_auths / d.total_prior_auths) * 100}
                color="primary"
              />
            </>
          )}
        </Progress.Root>
      </Paper>

      <Grid>
        {/* Top Denial Reasons */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder>
            <Title order={5} mb="sm">
              Top Denial Reasons
            </Title>
            <Stack gap="xs">
              {d.top_denial_reasons.length === 0 && (
                <Text size="sm" c="dimmed">
                  No denials yet
                </Text>
              )}
              {d.top_denial_reasons.map((r) => (
                <Group key={r.reason} justify="space-between">
                  <Text size="sm">{r.reason}</Text>
                  <Badge variant="outline" tone="neutral">
                    {r.count}
                  </Badge>
                </Group>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>

        {/* Expiring Soon */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder>
            <Title order={5} mb="sm">
              Expiring Soon (7 days)
            </Title>
            <Stack gap="xs">
              {d.expiring_soon.length === 0 && (
                <Text size="sm" c="dimmed">
                  No PAs expiring soon
                </Text>
              )}
              {d.expiring_soon.map((pa) => (
                <Group key={pa.id} justify="space-between">
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      {pa.pa_number}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {pa.service_type}
                    </Text>
                  </Group>
                  <Text size="xs" c="orange">
                    Expires: {pa.expires_at ? new Date(pa.expires_at).toLocaleDateString() : "—"}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
