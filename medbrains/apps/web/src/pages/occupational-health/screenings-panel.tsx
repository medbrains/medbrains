// IPD ScreeningsPanel — split from occupational-health.tsx (pure move).

import {
  Card,
  Checkbox,
  CheckboxGroup,
  Drawer,
  Group,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CreateOccScreeningRequest, OccHealthScreening } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCalendar,
  IconCertificate,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { occupationalHealthService } from "@/services/occupationalHealth.service";
import { FITNESS_STATUS_COLORS, SCREENING_TYPES, statusColorTone } from "./shared";

const FITNESS_STATUS_OPTIONS = [
  { value: "fit", label: "Fit" },
  { value: "unfit", label: "Unfit" },
  { value: "pending", label: "Pending" },
  { value: "referred", label: "Referred" },
];

function fitnessStatusTone(status: string): BadgeTone {
  const m: Record<string, BadgeTone> = {
    success: "success",
    danger: "danger",
    gray: "neutral",
    orange: "warning",
  };
  return m[FITNESS_STATUS_COLORS[status] ?? ""] ?? "neutral";
}

export function ScreeningsPanel() {
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
      occupationalHealthService.listOccScreenings(
        typeFilter ? { screening_type: typeFilter } : undefined,
      ),
    enabled: !showDue,
  });

  const { data: dueScreenings = [], isLoading: dueLoading } = useQuery({
    queryKey: ["occ-screenings-due"],
    queryFn: () => occupationalHealthService.listDueScreenings(),
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
      return occupationalHealthService.createOccScreening(payload);
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
      return occupationalHealthService.updateOccScreening(selected.id, editForm);
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
        <Badge tone={statusColorTone(r.screening_type)} size="sm">
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
        <Badge tone={fitnessStatusTone(r.fitness_status)} variant="filled" size="sm">
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
            <IconButton
              tone="success"
              size="sm"
              onClick={() => {
                setSelected(r);
                certHandlers.open();
              }}
              title="Generate Certificate"
              aria-label="Certificate"
            >
              <IconCertificate size={14} />
            </IconButton>
          )}
          {canUpdate && (
            <IconButton
              tone="default"
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
            </IconButton>
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
  const getUrgencyColor = (dueDate: string): BadgeTone => {
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
                tone={showDue ? "primary" : "secondary"}
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
              tone="secondary"
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
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              onClick={createHandlers.open}
            >
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
                    {items.map((item) => (
                      <Group key={`${item.type}-${item.due_date}`} justify="space-between">
                        <Text size="sm">
                          {SCREENING_TYPES.find((t) => t.value === item.type)?.label}
                        </Text>
                        <Badge tone={getUrgencyColor(item.due_date)} size="sm">
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
          <EmployeeSearchSelect
            label="Employee"
            required
            value={form.employee_id}
            onChange={(employeeId) => setForm({ ...form, employee_id: employeeId })}
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
                    onChange={(e) =>
                      setPreEmpForm({ ...preEmpForm, height_cm: e.currentTarget.value })
                    }
                  />
                  <TextInput
                    label="Weight (kg)"
                    size="xs"
                    value={preEmpForm.weight_kg}
                    onChange={(e) =>
                      setPreEmpForm({ ...preEmpForm, weight_kg: e.currentTarget.value })
                    }
                  />
                </Group>
                <Group grow>
                  <TextInput
                    label="BP Systolic"
                    size="xs"
                    value={preEmpForm.bp_systolic}
                    onChange={(e) =>
                      setPreEmpForm({ ...preEmpForm, bp_systolic: e.currentTarget.value })
                    }
                  />
                  <TextInput
                    label="BP Diastolic"
                    size="xs"
                    value={preEmpForm.bp_diastolic}
                    onChange={(e) =>
                      setPreEmpForm({ ...preEmpForm, bp_diastolic: e.currentTarget.value })
                    }
                  />
                </Group>
                <Group grow>
                  <TextInput
                    label="Vision Left"
                    size="xs"
                    value={preEmpForm.vision_left}
                    onChange={(e) =>
                      setPreEmpForm({ ...preEmpForm, vision_left: e.currentTarget.value })
                    }
                  />
                  <TextInput
                    label="Vision Right"
                    size="xs"
                    value={preEmpForm.vision_right}
                    onChange={(e) =>
                      setPreEmpForm({ ...preEmpForm, vision_right: e.currentTarget.value })
                    }
                  />
                </Group>
                <TextInput
                  label="Hearing Test Result"
                  size="xs"
                  value={preEmpForm.hearing_test}
                  onChange={(e) =>
                    setPreEmpForm({ ...preEmpForm, hearing_test: e.currentTarget.value })
                  }
                />
                <TextInput
                  label="Lab Results Reference"
                  size="xs"
                  value={preEmpForm.lab_results_ref}
                  onChange={(e) =>
                    setPreEmpForm({ ...preEmpForm, lab_results_ref: e.currentTarget.value })
                  }
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
          <EmployeeSearchSelect
            label="Examiner"
            value={form.examiner_id ?? ""}
            onChange={(employeeId) => setForm({ ...form, examiner_id: employeeId || undefined })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })}
          />
          <Button
            tone="primary"
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
          <Button tone="primary" onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
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
                    <Badge tone={statusColorTone(selected.screening_type)}>
                      {SCREENING_TYPES.find((t) => t.value === selected.screening_type)?.label}
                    </Badge>
                  </Group>
                  <Group>
                    <Text fw={600}>Fitness Status:</Text>
                    <Badge tone={fitnessStatusTone(selected.fitness_status)} size="lg">
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
              <Button tone="secondary" onClick={certHandlers.close}>
                Close
              </Button>
              <Button
                tone="primary"
                leftSection={<IconPrinter size={16} />}
                onClick={() => window.print()}
              >
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
