// QUALITY IncidentsTab — split from quality.tsx (pure move).

import {
  Card,
  Center,
  Drawer,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateCapaRequest,
  CreateMortalityReviewRequest,
  CreateQualityIncidentRequest,
  IncidentSeverityType,
  QualityCapa,
  QualityIncident,
  QualityIncidentListItem,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconEye, IconFileDescription, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Icd11CodeSelect } from "@/components/Clinical/Icd11CodeSelect";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { qualityService } from "@/services/quality.service";
import { capaStatusColors, incidentStatusColors, statusColorTone } from "./shared";

export function IncidentsTab() {
  const canCreate = useHasPermission(P.QUALITY.INCIDENTS_CREATE);
  const canUpdate = useHasPermission(P.QUALITY.INCIDENTS_UPDATE);
  const canManageCapa = useHasPermission(P.QUALITY.CAPA_MANAGE);
  const qc = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [selectedIncident, setSelectedIncident] = useState<QualityIncident | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [selectedCapa, setSelectedCapa] = useState<QualityCapa | null>(null);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["quality-incidents", statusFilter, severityFilter],
    queryFn: () =>
      qualityService.listQualityIncidents({
        status: statusFilter ?? undefined,
        severity: severityFilter ?? undefined,
      }),
  });

  const { data: capaList = [] } = useQuery({
    queryKey: ["quality-capa", selectedIncident?.id],
    queryFn: () => qualityService.listCapa({ incident_id: selectedIncident?.id }),
    enabled: !!selectedIncident,
  });

  // The list omits the heavy free-text/JSONB fields — fetch the full incident
  // (with description/immediate_action/root_cause) when opening the detail view.
  const openIncidentDetail = async (id: string) => {
    setSelectedIncident(null);
    openDetail();
    const full = await qc.fetchQuery({
      queryKey: ["quality-incident", id],
      queryFn: () => qualityService.getQualityIncident(id),
    });
    setSelectedIncident(full);
  };

  const [form, setForm] = useState<CreateQualityIncidentRequest>({
    title: "",
    incident_type: "",
    severity: "minor",
    incident_date: new Date().toISOString().slice(0, 10),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateQualityIncidentRequest) => qualityService.createQualityIncident(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-incidents"] });
      toast.success("", { title: "Incident reported" });
      closeCreate();
      setForm({
        title: "",
        incident_type: "",
        severity: "minor",
        incident_date: new Date().toISOString().slice(0, 10),
      });
    },
  });

  const openNearMissReport = () => {
    setForm({
      title: "",
      incident_type: "",
      severity: "near_miss",
      incident_date: new Date().toISOString().slice(0, 10),
    });
    openCreate();
  };

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      qualityService.updateQualityIncident(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-incidents"] });
      toast.success("", { title: "Incident updated" });
    },
  });

  // Mortality review
  const [mortalityOpened, { open: openMortality, close: closeMortality }] = useDisclosure(false);
  const [mortalityForm, setMortalityForm] = useState<CreateMortalityReviewRequest>({
    patient_id: "",
    death_date: "",
    primary_diagnosis: "",
  });
  const [mortalityIcd11Code, setMortalityIcd11Code] = useState("");

  const createMortalityMut = useMutation({
    mutationFn: (data: CreateMortalityReviewRequest) => qualityService.createMortalityReview(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-incidents"] });
      toast.success("", { title: "Mortality review created" });
      closeMortality();
      setMortalityForm({ patient_id: "", death_date: "", primary_diagnosis: "" });
      setMortalityIcd11Code("");
    },
  });

  const [capaForm, setCapaForm] = useState<CreateCapaRequest>({
    incident_id: "",
    capa_type: "corrective",
    assigned_to: "",
    due_date: "",
  });

  const createCapaMut = useMutation({
    mutationFn: (data: CreateCapaRequest) => qualityService.createCapa(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-capa"] });
      toast.success("", { title: "CAPA created" });
      setCapaForm({ incident_id: "", capa_type: "corrective", assigned_to: "", due_date: "" });
    },
  });

  const columns = [
    {
      key: "incident_number" as const,
      label: "Incident #",
      render: (i: QualityIncidentListItem) => <Text fw={500}>{i.incident_number}</Text>,
    },
    { key: "title" as const, label: "Title", render: (i: QualityIncidentListItem) => i.title },
    {
      key: "incident_type" as const,
      label: "Type",
      render: (i: QualityIncidentListItem) => i.incident_type,
    },
    {
      key: "severity" as const,
      label: "Severity",
      render: (i: QualityIncidentListItem) => (
        <Badge tone={statusColorTone(i.severity)}>{i.severity.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (i: QualityIncidentListItem) => (
        <Badge tone={incidentStatusColors[i.status] ?? "neutral"}>
          {i.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "incident_date" as const,
      label: "Date",
      render: (i: QualityIncidentListItem) => new Date(i.incident_date).toLocaleDateString(),
    },
    {
      key: "anonymous" as const,
      label: "Anon",
      render: (i: QualityIncidentListItem) =>
        i.is_anonymous ? (
          <Badge size="sm" tone="accent">
            Yes
          </Badge>
        ) : (
          "---"
        ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (i: QualityIncidentListItem) => (
        <Group gap="xs">
          <Tooltip label="View Details">
            <IconButton
              tone="primary"
              onClick={() => void openIncidentDetail(i.id)}
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
            data={[
              "reported",
              "acknowledged",
              "investigating",
              "rca_complete",
              "capa_assigned",
              "capa_in_progress",
              "closed",
              "reopened",
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={180}
          />
          <Select
            placeholder="Severity"
            data={["near_miss", "minor", "moderate", "major", "sentinel"]}
            value={severityFilter}
            onChange={setSeverityFilter}
            clearable
            w={140}
          />
          <Text c="dimmed" size="sm">
            {incidents.length} incident(s)
          </Text>
        </Group>
        {canCreate && (
          <Group>
            <Button
              tone="secondary"
              leftSection={<IconFileDescription size={16} />}
              onClick={openMortality}
            >
              Mortality Review
            </Button>
            <Button
              tone="secondary"
              leftSection={<IconAlertTriangle size={16} />}
              onClick={openNearMissReport}
            >
              Report Near Miss
            </Button>
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Report Incident
            </Button>
          </Group>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={incidents}
        loading={isLoading}
        rowKey={(i) => i.id}
        emptyTitle="No incidents reported"
      />

      {/* Create Incident Drawer */}
      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Report Incident"
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
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <Select
            label="Incident Type"
            required
            data={[
              { value: "medication_error", label: "Medication error" },
              { value: "fall", label: "Patient fall" },
              { value: "infection", label: "Infection" },
              { value: "surgical", label: "Surgical" },
              { value: "diagnostic", label: "Diagnostic" },
              { value: "equipment", label: "Equipment" },
              { value: "behavioral", label: "Behavioral" },
              { value: "other", label: "Other" },
            ]}
            value={form.incident_type}
            onChange={(v) => setForm({ ...form, incident_type: v ?? "" })}
          />
          {form.incident_type === "fall" && (
            <Alert
              icon={<IconAlertTriangle size={16} />}
              tone="warning"
              title="Feeds NABH falls register"
            >
              Select the patient, location, severity, and immediate action. This report will
              automatically create or update the NABH falls evidence row.
            </Alert>
          )}
          <Select
            label="Severity"
            required
            data={
              [
                "near_miss",
                "minor",
                "moderate",
                "major",
                "sentinel",
              ] satisfies IncidentSeverityType[]
            }
            value={form.severity}
            onChange={(v) => setForm({ ...form, severity: (v ?? "minor") as IncidentSeverityType })}
          />
          <DepartmentSelect
            value={form.department_id ?? ""}
            onChange={(id) => setForm({ ...form, department_id: id || undefined })}
          />
          <TextInput
            label="Location"
            value={form.location ?? ""}
            onChange={(e) => setForm({ ...form, location: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Incident Date"
            type="date"
            required
            value={form.incident_date}
            onChange={(e) => setForm({ ...form, incident_date: e.currentTarget.value })}
          />
          <PatientSearchSelect
            label="Patient (optional)"
            value={form.patient_id ?? ""}
            onChange={(id) => setForm({ ...form, patient_id: id || undefined })}
          />
          <Textarea
            label="Immediate Action Taken"
            value={form.immediate_action ?? ""}
            onChange={(e) =>
              setForm({ ...form, immediate_action: e.currentTarget.value || undefined })
            }
          />
          <Switch
            label="Report Anonymously"
            checked={form.is_anonymous ?? false}
            onChange={(e) => setForm({ ...form, is_anonymous: e.currentTarget.checked })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Submit Report
          </Button>
        </Stack>
      </Drawer>

      {/* Incident Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title={`Incident: ${selectedIncident?.incident_number ?? ""}`}
        position="right"
        size="lg"
      >
        {detailOpened && !selectedIncident && (
          <Center py="xl">
            <Loader />
          </Center>
        )}
        {selectedIncident && (
          <Stack>
            <Group>
              <Badge tone={statusColorTone(selectedIncident.severity)} size="lg">
                {selectedIncident.severity.replace(/_/g, " ")}
              </Badge>
              <Badge tone={incidentStatusColors[selectedIncident.status] ?? "neutral"} size="lg">
                {selectedIncident.status.replace(/_/g, " ")}
              </Badge>
            </Group>
            <Text fw={600}>{selectedIncident.title}</Text>
            {selectedIncident.description && (
              <Text size="sm" c="dimmed">
                {selectedIncident.description}
              </Text>
            )}
            <Text size="sm">Type: {selectedIncident.incident_type}</Text>
            <Text size="sm">
              Date: {new Date(selectedIncident.incident_date).toLocaleDateString()}
            </Text>
            {selectedIncident.location && (
              <Text size="sm">Location: {selectedIncident.location}</Text>
            )}
            {selectedIncident.immediate_action && (
              <>
                <Text fw={500} size="sm">
                  Immediate Action:
                </Text>
                <Text size="sm" c="dimmed">
                  {selectedIncident.immediate_action}
                </Text>
              </>
            )}

            {/* RCA section */}
            {canUpdate && (
              <>
                <Text fw={600} mt="md">
                  Root Cause Analysis
                </Text>
                <Textarea
                  label="Root Cause"
                  value={selectedIncident.root_cause ?? ""}
                  onChange={(e) =>
                    setSelectedIncident({
                      ...selectedIncident,
                      root_cause: e.currentTarget.value || undefined,
                    })
                  }
                />
                <Button
                  tone="secondary"
                  size="sm"
                  loading={updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      id: selectedIncident.id,
                      data: { root_cause: selectedIncident.root_cause, status: "rca_complete" },
                    })
                  }
                >
                  Save RCA
                </Button>
              </>
            )}

            {/* CAPA section */}
            <Text fw={600} mt="md">
              CAPA ({capaList.length})
            </Text>
            {capaList.length > 0 && (
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>CAPA #</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Due</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {capaList.map((c: QualityCapa) => {
                    const createdDate = new Date(c.created_at);
                    const now = new Date();
                    const capaAgeInDays = Math.floor(
                      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    return (
                      <Table.Tr key={c.id}>
                        <Table.Td>
                          <Text fw={500}>{c.capa_number}</Text>
                          <Text size="xs" c="dimmed">
                            {capaAgeInDays} days old
                          </Text>
                        </Table.Td>
                        <Table.Td>{c.capa_type}</Table.Td>
                        <Table.Td>
                          <Badge tone={capaStatusColors[c.status] ?? "neutral"}>
                            {c.status.replace(/_/g, " ")}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{new Date(c.due_date).toLocaleDateString()}</Table.Td>
                        <Table.Td>
                          <Tooltip label="View Effectiveness">
                            <IconButton
                              tone="primary"
                              onClick={() => setSelectedCapa(c)}
                              aria-label="View Effectiveness"
                            >
                              <IconEye size={16} />
                            </IconButton>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}

            {selectedCapa && (
              <Card withBorder shadow="sm" p="md" mt="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fw={600}>CAPA Effectiveness Review: {selectedCapa.capa_number}</Text>
                    <Button tone="ghost" size="compact-sm" onClick={() => setSelectedCapa(null)}>
                      Close
                    </Button>
                  </Group>
                  {(() => {
                    const createdDate = new Date(selectedCapa.created_at);
                    const dueDate = new Date(selectedCapa.due_date);
                    const now = new Date();
                    const capaAgeInDays = Math.floor(
                      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    const daysOverdueSinceCompletion = selectedCapa.completed_at
                      ? Math.floor(
                          (now.getTime() - new Date(selectedCapa.completed_at).getTime()) /
                            (1000 * 60 * 60 * 24),
                        )
                      : 0;
                    const reviewOverdue =
                      selectedCapa.completed_at && daysOverdueSinceCompletion > 90;
                    const effectivenessReview = (
                      selectedCapa as QualityCapa & {
                        effectiveness_review?: {
                          effectiveness_check_date?: string;
                          effectiveness_result?: string;
                        };
                      }
                    ).effectiveness_review;
                    return (
                      <>
                        <SimpleGrid cols={3} spacing="sm">
                          <Card withBorder p="xs">
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              CAPA Age
                            </Text>
                            <Text fw={600} mt={4}>
                              {capaAgeInDays} days
                            </Text>
                          </Card>
                          <Card withBorder p="xs">
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              Due Date
                            </Text>
                            <Text fw={600} mt={4}>
                              {dueDate.toLocaleDateString()}
                            </Text>
                          </Card>
                          <Card withBorder p="xs">
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              Effectiveness Review
                            </Text>
                            {effectivenessReview ? (
                              <>
                                <Text fw={600} mt={4} c="success">
                                  Completed
                                </Text>
                                {effectivenessReview.effectiveness_check_date && (
                                  <Text size="xs" c="dimmed">
                                    {new Date(
                                      effectivenessReview.effectiveness_check_date,
                                    ).toLocaleDateString()}
                                  </Text>
                                )}
                              </>
                            ) : reviewOverdue ? (
                              <Badge tone="danger" mt={4}>
                                Overdue
                              </Badge>
                            ) : selectedCapa.completed_at ? (
                              <Badge tone="warning" mt={4}>
                                Due Soon
                              </Badge>
                            ) : (
                              <Badge tone="neutral" mt={4}>
                                Pending
                              </Badge>
                            )}
                          </Card>
                        </SimpleGrid>
                        {effectivenessReview ? (
                          <Card withBorder p="sm">
                            <Text size="sm" fw={600} mb="xs">
                              Effectiveness Check Result
                            </Text>
                            <Text size="sm">
                              {effectivenessReview.effectiveness_result ?? "No result recorded"}
                            </Text>
                            {effectivenessReview.effectiveness_check_date && (
                              <Text size="xs" c="dimmed" mt="xs">
                                Checked on{" "}
                                {new Date(
                                  effectivenessReview.effectiveness_check_date,
                                ).toLocaleDateString()}
                              </Text>
                            )}
                          </Card>
                        ) : (
                          <Badge tone="neutral" size="lg">
                            Pending Review
                          </Badge>
                        )}
                        {reviewOverdue && (
                          <Badge tone="danger" size="lg">
                            Review overdue by {daysOverdueSinceCompletion - 90} days (90-day
                            threshold exceeded)
                          </Badge>
                        )}
                      </>
                    );
                  })()}
                </Stack>
              </Card>
            )}

            {canManageCapa && (
              <>
                <Text fw={500} size="sm" mt="sm">
                  Add CAPA
                </Text>
                <Select
                  label="Type"
                  data={["corrective", "preventive"]}
                  value={capaForm.capa_type}
                  onChange={(v) => setCapaForm({ ...capaForm, capa_type: v ?? "corrective" })}
                />
                <Textarea
                  label="Description"
                  value={capaForm.description ?? ""}
                  onChange={(e) =>
                    setCapaForm({ ...capaForm, description: e.currentTarget.value || undefined })
                  }
                />
                <Textarea
                  label="Action Plan"
                  value={capaForm.action_plan ?? ""}
                  onChange={(e) =>
                    setCapaForm({ ...capaForm, action_plan: e.currentTarget.value || undefined })
                  }
                />
                <EmployeeSearchSelect
                  label="Assigned to"
                  required
                  value={capaForm.assigned_to}
                  onChange={(employeeId) => setCapaForm({ ...capaForm, assigned_to: employeeId })}
                />
                <TextInput
                  label="Due Date"
                  type="date"
                  required
                  value={capaForm.due_date}
                  onChange={(e) => setCapaForm({ ...capaForm, due_date: e.currentTarget.value })}
                />
                <Button
                  tone="primary"
                  size="sm"
                  loading={createCapaMut.isPending}
                  onClick={() =>
                    createCapaMut.mutate({ ...capaForm, incident_id: selectedIncident.id })
                  }
                >
                  Create CAPA
                </Button>
              </>
            )}
          </Stack>
        )}
      </Drawer>

      {/* Mortality Review Drawer */}
      <Drawer
        opened={mortalityOpened}
        onClose={closeMortality}
        title="Mortality Review"
        position="right"
        size="xl"
      >
        <Stack>
          <PatientSearchSelect
            value={mortalityForm.patient_id}
            onChange={(v) => setMortalityForm({ ...mortalityForm, patient_id: v })}
            required
          />
          <TextInput
            label="Death Date"
            type="date"
            required
            value={mortalityForm.death_date}
            onChange={(e) =>
              setMortalityForm({ ...mortalityForm, death_date: e.currentTarget.value })
            }
          />
          <Icd11CodeSelect
            label="Primary ICD-11 diagnosis"
            value={mortalityIcd11Code || null}
            onChange={(value) => setMortalityIcd11Code(value ?? "")}
            onSelectResult={(result) =>
              setMortalityForm({
                ...mortalityForm,
                primary_diagnosis: `${result.code} - ${result.display}`,
              })
            }
            required
          />
          <TextInput
            label="Primary diagnosis summary"
            required
            value={mortalityForm.primary_diagnosis}
            onChange={(e) =>
              setMortalityForm({ ...mortalityForm, primary_diagnosis: e.currentTarget.value })
            }
          />
          <Textarea
            label="Review Findings"
            value={mortalityForm.review_findings ?? ""}
            onChange={(e) =>
              setMortalityForm({
                ...mortalityForm,
                review_findings: e.currentTarget.value || undefined,
              })
            }
          />
          <Select
            label="Preventability"
            data={[
              "definitely_preventable",
              "possibly_preventable",
              "not_preventable",
              "undetermined",
            ]}
            value={mortalityForm.preventability ?? null}
            onChange={(v) => setMortalityForm({ ...mortalityForm, preventability: v ?? undefined })}
            clearable
          />
          <Button
            tone="primary"
            loading={createMortalityMut.isPending}
            onClick={() => createMortalityMut.mutate(mortalityForm)}
          >
            Submit Review
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Committees Tab ──────────────────────────────────────
