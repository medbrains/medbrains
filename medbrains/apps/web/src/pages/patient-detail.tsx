import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
  SegmentedControl,
  ScrollArea,
  Progress,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconBed,
  IconCalendar,
  IconClock,
  IconFile,
  IconFlask,
  IconGitMerge,
  IconLink,
  IconPencil,
  IconPill,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconStethoscope,
  IconTrash,
  IconUser,
  IconReportMedical,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { PageHeader } from "../components/PageHeader";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { DrugSearchSelect } from "../components/DrugSearchSelect";
import { PrescriptionViews } from "../components/Clinical";
import { ActivePackagesSection } from "../components/Patient/ActivePackagesSection";
import type {
  Patient,
  PrescriptionHistoryItem,
  PatientVisitRow,
  PatientLabOrderRow,
  PatientInvoiceRow,
  PatientAppointmentRow,
  PatientAllergy,
  AllergyType,
  AllergySeverity,
  CreatePatientAllergyRequest,
  FamilyLinkRow,
  CreateFamilyLinkRequest,
  PatientDocument,
  CreateDocumentRequest,
  PatientMergeHistory,
  MergePatientRequest,
  MedicationTimelineEvent,
  DrugTimelineWithLabsResponse,
  TreatmentSummaryResponse,
} from "@medbrains/types";

// ── Helpers ────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  open: "primary",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger",
};

const LAB_STATUS_COLORS: Record<string, string> = {
  ordered: "primary",
  sample_collected: "info",
  processing: "warning",
  completed: "success",
  verified: "teal",
  cancelled: "danger",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "gray",
  issued: "primary",
  partially_paid: "warning",
  paid: "success",
  cancelled: "danger",
  refunded: "orange",
};

const APPT_STATUS_COLORS: Record<string, string> = {
  scheduled: "primary",
  confirmed: "info",
  checked_in: "warning",
  in_consultation: "orange",
  completed: "success",
  cancelled: "danger",
  no_show: "gray",
};

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function age(dob: string | null): string {
  if (!dob) return "-";
  const years = Math.floor(
    (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
  return `${years}y`;
}

// ── Overview Tab ───────────────────────────────────────────

function OverviewTab({ patient }: { patient: Patient }) {
  const { data: allergies } = useQuery({
    queryKey: ["patient-allergies", patient.id],
    queryFn: () => api.listPatientAllergies(patient.id),
  });

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      <Card withBorder>
        <Title order={5} mb="sm">
          Demographics
        </Title>
        <Stack gap="xs">
          <InfoRow label="UHID" value={patient.uhid} />
          <InfoRow
            label="Name"
            value={`${patient.first_name} ${patient.middle_name ?? ""} ${patient.last_name}`.trim()}
          />
          <InfoRow label="Gender" value={patient.gender} />
          <InfoRow
            label="Date of Birth"
            value={
              patient.date_of_birth
                ? `${formatDate(patient.date_of_birth)} (${age(patient.date_of_birth)})`
                : "-"
            }
          />
          <InfoRow label="Blood Group" value={patient.blood_group ?? "-"} />
          <InfoRow label="Marital Status" value={patient.marital_status ?? "-"} />
          <InfoRow label="Phone" value={patient.phone} />
          <InfoRow label="Email" value={patient.email ?? "-"} />
          <InfoRow label="Category" value={patient.category} />
          <InfoRow label="Financial Class" value={patient.financial_class} />
        </Stack>
      </Card>

      <Stack gap="md">
        <Card withBorder>
          <Title order={5} mb="sm">
            Visit Summary
          </Title>
          <Stack gap="xs">
            <InfoRow
              label="Total Visits"
              value={String(patient.total_visits)}
            />
            <InfoRow
              label="Last Visit"
              value={formatDate(patient.last_visit_date ?? null)}
            />
            <InfoRow
              label="Registration"
              value={patient.registration_type}
            />
            <InfoRow
              label="Registered"
              value={formatDate(patient.created_at)}
            />
          </Stack>
        </Card>

        <Card withBorder>
          <Title order={5} mb="sm">
            Allergies
          </Title>
          {patient.no_known_allergies ? (
            <Text size="sm" c="dimmed">
              No known allergies (NKDA)
            </Text>
          ) : allergies && allergies.length > 0 ? (
            <Stack gap="xs">
              {allergies.map((a: PatientAllergy) => (
                <Group key={a.id} gap="xs">
                  <Badge
                    color={
                      a.severity === "severe" || a.severity === "life_threatening"
                        ? "danger"
                        : a.severity === "moderate"
                          ? "orange"
                          : "warning"
                    }
                    variant="light"
                    size="sm"
                  >
                    {a.severity}
                  </Badge>
                  <Text size="sm">
                    {a.allergen_name} ({a.allergy_type})
                  </Text>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No allergies recorded
            </Text>
          )}
        </Card>

        {(patient.is_vip || patient.is_medico_legal || patient.is_deceased) && (
          <Card withBorder>
            <Title order={5} mb="sm">
              Flags
            </Title>
            <Group gap="xs">
              {patient.is_vip && (
                <Badge color="violet" variant="light">
                  VIP
                </Badge>
              )}
              {patient.is_medico_legal && (
                <Badge color="danger" variant="light">
                  Medico-Legal
                </Badge>
              )}
              {patient.is_deceased && (
                <Badge color="gray" variant="filled">
                  Deceased
                </Badge>
              )}
            </Group>
          </Card>
        )}
      </Stack>
    </SimpleGrid>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="xl">
      <Text size="sm" c="dimmed" w={130}>
        {label}
      </Text>
      <Text size="sm" fw={500} style={{ flex: 1, textAlign: "right" }}>
        {value}
      </Text>
    </Group>
  );
}

// ── Allergies Tab ─────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  mild: "success",
  moderate: "warning",
  severe: "orange",
  life_threatening: "danger",
};

const ALLERGY_TYPE_OPTIONS = [
  { value: "drug", label: "Drug" },
  { value: "food", label: "Food" },
  { value: "environmental", label: "Environmental" },
  { value: "latex", label: "Latex" },
  { value: "contrast_dye", label: "Contrast Dye" },
  { value: "biological", label: "Biological" },
  { value: "other", label: "Other" },
];

const SEVERITY_OPTIONS = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "life_threatening", label: "Life Threatening" },
];

function AllergiesTab({ patient }: { patient: Patient }) {
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [allergyType, setAllergyType] = useState<string | null>("drug");
  const [allergenName, setAllergenName] = useState("");
  const [severity, setSeverity] = useState<string | null>(null);
  const [reaction, setReaction] = useState("");

  const { data: allergies = [], isLoading } = useQuery({
    queryKey: ["patient-allergies", patient.id],
    queryFn: () => api.listPatientAllergies(patient.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePatientAllergyRequest) =>
      api.createPatientAllergy(patient.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-allergies", patient.id] });
      notifications.show({ title: "Allergy added", message: "Allergy recorded", color: "success" });
      handleClose();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (allergyId: string) =>
      api.deletePatientAllergy(patient.id, allergyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-allergies", patient.id] });
      notifications.show({ title: "Removed", message: "Allergy removed", color: "success" });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const handleClose = () => {
    close();
    setAllergyType("drug");
    setAllergenName("");
    setSeverity(null);
    setReaction("");
  };

  const handleSubmit = () => {
    if (!allergyType || !allergenName.trim()) return;
    createMutation.mutate({
      allergy_type: allergyType as AllergyType,
      allergen_name: allergenName.trim(),
      severity: (severity as AllergySeverity) || undefined,
      reaction: reaction.trim() || undefined,
    });
  };

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="md">
      {patient.no_known_allergies && (
        <Alert color="success" variant="light">
          NKDA -- No Known Drug Allergies
        </Alert>
      )}

      {canUpdate && (
        <Group justify="flex-end">
          <Button leftSection={<IconPlus size={14} />} size="sm" onClick={open}>
            Add Allergy
          </Button>
        </Group>
      )}

      {allergies.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No allergies recorded.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Allergen</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Severity</Table.Th>
              <Table.Th>Reaction</Table.Th>
              {canUpdate && <Table.Th w={40} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {allergies.map((a: PatientAllergy) => (
              <Table.Tr key={a.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{a.allergen_name}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">
                    {a.allergy_type.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {a.severity ? (
                    <Badge
                      color={SEVERITY_COLORS[a.severity] ?? "gray"}
                      variant="light"
                      size="sm"
                    >
                      {a.severity.replace(/_/g, " ")}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">-</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{a.reaction ?? "-"}</Text>
                </Table.Td>
                {canUpdate && (
                  <Table.Td>
                    <ActionIcon
                      variant="light"
                      color="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(a.id)}
                      loading={deleteMutation.isPending}
                      aria-label="Delete allergy"
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={handleClose} title="Add Allergy" size="md">
        <Stack gap="sm">
          <Select
            label="Allergy Type"
            data={ALLERGY_TYPE_OPTIONS}
            value={allergyType}
            onChange={(val) => {
              setAllergyType(val);
              setAllergenName("");
            }}
            required
          />
          {allergyType === "drug" ? (
            <DrugSearchSelect
              value={allergenName}
              onChange={(_id, drug) => setAllergenName(drug?.name ?? "")}
              label="Drug"
              required
            />
          ) : (
            <TextInput
              label="Allergen Name"
              placeholder="e.g., Peanuts, Latex, Dust"
              value={allergenName}
              onChange={(e) => setAllergenName(e.currentTarget.value)}
              required
            />
          )}
          <Select
            label="Severity"
            data={SEVERITY_OPTIONS}
            value={severity}
            onChange={setSeverity}
            clearable
          />
          <TextInput
            label="Reaction"
            placeholder="e.g., Rash, Anaphylaxis, Itching"
            value={reaction}
            onChange={(e) => setReaction(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!allergyType || !allergenName.trim()}
            >
              Add Allergy
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Visits Tab ─────────────────────────────────────────────

function VisitsTab({ patientId }: { patientId: string }) {
  const { data: visits, isLoading } = useQuery({
    queryKey: ["patient-visits", patientId],
    queryFn: () => api.listPatientVisits(patientId),
  });

  if (isLoading) return <Loader size="sm" />;

  if (!visits || visits.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No visit history found.
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Date</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Doctor</Table.Th>
          <Table.Th>Department</Table.Th>
          <Table.Th>Chief Complaint</Table.Th>
          <Table.Th>Dx</Table.Th>
          <Table.Th>Rx</Table.Th>
          <Table.Th>Lab</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {visits.map((v: PatientVisitRow) => (
          <Table.Tr key={v.id}>
            <Table.Td>
              <Text size="sm" fw={500}>
                {formatDate(v.encounter_date)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge variant="light" size="sm" tt="uppercase">
                {v.encounter_type}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{v.doctor_name ?? "-"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{v.department_name ?? "-"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" lineClamp={1}>
                {v.chief_complaint ?? "-"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" ta="center">
                {v.diagnosis_count ?? 0}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" ta="center">
                {v.prescription_count ?? 0}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" ta="center">
                {v.lab_order_count ?? 0}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge
                color={STATUS_COLORS[v.status] ?? "gray"}
                variant="light"
                size="sm"
              >
                {v.status.replace(/_/g, " ")}
              </Badge>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Prescriptions Tab ────────────────────────────────────────

function PrescriptionsTab({ patient }: { patient: Patient }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["patient-prescriptions", patient.id],
    queryFn: () => api.listPatientPrescriptions(patient.id),
  });

  const { data: allergies } = useQuery({
    queryKey: ["patient-allergies", patient.id],
    queryFn: () => api.listPatientAllergies(patient.id),
  });

  if (isLoading) return <Loader size="sm" />;

  const items = (history ?? []) as PrescriptionHistoryItem[];

  if (items.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No prescriptions found.
      </Text>
    );
  }

  const allergyNames = (allergies ?? []).map((a: PatientAllergy) => a.allergen_name);
  const fullName = `${patient.first_name} ${patient.middle_name ?? ""} ${patient.last_name}`.trim();
  const patientAge = age(patient.date_of_birth);

  return (
    <PrescriptionViews
      prescriptions={items}
      patientName={fullName}
      uhid={patient.uhid}
      patientAge={patientAge}
      allergies={allergyNames}
      doctorName={items[0]?.doctor_name ?? undefined}
    />
  );
}

// ── Lab Orders Tab ─────────────────────────────────────────

function LabOrdersTab({ patientId }: { patientId: string }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["patient-lab-orders", patientId],
    queryFn: () => api.listPatientLabOrders(patientId),
  });

  if (isLoading) return <Loader size="sm" />;

  if (!orders || orders.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No lab orders found.
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Test</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Priority</Table.Th>
          <Table.Th>Ordered By</Table.Th>
          <Table.Th>Results</Table.Th>
          <Table.Th>Ordered</Table.Th>
          <Table.Th>Updated</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {orders.map((o: PatientLabOrderRow) => (
          <Table.Tr key={o.id}>
            <Table.Td>
              <Text size="sm" fw={500}>
                {o.test_name ?? "-"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge
                color={LAB_STATUS_COLORS[o.status] ?? "gray"}
                variant="light"
                size="sm"
              >
                {o.status.replace(/_/g, " ")}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Badge
                color={o.priority === "stat" ? "danger" : o.priority === "urgent" ? "orange" : "gray"}
                variant="light"
                size="sm"
              >
                {o.priority}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{o.ordered_by_name ?? "-"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" ta="center">
                {o.result_count ?? 0}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{formatDate(o.created_at)}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{formatDate(o.updated_at)}</Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Billing Tab ────────────────────────────────────────────

function BillingTab({ patientId }: { patientId: string }) {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["patient-invoices", patientId],
    queryFn: () => api.listPatientInvoices(patientId),
  });

  const totals = useMemo(() => {
    if (!invoices) return { total: 0, paid: 0, balance: 0 };
    return invoices.reduce(
      (acc, inv) => ({
        total: acc.total + parseFloat(inv.total_amount),
        paid: acc.paid + parseFloat(inv.paid_amount),
        balance: acc.balance + parseFloat(inv.balance),
      }),
      { total: 0, paid: 0, balance: 0 },
    );
  }, [invoices]);

  if (isLoading) return <Loader size="sm" />;

  if (!invoices || invoices.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No invoices found.
      </Text>
    );
  }

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">
            Total Billed
          </Text>
          <Text size="lg" fw={700}>
            {"\u20B9"}{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </Text>
        </Card>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">
            Paid
          </Text>
          <Text size="lg" fw={700} c="success">
            {"\u20B9"}{totals.paid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </Text>
        </Card>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">
            Balance
          </Text>
          <Text size="lg" fw={700} c={totals.balance > 0 ? "danger" : "success"}>
            {"\u20B9"}{totals.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </Text>
        </Card>
      </SimpleGrid>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Invoice #</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Items</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
            <Table.Th ta="right">Paid</Table.Th>
            <Table.Th ta="right">Balance</Table.Th>
            <Table.Th>Date</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {invoices.map((inv: PatientInvoiceRow) => (
            <Table.Tr key={inv.id}>
              <Table.Td>
                <Text size="sm" fw={500} ff="monospace">
                  {inv.invoice_number}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge
                  color={INVOICE_STATUS_COLORS[inv.status] ?? "gray"}
                  variant="light"
                  size="sm"
                >
                  {inv.status.replace(/_/g, " ")}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" ta="center">
                  {inv.item_count ?? 0}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm">
                  {"\u20B9"}{parseFloat(inv.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm" c="success">
                  {"\u20B9"}{parseFloat(inv.paid_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text
                  size="sm"
                  c={parseFloat(inv.balance) > 0 ? "danger" : undefined}
                >
                  {"\u20B9"}{parseFloat(inv.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{formatDate(inv.created_at)}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

// ── Appointments Tab ───────────────────────────────────────

function AppointmentsTab({ patientId }: { patientId: string }) {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["patient-appointments", patientId],
    queryFn: () => api.listPatientAppointments(patientId),
  });

  if (isLoading) return <Loader size="sm" />;

  if (!appointments || appointments.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No appointments found.
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Date</Table.Th>
          <Table.Th>Time</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Doctor</Table.Th>
          <Table.Th>Department</Table.Th>
          <Table.Th>Reason</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {appointments.map((a: PatientAppointmentRow) => (
          <Table.Tr key={a.id}>
            <Table.Td>
              <Text size="sm" fw={500}>
                {formatDate(a.appointment_date)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Group gap={4}>
                <IconClock size={14} />
                <Text size="sm">
                  {formatTime(a.slot_start)} - {formatTime(a.slot_end)}
                </Text>
              </Group>
            </Table.Td>
            <Table.Td>
              <Badge variant="light" size="sm">
                {a.appointment_type.replace(/_/g, " ")}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{a.doctor_name ?? "-"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{a.department_name ?? "-"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" lineClamp={1} c={a.reason ? undefined : "dimmed"}>
                {a.reason ?? "-"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge
                color={APPT_STATUS_COLORS[a.status] ?? "gray"}
                variant="light"
                size="sm"
              >
                {a.status.replace(/_/g, " ")}
              </Badge>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Main Patient Detail Page ───────────────────────────────

// ── Family Links Tab (Detail Page) ─────────────────────────

const RELATIONSHIP_OPTIONS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "spouse", label: "Spouse" },
  { value: "child", label: "Child" },
  { value: "sibling", label: "Sibling" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
];

function DetailFamilyLinksTab({ patientId }: { patientId: string }) {
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedRelated, setSelectedRelated] = useState<Patient | null>(null);
  const [relationship, setRelationship] = useState<string | null>("spouse");

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["patient-family-links", patientId],
    queryFn: () => api.listFamilyLinks(patientId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateFamilyLinkRequest) =>
      api.createFamilyLink(patientId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-family-links", patientId] });
      notifications.show({ title: "Linked", message: "Family member linked", color: "success" });
      handleClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) => api.deleteFamilyLink(patientId, linkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-family-links", patientId] });
    },
  });

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    try {
      const result = await api.listPatients({ page: 1, per_page: 5, search: searchTerm.trim() });
      setSearchResults(result.patients.filter((p) => p.id !== patientId));
    } catch {
      setSearchResults([]);
    }
  };

  const handleClose = () => {
    close();
    setSearchTerm("");
    setSearchResults([]);
    setSelectedRelated(null);
    setRelationship("spouse");
  };

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="md">
      {canUpdate && (
        <Group justify="flex-end">
          <Button leftSection={<IconPlus size={14} />} size="sm" onClick={open}>
            Link Family Member
          </Button>
        </Group>
      )}

      {(links as FamilyLinkRow[]).length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No family links</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Relationship</Table.Th>
              <Table.Th>UHID</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Phone</Table.Th>
              <Table.Th>Gender</Table.Th>
              {canUpdate && <Table.Th w={40} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(links as FamilyLinkRow[]).map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td><Badge size="sm" variant="light">{l.relationship}</Badge></Table.Td>
                <Table.Td><Text size="sm" fw={500}>{l.related_uhid ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="sm">{l.related_name ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="sm">{l.related_phone ?? "—"}</Text></Table.Td>
                <Table.Td><Text size="sm">{l.related_gender ?? "—"}</Text></Table.Td>
                {canUpdate && (
                  <Table.Td>
                    <ActionIcon variant="light" color="danger" size="sm" onClick={() => deleteMutation.mutate(l.id)} aria-label="Delete">
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={handleClose} title="Link Family Member">
        <Stack gap="sm">
          <Group>
            <TextInput placeholder="Search by UHID, name or phone" value={searchTerm} onChange={(e) => setSearchTerm(e.currentTarget.value)} style={{ flex: 1 }} />
            <Button size="sm" onClick={handleSearch}>Search</Button>
          </Group>
          {searchResults.length > 0 && (
            <Table>
              <Table.Tbody>
                {searchResults.map((p) => (
                  <Table.Tr key={p.id} style={{ cursor: "pointer", background: selectedRelated?.id === p.id ? "var(--mantine-color-blue-light)" : undefined }} onClick={() => setSelectedRelated(p)}>
                    <Table.Td><Text size="sm" fw={500}>{p.uhid}</Text></Table.Td>
                    <Table.Td><Text size="sm">{p.first_name} {p.last_name}</Text></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{p.phone}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {selectedRelated && (
            <Alert color="primary">Selected: {selectedRelated.uhid} — {selectedRelated.first_name} {selectedRelated.last_name}</Alert>
          )}
          <Select label="Relationship" data={RELATIONSHIP_OPTIONS} value={relationship} onChange={setRelationship} required />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>Cancel</Button>
            <Button onClick={() => { if (selectedRelated && relationship) createMutation.mutate({ related_patient_id: selectedRelated.id, relationship }); }} loading={createMutation.isPending} disabled={!selectedRelated || !relationship}>Link</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Documents Tab (Detail Page) ────────────────────────────

const DOCUMENT_TYPE_OPTIONS = [
  { value: "id_proof", label: "ID Proof" },
  { value: "consent_form", label: "Consent Form" },
  { value: "referral_letter", label: "Referral Letter" },
  { value: "photo", label: "Photo" },
  { value: "report", label: "Report" },
  { value: "prescription", label: "Prescription" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "insurance_card", label: "Insurance Card" },
  { value: "other", label: "Other" },
];

function DetailDocumentsTab({ patientId }: { patientId: string }) {
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [docType, setDocType] = useState<string | null>("id_proof");
  const [docName, setDocName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["patient-documents", patientId],
    queryFn: () => api.listPatientDocuments(patientId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDocumentRequest) => api.createPatientDocument(patientId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-documents", patientId] });
      notifications.show({ title: "Added", message: "Document added", color: "success" });
      handleClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => api.deletePatientDocument(patientId, docId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-documents", patientId] });
    },
  });

  const handleClose = () => {
    close();
    setDocType("id_proof");
    setDocName("");
    setFileUrl("");
    setNotes("");
  };

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="md">
      {canUpdate && (
        <Group justify="flex-end">
          <Button leftSection={<IconPlus size={14} />} size="sm" onClick={open}>
            Add Document
          </Button>
        </Group>
      )}

      {(documents as PatientDocument[]).length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No documents uploaded</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Size</Table.Th>
              <Table.Th>Date</Table.Th>
              {canUpdate && <Table.Th w={40} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(documents as PatientDocument[]).map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td><Badge size="sm" variant="light">{d.document_type}</Badge></Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>{d.document_name}</Text>
                  {d.notes && <Text size="xs" c="dimmed" lineClamp={1}>{d.notes}</Text>}
                </Table.Td>
                <Table.Td><Text size="xs" c="dimmed">{d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "—"}</Text></Table.Td>
                <Table.Td><Text size="xs" c="dimmed">{formatDate(d.created_at)}</Text></Table.Td>
                {canUpdate && (
                  <Table.Td>
                    <ActionIcon variant="light" color="danger" size="sm" onClick={() => deleteMutation.mutate(d.id)} aria-label="Delete">
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={handleClose} title="Add Document">
        <Stack gap="sm">
          <Select label="Document Type" data={DOCUMENT_TYPE_OPTIONS} value={docType} onChange={setDocType} required />
          <TextInput label="Document Name" placeholder="e.g. Aadhaar Card" value={docName} onChange={(e) => setDocName(e.currentTarget.value)} required />
          <TextInput label="File URL" placeholder="https://..." value={fileUrl} onChange={(e) => setFileUrl(e.currentTarget.value)} required />
          <Textarea label="Notes" placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>Cancel</Button>
            <Button onClick={() => { if (docType && docName.trim() && fileUrl.trim()) createMutation.mutate({ document_type: docType, document_name: docName.trim(), file_url: fileUrl.trim(), notes: notes.trim() || undefined }); }} loading={createMutation.isPending} disabled={!docType || !docName.trim() || !fileUrl.trim()}>Add</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Merge Tab (Detail Page) ────────────────────────────────

function MergeTab({ patient }: { patient: Patient }) {
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const [mergeReason, setMergeReason] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<Patient | null>(null);
  const [confirmOpen, confirmHandlers] = useDisclosure(false);

  const { data: mergeHistory = [], isLoading } = useQuery({
    queryKey: ["patient-merge-history", patient.id],
    queryFn: () => api.listMergeHistory(patient.id),
  });

  const mergeMutation = useMutation({
    mutationFn: (data: MergePatientRequest) => api.mergePatients(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-merge-history", patient.id] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      notifications.show({ title: "Merged", message: "Patient records merged", color: "success" });
      confirmHandlers.close();
      setSelectedTarget(null);
      setMergeReason("");
    },
  });

  const unmergeMutation = useMutation({
    mutationFn: (historyId: string) => api.unmergePatient(historyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-merge-history", patient.id] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      notifications.show({ title: "Unmerged", message: "Patient records separated", color: "success" });
    },
  });

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="lg">
      {patient.is_merged && (
        <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
          This patient has been merged into another record.
        </Alert>
      )}

      {/* Merge History */}
      <Card withBorder>
        <Title order={5} mb="sm">Merge History</Title>
        {(mergeHistory as PatientMergeHistory[]).length === 0 ? (
          <Text size="sm" c="dimmed">No merge history</Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Surviving</Table.Th>
                <Table.Th>Merged</Table.Th>
                <Table.Th>Reason</Table.Th>
                <Table.Th>Status</Table.Th>
                {canUpdate && <Table.Th w={60} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(mergeHistory as PatientMergeHistory[]).map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td><Text size="xs">{formatDate(h.created_at)}</Text></Table.Td>
                  <Table.Td><Text size="sm" fw={500}>{h.surviving_patient_id.slice(0, 8)}...</Text></Table.Td>
                  <Table.Td><Text size="sm">{h.merged_patient_id.slice(0, 8)}...</Text></Table.Td>
                  <Table.Td><Text size="sm">{h.merge_reason}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={h.unmerged_at ? "gray" : "success"}>
                      {h.unmerged_at ? "Unmerged" : "Active"}
                    </Badge>
                  </Table.Td>
                  {canUpdate && (
                    <Table.Td>
                      {!h.unmerged_at && (
                        <Button size="xs" variant="light" color="orange" onClick={() => unmergeMutation.mutate(h.id)}>
                          Undo
                        </Button>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Merge Another Patient Into This One */}
      {canUpdate && !patient.is_merged && (
        <Card withBorder>
          <Title order={5} mb="sm">Merge Duplicate Into This Patient</Title>
          <Text size="sm" c="dimmed" mb="md">
            Search for a duplicate patient record and merge it into this one. The duplicate will be deactivated.
          </Text>
          <PatientSearchSelect
            value={selectedTarget?.id ?? ""}
            onChange={(id) => {
              if (!id) { setSelectedTarget(null); return; }
              api.getPatient(id).then((p) => setSelectedTarget(p as Patient)).catch(() => setSelectedTarget(null));
            }}
            label="Search duplicate patient"
            placeholder="Search by UHID, name or phone..."
          />
          {selectedTarget && (
            <Stack gap="sm" mt="md">
              {/* Side-by-side comparison */}
              <Card withBorder bg="var(--fc-panel, #f7f8f6)" p="md">
                <Text size="xs" fw={700} c="dimmed" mb="sm" tt="uppercase" ff="var(--font-mono, monospace)" style={{ letterSpacing: "0.14em" }}>
                  Compare Before Merging
                </Text>
                <SimpleGrid cols={2}>
                  <Stack gap={4}>
                    <Badge color="success" variant="light" size="sm" mb={4}>Surviving Record (this patient)</Badge>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>UHID</Text><Text size="sm" fw={600}>{patient.uhid}</Text></Group>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>Name</Text><Text size="sm">{patient.first_name} {patient.last_name}</Text></Group>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>Phone</Text><Text size="sm">{patient.phone ?? "—"}</Text></Group>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>DOB</Text><Text size="sm">{patient.date_of_birth ?? "—"}</Text></Group>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>Gender</Text><Text size="sm">{patient.gender}</Text></Group>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>Category</Text><Badge size="xs" variant="light">{patient.category}</Badge></Group>
                  </Stack>
                  <Stack gap={4}>
                    <Badge color="warning" variant="light" size="sm" mb={4}>Duplicate (will be deactivated)</Badge>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>UHID</Text><Text size="sm" fw={600}>{selectedTarget.uhid}</Text></Group>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>Name</Text><Text size="sm">{selectedTarget.first_name} {selectedTarget.last_name}</Text></Group>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>Phone</Text><Text size="sm">{selectedTarget.phone ?? "—"}</Text></Group>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>DOB</Text><Text size="sm">{selectedTarget.date_of_birth ?? "—"}</Text></Group>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>Gender</Text><Text size="sm">{selectedTarget.gender}</Text></Group>
                    <Group gap="xs"><Text size="xs" c="dimmed" w={60}>Category</Text><Badge size="xs" variant="light">{selectedTarget.category}</Badge></Group>
                  </Stack>
                </SimpleGrid>
              </Card>

              <Alert color="warning" variant="light">
                All visits, prescriptions, lab orders, and billing records from <b>{selectedTarget.uhid}</b> will be transferred to <b>{patient.uhid}</b>.
              </Alert>
              <Textarea label="Merge Reason" placeholder="Why are these records being merged?" value={mergeReason} onChange={(e) => setMergeReason(e.currentTarget.value)} required />
              <Group justify="flex-end">
                <Button variant="subtle" onClick={() => setSelectedTarget(null)}>Cancel</Button>
                <Button color="warning" disabled={!mergeReason.trim()} onClick={confirmHandlers.open}>
                  Merge Records
                </Button>
              </Group>
            </Stack>
          )}
        </Card>
      )}

      {/* Confirmation Modal */}
      <Modal opened={confirmOpen} onClose={confirmHandlers.close} title="Confirm Merge">
        <Alert color="danger" icon={<IconAlertTriangle size={16} />} mb="md">
          This will deactivate {selectedTarget?.uhid} and merge its data into {patient.uhid}. This can be undone later.
        </Alert>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={confirmHandlers.close}>Cancel</Button>
          <Button color="danger" loading={mergeMutation.isPending} onClick={() => {
            if (selectedTarget) {
              mergeMutation.mutate({
                surviving_patient_id: patient.id,
                merged_patient_id: selectedTarget.id,
                merge_reason: mergeReason.trim(),
              });
            }
          }}>
            Confirm Merge
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

// ── Print Patient Card ─────────────────────────────────────

function handlePrintPatientCard(patient: Patient) {
  const win = window.open("", "_blank", "width=400,height=300");
  if (!win) return;
  win.document.write(`
    <html><head><title>Patient Card</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .card { border: 2px solid #333; padding: 16px; width: 350px; border-radius: 8px; }
      .uhid { font-size: 18px; font-weight: bold; color: #1a73e8; }
      .name { font-size: 16px; font-weight: bold; margin: 8px 0 4px; }
      .info { font-size: 12px; color: #555; margin: 2px 0; }
      .footer { font-size: 10px; color: #999; margin-top: 12px; border-top: 1px solid #ddd; padding-top: 8px; }
    </style></head><body>
    <div class="card">
      <div class="uhid">${patient.uhid}</div>
      <div class="name">${patient.first_name} ${patient.middle_name ?? ""} ${patient.last_name}</div>
      <div class="info">Gender: ${patient.gender} | Blood Group: ${patient.blood_group ?? "Unknown"}</div>
      <div class="info">Phone: ${patient.phone}</div>
      <div class="info">DOB: ${patient.date_of_birth ?? "N/A"}</div>
      <div class="info">Category: ${patient.category}</div>
      ${patient.is_vip ? '<div class="info" style="color:orange;font-weight:bold;">VIP Patient</div>' : ""}
      ${patient.is_medico_legal ? '<div class="info" style="color:red;font-weight:bold;">MLC #' + (patient.mlc_number ?? "") + "</div>" : ""}
      <div class="footer">MedBrains HMS &mdash; Printed ${new Date().toLocaleDateString()}</div>
    </div>
    <script>window.print();window.close();</script>
    </body></html>
  `);
  win.document.close();
}

// ══════════════════════════════════════════════════════════
//  Chronic Care Tab — Drug-o-gram, Outcomes, Adherence
// ══════════════════════════════════════════════════════════

const TIMELINE_RANGES = [
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "2y", label: "2 Years" },
  { value: "all", label: "All" },
];

const EVENT_COLORS: Record<string, string> = {
  started: "#40c057",
  dose_changed: "#228be6",
  switched: "#be4bdb",
  discontinued: "#fa5252",
  resumed: "#12b886",
  held: "#fab005",
};

const ENROLLMENT_STATUS_COLORS: Record<string, string> = {
  active: "success",
  completed: "teal",
  discontinued: "orange",
  transferred: "primary",
  lost_to_followup: "danger",
  deceased: "dark",
};

function ChronicCareTab({
  patientId,
}: {
  patientId: string;
}) {
  const [segment, setSegment] = useState("drugogram");
  const canViewTimeline = useHasPermission(P.CHRONIC.TIMELINE_VIEW);
  const canViewOutcomes = useHasPermission(P.CHRONIC.OUTCOMES_VIEW);
  const canViewAdherence = useHasPermission(P.CHRONIC.ADHERENCE_LIST);

  return (
    <Stack gap="md" mt="md">
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        data={[
          ...(canViewTimeline ? [{ value: "drugogram", label: "Drug-o-gram" }] : []),
          ...(canViewOutcomes ? [{ value: "outcomes", label: "Outcomes & Targets" }] : []),
          ...(canViewAdherence ? [{ value: "adherence", label: "Adherence" }] : []),
        ]}
      />

      {segment === "drugogram" && canViewTimeline && (
        <DrugOGramSegment patientId={patientId} />
      )}
      {segment === "outcomes" && canViewOutcomes && <OutcomesSegment patientId={patientId} />}
      {segment === "adherence" && canViewAdherence && <AdherenceSegment patientId={patientId} />}
    </Stack>
  );
}

function getDateRange(range: string): { from_date?: string; to_date?: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  switch (range) {
    case "3m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    case "6m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    case "1y": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    case "2y": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 2);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    default:
      return {};
  }
}

function DrugOGramSegment({
  patientId,
}: {
  patientId: string;
}) {
  const [range, setRange] = useState("1y");
  const dateRange = useMemo(() => getDateRange(range), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["drug-timeline-labs", patientId, range],
    queryFn: () => api.drugTimelineWithLabs(patientId, dateRange),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["interaction-alerts", patientId],
    queryFn: () => api.listInteractionAlerts(patientId),
  });

  const activeAlerts = alerts.filter((a) => a.status === "active");

  const { data: summary } = useQuery({
    queryKey: ["treatment-summary", patientId],
    queryFn: () => api.treatmentSummary(patientId),
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <SegmentedControl
          value={range}
          onChange={setRange}
          data={TIMELINE_RANGES}
          size="xs"
        />
        <Group gap="xs">
          {summary && (
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPrinter size={14} />}
              onClick={() => printTreatmentSummary(summary)}
            >
              Print Summary
            </Button>
          )}
        </Group>
      </Group>

      {/* Polypharmacy Alerts */}
      {activeAlerts.length > 0 && (
        <Alert color="danger" title={`${activeAlerts.length} Drug Interaction Alert(s)`} icon={<IconAlertTriangle size={16} />}>
          <Stack gap={4}>
            {activeAlerts.map((a) => (
              <Group key={a.id} gap="xs">
                <Badge color={a.severity === "contraindicated" ? "danger" : a.severity === "major" ? "orange" : "warning"} size="sm">
                  {a.severity}
                </Badge>
                <Text size="sm">{a.drug_a_name} + {a.drug_b_name}</Text>
                {a.description && <Text size="xs" c="dimmed">{a.description}</Text>}
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

      {isLoading && <Loader size="sm" />}

      {data && <DrugSwimLane data={data} />}
    </Stack>
  );
}

function DrugSwimLane({ data }: { data: DrugTimelineWithLabsResponse }) {
  const { medication_events, active_drugs, lab_series } = data;

  if (medication_events.length === 0 && active_drugs.length === 0) {
    return <Text c="dimmed">No medication timeline events found for this period.</Text>;
  }

  // Group events by drug_name
  const drugEvents = medication_events.reduce<Record<string, MedicationTimelineEvent[]>>((acc, ev) => {
    const list = acc[ev.drug_name] ?? [];
    list.push(ev);
    acc[ev.drug_name] = list;
    return acc;
  }, {});

  const drugNames = Object.keys(drugEvents).sort();

  // Calculate time range
  const allDates = medication_events.map((e) => new Date(e.effective_date).getTime());
  const minDate = allDates.length > 0 ? Math.min(...allDates) : Date.now();
  const maxDate = Math.max(Date.now(), ...allDates);
  const rangeMs = maxDate - minDate || 1;

  const ROW_HEIGHT = 36;
  const LABEL_WIDTH = 180;
  const CHART_WIDTH = 600;
  const totalHeight = drugNames.length * ROW_HEIGHT + 40;

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Text fw={500} mb="sm">Medication Timeline</Text>
        <ScrollArea>
          <svg width={LABEL_WIDTH + CHART_WIDTH + 20} height={totalHeight}>
            {/* Header line */}
            <line x1={LABEL_WIDTH} y1={20} x2={LABEL_WIDTH + CHART_WIDTH} y2={20} stroke="#dee2e6" />
            {/* Date labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const x = LABEL_WIDTH + frac * CHART_WIDTH;
              const d = new Date(minDate + frac * rangeMs);
              return (
                <text key={frac} x={x} y={14} fontSize={10} fill="#868e96" textAnchor="middle">
                  {d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
                </text>
              );
            })}

            {drugNames.map((drug, idx) => {
              const y = 30 + idx * ROW_HEIGHT;
              const events = drugEvents[drug] ?? [];
              const isActive = active_drugs.some((d) => d.drug_name === drug);

              return (
                <g key={drug}>
                  {/* Drug label */}
                  <text x={4} y={y + 14} fontSize={11} fill={isActive ? "#212529" : "#868e96"} fontWeight={isActive ? 600 : 400}>
                    {drug.length > 22 ? `${drug.slice(0, 20)}...` : drug}
                  </text>
                  {/* Row background */}
                  <rect x={LABEL_WIDTH} y={y} width={CHART_WIDTH} height={ROW_HEIGHT - 4} fill={idx % 2 === 0 ? "#f8f9fa" : "#fff"} rx={2} />

                  {/* Event bars and markers */}
                  {events.map((ev, eidx) => {
                    const startX = LABEL_WIDTH + ((new Date(ev.effective_date).getTime() - minDate) / rangeMs) * CHART_WIDTH;
                    const endTs = ev.end_date ? new Date(ev.end_date).getTime() : (ev.event_type === "discontinued" ? new Date(ev.effective_date).getTime() : maxDate);
                    const endX = LABEL_WIDTH + ((endTs - minDate) / rangeMs) * CHART_WIDTH;
                    const color = EVENT_COLORS[ev.event_type] ?? "#868e96";

                    if (ev.event_type === "started" || ev.event_type === "resumed") {
                      return (
                        <g key={eidx}>
                          <rect x={startX} y={y + 8} width={Math.max(endX - startX, 2)} height={14} fill={color} opacity={0.3} rx={3} />
                          <circle cx={startX} cy={y + 15} r={4} fill={color}>
                            <title>{`${ev.event_type}: ${ev.dosage ?? ""} ${ev.frequency ?? ""}`}</title>
                          </circle>
                        </g>
                      );
                    }

                    return (
                      <g key={eidx}>
                        <circle cx={startX} cy={y + 15} r={5} fill={color} stroke="#fff" strokeWidth={1}>
                          <title>{`${ev.event_type}: ${ev.change_reason ?? ev.dosage ?? ""}`}</title>
                        </circle>
                        {ev.event_type === "dose_changed" && (
                          <text x={startX + 8} y={y + 19} fontSize={8} fill={color}>
                            {ev.dosage}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </ScrollArea>

        {/* Legend */}
        <Group gap="md" mt="sm">
          {Object.entries(EVENT_COLORS).map(([type, color]) => (
            <Group key={type} gap={4}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
              <Text size="xs">{type.replace(/_/g, " ")}</Text>
            </Group>
          ))}
        </Group>
      </Card>

      {/* Active drugs */}
      {active_drugs.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">Currently Active Medications</Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Drug</Table.Th>
                <Table.Th>Generic</Table.Th>
                <Table.Th>Dosage</Table.Th>
                <Table.Th>Frequency</Table.Th>
                <Table.Th>Route</Table.Th>
                <Table.Th>Started</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {active_drugs.map((d, i) => (
                <Table.Tr key={i}>
                  <Table.Td><Text fw={500} size="sm">{d.drug_name}</Text></Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{d.generic_name ?? "—"}</Text></Table.Td>
                  <Table.Td>{d.dosage ?? "—"}</Table.Td>
                  <Table.Td>{d.frequency ?? "—"}</Table.Td>
                  <Table.Td>{d.route ?? "—"}</Table.Td>
                  <Table.Td>{d.started_date}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Lab trends */}
      {lab_series.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">Lab Value Trends</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {lab_series.slice(0, 9).map((series) => {
              const points = series.data_points;
              if (points.length === 0) return null;
              const latest = points[points.length - 1]!;
              const atTarget =
                series.target_value != null && latest.numeric_value != null
                  ? latest.numeric_value <= series.target_value
                  : null;
              return (
                <Card key={series.parameter_name} withBorder padding="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>{series.parameter_name}</Text>
                    {atTarget !== null && (
                      <Badge color={atTarget ? "success" : "danger"} size="xs">
                        {atTarget ? "At Target" : "Off Target"}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xl" fw={700} mt={4}>
                    {latest.value} {series.unit ?? ""}
                  </Text>
                  {series.target_value != null && (
                    <Text size="xs" c="dimmed">Target: {series.target_value} {series.unit ?? ""}</Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {points.length} readings | Last: {new Date(latest.result_date).toLocaleDateString()}
                  </Text>
                </Card>
              );
            })}
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}

function OutcomesSegment({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["outcome-dashboard", patientId],
    queryFn: () => api.outcomeDashboard(patientId),
  });

  if (isLoading) return <Loader size="sm" />;
  if (!data) return <Text c="dimmed">No outcome data available.</Text>;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Active Enrollments</Text>
          <Text fw={700} size="xl">{data.active_enrollments}</Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Adherence Rate</Text>
          <Text fw={700} size="xl">
            {data.adherence_rate != null ? `${Math.round(Number(data.adherence_rate))}%` : "N/A"}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Duration</Text>
          <Text fw={700} size="xl">
            {data.enrollment_duration_days != null ? `${data.enrollment_duration_days} days` : "N/A"}
          </Text>
        </Card>
      </SimpleGrid>

      {data.targets.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">Outcome Targets</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {data.targets.map((t) => (
              <Card key={t.target.id} withBorder padding="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>{t.target.parameter_name}</Text>
                  {t.at_target !== null && (
                    <Badge color={t.at_target ? "success" : "danger"} size="xs">
                      {t.at_target ? "At Target" : "Off Target"}
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  Target: {t.target.comparison} {t.target.target_value} {t.target.unit}
                </Text>
                <Text size="lg" fw={600} mt={4}>
                  {t.latest_value != null ? `${t.latest_value} ${t.target.unit}` : "No data"}
                </Text>
                {t.latest_date && (
                  <Text size="xs" c="dimmed">Last: {new Date(t.latest_date).toLocaleDateString()}</Text>
                )}
              </Card>
            ))}
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}

function AdherenceSegment({ patientId }: { patientId: string }) {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["patient-enrollments-chronic", patientId],
    queryFn: () => api.patientEnrollments(patientId),
  });

  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["adherence-summary-detail", selected],
    queryFn: () => api.adherenceSummary(selected ?? ""),
    enabled: !!selected,
  });

  if (activeEnrollments.length === 0 && enrollments.length === 0) {
    return <Text c="dimmed">No chronic care enrollments found.</Text>;
  }

  return (
    <Stack gap="md">
      {/* Enrollment list */}
      <Card withBorder padding="md">
        <Text fw={500} mb="sm">Enrollments</Text>
        <Stack gap="xs">
          {enrollments.map((e) => (
            <Group
              key={e.id}
              justify="space-between"
              style={{ cursor: "pointer", padding: 8, borderRadius: 4, background: selected === e.id ? "#e7f5ff" : undefined }}
              onClick={() => setSelected(e.id)}
            >
              <div>
                <Text size="sm" fw={500}>{e.program_name}</Text>
                <Text size="xs" c="dimmed">Enrolled: {e.enrollment_date}</Text>
              </div>
              <Badge color={ENROLLMENT_STATUS_COLORS[e.status] ?? "gray"}>{e.status.replace(/_/g, " ")}</Badge>
            </Group>
          ))}
        </Stack>
      </Card>

      {/* Adherence summary */}
      {summary && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed" tt="uppercase">Dose Adherence</Text>
              <Text fw={700} size="xl">{Math.round(Number(summary.dose_adherence_pct))}%</Text>
              <Progress
                value={Number(summary.dose_adherence_pct)}
                color={Number(summary.dose_adherence_pct) >= 80 ? "success" : "danger"}
                mt="xs"
              />
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed" tt="uppercase">Doses</Text>
              <Group gap="xs" mt="xs">
                <Badge color="success" variant="light">{summary.doses_taken} taken</Badge>
                <Badge color="danger" variant="light">{summary.doses_missed} missed</Badge>
                <Badge color="warning" variant="light">{summary.doses_late} late</Badge>
              </Group>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed" tt="uppercase">Appointments</Text>
              <Group gap="xs" mt="xs">
                <Badge color="success" variant="light">{summary.appointments_attended} attended</Badge>
                <Badge color="danger" variant="light">{summary.appointments_missed} missed</Badge>
              </Group>
            </Card>
          </SimpleGrid>

          {summary.by_month.length > 0 && (
            <Card withBorder padding="md">
              <Text fw={500} mb="sm">Monthly Adherence</Text>
              {summary.by_month.map((m) => {
                const total = m.taken + m.missed + m.late;
                const pct = total > 0 ? Math.round((m.taken / total) * 100) : 0;
                return (
                  <Group key={m.month} mb="xs">
                    <Text size="sm" w={80}>{m.month}</Text>
                    <Progress value={pct} color={pct >= 80 ? "success" : "danger"} style={{ flex: 1 }} />
                    <Text size="sm" w={40}>{pct}%</Text>
                  </Group>
                );
              })}
            </Card>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function printTreatmentSummary(summary: TreatmentSummaryResponse) {
  const win = window.open("", "_blank");
  if (!win) return;

  const medsRows = summary.current_medications
    .map(
      (m) =>
        `<tr><td>${m.drug_name}</td><td>${m.generic_name ?? ""}</td><td>${m.dosage ?? ""}</td><td>${m.frequency ?? ""}</td><td>${m.route ?? ""}</td><td>${m.started_date}</td></tr>`,
    )
    .join("");

  const diagRows = summary.active_diagnoses
    .map((d) => `<tr><td>${d.diagnosis_name}</td><td>${d.icd_code ?? ""}</td><td>${d.diagnosed_date ?? ""}</td></tr>`)
    .join("");

  const targetRows = summary.targets
    .map(
      (t) =>
        `<tr><td>${t.target.parameter_name}</td><td>${t.target.comparison} ${t.target.target_value} ${t.target.unit}</td><td>${t.latest_value ?? "N/A"}</td><td>${t.at_target === true ? "Yes" : t.at_target === false ? "No" : "N/A"}</td></tr>`,
    )
    .join("");

  win.document.write(`<!DOCTYPE html><html><head><title>Treatment Summary</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h1{font-size:16px;margin-bottom:4px}
      h2{font-size:14px;margin:16px 0 4px;border-bottom:1px solid #ccc;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ddd;padding:4px 8px;text-align:left;font-size:11px}
      th{background:#f5f5f5;font-weight:600}
      .header{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:16px}
    </style>
  </head><body>
    <div class="header">
      <div><h1>Treatment Summary</h1><p>Generated: ${new Date().toLocaleDateString()}</p></div>
      <div style="text-align:right"><p><b>${summary.patient_name}</b><br/>UHID: ${summary.uhid}<br/>DOB: ${summary.date_of_birth ?? "N/A"}<br/>Gender: ${summary.gender ?? "N/A"}</p></div>
    </div>
    <h2>Active Diagnoses</h2>
    <table><tr><th>Diagnosis</th><th>ICD Code</th><th>Date</th></tr>${diagRows || "<tr><td colspan=3>None</td></tr>"}</table>
    <h2>Current Medications</h2>
    <table><tr><th>Drug</th><th>Generic</th><th>Dosage</th><th>Frequency</th><th>Route</th><th>Started</th></tr>${medsRows || "<tr><td colspan=6>None</td></tr>"}</table>
    <h2>Outcome Targets</h2>
    <table><tr><th>Parameter</th><th>Target</th><th>Latest</th><th>At Target</th></tr>${targetRows || "<tr><td colspan=4>None set</td></tr>"}</table>
    <h2>Adherence Rate</h2>
    <p>${summary.adherence_rate != null ? `${Math.round(Number(summary.adherence_rate))}%` : "No adherence data"}</p>
    <h2>Program Enrollments</h2>
    <table><tr><th>Program</th><th>Enrolled</th><th>Status</th></tr>${summary.enrollments.map((e) => `<tr><td>${e.program_name}</td><td>${e.enrollment_date}</td><td>${e.status}</td></tr>`).join("")}</table>
    <script>window.print();window.close();</script>
  </body></html>`);
  win.document.close();
}

export function PatientDetailPage() {
  useRequirePermission(P.PATIENTS.VIEW);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  const canCreateVisit = useHasPermission(P.OPD.VISIT_CREATE);
  const canAdmit = useHasPermission(P.IPD.ADMISSIONS_CREATE);

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => api.getPatient(id!),
    enabled: !!id,
  });

  if (isLoading || !patient) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading patient...</Text>
      </Stack>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${patient.first_name} ${patient.last_name}`}
        subtitle={`UHID: ${patient.uhid} | ${patient.gender} | ${age(patient.date_of_birth)} | ${patient.phone}`}
        actions={
          <Group gap="xs">
            {canUpdate && (
              <Tooltip label="Edit Patient">
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconPencil size={14} />}
                  onClick={() => navigate(`/patients/${patient.id}/edit`)}
                >
                  Edit
                </Button>
              </Tooltip>
            )}
            {canCreateVisit && (
              <Button
                variant="light"
                size="sm"
                leftSection={<IconStethoscope size={14} />}
                onClick={() => navigate(`/opd?action=new&patient_id=${patient.id}`)}
              >
                New OPD Visit
              </Button>
            )}
            {canAdmit && (
              <Button
                variant="light"
                size="sm"
                leftSection={<IconBed size={14} />}
                onClick={() => navigate(`/ipd?action=admit&patient_id=${patient.id}`)}
              >
                Admit to IPD
              </Button>
            )}
            <Tooltip label="Print patient card">
              <ActionIcon variant="light" onClick={() => handlePrintPatientCard(patient)} aria-label="Print">
                <IconPrinter size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        }
      />

      <Group gap="xs" mb="md">
        <Badge color="primary" variant="light">
          {patient.category}
        </Badge>
        <Badge color="gray" variant="light">
          {patient.financial_class}
        </Badge>
        {patient.blood_group && (
          <Badge color="danger" variant="light">
            {patient.blood_group}
          </Badge>
        )}
        {patient.is_vip && (
          <Badge color="violet" variant="light">
            VIP
          </Badge>
        )}
        {patient.is_medico_legal && (
          <Badge color="danger" variant="filled">
            MLC
          </Badge>
        )}
      </Group>

      <Tabs defaultValue="overview" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="overview" leftSection={<IconUser size={14} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="allergies" leftSection={<IconAlertTriangle size={14} />}>
            Allergies
          </Tabs.Tab>
          <Tabs.Tab value="visits" leftSection={<IconStethoscope size={14} />}>
            Visits
          </Tabs.Tab>
          <Tabs.Tab value="prescriptions" leftSection={<IconPill size={14} />}>
            Prescriptions
          </Tabs.Tab>
          <Tabs.Tab value="lab" leftSection={<IconFlask size={14} />}>
            Lab Orders
          </Tabs.Tab>
          <Tabs.Tab value="billing" leftSection={<IconReceipt size={14} />}>
            Billing
          </Tabs.Tab>
          <Tabs.Tab value="appointments" leftSection={<IconCalendar size={14} />}>
            Appointments
          </Tabs.Tab>
          <Tabs.Tab value="family" leftSection={<IconLink size={14} />}>
            Family
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFile size={14} />}>
            Documents
          </Tabs.Tab>
          <Tabs.Tab value="chronic" leftSection={<IconReportMedical size={14} />}>
            Chronic Care
          </Tabs.Tab>
          <Tabs.Tab value="packages" leftSection={<IconReportMedical size={14} />}>
            Packages
          </Tabs.Tab>
          <Tabs.Tab value="merge" leftSection={<IconGitMerge size={14} />}>
            Merge
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          <OverviewTab patient={patient} />
        </Tabs.Panel>
        <Tabs.Panel value="allergies">
          <AllergiesTab patient={patient} />
        </Tabs.Panel>
        <Tabs.Panel value="visits">
          <VisitsTab patientId={patient.id} />
        </Tabs.Panel>
        <Tabs.Panel value="prescriptions">
          <PrescriptionsTab patient={patient} />
        </Tabs.Panel>
        <Tabs.Panel value="lab">
          <LabOrdersTab patientId={patient.id} />
        </Tabs.Panel>
        <Tabs.Panel value="billing">
          <BillingTab patientId={patient.id} />
        </Tabs.Panel>
        <Tabs.Panel value="appointments">
          <AppointmentsTab patientId={patient.id} />
        </Tabs.Panel>
        <Tabs.Panel value="family">
          <DetailFamilyLinksTab patientId={patient.id} />
        </Tabs.Panel>
        <Tabs.Panel value="documents">
          <DetailDocumentsTab patientId={patient.id} />
        </Tabs.Panel>
        <Tabs.Panel value="chronic">
          <ChronicCareTab patientId={patient.id} />
        </Tabs.Panel>
        <Tabs.Panel value="packages">
          <ActivePackagesSection patientId={patient.id} />
        </Tabs.Panel>
        <Tabs.Panel value="merge">
          <MergeTab patient={patient} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
