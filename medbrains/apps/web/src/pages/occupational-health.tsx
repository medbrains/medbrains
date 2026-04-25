import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Drawer,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { BarChart, DonutChart } from "@mantine/charts";
import {
  IconAlertTriangle,
  IconCalendar,
  IconCertificate,
  IconChartBar,
  IconChecklist,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconReportMedical,
  IconShieldCheck,
  IconVaccine,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  OccHealthScreening,
  OccHealthDrugScreen,
  OccHealthVaccination,
  OccHealthInjuryReport,
  OccHealthHazard,
  VaccinationComplianceRow,
  CreateOccScreeningRequest,
  CreateOccHealthHazardRequest,
  CreateDrugScreenRequest,
  CreateVaccinationRequest,
  CreateInjuryRequest,
  UpdateInjuryRequest,
  ReturnToWorkClearanceRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Constants ──────────────────────────────────────────

const SCREENING_TYPES = [
  { value: "pre_employment", label: "Pre-Employment" },
  { value: "periodic", label: "Periodic" },
  { value: "special", label: "Special" },
  { value: "exit", label: "Exit" },
];

const SCREENING_TYPE_COLORS: Record<string, string> = {
  pre_employment: "primary",
  periodic: "info",
  special: "orange",
  exit: "gray",
};

const FITNESS_STATUS_OPTIONS = [
  { value: "fit", label: "Fit" },
  { value: "unfit", label: "Unfit" },
  { value: "pending", label: "Pending" },
  { value: "referred", label: "Referred" },
];

const FITNESS_STATUS_COLORS: Record<string, string> = {
  fit: "success",
  unfit: "danger",
  pending: "gray",
  referred: "orange",
};

const DRUG_SCREEN_STATUS_OPTIONS = [
  { value: "ordered", label: "Ordered" },
  { value: "collected", label: "Collected" },
  { value: "sent_to_lab", label: "Sent to Lab" },
  { value: "mro_review", label: "MRO Review" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "inconclusive", label: "Inconclusive" },
  { value: "cancelled", label: "Cancelled" },
];

const DRUG_SCREEN_STATUS_COLORS: Record<string, string> = {
  ordered: "gray",
  collected: "primary",
  sent_to_lab: "info",
  mro_review: "warning",
  positive: "danger",
  negative: "success",
  inconclusive: "orange",
  cancelled: "gray",
};

const DRUG_PANEL_OPTIONS = [
  { value: "standard_5", label: "Standard 5-Panel" },
  { value: "extended_10", label: "Extended 10-Panel" },
  { value: "custom", label: "Custom" },
];

const INJURY_TYPES = [
  { value: "needlestick", label: "Needlestick" },
  { value: "slip_fall", label: "Slip/Fall" },
  { value: "strain", label: "Strain" },
  { value: "chemical", label: "Chemical Exposure" },
  { value: "other", label: "Other" },
];

const RTW_STATUS_OPTIONS = [
  { value: "pending_evaluation", label: "Pending Evaluation" },
  { value: "cleared_full", label: "Cleared — Full Duty" },
  { value: "cleared_with_restrictions", label: "Cleared — Restrictions" },
  { value: "not_cleared", label: "Not Cleared" },
  { value: "follow_up_required", label: "Follow-up Required" },
];

const RTW_STATUS_COLORS: Record<string, string> = {
  pending_evaluation: "warning",
  cleared_full: "success",
  cleared_with_restrictions: "orange",
  not_cleared: "danger",
  follow_up_required: "primary",
};

// ── Main Page ──────────────────────────────────────────

export function OccupationalHealthPage() {
  useRequirePermission(P.OCC_HEALTH.SCREENINGS_LIST);
  const [activeTab, setActiveTab] = useState<string | null>("screenings");

  return (
    <div>
      <PageHeader
        title="Occupational Health"
        subtitle="Employee health screenings, vaccinations, and injury tracking"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="screenings" leftSection={<IconShieldCheck size={16} />}>
            Health Screenings
          </Tabs.Tab>
          <Tabs.Tab value="drug-screens" leftSection={<IconReportMedical size={16} />}>
            Drug Screening
          </Tabs.Tab>
          <Tabs.Tab value="vaccinations" leftSection={<IconVaccine size={16} />}>
            Vaccinations
          </Tabs.Tab>
          <Tabs.Tab value="injuries" leftSection={<IconAlertTriangle size={16} />}>
            Injuries & RTW
          </Tabs.Tab>
          <Tabs.Tab value="hazards" leftSection={<IconChecklist size={16} />}>
            Hazard Registry
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
          <Tabs.Tab value="rtw-clearance" leftSection={<IconCertificate size={16} />}>
            RTW Clearance
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="screenings" pt="md">
          <ScreeningsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="drug-screens" pt="md">
          <DrugScreensPanel />
        </Tabs.Panel>
        <Tabs.Panel value="vaccinations" pt="md">
          <VaccinationsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="injuries" pt="md">
          <InjuriesPanel />
        </Tabs.Panel>
        <Tabs.Panel value="hazards" pt="md">
          <HazardRegistryPanel />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <OccHealthAnalyticsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="rtw-clearance" pt="md">
          <ReturnToWorkPanel />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — Health Screenings
// ══════════════════════════════════════════════════════════

function ScreeningsPanel() {
  const canCreate = useHasPermission(P.OCC_HEALTH.SCREENINGS_CREATE);
  const canUpdate = useHasPermission(P.OCC_HEALTH.SCREENINGS_UPDATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const [certOpen, certHandlers] = useDisclosure(false);
  const [selected, setSelected] = useState<OccHealthScreening | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showDue, setShowDue] = useState(false);
  const [subView, setSubView] = useState<"list" | "schedule">("list");

  const { data: screenings = [], isLoading } = useQuery({
    queryKey: ["occ-screenings", typeFilter],
    queryFn: () =>
      api.listOccScreenings(typeFilter ? { screening_type: typeFilter } : undefined),
    enabled: !showDue,
  });

  const { data: dueScreenings = [], isLoading: dueLoading } = useQuery({
    queryKey: ["occ-screenings-due"],
    queryFn: () => api.listDueScreenings(),
    enabled: showDue,
  });

  const items = showDue ? dueScreenings : screenings;
  const loading = showDue ? dueLoading : isLoading;

  const [form, setForm] = useState<CreateOccScreeningRequest>({
    employee_id: "",
    screening_type: "pre_employment",
    screening_date: "",
  });

  // Pre-employment form fields (stored in findings JSONB)
  const [preEmpForm, setPreEmpForm] = useState({
    medical_history: [] as string[],
    height_cm: "",
    weight_kg: "",
    bp_systolic: "",
    bp_diastolic: "",
    vision_left: "",
    vision_right: "",
    hearing_test: "",
    lab_results_ref: "",
  });

  const [editForm, setEditForm] = useState<{
    fitness_status?: string;
    next_due_date?: string;
    notes?: string;
  }>({});

  const createMut = useMutation({
    mutationFn: () => {
      const payload: CreateOccScreeningRequest = { ...form };
      // If pre-employment, store structured data in findings
      if (form.screening_type === "pre_employment") {
        payload.findings = preEmpForm as unknown as Record<string, unknown>;
      }
      return api.createOccScreening(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-screenings"] });
      void qc.invalidateQueries({ queryKey: ["occ-screenings-due"] });
      createHandlers.close();
      setForm({ employee_id: "", screening_type: "pre_employment", screening_date: "" });
      setPreEmpForm({
        medical_history: [],
        height_cm: "",
        weight_kg: "",
        bp_systolic: "",
        bp_diastolic: "",
        vision_left: "",
        vision_right: "",
        hearing_test: "",
        lab_results_ref: "",
      });
      notifications.show({
        title: "Screening Created",
        message: "Health screening record created successfully",
        color: "success",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selected) return Promise.reject(new Error("No screening selected"));
      return api.updateOccScreening(selected.id, editForm);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-screenings"] });
      void qc.invalidateQueries({ queryKey: ["occ-screenings-due"] });
      editHandlers.close();
      setSelected(null);
      notifications.show({
        title: "Screening Updated",
        message: "Health screening updated successfully",
        color: "success",
      });
    },
  });

  const columns: Column<OccHealthScreening>[] = [
    {
      key: "employee_id",
      label: "Employee",
      render: (r) => (
        <Text size="sm" truncate style={{ maxWidth: 120 }}>
          {r.employee_id}
        </Text>
      ),
    },
    {
      key: "screening_type",
      label: "Type",
      render: (r) => (
        <Badge
          color={SCREENING_TYPE_COLORS[r.screening_type] ?? "gray"}
          variant="light"
          size="sm"
        >
          {SCREENING_TYPES.find((t) => t.value === r.screening_type)?.label ?? r.screening_type}
        </Badge>
      ),
    },
    {
      key: "screening_date",
      label: "Screening Date",
      render: (r) => r.screening_date,
    },
    {
      key: "fitness_status",
      label: "Fitness Status",
      render: (r) => (
        <Badge
          color={FITNESS_STATUS_COLORS[r.fitness_status] ?? "gray"}
          variant="filled"
          size="sm"
        >
          {r.fitness_status}
        </Badge>
      ),
    },
    {
      key: "next_due_date",
      label: "Next Due",
      render: (r) => r.next_due_date ?? "---",
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {r.fitness_status === "fit" && (
            <ActionIcon
              variant="subtle"
              size="sm"
              color="success"
              onClick={() => {
                setSelected(r);
                certHandlers.open();
              }}
              title="Generate Certificate"
              aria-label="Certificate"
            >
              <IconCertificate size={14} />
            </ActionIcon>
          )}
          {canUpdate && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => {
                setSelected(r);
                setEditForm({
                  fitness_status: r.fitness_status,
                  next_due_date: r.next_due_date ?? "",
                  notes: r.notes ?? "",
                });
                editHandlers.open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  // Group due screenings by department
  const dueByDept = useMemo(() => {
    if (!showDue || subView !== "schedule") return [];
    const grouped: Record<string, { count: number; type: string; due_date: string }[]> = {};
    dueScreenings.forEach((s) => {
      const dept = s.employee_id.split("-")[0] || "GENERAL";
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push({
        count: 1,
        type: s.screening_type,
        due_date: s.next_due_date ?? "",
      });
    });
    return Object.entries(grouped).map(([dept, items]) => ({
      dept,
      items,
    }));
  }, [dueScreenings, showDue, subView]);

  // Helper to get urgency color
  const getUrgencyColor = (dueDate: string) => {
    if (!dueDate) return "primary";
    const days = Math.floor((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return "danger";
    if (days <= 7) return "warning";
    return "primary";
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <SegmentedControl
            value={subView}
            onChange={(v) => setSubView(v as "list" | "schedule")}
            data={[
              { value: "list", label: "List" },
              { value: "schedule", label: "Schedule" },
            ]}
          />
          {subView === "list" && (
            <>
              <Select
                placeholder="Filter by type"
                clearable
                data={SCREENING_TYPES}
                value={typeFilter}
                onChange={(v) => {
                  setTypeFilter(v);
                  setShowDue(false);
                }}
                w={200}
              />
              <Button
                variant={showDue ? "filled" : "light"}
                color="orange"
                size="sm"
                onClick={() => {
                  setShowDue(!showDue);
                  setTypeFilter(null);
                }}
              >
                Due Soon
              </Button>
            </>
          )}
        </Group>
        {canCreate && (
          <Group gap="xs">
            <Button
              variant="light"
              leftSection={<IconShieldCheck size={16} />}
              onClick={() => {
                setForm({
                  employee_id: "",
                  screening_type: "pre_employment",
                  screening_date: new Date().toISOString().slice(0, 10),
                });
                createHandlers.open();
              }}
            >
              Pre-Employment
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
              New Screening
            </Button>
          </Group>
        )}
      </Group>

      {subView === "list" ? (
        <DataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.id} />
      ) : (
        <Stack gap="md">
          <Group gap="xs" align="center">
            <IconCalendar size={20} />
            <Text fw={600} size="lg">
              Upcoming Screenings by Department
            </Text>
          </Group>
          {dueLoading ? (
            <Text c="dimmed">Loading schedule...</Text>
          ) : dueByDept.length === 0 ? (
            <Text c="dimmed">No upcoming screenings scheduled</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }}>
              {dueByDept.map(({ dept, items }) => (
                <Card key={dept} withBorder p="md">
                  <Text fw={600} mb="xs">
                    {dept}
                  </Text>
                  <Stack gap="xs">
                    {items.map((item, idx) => (
                      <Group key={idx} justify="space-between">
                        <Text size="sm">{SCREENING_TYPES.find((t) => t.value === item.type)?.label}</Text>
                        <Badge color={getUrgencyColor(item.due_date)} size="sm">
                          {item.due_date}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                  <Text size="xs" c="dimmed" mt="xs">
                    {items.length} employee(s) due
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      )}

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="New Health Screening"
        position="right"
        size="md"
      >
        <Stack>
          <TextInput
            label="Employee ID"
            required
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.currentTarget.value })}
          />
          <Select
            label="Screening Type"
            required
            data={SCREENING_TYPES}
            value={form.screening_type}
            onChange={(v) => setForm({ ...form, screening_type: v ?? "pre_employment" })}
          />
          <DateInput
            label="Screening Date"
            required
            value={form.screening_date ? new Date(form.screening_date) : null}
            onChange={(d) =>
              setForm({ ...form, screening_date: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />

          {/* Pre-Employment Structured Form */}
          {form.screening_type === "pre_employment" && (
            <Card withBorder p="sm" bg="gray.0">
              <Text fw={600} size="sm" mb="xs">
                Pre-Employment Exam Details
              </Text>
              <Stack gap="xs">
                <CheckboxGroup
                  label="Medical History"
                  value={preEmpForm.medical_history}
                  onChange={(val) => setPreEmpForm({ ...preEmpForm, medical_history: val })}
                >
                  <Stack gap={4} mt={4}>
                    <Checkbox value="diabetes" label="Diabetes" size="xs" />
                    <Checkbox value="hypertension" label="Hypertension" size="xs" />
                    <Checkbox value="asthma" label="Asthma" size="xs" />
                    <Checkbox value="cardiac" label="Cardiac Conditions" size="xs" />
                    <Checkbox value="surgery" label="Previous Surgery" size="xs" />
                  </Stack>
                </CheckboxGroup>
                <Group grow>
                  <TextInput
                    label="Height (cm)"
                    size="xs"
                    value={preEmpForm.height_cm}
                    onChange={(e) => setPreEmpForm({ ...preEmpForm, height_cm: e.currentTarget.value })}
                  />
                  <TextInput
                    label="Weight (kg)"
                    size="xs"
                    value={preEmpForm.weight_kg}
                    onChange={(e) => setPreEmpForm({ ...preEmpForm, weight_kg: e.currentTarget.value })}
                  />
                </Group>
                <Group grow>
                  <TextInput
                    label="BP Systolic"
                    size="xs"
                    value={preEmpForm.bp_systolic}
                    onChange={(e) => setPreEmpForm({ ...preEmpForm, bp_systolic: e.currentTarget.value })}
                  />
                  <TextInput
                    label="BP Diastolic"
                    size="xs"
                    value={preEmpForm.bp_diastolic}
                    onChange={(e) => setPreEmpForm({ ...preEmpForm, bp_diastolic: e.currentTarget.value })}
                  />
                </Group>
                <Group grow>
                  <TextInput
                    label="Vision Left"
                    size="xs"
                    value={preEmpForm.vision_left}
                    onChange={(e) => setPreEmpForm({ ...preEmpForm, vision_left: e.currentTarget.value })}
                  />
                  <TextInput
                    label="Vision Right"
                    size="xs"
                    value={preEmpForm.vision_right}
                    onChange={(e) => setPreEmpForm({ ...preEmpForm, vision_right: e.currentTarget.value })}
                  />
                </Group>
                <TextInput
                  label="Hearing Test Result"
                  size="xs"
                  value={preEmpForm.hearing_test}
                  onChange={(e) => setPreEmpForm({ ...preEmpForm, hearing_test: e.currentTarget.value })}
                />
                <TextInput
                  label="Lab Results Reference"
                  size="xs"
                  value={preEmpForm.lab_results_ref}
                  onChange={(e) => setPreEmpForm({ ...preEmpForm, lab_results_ref: e.currentTarget.value })}
                />
              </Stack>
            </Card>
          )}

          <Select
            label="Fitness Status"
            data={FITNESS_STATUS_OPTIONS}
            value={form.fitness_status ?? ""}
            onChange={(v) => setForm({ ...form, fitness_status: v ?? undefined })}
            clearable
          />
          <DateInput
            label="Next Due Date"
            value={form.next_due_date ? new Date(form.next_due_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                next_due_date: d ? new Date(d).toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <TextInput
            label="Examiner ID"
            value={form.examiner_id ?? ""}
            onChange={(e) =>
              setForm({ ...form, examiner_id: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) =>
              setForm({ ...form, notes: e.currentTarget.value || undefined })
            }
          />
          <Button
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.employee_id || !form.screening_date}
          >
            Create Screening
          </Button>
        </Stack>
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        opened={editOpen}
        onClose={editHandlers.close}
        title="Update Screening"
        position="right"
        size="md"
      >
        <Stack>
          <Select
            label="Fitness Status"
            data={FITNESS_STATUS_OPTIONS}
            value={editForm.fitness_status ?? ""}
            onChange={(v) => setEditForm({ ...editForm, fitness_status: v ?? undefined })}
          />
          <DateInput
            label="Next Due Date"
            value={editForm.next_due_date ? new Date(editForm.next_due_date) : null}
            onChange={(d) =>
              setEditForm({
                ...editForm,
                next_due_date: d ? new Date(d).toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <Textarea
            label="Notes"
            value={editForm.notes ?? ""}
            onChange={(e) =>
              setEditForm({ ...editForm, notes: e.currentTarget.value || undefined })
            }
          />
          <Button onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
            Update Screening
          </Button>
        </Stack>
      </Drawer>

      {/* Fitness Certificate Modal */}
      <Modal
        opened={certOpen}
        onClose={certHandlers.close}
        title="Fitness to Work Certificate"
        size="lg"
      >
        {selected && (
          <Stack gap="md">
            <style>
              {`
                @media print {
                  .mantine-Modal-header, .print-hide { display: none; }
                  .certificate-content { padding: 20px; }
                }
              `}
            </style>
            <Card className="certificate-content" withBorder p="xl">
              <Stack gap="lg" align="center">
                <Text fw={700} size="xl">
                  OCCUPATIONAL HEALTH CERTIFICATE
                </Text>
                <Text fw={600} size="lg">
                  Fitness to Work Certification
                </Text>
                <Stack gap="sm" w="100%" mt="md">
                  <Group>
                    <Text fw={600}>Employee ID:</Text>
                    <Text>{selected.employee_id}</Text>
                  </Group>
                  <Group>
                    <Text fw={600}>Examination Date:</Text>
                    <Text>{selected.screening_date}</Text>
                  </Group>
                  <Group>
                    <Text fw={600}>Examination Type:</Text>
                    <Badge color={SCREENING_TYPE_COLORS[selected.screening_type] ?? "gray"}>
                      {SCREENING_TYPES.find((t) => t.value === selected.screening_type)?.label}
                    </Badge>
                  </Group>
                  <Group>
                    <Text fw={600}>Fitness Status:</Text>
                    <Badge color={FITNESS_STATUS_COLORS[selected.fitness_status] ?? "gray"} size="lg">
                      {selected.fitness_status.toUpperCase()}
                    </Badge>
                  </Group>
                  {selected.notes && (
                    <Stack gap={4}>
                      <Text fw={600}>Restrictions / Notes:</Text>
                      <Text size="sm" c="dimmed">
                        {selected.notes}
                      </Text>
                    </Stack>
                  )}
                  {selected.next_due_date && (
                    <Group>
                      <Text fw={600}>Valid Until:</Text>
                      <Text>{selected.next_due_date}</Text>
                    </Group>
                  )}
                  {selected.examiner_id && (
                    <Group>
                      <Text fw={600}>Examining Physician:</Text>
                      <Text>{selected.examiner_id}</Text>
                    </Group>
                  )}
                </Stack>
                <Text size="xs" c="dimmed" mt="xl">
                  Certificate generated on {new Date().toLocaleDateString()}
                </Text>
              </Stack>
            </Card>
            <Group justify="flex-end" className="print-hide">
              <Button variant="light" onClick={certHandlers.close}>
                Close
              </Button>
              <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
                Print Certificate
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2 — Drug Screening
// ══════════════════════════════════════════════════════════

function DrugScreensPanel() {
  const canManage = useHasPermission(P.OCC_HEALTH.DRUG_SCREENS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const [selected, setSelected] = useState<OccHealthDrugScreen | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: screens = [], isLoading } = useQuery({
    queryKey: ["occ-drug-screens", statusFilter],
    queryFn: () =>
      api.listDrugScreens(statusFilter ? { status: statusFilter } : undefined),
  });

  const [form, setForm] = useState<CreateDrugScreenRequest>({
    employee_id: "",
  });

  const [editForm, setEditForm] = useState<{
    status?: string;
    mro_decision?: string;
  }>({});

  const createMut = useMutation({
    mutationFn: () => api.createDrugScreen(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-drug-screens"] });
      createHandlers.close();
      setForm({ employee_id: "" });
      notifications.show({
        title: "Drug Screen Created",
        message: "Drug screening order created successfully",
        color: "success",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selected) return Promise.reject(new Error("No drug screen selected"));
      return api.updateDrugScreen(selected.id, {
        status: editForm.status as OccHealthDrugScreen["status"],
        mro_decision: editForm.mro_decision,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-drug-screens"] });
      editHandlers.close();
      setSelected(null);
      notifications.show({
        title: "Drug Screen Updated",
        message: "Drug screen status updated successfully",
        color: "success",
      });
    },
  });

  const columns: Column<OccHealthDrugScreen>[] = [
    {
      key: "employee_id",
      label: "Employee",
      render: (r) => (
        <Text size="sm" truncate style={{ maxWidth: 120 }}>
          {r.employee_id}
        </Text>
      ),
    },
    {
      key: "specimen_id",
      label: "Specimen ID",
      render: (r) => r.specimen_id ?? "---",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge
          color={DRUG_SCREEN_STATUS_COLORS[r.status] ?? "gray"}
          variant="filled"
          size="sm"
        >
          {DRUG_SCREEN_STATUS_OPTIONS.find((s) => s.value === r.status)?.label ?? r.status}
        </Badge>
      ),
    },
    {
      key: "panel",
      label: "Panel",
      render: (r) =>
        DRUG_PANEL_OPTIONS.find((p) => p.value === r.panel)?.label ?? r.panel,
    },
    {
      key: "mro_decision",
      label: "MRO Decision",
      render: (r) => r.mro_decision ?? "---",
    },
    {
      key: "collected_at",
      label: "Collected",
      render: (r) => r.collected_at ?? "---",
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {canManage && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => {
                setSelected(r);
                setEditForm({
                  status: r.status,
                  mro_decision: r.mro_decision ?? "",
                });
                editHandlers.open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          data={DRUG_SCREEN_STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          w={200}
        />
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            New Drug Screen
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={screens} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="New Drug Screening"
        position="right"
        size="md"
      >
        <Stack>
          <TextInput
            label="Employee ID"
            required
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.currentTarget.value })}
          />
          <TextInput
            label="Screening ID"
            description="Link to a health screening (optional)"
            value={form.screening_id ?? ""}
            onChange={(e) =>
              setForm({ ...form, screening_id: e.currentTarget.value || undefined })
            }
          />
          <Select
            label="Panel"
            data={DRUG_PANEL_OPTIONS}
            value={form.panel ?? "standard_5"}
            onChange={(v) => setForm({ ...form, panel: v ?? undefined })}
          />
          <Button
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.employee_id}
          >
            Create Drug Screen
          </Button>
        </Stack>
      </Drawer>

      {/* Update Status Drawer */}
      <Drawer
        opened={editOpen}
        onClose={editHandlers.close}
        title="Update Drug Screen"
        position="right"
        size="md"
      >
        <Stack>
          <Select
            label="Status"
            data={DRUG_SCREEN_STATUS_OPTIONS}
            value={editForm.status ?? ""}
            onChange={(v) => setEditForm({ ...editForm, status: v ?? undefined })}
          />
          <TextInput
            label="MRO Decision"
            value={editForm.mro_decision ?? ""}
            onChange={(e) =>
              setEditForm({ ...editForm, mro_decision: e.currentTarget.value || undefined })
            }
          />
          <Button onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
            Update Drug Screen
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Vaccinations
// ══════════════════════════════════════════════════════════

function VaccinationsPanel() {
  const canManage = useHasPermission(P.OCC_HEALTH.VACCINATIONS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const { data: vaccinations = [], isLoading } = useQuery({
    queryKey: ["occ-vaccinations"],
    queryFn: () => api.listVaccinations(),
  });

  const { data: compliance = [] } = useQuery<VaccinationComplianceRow[]>({
    queryKey: ["occ-vaccination-compliance"],
    queryFn: () => api.vaccinationCompliance(),
  });

  const [form, setForm] = useState<CreateVaccinationRequest>({
    employee_id: "",
    vaccine_name: "",
    administered_date: "",
  });
  const [formCompliant, setFormCompliant] = useState(true);

  const createMut = useMutation({
    mutationFn: () =>
      api.createVaccination({
        ...form,
        is_compliant: formCompliant,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-vaccinations"] });
      void qc.invalidateQueries({ queryKey: ["occ-vaccination-compliance"] });
      createHandlers.close();
      setForm({ employee_id: "", vaccine_name: "", administered_date: "" });
      setFormCompliant(true);
      notifications.show({
        title: "Vaccination Recorded",
        message: "Vaccination record created successfully",
        color: "success",
      });
    },
  });

  const columns: Column<OccHealthVaccination>[] = [
    {
      key: "employee_id",
      label: "Employee",
      render: (r) => (
        <Text size="sm" truncate style={{ maxWidth: 120 }}>
          {r.employee_id}
        </Text>
      ),
    },
    {
      key: "vaccine_name",
      label: "Vaccine",
      render: (r) => r.vaccine_name,
    },
    {
      key: "dose_number",
      label: "Dose #",
      render: (r) => r.dose_number.toString(),
    },
    {
      key: "administered_date",
      label: "Administered",
      render: (r) => r.administered_date,
    },
    {
      key: "is_compliant",
      label: "Compliant",
      render: (r) => (
        <Badge color={r.is_compliant ? "success" : "danger"} variant="filled" size="sm">
          {r.is_compliant ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "next_due_date",
      label: "Next Due",
      render: (r) => r.next_due_date ?? "---",
    },
    {
      key: "batch_number",
      label: "Batch",
      render: (r) => r.batch_number ?? "---",
    },
  ];

  return (
    <>
      {/* Compliance Summary Cards */}
      {compliance.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="md">
          {compliance.map((row) => (
            <Card key={row.vaccine_name} shadow="xs" padding="md" withBorder>
              <Text fw={600} size="sm" mb={4}>
                {row.vaccine_name}
              </Text>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {row.compliant_count} / {row.total_employees}
                </Text>
                <Badge
                  color={row.compliance_pct >= 90 ? "success" : row.compliance_pct >= 70 ? "warning" : "danger"}
                  variant="light"
                  size="sm"
                >
                  {row.compliance_pct.toFixed(1)}%
                </Badge>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Record Vaccination
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={vaccinations}
        loading={isLoading}
        rowKey={(r) => r.id}
      />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Record Vaccination"
        position="right"
        size="md"
      >
        <Stack>
          <TextInput
            label="Employee ID"
            required
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.currentTarget.value })}
          />
          <TextInput
            label="Vaccine Name"
            required
            value={form.vaccine_name}
            onChange={(e) => setForm({ ...form, vaccine_name: e.currentTarget.value })}
          />
          <NumberInput
            label="Dose Number"
            min={1}
            value={form.dose_number ?? 1}
            onChange={(v) =>
              setForm({ ...form, dose_number: typeof v === "number" ? v : undefined })
            }
          />
          <DateInput
            label="Administered Date"
            required
            value={form.administered_date ? new Date(form.administered_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                administered_date: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <TextInput
            label="Batch Number"
            value={form.batch_number ?? ""}
            onChange={(e) =>
              setForm({ ...form, batch_number: e.currentTarget.value || undefined })
            }
          />
          <DateInput
            label="Next Due Date"
            value={form.next_due_date ? new Date(form.next_due_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                next_due_date: d ? new Date(d).toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <Switch
            label="Is Compliant"
            checked={formCompliant}
            onChange={(e) => setFormCompliant(e.currentTarget.checked)}
          />
          <TextInput
            label="Exemption Type"
            value={form.exemption_type ?? ""}
            onChange={(e) =>
              setForm({ ...form, exemption_type: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Exemption Reason"
            value={form.exemption_reason ?? ""}
            onChange={(e) =>
              setForm({ ...form, exemption_reason: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) =>
              setForm({ ...form, notes: e.currentTarget.value || undefined })
            }
          />
          <Button
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.employee_id || !form.vaccine_name || !form.administered_date}
          >
            Save Vaccination
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4 — Injuries & Return-to-Work
// ══════════════════════════════════════════════════════════

function InjuriesPanel() {
  const canCreate = useHasPermission(P.OCC_HEALTH.INJURIES_CREATE);
  const canManage = useHasPermission(P.OCC_HEALTH.INJURIES_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const [selected, setSelected] = useState<OccHealthInjuryReport | null>(null);
  const [rtwFilter, setRtwFilter] = useState<string | null>(null);

  const { data: injuries = [], isLoading } = useQuery({
    queryKey: ["occ-injuries", rtwFilter],
    queryFn: () =>
      api.listInjuries(rtwFilter ? { rtw_status: rtwFilter } : undefined),
  });

  const [form, setForm] = useState<CreateInjuryRequest>({
    employee_id: "",
    injury_date: "",
    injury_type: "other",
  });
  const [formOsha, setFormOsha] = useState(false);

  const [editForm, setEditForm] = useState<UpdateInjuryRequest>({});

  const createMut = useMutation({
    mutationFn: () =>
      api.createInjury({
        ...form,
        is_osha_recordable: formOsha,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-injuries"] });
      createHandlers.close();
      setForm({ employee_id: "", injury_date: "", injury_type: "other" });
      setFormOsha(false);
      notifications.show({
        title: "Injury Report Created",
        message: "Workplace injury report created successfully",
        color: "success",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selected) return Promise.reject(new Error("No injury selected"));
      return api.updateInjury(selected.id, editForm);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-injuries"] });
      editHandlers.close();
      setSelected(null);
      notifications.show({
        title: "Injury Updated",
        message: "Injury report and RTW status updated successfully",
        color: "success",
      });
    },
  });

  const columns: Column<OccHealthInjuryReport>[] = [
    {
      key: "report_number",
      label: "Report #",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.report_number}
        </Text>
      ),
    },
    {
      key: "employee_id",
      label: "Employee",
      render: (r) => (
        <Text size="sm" truncate style={{ maxWidth: 120 }}>
          {r.employee_id}
        </Text>
      ),
    },
    {
      key: "injury_date",
      label: "Injury Date",
      render: (r) => r.injury_date,
    },
    {
      key: "injury_type",
      label: "Type",
      render: (r) =>
        INJURY_TYPES.find((t) => t.value === r.injury_type)?.label ?? r.injury_type,
    },
    {
      key: "is_osha_recordable",
      label: "OSHA",
      render: (r) => (
        <Badge color={r.is_osha_recordable ? "danger" : "gray"} variant="filled" size="sm">
          {r.is_osha_recordable ? "Recordable" : "Non-Rec."}
        </Badge>
      ),
    },
    {
      key: "rtw_status",
      label: "RTW Status",
      render: (r) => (
        <Badge
          color={RTW_STATUS_COLORS[r.rtw_status] ?? "gray"}
          variant="filled"
          size="sm"
        >
          {RTW_STATUS_OPTIONS.find((s) => s.value === r.rtw_status)?.label ?? r.rtw_status}
        </Badge>
      ),
    },
    {
      key: "lost_work_days",
      label: "Lost Days",
      render: (r) => r.lost_work_days.toString(),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {canManage && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => {
                setSelected(r);
                setEditForm({
                  injury_description: r.injury_description ?? "",
                  is_osha_recordable: r.is_osha_recordable,
                  lost_work_days: r.lost_work_days,
                  restricted_days: r.restricted_days,
                  workers_comp_claim_number: r.workers_comp_claim_number ?? "",
                  workers_comp_status: r.workers_comp_status ?? "",
                  rtw_status: r.rtw_status,
                  employer_access_notes: r.employer_access_notes ?? "",
                });
                editHandlers.open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by RTW status"
          clearable
          data={RTW_STATUS_OPTIONS}
          value={rtwFilter}
          onChange={setRtwFilter}
          w={240}
        />
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Report Injury
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={injuries} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Report Workplace Injury"
        position="right"
        size="md"
      >
        <Stack>
          <TextInput
            label="Employee ID"
            required
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.currentTarget.value })}
          />
          <DateInput
            label="Injury Date"
            required
            value={form.injury_date ? new Date(form.injury_date) : null}
            onChange={(d) =>
              setForm({ ...form, injury_date: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />
          <Select
            label="Injury Type"
            required
            data={INJURY_TYPES}
            value={form.injury_type}
            onChange={(v) => setForm({ ...form, injury_type: v ?? "other" })}
          />
          <TextInput
            label="Body Part Affected"
            value={form.body_part_affected ?? ""}
            onChange={(e) =>
              setForm({ ...form, body_part_affected: e.currentTarget.value || undefined })
            }
          />
          <TextInput
            label="Location of Incident"
            value={form.location_of_incident ?? ""}
            onChange={(e) =>
              setForm({ ...form, location_of_incident: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Injury Description"
            value={form.injury_description ?? ""}
            onChange={(e) =>
              setForm({ ...form, injury_description: e.currentTarget.value || undefined })
            }
          />
          <Switch
            label="OSHA Recordable"
            checked={formOsha}
            onChange={(e) => setFormOsha(e.currentTarget.checked)}
          />
          <Button
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.employee_id || !form.injury_date}
          >
            Submit Report
          </Button>
        </Stack>
      </Drawer>

      {/* Edit / RTW Drawer */}
      <Drawer
        opened={editOpen}
        onClose={editHandlers.close}
        title="Manage Injury & Return-to-Work"
        position="right"
        size="md"
      >
        <Stack>
          <Select
            label="RTW Status"
            data={RTW_STATUS_OPTIONS}
            value={editForm.rtw_status ?? ""}
            onChange={(v) =>
              setEditForm({
                ...editForm,
                rtw_status: (v as OccHealthInjuryReport["rtw_status"]) ?? undefined,
              })
            }
          />
          <NumberInput
            label="Lost Work Days"
            min={0}
            value={editForm.lost_work_days ?? 0}
            onChange={(v) =>
              setEditForm({ ...editForm, lost_work_days: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Restricted Days"
            min={0}
            value={editForm.restricted_days ?? 0}
            onChange={(v) =>
              setEditForm({
                ...editForm,
                restricted_days: typeof v === "number" ? v : undefined,
              })
            }
          />
          <Switch
            label="OSHA Recordable"
            checked={editForm.is_osha_recordable ?? false}
            onChange={(e) =>
              setEditForm({ ...editForm, is_osha_recordable: e.currentTarget.checked })
            }
          />
          <TextInput
            label="Workers Comp Claim Number"
            value={editForm.workers_comp_claim_number ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                workers_comp_claim_number: e.currentTarget.value || undefined,
              })
            }
          />
          <TextInput
            label="Workers Comp Status"
            value={editForm.workers_comp_status ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                workers_comp_status: e.currentTarget.value || undefined,
              })
            }
          />
          <Textarea
            label="Employer Access Notes"
            value={editForm.employer_access_notes ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                employer_access_notes: e.currentTarget.value || undefined,
              })
            }
          />
          <Textarea
            label="Injury Description"
            value={editForm.injury_description ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                injury_description: e.currentTarget.value || undefined,
              })
            }
          />
          <Button onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
            Update Injury Report
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 5 — Hazard Registry
// ══════════════════════════════════════════════════════════

const HAZARD_TYPES = [
  { value: "biological", label: "Biological" },
  { value: "chemical", label: "Chemical" },
  { value: "physical", label: "Physical" },
  { value: "ergonomic", label: "Ergonomic" },
  { value: "psychosocial", label: "Psychosocial" },
  { value: "radiation", label: "Radiation" },
  { value: "other", label: "Other" },
];

const HAZARD_RISK_COLORS: Record<string, string> = {
  low: "success",
  medium: "warning",
  high: "orange",
  critical: "danger",
};

function HazardRegistryPanel() {
  const canCreate = useHasPermission(P.OCC_HEALTH.SCREENINGS_CREATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const { data: hazards = [], isLoading } = useQuery({
    queryKey: ["occ-health-hazards"],
    queryFn: () => api.listOccHealthHazards(),
  });

  const [form, setForm] = useState<CreateOccHealthHazardRequest>({
    hazard_type: "biological",
    location: "",
    risk_level: "low",
    assessed_date: new Date().toISOString().slice(0, 10),
  });

  const createMut = useMutation({
    mutationFn: () => api.createOccHealthHazard(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-health-hazards"] });
      createHandlers.close();
      setForm({
        hazard_type: "biological",
        location: "",
        risk_level: "low",
        assessed_date: new Date().toISOString().slice(0, 10),
      });
      notifications.show({
        title: "Hazard Created",
        message: "Hazard registry entry created successfully",
        color: "success",
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  const columns: Column<OccHealthHazard>[] = [
    {
      key: "hazard_type",
      label: "Type",
      render: (r) => (
        <Badge variant="light" size="sm">
          {HAZARD_TYPES.find((t) => t.value === r.hazard_type)?.label ?? r.hazard_type}
        </Badge>
      ),
    },
    {
      key: "location",
      label: "Location",
      render: (r) => <Text size="sm">{r.location}</Text>,
    },
    {
      key: "risk_level",
      label: "Risk Level",
      render: (r) => (
        <Badge color={HAZARD_RISK_COLORS[r.risk_level] ?? "gray"} variant="filled" size="sm">
          {r.risk_level}
        </Badge>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (r) => <Text size="sm" lineClamp={2}>{r.description ?? "---"}</Text>,
    },
    {
      key: "mitigation",
      label: "Mitigation",
      render: (r) => <Text size="sm" lineClamp={2}>{r.mitigation ?? "---"}</Text>,
    },
    {
      key: "assessed_date",
      label: "Assessed",
      render: (r) => <Text size="sm">{r.assessed_date}</Text>,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Add Hazard
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={hazards}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No hazards registered"
        emptyDescription="Add workplace hazards to build a comprehensive registry"
      />

      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Register Workplace Hazard"
        position="right"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Hazard Type"
            required
            data={HAZARD_TYPES}
            value={form.hazard_type}
            onChange={(v) => setForm({ ...form, hazard_type: v ?? "biological" })}
          />
          <TextInput
            label="Location"
            required
            placeholder="e.g. ICU Ward 3, Radiology Lab"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.currentTarget.value })}
          />
          <Select
            label="Risk Level"
            required
            data={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ]}
            value={form.risk_level}
            onChange={(v) => setForm({ ...form, risk_level: v ?? "low" })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <Textarea
            label="Mitigation Measures"
            value={form.mitigation ?? ""}
            onChange={(e) => setForm({ ...form, mitigation: e.currentTarget.value || undefined })}
          />
          <DateInput
            label="Assessment Date"
            required
            value={form.assessed_date ? new Date(form.assessed_date) : null}
            onChange={(d) =>
              setForm({ ...form, assessed_date: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />
          <Button
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.location || !form.assessed_date}
          >
            Register Hazard
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 6 — Analytics
// ══════════════════════════════════════════════════════════

function OccHealthAnalyticsPanel() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["occ-health-analytics"],
    queryFn: () => api.occHealthAnalytics(),
  });

  if (isLoading) {
    return <Text c="dimmed" size="sm">Loading analytics...</Text>;
  }

  if (!analytics) {
    return <Text c="dimmed" size="sm">No analytics data available</Text>;
  }

  const byTypeData = Object.entries(analytics.by_type ?? {}).map(([type, count]) => ({
    type: SCREENING_TYPES.find((t) => t.value === type)?.label ?? type,
    count,
  }));

  const fitnessData = Object.entries(analytics.fitness_rates ?? {}).map(([status, rate]) => ({
    name: status,
    value: Math.round((rate as number) * 100),
    color: FITNESS_STATUS_COLORS[status] ?? "gray",
  }));

  const byDeptData = Object.entries(analytics.by_department ?? {}).map(([dept, count]) => ({
    department: dept,
    count,
  }));

  return (
    <Stack gap="lg">
      {/* Summary Stats */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">Total Screenings</Text>
          <Text fw={700} size="xl" c="primary">{analytics.total_screenings ?? 0}</Text>
        </Card>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">Screening Types</Text>
          <Text fw={700} size="xl">{Object.keys(analytics.by_type ?? {}).length}</Text>
        </Card>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">Departments Covered</Text>
          <Text fw={700} size="xl">{Object.keys(analytics.by_department ?? {}).length}</Text>
        </Card>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">Fitness Statuses Tracked</Text>
          <Text fw={700} size="xl">{Object.keys(analytics.fitness_rates ?? {}).length}</Text>
        </Card>
      </SimpleGrid>

      {/* Charts */}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {byTypeData.length > 0 && (
          <Card withBorder p="md">
            <Text fw={600} size="sm" mb="md">Screenings by Type</Text>
            <BarChart
              h={250}
              data={byTypeData}
              dataKey="type"
              series={[{ name: "count", label: "Count", color: "primary" }]}
            />
          </Card>
        )}
        {fitnessData.length > 0 && (
          <Card withBorder p="md">
            <Text fw={600} size="sm" mb="md">Fitness Rate Distribution (%)</Text>
            <DonutChart
              data={fitnessData}
              size={200}
              thickness={30}
              paddingAngle={4}
              withLabelsLine
              withLabels
            />
          </Card>
        )}
      </SimpleGrid>

      {byDeptData.length > 0 && (
        <Card withBorder p="md">
          <Text fw={600} size="sm" mb="md">Screenings by Department</Text>
          <BarChart
            h={300}
            data={byDeptData}
            dataKey="department"
            series={[{ name: "count", label: "Count", color: "teal" }]}
          />
        </Card>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 7 — Return-to-Work Clearance
// ══════════════════════════════════════════════════════════

function ReturnToWorkPanel() {
  const canCreate = useHasPermission(P.OCC_HEALTH.SCREENINGS_CREATE);
  const qc = useQueryClient();

  const [form, setForm] = useState<ReturnToWorkClearanceRequest>({
    employee_id: "",
    clearance_date: new Date().toISOString().slice(0, 10),
  });

  const clearanceMut = useMutation({
    mutationFn: () => api.returnToWorkClearance(form),
    onSuccess: () => {
      notifications.show({
        title: "Clearance Issued",
        message: "Return-to-work clearance issued successfully. A screening record has been created.",
        color: "success",
      });
      void qc.invalidateQueries({ queryKey: ["occ-screenings"] });
      setForm({
        employee_id: "",
        clearance_date: new Date().toISOString().slice(0, 10),
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack gap="md" maw={600}>
      <Card withBorder p="lg">
        <Text fw={600} size="lg" mb="sm">
          Issue Return-to-Work Clearance
        </Text>
        <Text size="sm" c="dimmed" mb="md">
          This form creates a fitness clearance for an employee returning from injury or extended
          medical absence. A screening record will be automatically generated.
        </Text>
        <Stack gap="sm">
          <TextInput
            label="Employee ID"
            required
            placeholder="UUID of the employee"
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.currentTarget.value })}
          />
          <DateInput
            label="Clearance Date"
            required
            value={form.clearance_date ? new Date(form.clearance_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                clearance_date: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <Textarea
            label="Restrictions"
            placeholder="e.g. No heavy lifting for 4 weeks"
            value={form.restrictions ?? ""}
            onChange={(e) =>
              setForm({ ...form, restrictions: e.currentTarget.value || undefined })
            }
          />
          <DateInput
            label="Follow-up Date"
            value={form.follow_up_date ? new Date(form.follow_up_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                follow_up_date: d ? new Date(d).toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) =>
              setForm({ ...form, notes: e.currentTarget.value || undefined })
            }
          />
          {canCreate && (
            <Button
              onClick={() => clearanceMut.mutate()}
              loading={clearanceMut.isPending}
              disabled={!form.employee_id || !form.clearance_date}
            >
              Issue RTW Clearance
            </Button>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
