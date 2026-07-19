// IPD HygieneTab — split from infection-control.tsx (pure move).

import { BarChart } from "@mantine/charts";
import {
  Card,
  Drawer,
  Grid,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateHygieneAuditRequest,
  CultureSurveillance,
  HandHygieneAudit,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { Badge, Button } from "@/components/ui";
import { infectionControlService } from "@/services/infectionControl.service";

const STAFF_CATEGORIES = [
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "technician", label: "Technician" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "paramedic", label: "Paramedic" },
  { value: "admin", label: "Administrative" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

export function HygieneTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.HYGIENE_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [subView, setSubView] = useState<string>("audits");

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ["ic-hygiene"],
    queryFn: () => infectionControlService.listHygieneAudits(),
  });

  const { data: cultures = [], isLoading: culturesLoading } = useQuery({
    queryKey: ["ic-cultures"],
    queryFn: () => infectionControlService.listCultureSurveillance(),
  });

  // Feature 2: Bundle compliance stats
  const { data: deviceDays = [] } = useQuery({
    queryKey: ["ic-device-days"],
    queryFn: () => infectionControlService.listDeviceDays(),
  });

  // Feature 3: Hand hygiene audit bar chart by department
  const hygieneChartData = useMemo(() => {
    const byDept: Record<string, { total: number; compliant: number; count: number }> = {};
    audits.forEach((a) => {
      const dept = a.department_id;
      if (!dept) return;
      if (!byDept[dept]) byDept[dept] = { total: 0, compliant: 0, count: 0 };
      byDept[dept].total += a.observations;
      byDept[dept].compliant += a.compliant;
      byDept[dept].count++;
    });
    return Object.entries(byDept).map(([dept, data]) => ({
      department: dept,
      compliance: data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 0,
    }));
  }, [audits]);

  // Feature 6: Environmental monitoring pass/fail
  const envMonitoringSummary = useMemo(() => {
    const byLocation: Record<string, { pass: number; fail: number }> = {};
    cultures.forEach((c) => {
      const loc = c.sample_site;
      if (!byLocation[loc]) byLocation[loc] = { pass: 0, fail: 0 };
      if (c.acceptable === true) byLocation[loc].pass++;
      else if (c.acceptable === false) byLocation[loc].fail++;
    });
    const totalPass = Object.values(byLocation).reduce((sum, d) => sum + d.pass, 0);
    const totalFail = Object.values(byLocation).reduce((sum, d) => sum + d.fail, 0);
    const total = totalPass + totalFail;
    return {
      passRate: total > 0 ? ((totalPass / total) * 100).toFixed(1) : "0.0",
      total,
      totalPass,
      totalFail,
    };
  }, [cultures]);

  const [form, setForm] = useState<CreateHygieneAuditRequest>({
    audit_date: "",
    department_id: "",
    observations: 0,
    compliant: 0,
    non_compliant: 0,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateHygieneAuditRequest) =>
      infectionControlService.createHygieneAudit(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-hygiene"] });
      notifications.show({ title: "Audit recorded", message: "", color: "success" });
      close();
    },
  });

  const auditColumns = [
    {
      key: "audit_date" as const,
      label: "Date",
      render: (r: HandHygieneAudit) => new Date(r.audit_date).toLocaleDateString(),
    },
    {
      key: "observations" as const,
      label: "Observations",
      render: (r: HandHygieneAudit) => String(r.observations),
    },
    {
      key: "compliant" as const,
      label: "Compliant",
      render: (r: HandHygieneAudit) => <Badge tone="success">{r.compliant}</Badge>,
    },
    {
      key: "non_compliant" as const,
      label: "Non-Compliant",
      render: (r: HandHygieneAudit) => <Badge tone="danger">{r.non_compliant}</Badge>,
    },
    {
      key: "compliance_rate" as const,
      label: "Rate",
      render: (r: HandHygieneAudit) =>
        r.compliance_rate != null ? `${Number(r.compliance_rate).toFixed(1)}%` : "---",
    },
    {
      key: "staff_category" as const,
      label: "Staff Category",
      render: (r: HandHygieneAudit) => r.staff_category ?? "---",
    },
    {
      key: "findings" as const,
      label: "Findings",
      render: (r: HandHygieneAudit) => r.findings ?? "---",
    },
  ];

  const cultureColumns = [
    {
      key: "culture_type" as const,
      label: "Type",
      render: (r: CultureSurveillance) => r.culture_type,
    },
    {
      key: "sample_site" as const,
      label: "Site",
      render: (r: CultureSurveillance) => r.sample_site,
    },
    {
      key: "collection_date" as const,
      label: "Date",
      render: (r: CultureSurveillance) => new Date(r.collection_date).toLocaleDateString(),
    },
    {
      key: "organism" as const,
      label: "Organism",
      render: (r: CultureSurveillance) => r.organism ?? "---",
    },
    {
      key: "acceptable" as const,
      label: "Status",
      render: (r: CultureSurveillance) =>
        r.acceptable == null ? (
          <Badge tone="neutral">Pending</Badge>
        ) : r.acceptable ? (
          <Badge tone="success">Pass</Badge>
        ) : (
          <Badge tone="danger">Fail</Badge>
        ),
    },
    {
      key: "action_taken" as const,
      label: "Action",
      render: (r: CultureSurveillance) => r.action_taken ?? "---",
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          value={subView}
          onChange={setSubView}
          data={[
            { value: "audits", label: "Hand Hygiene" },
            { value: "bundles", label: "Bundle Compliance" },
            { value: "cultures", label: "Environmental" },
          ]}
        />
        {canCreate && subView === "audits" && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            New Audit
          </Button>
        )}
      </Group>

      {subView === "audits" && (
        <>
          <DataTable
            columns={auditColumns}
            data={audits}
            loading={isLoading}
            rowKey={(r) => r.id}
            emptyTitle="No hygiene audits"
          />
          {hygieneChartData.length > 0 && (
            <Paper p="md" withBorder mt="md">
              <Title order={5} mb="md">
                Compliance Rate by Department
              </Title>
              <BarChart
                h={300}
                data={hygieneChartData}
                dataKey="department"
                series={[{ name: "compliance", label: "Compliance %", color: "teal" }]}
                tickLine="y"
              />
            </Paper>
          )}
        </>
      )}

      {subView === "bundles" && (
        <Stack>
          <Card withBorder p="md">
            <Text size="sm" c="dimmed" mb="xs">
              Bundle Compliance Summary
            </Text>
            <Text size="sm">
              Based on device-day records. Individual bundle compliance tracking requires structured
              bundle_compliance field in device day records.
            </Text>
          </Card>
          <Grid>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Total Device Days
                </Text>
                <Text size="xl" fw={600}>
                  {deviceDays.length}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Central Line Days
                </Text>
                <Text size="xl" fw={600}>
                  {deviceDays.reduce((sum, d) => sum + d.central_line_days, 0)}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Ventilator Days
                </Text>
                <Text size="xl" fw={600}>
                  {deviceDays.reduce((sum, d) => sum + d.ventilator_days, 0)}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Catheter Days
                </Text>
                <Text size="xl" fw={600}>
                  {deviceDays.reduce((sum, d) => sum + d.urinary_catheter_days, 0)}
                </Text>
              </Card>
            </Grid.Col>
          </Grid>
        </Stack>
      )}

      {subView === "cultures" && (
        <>
          <Grid>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Pass Rate
                </Text>
                <Text size="xl" fw={600} c="teal">
                  {envMonitoringSummary.passRate}%
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Total Samples
                </Text>
                <Text size="xl" fw={600}>
                  {envMonitoringSummary.total}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Passed
                </Text>
                <Text size="xl" fw={600} c="success">
                  {envMonitoringSummary.totalPass}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Failed
                </Text>
                <Text size="xl" fw={600} c="danger">
                  {envMonitoringSummary.totalFail}
                </Text>
              </Card>
            </Grid.Col>
          </Grid>
          <DataTable
            columns={cultureColumns}
            data={cultures}
            loading={culturesLoading}
            rowKey={(r) => r.id}
            emptyTitle="No culture records"
          />
        </>
      )}

      <Drawer opened={opened} onClose={close} title="Hand Hygiene Audit" position="right" size="xl">
        <Stack>
          <TextInput
            label="Audit Date"
            type="datetime-local"
            required
            value={form.audit_date}
            onChange={(e) => setForm({ ...form, audit_date: e.currentTarget.value })}
          />
          <DepartmentSelect
            value={form.department_id}
            onChange={(id) => setForm({ ...form, department_id: id })}
            required
          />
          <NumberInput
            label="Total Observations"
            required
            value={form.observations}
            onChange={(v) => setForm({ ...form, observations: Number(v) })}
          />
          <NumberInput
            label="Compliant"
            required
            value={form.compliant}
            onChange={(v) => setForm({ ...form, compliant: Number(v) })}
          />
          <NumberInput
            label="Non-Compliant"
            required
            value={form.non_compliant}
            onChange={(v) => setForm({ ...form, non_compliant: Number(v) })}
          />
          <Select
            label="Staff Category"
            data={STAFF_CATEGORIES}
            value={form.staff_category ?? null}
            onChange={(v) => setForm({ ...form, staff_category: v || undefined })}
            clearable
            searchable
          />
          <Textarea
            label="Findings"
            value={form.findings ?? ""}
            onChange={(e) => setForm({ ...form, findings: e.currentTarget.value || undefined })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Outbreak Tab ────────────────────────────────────────
