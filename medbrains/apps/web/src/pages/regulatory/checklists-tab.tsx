// REGULATORY ChecklistsTab — split from regulatory.tsx (pure move).

import { BarChart } from "@mantine/charts";
import {
  Drawer,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { ComplianceChecklist, CreateChecklistRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconDownload, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";
import { checklistStatusColors } from "./shared";

function ChecklistListView({
  checklists,
  isLoading,
  bodyFilter,
  setBodyFilter,
}: {
  checklists: ComplianceChecklist[];
  isLoading: boolean;
  bodyFilter: string | null;
  setBodyFilter: (v: string | null) => void;
}) {
  const canUpdate = useHasPermission(P.REGULATORY.CHECKLISTS_UPDATE);
  const qc = useQueryClient();

  const autoPopulateMut = useMutation({
    mutationFn: (id: string) => regulatoryService.autoPopulateChecklist(id),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["regulatory-checklists"] });
      toast.success(`${result.updated} item(s) updated`, { title: "Auto-populated" });
    },
    onError: () => {
      toast.error("Could not auto-populate checklist", { title: "Auto-populate failed" });
    },
  });

  return (
    <Stack gap="md">
      <Group>
        <Select
          placeholder="Filter by body"
          clearable
          value={bodyFilter}
          onChange={setBodyFilter}
          data={[
            { value: "nabh", label: "NABH" },
            { value: "nmc", label: "NMC" },
            { value: "nabl", label: "NABL" },
            { value: "jci", label: "JCI" },
            { value: "abdm", label: "ABDM" },
          ]}
        />
      </Group>

      <DataTable
        data={checklists}
        rowKey={(r) => r.id}
        loading={isLoading}
        columns={[
          {
            key: "name",
            label: "Name",
            render: (r) => (
              <Text size="sm" fw={500}>
                {r.name}
              </Text>
            ),
          },
          {
            key: "accreditation_body",
            label: "Body",
            render: (r) => (
              <Badge tone="neutral" size="sm" tt="uppercase">
                {r.accreditation_body}
              </Badge>
            ),
          },
          {
            key: "standard_code",
            label: "Standard",
            render: (r) => <Text size="sm">{r.standard_code}</Text>,
          },
          {
            key: "overall_status",
            label: "Status",
            render: (r) => (
              <Badge tone={checklistStatusColors[r.overall_status]}>
                {r.overall_status.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "compliance_score",
            label: "Score",
            render: (r) =>
              r.compliance_score != null ? (
                <Badge
                  tone={
                    r.compliance_score >= 80
                      ? "success"
                      : r.compliance_score >= 60
                        ? "warning"
                        : "danger"
                  }
                >
                  {r.compliance_score}%
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  -
                </Text>
              ),
          },
          {
            key: "items",
            label: "Items",
            render: (r) => (
              <Text size="sm">
                {r.compliant_items}/{r.total_items}
              </Text>
            ),
          },
          {
            key: "period",
            label: "Period",
            render: (r) => (
              <Text size="sm">
                {r.assessment_period_start} — {r.assessment_period_end}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (r) =>
              canUpdate ? (
                <Tooltip label="Auto-populate from system data">
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    loading={autoPopulateMut.isPending}
                    onClick={() => autoPopulateMut.mutate(r.id)}
                  >
                    Auto-Populate
                  </Button>
                </Tooltip>
              ) : null,
          },
        ]}
      />
    </Stack>
  );
}

function GapAnalysisView({
  checklists,
  isLoading,
}: {
  checklists: ComplianceChecklist[];
  isLoading: boolean;
}) {
  const chartData = useMemo(() => {
    return checklists.map((c) => {
      const partialItems = c.total_items - c.compliant_items - c.non_compliant_items;
      return {
        name: c.name.length > 30 ? `${c.name.slice(0, 27)}...` : c.name,
        met: c.compliant_items,
        partial: partialItems,
        unmet: c.non_compliant_items,
      };
    });
  }, [checklists]);

  const summaryData = useMemo(() => {
    return checklists.map((c) => {
      const partialItems = c.total_items - c.compliant_items - c.non_compliant_items;
      const metPercent =
        c.total_items > 0 ? Math.round((c.compliant_items / c.total_items) * 100) : 0;
      const partialPercent =
        c.total_items > 0 ? Math.round((partialItems / c.total_items) * 100) : 0;
      const unmetPercent =
        c.total_items > 0 ? Math.round((c.non_compliant_items / c.total_items) * 100) : 0;

      return {
        id: c.id,
        name: c.name,
        body: c.accreditation_body,
        total: c.total_items,
        met: c.compliant_items,
        partial: partialItems,
        unmet: c.non_compliant_items,
        metPercent,
        partialPercent,
        unmetPercent,
      };
    });
  }, [checklists]);

  if (isLoading) {
    return <Text>Loading gap analysis...</Text>;
  }

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={600}>Gap Analysis Visual Report</Text>
          <Button tone="secondary" leftSection={<IconDownload size={16} />} size="sm">
            Export Report
          </Button>
        </Group>

        {chartData.length > 0 ? (
          <BarChart
            h={400}
            data={chartData}
            dataKey="name"
            series={[
              { name: "met", label: "Met", color: "success" },
              { name: "partial", label: "Partial", color: "warning" },
              { name: "unmet", label: "Unmet", color: "danger" },
            ]}
            type="stacked"
            orientation="horizontal"
          />
        ) : (
          <Text c="dimmed">No checklists available for analysis</Text>
        )}
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} mb="md">
          Detailed Gap Breakdown
        </Text>
        <DataTable
          data={summaryData}
          rowKey={(r) => r.id}
          loading={false}
          columns={[
            {
              key: "name",
              label: "Checklist",
              render: (r) => (
                <Text size="sm" fw={500}>
                  {r.name}
                </Text>
              ),
            },
            {
              key: "body",
              label: "Body",
              render: (r) => (
                <Badge tone="neutral" size="sm" tt="uppercase">
                  {r.body}
                </Badge>
              ),
            },
            { key: "total", label: "Total", render: (r) => <Text size="sm">{r.total}</Text> },
            {
              key: "met",
              label: "Met",
              render: (r) => (
                <Group gap={4}>
                  <Text size="sm" c="success" fw={600}>
                    {r.met}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({r.metPercent}%)
                  </Text>
                </Group>
              ),
            },
            {
              key: "partial",
              label: "Partial",
              render: (r) => (
                <Group gap={4}>
                  <Text size="sm" c="warning" fw={600}>
                    {r.partial}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({r.partialPercent}%)
                  </Text>
                </Group>
              ),
            },
            {
              key: "unmet",
              label: "Unmet",
              render: (r) => (
                <Group gap={4}>
                  <Text size="sm" c="danger" fw={600}>
                    {r.unmet}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({r.unmetPercent}%)
                  </Text>
                </Group>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => (
                <Badge
                  tone={r.metPercent >= 80 ? "success" : r.metPercent >= 50 ? "warning" : "danger"}
                >
                  {r.metPercent >= 80 ? "Good" : r.metPercent >= 50 ? "Fair" : "Critical"}
                </Badge>
              ),
            },
          ]}
        />
      </Paper>
    </Stack>
  );
}

export function ChecklistsTab() {
  const [checklistView, setChecklistView] = useState("list");
  const canCreate = useHasPermission(P.REGULATORY.CHECKLISTS_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [bodyFilter, setBodyFilter] = useState<string | null>(null);

  const { data: checklists = [], isLoading } = useQuery<ComplianceChecklist[]>({
    queryKey: ["regulatory-checklists", bodyFilter],
    queryFn: () =>
      regulatoryService.listChecklists(bodyFilter ? { accreditation_body: bodyFilter } : undefined),
  });

  const [form, setForm] = useState<CreateChecklistRequest>({
    accreditation_body: "nabh",
    standard_code: "",
    name: "",
    assessment_period_start: "",
    assessment_period_end: "",
  });

  const createMut = useMutation({
    mutationFn: (data: CreateChecklistRequest) => regulatoryService.createChecklist(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-checklists"] });
      toast.success("", { title: "Checklist created" });
      close();
    },
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Compliance Checklists"
        subtitle="Department-wise regulatory compliance assessments"
        actions={
          canCreate ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Checklist
            </Button>
          ) : undefined
        }
      />

      <SegmentedControl
        value={checklistView}
        onChange={setChecklistView}
        data={[
          { value: "list", label: "Checklist List" },
          { value: "gap-analysis", label: "Gap Analysis" },
        ]}
      />

      {checklistView === "list" ? (
        <ChecklistListView
          checklists={checklists}
          isLoading={isLoading}
          bodyFilter={bodyFilter}
          setBodyFilter={setBodyFilter}
        />
      ) : (
        <GapAnalysisView checklists={checklists} isLoading={isLoading} />
      )}

      <Drawer
        opened={opened}
        onClose={close}
        title="New Compliance Checklist"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
          <Select
            label="Accreditation Body"
            required
            value={form.accreditation_body}
            onChange={(v) => setForm({ ...form, accreditation_body: v ?? "nabh" })}
            data={[
              { value: "nabh", label: "NABH" },
              { value: "nmc", label: "NMC" },
              { value: "nabl", label: "NABL" },
              { value: "jci", label: "JCI" },
              { value: "abdm", label: "ABDM" },
              { value: "other", label: "Other" },
            ]}
          />
          <TextInput
            label="Standard Code"
            required
            value={form.standard_code}
            onChange={(e) => setForm({ ...form, standard_code: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <DateInput
            label="Assessment Start"
            required
            value={form.assessment_period_start ? new Date(form.assessment_period_start) : null}
            onChange={(d) =>
              setForm({
                ...form,
                assessment_period_start: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <DateInput
            label="Assessment End"
            required
            value={form.assessment_period_end ? new Date(form.assessment_period_end) : null}
            onChange={(d) =>
              setForm({
                ...form,
                assessment_period_end: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Create Checklist
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
