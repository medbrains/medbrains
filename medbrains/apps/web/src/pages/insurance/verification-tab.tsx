// Insurance VerificationTab — split from insurance.tsx (pure move).

import { Drawer, Grid, Group, Paper, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type { InsuranceVerification, RunVerificationRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconFileText, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { insuranceService } from "@/services/insurance.service";
import { canViewSensitiveField } from "./shared";

const verificationColors: Record<string, BadgeTone> = {
  pending: "warning",
  active: "success",
  inactive: "neutral",
  unknown: "warning",
  error: "danger",
};

export function VerificationTab() {
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
