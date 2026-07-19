// QUALITY AuditsTab — split from quality.tsx (pure move).

import {
  Drawer,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  AuditFinding,
  CreateAuditFindingRequest,
  CreateQualityAuditRequest,
  QualityAudit,
  ScheduleAuditsRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCalendarEvent, IconEye, IconPlus, IconShieldCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { qualityService } from "@/services/quality.service";
import { auditStatusColors, statusColorTone } from "./shared";

export function AuditsTab() {
  const canCreate = useHasPermission(P.QUALITY.AUDITS_CREATE);
  const qc = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [selectedAudit, setSelectedAudit] = useState<QualityAudit | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ["quality-audits", statusFilter],
    queryFn: () => qualityService.listQualityAudits({ status: statusFilter ?? undefined }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: () => qualityService.listDepartments(),
    staleTime: 300_000,
  });

  const departmentOptions = departments
    .filter((d: { is_active: boolean }) => d.is_active)
    .map((d: { id: string; name: string }) => ({ value: d.id, label: d.name }));

  const [form, setForm] = useState<CreateQualityAuditRequest>({
    audit_type: "internal",
    title: "",
    audit_date: new Date().toISOString().slice(0, 10),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateQualityAuditRequest) => qualityService.createQualityAudit(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-audits"] });
      toast.success("", { title: "Audit created" });
      closeCreate();
      setForm({
        audit_type: "internal",
        title: "",
        audit_date: new Date().toISOString().slice(0, 10),
      });
    },
  });

  // Schedule audits
  const [scheduleOpened, { open: openSchedule, close: closeSchedule }] = useDisclosure(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleAuditsRequest>({
    department_ids: [],
    frequency: "quarterly",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  const scheduleAuditsMut = useMutation({
    mutationFn: (data: ScheduleAuditsRequest) => qualityService.scheduleAudits(data),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["quality-audits"] });
      toast.success(`${result.count} audit(s) created`, { title: "Audits scheduled" });
      closeSchedule();
    },
  });

  // Audit findings
  const [findingOpened, { open: openFinding, close: closeFinding }] = useDisclosure(false);
  const [findingForm, setFindingForm] = useState<CreateAuditFindingRequest>({
    finding_type: "non_conformity",
    description: "",
    severity: "minor",
  });

  const { data: findings = [], isLoading: findingsLoading } = useQuery({
    queryKey: ["quality-audit-findings", selectedAudit?.id],
    queryFn: () => qualityService.listAuditFindings(selectedAudit?.id ?? ""),
    enabled: !!selectedAudit,
  });

  const createFindingMut = useMutation({
    mutationFn: (data: CreateAuditFindingRequest) => {
      if (!selectedAudit) throw new Error("No audit selected");
      return qualityService.createAuditFinding(selectedAudit.id, data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-audit-findings", selectedAudit?.id] });
      void qc.invalidateQueries({ queryKey: ["quality-audits"] });
      toast.success("", { title: "Finding added" });
      closeFinding();
      setFindingForm({ finding_type: "non_conformity", description: "", severity: "minor" });
    },
  });

  const openMockInspection = () => {
    setForm({
      audit_type: "mock",
      title: "",
      audit_date: new Date().toISOString().slice(0, 10),
    });
    openCreate();
  };

  const columns = [
    {
      key: "audit_number" as const,
      label: "Audit #",
      render: (a: QualityAudit) => <Text fw={500}>{a.audit_number}</Text>,
    },
    { key: "title" as const, label: "Title", render: (a: QualityAudit) => a.title },
    {
      key: "audit_type" as const,
      label: "Type",
      render: (a: QualityAudit) => <Badge tone="neutral">{a.audit_type}</Badge>,
    },
    {
      key: "audit_date" as const,
      label: "Date",
      render: (a: QualityAudit) => new Date(a.audit_date).toLocaleDateString(),
    },
    {
      key: "score" as const,
      label: "Score",
      render: (a: QualityAudit) => (a.overall_score != null ? `${a.overall_score}%` : "---"),
    },
    {
      key: "nc" as const,
      label: "NC / Obs / Opp",
      render: (a: QualityAudit) => `${a.non_conformities} / ${a.observations} / ${a.opportunities}`,
    },
    {
      key: "status" as const,
      label: "Status",
      render: (a: QualityAudit) => (
        <Badge tone={auditStatusColors[a.status] ?? "neutral"}>{a.status.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (a: QualityAudit) => (
        <Group gap="xs">
          <Tooltip label="View Details">
            <IconButton
              tone="primary"
              onClick={() => {
                setSelectedAudit(a);
                openDetail();
              }}
              aria-label="View Details"
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["planned", "in_progress", "completed", "cancelled"]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
          <Text c="dimmed" size="sm">
            {audits.length} audit(s)
          </Text>
        </Group>
        {canCreate && (
          <Group>
            <Button
              tone="secondary"
              leftSection={<IconCalendarEvent size={16} />}
              onClick={openSchedule}
            >
              Schedule Audits
            </Button>
            <Button
              tone="secondary"
              leftSection={<IconShieldCheck size={16} />}
              onClick={openMockInspection}
            >
              Mock Inspection
            </Button>
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
              New Audit
            </Button>
          </Group>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={audits}
        loading={isLoading}
        rowKey={(a) => a.id}
        emptyTitle="No audits"
      />

      {/* Create Audit Drawer */}
      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title={form.audit_type === "mock" ? "Schedule Mock Inspection" : "New Audit"}
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
          />
          <Select
            label="Audit Type"
            required
            data={["internal", "external", "mock", "surveillance", "follow_up"]}
            value={form.audit_type}
            onChange={(v) => setForm({ ...form, audit_type: v ?? "internal" })}
          />
          <Textarea
            label="Scope"
            value={form.scope ?? ""}
            onChange={(e) => setForm({ ...form, scope: e.currentTarget.value || undefined })}
          />
          <DepartmentSelect
            value={form.department_id ?? ""}
            onChange={(id) => setForm({ ...form, department_id: id || undefined })}
          />
          <TextInput
            label="Audit Date"
            type="date"
            required
            value={form.audit_date}
            onChange={(e) => setForm({ ...form, audit_date: e.currentTarget.value })}
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

      {/* Audit Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title={`Audit: ${selectedAudit?.audit_number ?? ""}`}
        position="right"
        size="lg"
      >
        {selectedAudit && (
          <Stack>
            <Text fw={600} size="lg">
              {selectedAudit.title}
            </Text>
            <Group>
              <Badge tone="neutral">{selectedAudit.audit_type}</Badge>
              <Badge tone={auditStatusColors[selectedAudit.status] ?? "neutral"}>
                {selectedAudit.status.replace(/_/g, " ")}
              </Badge>
            </Group>
            <Text size="sm">Date: {new Date(selectedAudit.audit_date).toLocaleDateString()}</Text>
            {selectedAudit.scope && <Text size="sm">Scope: {selectedAudit.scope}</Text>}
            {selectedAudit.report_date && (
              <Text size="sm">
                Report Date: {new Date(selectedAudit.report_date).toLocaleDateString()}
              </Text>
            )}

            <Group mt="md">
              <Badge tone="danger" size="lg">
                Non-Conformities: {selectedAudit.non_conformities}
              </Badge>
              <Badge tone="warning" size="lg">
                Observations: {selectedAudit.observations}
              </Badge>
              <Badge tone="primary" size="lg">
                Opportunities: {selectedAudit.opportunities}
              </Badge>
            </Group>

            {selectedAudit.overall_score != null && (
              <Text
                fw={600}
                size="xl"
                c={
                  selectedAudit.overall_score >= 80
                    ? "success"
                    : selectedAudit.overall_score >= 60
                      ? "warning"
                      : "danger"
                }
              >
                Score: {selectedAudit.overall_score}%
              </Text>
            )}

            {Array.isArray(selectedAudit.findings) && selectedAudit.findings.length > 0 && (
              <>
                <Text fw={600} mt="md">
                  Findings (legacy)
                </Text>
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Finding</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedAudit.findings.map((f, idx) => (
                      <Table.Tr key={typeof f === "string" ? f : JSON.stringify(f)}>
                        <Table.Td>{idx + 1}</Table.Td>
                        <Table.Td>{typeof f === "string" ? f : JSON.stringify(f)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}

            {/* Structured Findings */}
            <Group justify="space-between" mt="md">
              <Text fw={600}>Audit Findings ({findings.length})</Text>
              {canCreate && (
                <Button
                  tone="primary"
                  size="compact-sm"
                  leftSection={<IconPlus size={14} />}
                  onClick={openFinding}
                >
                  Add Finding
                </Button>
              )}
            </Group>
            {findingsLoading ? (
              <Text c="dimmed" size="sm">
                Loading findings...
              </Text>
            ) : findings.length > 0 ? (
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Severity</Table.Th>
                    <Table.Th>Recommendation</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {findings.map((f: AuditFinding) => (
                    <Table.Tr key={f.id}>
                      <Table.Td>
                        <Badge tone="neutral">{f.finding_type.replace(/_/g, " ")}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {f.description}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge tone={statusColorTone(f.severity)}>{f.severity}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {f.recommendation ?? "---"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          tone={
                            f.status === "closed"
                              ? "success"
                              : f.status === "open"
                                ? "danger"
                                : "primary"
                          }
                        >
                          {f.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" size="sm">
                No structured findings recorded
              </Text>
            )}
          </Stack>
        )}
      </Drawer>

      {/* Schedule Audits Drawer */}
      <Drawer
        opened={scheduleOpened}
        onClose={closeSchedule}
        title="Schedule Audits"
        position="right"
        size="xl"
      >
        <Stack>
          <MultiSelect
            label="Departments"
            required
            data={departmentOptions}
            value={scheduleForm.department_ids}
            onChange={(ids) => setScheduleForm({ ...scheduleForm, department_ids: ids })}
            searchable
            placeholder="Select departments..."
          />
          <Select
            label="Frequency"
            required
            data={["monthly", "quarterly", "biannual", "annual"]}
            value={scheduleForm.frequency}
            onChange={(v) => setScheduleForm({ ...scheduleForm, frequency: v ?? "quarterly" })}
          />
          <TextInput
            label="Start Date"
            type="date"
            required
            value={scheduleForm.start_date}
            onChange={(e) =>
              setScheduleForm({ ...scheduleForm, start_date: e.currentTarget.value })
            }
          />
          <TextInput
            label="End Date"
            type="date"
            required
            value={scheduleForm.end_date}
            onChange={(e) => setScheduleForm({ ...scheduleForm, end_date: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            loading={scheduleAuditsMut.isPending}
            onClick={() => scheduleAuditsMut.mutate(scheduleForm)}
          >
            Schedule
          </Button>
        </Stack>
      </Drawer>

      {/* Add Finding Drawer */}
      <Drawer
        opened={findingOpened}
        onClose={closeFinding}
        title={`Add Finding: ${selectedAudit?.audit_number ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Finding Type"
            required
            data={["non_conformity", "observation", "opportunity_for_improvement", "strength"]}
            value={findingForm.finding_type}
            onChange={(v) =>
              setFindingForm({ ...findingForm, finding_type: v ?? "non_conformity" })
            }
          />
          <Textarea
            label="Description"
            required
            value={findingForm.description}
            onChange={(e) => setFindingForm({ ...findingForm, description: e.currentTarget.value })}
            minRows={3}
          />
          <Select
            label="Severity"
            required
            data={["minor", "moderate", "major", "critical"]}
            value={findingForm.severity}
            onChange={(v) => setFindingForm({ ...findingForm, severity: v ?? "minor" })}
          />
          <Textarea
            label="Recommendation"
            value={findingForm.recommendation ?? ""}
            onChange={(e) =>
              setFindingForm({ ...findingForm, recommendation: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createFindingMut.isPending}
            onClick={() => createFindingMut.mutate(findingForm)}
          >
            Add Finding
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Analytics & Reviews Tab ──────────────────────────────
