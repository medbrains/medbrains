// QUALITY AccreditationTab — split from quality.tsx (pure move).

import { DonutChart } from "@mantine/charts";
import {
  Card,
  Drawer,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  AccreditationBodyType,
  ComplianceStatusType,
  CreateAccreditationStandardRequest,
  EvidenceCompilation,
  QualityAccreditationCompliance,
  QualityAccreditationStandard,
  UpdateComplianceRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconClipboardCheck, IconFileStack, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { qualityService } from "@/services/quality.service";
import { statusColorTone } from "./shared";

export function AccreditationTab() {
  const canManage = useHasPermission(P.QUALITY.ACCREDITATION_MANAGE);
  const qc = useQueryClient();
  const [standardOpened, { open: openStandard, close: closeStandard }] = useDisclosure(false);
  const [complianceOpened, { open: openCompliance, close: closeCompliance }] = useDisclosure(false);
  const [evidenceModalOpened, { open: openEvidenceModal, close: closeEvidenceModal }] =
    useDisclosure(false);
  const [evidenceData, setEvidenceData] = useState<EvidenceCompilation | null>(null);
  const [bodyFilter, setBodyFilter] = useState<string | null>(null);
  const [selectedStandard, setSelectedStandard] = useState<QualityAccreditationStandard | null>(
    null,
  );

  const compileEvidenceMut = useMutation({
    mutationFn: (body: string) => qualityService.compileEvidence(body),
    onSuccess: (data) => {
      setEvidenceData(data);
      openEvidenceModal();
    },
    onError: () => {
      toast.error("Failed to compile evidence", { title: "Error" });
    },
  });

  const { data: standards = [], isLoading } = useQuery({
    queryKey: ["quality-standards", bodyFilter],
    queryFn: () =>
      qualityService.listAccreditationStandards(bodyFilter ? { body: bodyFilter } : undefined),
  });

  const { data: compliance = [] } = useQuery({
    queryKey: ["quality-compliance"],
    queryFn: () => qualityService.listAccreditationCompliance(),
  });

  const complianceMap = new Map(
    compliance.map((c: QualityAccreditationCompliance) => [c.standard_id, c]),
  );

  const [standardForm, setStandardForm] = useState<CreateAccreditationStandardRequest>({
    body: "nabh",
    standard_code: "",
    standard_name: "",
  });

  const createStandardMut = useMutation({
    mutationFn: (data: CreateAccreditationStandardRequest) =>
      qualityService.createAccreditationStandard(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-standards"] });
      toast.success("", { title: "Standard added" });
      closeStandard();
      setStandardForm({ body: "nabh", standard_code: "", standard_name: "" });
    },
  });

  const [complianceForm, setComplianceForm] = useState<UpdateComplianceRequest>({
    standard_id: "",
    compliance: "non_compliant",
  });

  const updateComplianceMut = useMutation({
    mutationFn: (data: UpdateComplianceRequest) =>
      qualityService.updateAccreditationCompliance(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-compliance"] });
      toast.success("", { title: "Compliance updated" });
      closeCompliance();
    },
  });

  // Summary counts
  const compliantCount = compliance.filter(
    (c: QualityAccreditationCompliance) => c.compliance === "compliant",
  ).length;
  const partialCount = compliance.filter(
    (c: QualityAccreditationCompliance) => c.compliance === "partially_compliant",
  ).length;
  const nonCompliantCount = compliance.filter(
    (c: QualityAccreditationCompliance) => c.compliance === "non_compliant",
  ).length;
  const naCount = compliance.filter(
    (c: QualityAccreditationCompliance) => c.compliance === "not_applicable",
  ).length;
  const notAssessedCount = standards.length - compliance.length;

  const donutData = useMemo(
    () =>
      [
        { name: "Compliant", value: compliantCount, color: "green.6" },
        { name: "Partial", value: partialCount, color: "yellow.5" },
        { name: "Non-Compliant", value: nonCompliantCount, color: "red.6" },
        { name: "N/A", value: naCount, color: "gray.4" },
        {
          name: "Not Assessed",
          value: notAssessedCount > 0 ? notAssessedCount : 0,
          color: "gray.2",
        },
      ].filter((d) => d.value > 0),
    [compliantCount, partialCount, nonCompliantCount, naCount, notAssessedCount],
  );

  const columns = [
    {
      key: "standard_code" as const,
      label: "Code",
      render: (s: QualityAccreditationStandard) => <Text fw={500}>{s.standard_code}</Text>,
    },
    {
      key: "standard_name" as const,
      label: "Standard",
      render: (s: QualityAccreditationStandard) => s.standard_name,
    },
    {
      key: "body" as const,
      label: "Body",
      render: (s: QualityAccreditationStandard) => (
        <Badge tone="neutral" variant="outline">
          {s.body.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "chapter" as const,
      label: "Chapter",
      render: (s: QualityAccreditationStandard) => s.chapter ?? "---",
    },
    {
      key: "compliance" as const,
      label: "Compliance",
      render: (s: QualityAccreditationStandard) => {
        const c = complianceMap.get(s.id);
        if (!c) return <Badge tone="neutral">Not Assessed</Badge>;
        return (
          <Badge tone={statusColorTone(c.compliance)}>{c.compliance.replace(/_/g, " ")}</Badge>
        );
      },
    },
    {
      key: "gap" as const,
      label: "Gap",
      render: (s: QualityAccreditationStandard) => {
        const c = complianceMap.get(s.id);
        return c?.gap_description ? (
          <Text size="xs" c="danger" lineClamp={1}>
            {c.gap_description}
          </Text>
        ) : (
          "---"
        );
      },
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (s: QualityAccreditationStandard) => (
        <Group gap="xs">
          {canManage && (
            <Tooltip label="Update Compliance">
              <IconButton
                tone="primary"
                onClick={() => {
                  setSelectedStandard(s);
                  const existing = complianceMap.get(s.id);
                  setComplianceForm({
                    standard_id: s.id,
                    compliance: existing?.compliance ?? "non_compliant",
                    evidence_summary: existing?.evidence_summary,
                    gap_description: existing?.gap_description,
                    action_plan: existing?.action_plan,
                    responsible_person_id: existing?.responsible_person_id,
                    target_date: existing?.target_date,
                  });
                  openCompliance();
                }}
                aria-label="Update Compliance"
              >
                <IconClipboardCheck size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      {/* Compliance Dashboard */}
      <SimpleGrid cols={4} spacing="md">
        <Card withBorder shadow="sm" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Total Standards
          </Text>
          <Text size="xl" fw={700} mt={4}>
            {standards.length}
          </Text>
        </Card>
        <Card withBorder shadow="sm" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Compliant
          </Text>
          <Text size="xl" fw={700} mt={4} c="success">
            {compliantCount}
          </Text>
        </Card>
        <Card withBorder shadow="sm" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Partially Compliant
          </Text>
          <Text size="xl" fw={700} mt={4} c="yellow.7">
            {partialCount}
          </Text>
        </Card>
        <Card withBorder shadow="sm" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Non-Compliant
          </Text>
          <Text size="xl" fw={700} mt={4} c="danger">
            {nonCompliantCount}
          </Text>
        </Card>
      </SimpleGrid>

      {donutData.length > 0 && (
        <Card withBorder shadow="sm" p="md">
          <Text fw={600} mb="sm">
            Compliance Distribution
          </Text>
          <DonutChart
            data={donutData}
            withLabelsLine
            withLabels
            tooltipDataSource="segment"
            size={220}
            thickness={30}
          />
        </Card>
      )}

      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Filter by body"
            data={["nabh", "nmc", "nabl", "jci", "abdm", "naac", "other"].map((b) => ({
              value: b,
              label: b.toUpperCase(),
            }))}
            value={bodyFilter}
            onChange={setBodyFilter}
            clearable
            w={160}
          />
          <Badge tone="success">Compliant: {compliantCount}</Badge>
          <Badge tone="warning">Partial: {partialCount}</Badge>
          <Badge tone="danger">Non-Compliant: {nonCompliantCount}</Badge>
        </Group>
        <Group>
          {canManage && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openStandard}>
              Add Standard
            </Button>
          )}
          {bodyFilter && canManage && (
            <Button
              tone="secondary"
              leftSection={<IconFileStack size={16} />}
              loading={compileEvidenceMut.isPending}
              onClick={() => compileEvidenceMut.mutate(bodyFilter)}
            >
              Compile Evidence
            </Button>
          )}
        </Group>
      </Group>

      <DataTable
        columns={columns}
        data={standards}
        loading={isLoading}
        rowKey={(s) => s.id}
        emptyTitle="No accreditation standards"
      />

      {/* Create Standard Drawer */}
      <Drawer
        opened={standardOpened}
        onClose={closeStandard}
        title="Add Accreditation Standard"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Accreditation Body"
            required
            data={(["nabh", "nmc", "nabl", "jci", "abdm", "naac", "other"] as const).map((b) => ({
              value: b,
              label: b.toUpperCase(),
            }))}
            value={standardForm.body}
            onChange={(v) =>
              setStandardForm({ ...standardForm, body: (v ?? "nabh") as AccreditationBodyType })
            }
          />
          <TextInput
            label="Standard Code"
            required
            value={standardForm.standard_code}
            onChange={(e) =>
              setStandardForm({ ...standardForm, standard_code: e.currentTarget.value })
            }
          />
          <TextInput
            label="Standard Name"
            required
            value={standardForm.standard_name}
            onChange={(e) =>
              setStandardForm({ ...standardForm, standard_name: e.currentTarget.value })
            }
          />
          <TextInput
            label="Chapter"
            value={standardForm.chapter ?? ""}
            onChange={(e) =>
              setStandardForm({ ...standardForm, chapter: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Description"
            value={standardForm.description ?? ""}
            onChange={(e) =>
              setStandardForm({ ...standardForm, description: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createStandardMut.isPending}
            onClick={() => createStandardMut.mutate(standardForm)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      {/* Update Compliance Drawer */}
      <Drawer
        opened={complianceOpened}
        onClose={closeCompliance}
        title={`Compliance: ${selectedStandard?.standard_code ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Compliance Status"
            required
            data={(
              ["compliant", "partially_compliant", "non_compliant", "not_applicable"] as const
            ).map((c) => ({ value: c, label: c.replace(/_/g, " ") }))}
            value={complianceForm.compliance}
            onChange={(v) =>
              setComplianceForm({
                ...complianceForm,
                compliance: (v ?? "non_compliant") as ComplianceStatusType,
              })
            }
          />
          <Textarea
            label="Evidence Summary"
            value={complianceForm.evidence_summary ?? ""}
            onChange={(e) =>
              setComplianceForm({
                ...complianceForm,
                evidence_summary: e.currentTarget.value || undefined,
              })
            }
          />
          <Textarea
            label="Gap Description"
            value={complianceForm.gap_description ?? ""}
            onChange={(e) =>
              setComplianceForm({
                ...complianceForm,
                gap_description: e.currentTarget.value || undefined,
              })
            }
          />
          <Textarea
            label="Action Plan"
            value={complianceForm.action_plan ?? ""}
            onChange={(e) =>
              setComplianceForm({
                ...complianceForm,
                action_plan: e.currentTarget.value || undefined,
              })
            }
          />
          <EmployeeSearchSelect
            label="Responsible person"
            value={complianceForm.responsible_person_id ?? ""}
            onChange={(employeeId) =>
              setComplianceForm({
                ...complianceForm,
                responsible_person_id: employeeId || undefined,
              })
            }
          />
          <TextInput
            label="Target Date"
            type="date"
            value={complianceForm.target_date ?? ""}
            onChange={(e) =>
              setComplianceForm({
                ...complianceForm,
                target_date: e.currentTarget.value || undefined,
              })
            }
          />
          <Button
            tone="primary"
            loading={updateComplianceMut.isPending}
            onClick={() => updateComplianceMut.mutate(complianceForm)}
          >
            Update Compliance
          </Button>
        </Stack>
      </Drawer>

      {/* Evidence Compilation Modal */}
      <Modal
        opened={evidenceModalOpened}
        onClose={() => {
          closeEvidenceModal();
          setEvidenceData(null);
        }}
        title="Evidence Compilation"
        size="lg"
      >
        {evidenceData ? (
          <Stack>
            <SimpleGrid cols={3} spacing="md">
              <Card withBorder p="sm">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Accreditation Body
                </Text>
                <Text fw={600} mt={4}>
                  {evidenceData.accreditation_body.toUpperCase()}
                </Text>
              </Card>
              <Card withBorder p="sm">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Total Standards
                </Text>
                <Text fw={600} mt={4}>
                  {evidenceData.total_standards}
                </Text>
              </Card>
              <Card withBorder p="sm">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Compliance Rate
                </Text>
                <Text
                  fw={600}
                  mt={4}
                  c={
                    evidenceData.compliance_rate >= 80
                      ? "success"
                      : evidenceData.compliance_rate >= 50
                        ? "warning"
                        : "danger"
                  }
                >
                  {evidenceData.compliance_rate.toFixed(1)}%
                </Text>
              </Card>
            </SimpleGrid>
            <Group>
              <Badge tone="success">Compliant: {evidenceData.compliant_count}</Badge>
              <Badge tone="danger">Non-Compliant: {evidenceData.non_compliant_items.length}</Badge>
            </Group>
            {evidenceData.non_compliant_items.length > 0 && (
              <>
                <Text fw={600} size="sm" mt="xs">
                  Non-Compliant Items
                </Text>
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Details</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {evidenceData.non_compliant_items.map((item, idx) => (
                      <Table.Tr key={typeof item === "string" ? item : JSON.stringify(item)}>
                        <Table.Td>{idx + 1}</Table.Td>
                        <Table.Td>
                          {typeof item === "string" ? item : JSON.stringify(item)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}
          </Stack>
        ) : (
          <Text c="dimmed">No evidence data available.</Text>
        )}
      </Modal>
    </Stack>
  );
}

// ── Audits Tab ──────────────────────────────────────────
