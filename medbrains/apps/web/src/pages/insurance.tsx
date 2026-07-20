import {
  Drawer,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  CreatePriorAuthRequestBody,
  PriorAuthDetail,
  PriorAuthRequestRow,
  RespondPriorAuthRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
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
import { AppealsTab } from "./insurance/appeals-tab";
import { DashboardTab } from "./insurance/dashboard-tab";
import { RulesTab } from "./insurance/rules-tab";
import { canViewSensitiveField } from "./insurance/shared";
import { VerificationTab } from "./insurance/verification-tab";

// ── Color maps ─────────────────────────────────────────

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
