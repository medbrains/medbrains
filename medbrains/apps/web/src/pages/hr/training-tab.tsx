// HR TrainingTab — split from hr.tsx (pure move).

import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { TrainingComplianceRow, TrainingProgram } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";

export function TrainingTab({ canManage }: { canManage: boolean }) {
  // Training compliance is `hr.training.list`; empty reads as "nobody is
  // trained", which is reported to the accreditor.
  const canListTraining = useHasPermission(P.HR.TRAINING_LIST);

  const qc = useQueryClient();
  const [programOpen, { open: openProgram, close: closeProgram }] = useDisclosure(false);
  const [recordOpen, { open: openRecord, close: closeRecord }] = useDisclosure(false);
  const [subView, setSubView] = useState<string>("programs");

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ["hr-training-programs"],
    queryFn: hrService.listTrainingPrograms,
  });

  const { data: complianceRows = [], isLoading: complianceLoading } = useQuery({
    queryKey: ["hr-training-compliance"],
    queryFn: () => hrService.trainingCompliance(),
    enabled: subView === "compliance" && canListTraining,
  });

  // ── Create program ──
  const [progForm, setProgForm] = useState({
    code: "",
    name: "",
    description: "",
    is_mandatory: false,
    frequency_months: 12,
    duration_hours: 2,
  });
  const progMut = useMutation({
    mutationFn: () =>
      hrService.createTrainingProgram({
        code: progForm.code,
        name: progForm.name,
        description: progForm.description || undefined,
        is_mandatory: progForm.is_mandatory,
        frequency_months: progForm.frequency_months,
        duration_hours: progForm.duration_hours,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-training-programs"] });
      closeProgram();
      setProgForm({
        code: "",
        name: "",
        description: "",
        is_mandatory: false,
        frequency_months: 12,
        duration_hours: 2,
      });
      toast.success("Training program added", { title: "Program Created" });
    },
  });

  // ── Record training ──
  const [recForm, setRecForm] = useState({
    employee_id: "",
    program_id: "",
    training_date: "",
    status: "completed",
    score: 0,
    certificate_no: "",
    trainer_name: "",
  });
  const recMut = useMutation({
    mutationFn: () =>
      hrService.createTrainingRecord({
        employee_id: recForm.employee_id,
        program_id: recForm.program_id,
        training_date: recForm.training_date,
        status: recForm.status || undefined,
        score: recForm.score || undefined,
        certificate_no: recForm.certificate_no || undefined,
        trainer_name: recForm.trainer_name || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-training-compliance"] });
      closeRecord();
      setRecForm({
        employee_id: "",
        program_id: "",
        training_date: "",
        status: "completed",
        score: 0,
        certificate_no: "",
        trainer_name: "",
      });
      toast.success("Training record added", { title: "Training Recorded" });
    },
  });

  // ── Compliance stats ──
  const mandatoryRows = complianceRows.filter((r) => r.is_mandatory);
  const mandatoryPct =
    mandatoryRows.length > 0
      ? mandatoryRows.reduce((sum, r) => sum + r.compliance_pct, 0) / mandatoryRows.length
      : 0;
  const overallPct =
    complianceRows.length > 0
      ? complianceRows.reduce((sum, r) => sum + r.compliance_pct, 0) / complianceRows.length
      : 0;
  const totalStaff = complianceRows.length > 0 ? (complianceRows[0]?.total_staff ?? 0) : 0;

  return (
    <>
      <Group justify="space-between" mb="md">
        <SegmentedControl
          value={subView}
          onChange={setSubView}
          data={[
            { value: "programs", label: "Programs" },
            { value: "compliance", label: "Training Compliance" },
          ]}
        />
        {canManage && subView === "programs" && (
          <Group gap="xs">
            <Button tone="secondary" leftSection={<IconPlus size={16} />} onClick={openRecord}>
              Record Training
            </Button>
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openProgram}>
              Add Program
            </Button>
          </Group>
        )}
      </Group>

      {subView === "programs" && (
        <DataTable
          data={programs}
          loading={isLoading}
          rowKey={(r: TrainingProgram) => r.id}
          columns={[
            {
              key: "code",
              label: "Code",
              render: (r: TrainingProgram) => (
                <Text size="sm" fw={500}>
                  {r.code}
                </Text>
              ),
            },
            {
              key: "name",
              label: "Name",
              render: (r: TrainingProgram) => <Text size="sm">{r.name}</Text>,
            },
            {
              key: "mandatory",
              label: "Mandatory",
              render: (r: TrainingProgram) =>
                r.is_mandatory ? (
                  <Badge tone="danger" size="sm">
                    Mandatory
                  </Badge>
                ) : (
                  <Badge tone="neutral" size="sm">
                    Optional
                  </Badge>
                ),
            },
            {
              key: "frequency",
              label: "Frequency",
              render: (r: TrainingProgram) => (
                <Text size="sm">{r.frequency_months ? `${r.frequency_months}mo` : "—"}</Text>
              ),
            },
            {
              key: "duration",
              label: "Duration",
              render: (r: TrainingProgram) => (
                <Text size="sm">{r.duration_hours ? `${r.duration_hours}h` : "—"}</Text>
              ),
            },
            {
              key: "active",
              label: "Active",
              render: (r: TrainingProgram) =>
                r.is_active ? (
                  <Badge tone="success" size="sm">
                    Yes
                  </Badge>
                ) : (
                  <Badge tone="neutral" size="sm">
                    No
                  </Badge>
                ),
            },
          ]}
        />
      )}

      {subView === "compliance" && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">
                Total Employees
              </Text>
              <Text fw={700} size="xl">
                {totalStaff}
              </Text>
            </Card>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">
                Mandatory Compliance
              </Text>
              <Text
                fw={700}
                size="xl"
                c={mandatoryPct >= 90 ? "success" : mandatoryPct >= 70 ? "warning" : "danger"}
              >
                {mandatoryPct.toFixed(1)}%
              </Text>
              <Progress
                value={mandatoryPct}
                color={mandatoryPct >= 90 ? "success" : mandatoryPct >= 70 ? "warning" : "danger"}
                size="sm"
                mt={4}
              />
            </Card>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">
                Overall Compliance
              </Text>
              <Text
                fw={700}
                size="xl"
                c={overallPct >= 90 ? "success" : overallPct >= 70 ? "warning" : "danger"}
              >
                {overallPct.toFixed(1)}%
              </Text>
              <Progress
                value={overallPct}
                color={overallPct >= 90 ? "success" : overallPct >= 70 ? "warning" : "danger"}
                size="sm"
                mt={4}
              />
            </Card>
          </SimpleGrid>
          <DataTable
            data={complianceRows}
            loading={complianceLoading}
            rowKey={(r: TrainingComplianceRow) => r.program_id}
            columns={[
              {
                key: "program_name",
                label: "Program",
                render: (r: TrainingComplianceRow) => (
                  <Text size="sm" fw={500}>
                    {r.program_name}
                  </Text>
                ),
              },
              {
                key: "mandatory",
                label: "Type",
                render: (r: TrainingComplianceRow) =>
                  r.is_mandatory ? (
                    <Badge tone="danger" size="sm">
                      Mandatory
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      Optional
                    </Badge>
                  ),
              },
              {
                key: "total",
                label: "Total Staff",
                render: (r: TrainingComplianceRow) => <Text size="sm">{r.total_staff}</Text>,
              },
              {
                key: "completed",
                label: "Completed",
                render: (r: TrainingComplianceRow) => <Text size="sm">{r.completed}</Text>,
              },
              {
                key: "pct",
                label: "Compliance %",
                render: (r: TrainingComplianceRow) => (
                  <Group gap="xs">
                    <Progress
                      value={r.compliance_pct}
                      color={
                        r.compliance_pct >= 90
                          ? "success"
                          : r.compliance_pct >= 70
                            ? "warning"
                            : "danger"
                      }
                      size="sm"
                      style={{ width: 80 }}
                    />
                    <Text size="sm" fw={500}>
                      {r.compliance_pct.toFixed(1)}%
                    </Text>
                  </Group>
                ),
              },
            ]}
          />
        </Stack>
      )}

      {/* Create Program Drawer */}
      <Drawer
        opened={programOpen}
        onClose={closeProgram}
        title="Add Training Program"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <TextInput
            label="Code"
            required
            value={progForm.code}
            onChange={(e) => setProgForm({ ...progForm, code: e.currentTarget.value })}
          />
          <TextInput
            label="Name"
            required
            value={progForm.name}
            onChange={(e) => setProgForm({ ...progForm, name: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={progForm.description}
            onChange={(e) => setProgForm({ ...progForm, description: e.currentTarget.value })}
          />
          <Switch
            label="Mandatory"
            checked={progForm.is_mandatory}
            onChange={(e) => setProgForm({ ...progForm, is_mandatory: e.currentTarget.checked })}
          />
          <NumberInput
            label="Frequency (months)"
            value={progForm.frequency_months}
            onChange={(v) =>
              setProgForm({ ...progForm, frequency_months: typeof v === "number" ? v : 12 })
            }
          />
          <NumberInput
            label="Duration (hours)"
            value={progForm.duration_hours}
            onChange={(v) =>
              setProgForm({ ...progForm, duration_hours: typeof v === "number" ? v : 2 })
            }
          />
          <Button
            tone="primary"
            onClick={() => progMut.mutate()}
            loading={progMut.isPending}
            disabled={!progForm.code || !progForm.name}
          >
            Create Program
          </Button>
        </Stack>
      </Drawer>

      {/* Record Training Drawer */}
      <Drawer
        opened={recordOpen}
        onClose={closeRecord}
        title="Record Training"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <EmployeeSearchSelect
            value={recForm.employee_id}
            onChange={(id) => setRecForm({ ...recForm, employee_id: id })}
            required
          />
          <Select
            label="Program"
            required
            value={recForm.program_id}
            onChange={(v) => setRecForm({ ...recForm, program_id: v || "" })}
            data={programs.map((p: TrainingProgram) => ({ value: p.id, label: p.name }))}
          />
          <TextInput
            label="Training Date"
            required
            placeholder="YYYY-MM-DD"
            value={recForm.training_date}
            onChange={(e) => setRecForm({ ...recForm, training_date: e.currentTarget.value })}
          />
          <Select
            label="Status"
            value={recForm.status}
            onChange={(v) => setRecForm({ ...recForm, status: v || "completed" })}
            data={[
              { value: "scheduled", label: "Scheduled" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
              { value: "failed", label: "Failed" },
            ]}
          />
          <NumberInput
            label="Score"
            value={recForm.score}
            onChange={(v) => setRecForm({ ...recForm, score: typeof v === "number" ? v : 0 })}
          />
          <TextInput
            label="Certificate No"
            value={recForm.certificate_no}
            onChange={(e) => setRecForm({ ...recForm, certificate_no: e.currentTarget.value })}
          />
          <TextInput
            label="Trainer Name"
            value={recForm.trainer_name}
            onChange={(e) => setRecForm({ ...recForm, trainer_name: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => recMut.mutate()}
            loading={recMut.isPending}
            disabled={!recForm.employee_id || !recForm.program_id || !recForm.training_date}
          >
            Record Training
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Compliance Tab
// ══════════════════════════════════════════════════════════
