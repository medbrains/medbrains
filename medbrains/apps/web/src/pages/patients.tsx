import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Modal,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconBolt,
  IconEye,
  IconSearch,
  IconStarFilled,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  BloodGroup,
  CreatePatientRequest,
  FinancialClass,
  Gender,
  MaritalStatus,
  Patient,
  PatientCategory,
  RegistrationSource,
  RegistrationType,
  MpiMatchResult,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { DataTable, DynamicForm, PageHeader, StatusDot } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

const PER_PAGE = 20;

// #region Helpers

const genderColors: Record<string, string> = {
  male: "primary",
  female: "danger",
  other: "violet",
  unknown: "slate",
};

const categoryColors: Record<string, string> = {
  general: "slate",
  private: "teal",
  insurance: "primary",
  pmjay: "orange",
  cghs: "info",
  staff: "success",
  vip: "warning",
  mlc: "danger",
  esi: "lime",
  corporate: "violet",
  free: "primary",
  charity: "danger",
  research_subject: "violet",
  staff_dependent: "green.3",
};

const bloodGroupLabels: Record<string, string> = {
  a_positive: "A+",
  a_negative: "A-",
  b_positive: "B+",
  b_negative: "B-",
  ab_positive: "AB+",
  ab_negative: "AB-",
  o_positive: "O+",
  o_negative: "O-",
  unknown: "Unknown",
};

const registrationTypeLabels: Record<string, string> = {
  new: "Registered",
  revisit: "Active",
  transfer_in: "Transfer",
  referral: "Referred",
  emergency: "Emergency",
  camp: "Camp",
  telemedicine: "Telemedicine",
  pre_registration: "Pre-Registration",
};

function buildFullName(patient: Patient): string {
  const parts = [
    patient.prefix,
    patient.first_name,
    patient.middle_name,
    patient.last_name,
    patient.suffix,
  ].filter(Boolean);
  return parts.join(" ");
}

/** Map form field_code flat data from DynamicForm into CreatePatientRequest */
function mapFormDataToRequest(
  data: Record<string, unknown>,
): CreatePatientRequest {
  const address: Record<string, unknown> = {};
  const attributes: Record<string, unknown> = {};

  const directFields = new Set([
    "patient.first_name",
    "patient.last_name",
    "patient.date_of_birth",
    "patient.biological_sex",
    "patient.phone_primary",
    "patient.email",
    "patient.category",
    "patient.prefix",
    "patient.middle_name",
    "patient.suffix",
    "patient.father_name",
    "patient.guardian_name",
    "patient.guardian_relation",
    "patient.marital_status",
    "patient.religion",
    "patient.blood_group",
    "patient.occupation",
    "patient.phone_secondary",
    "patient.registration_type",
    "patient.registration_source",
    "patient.financial_class",
    "patient.is_medico_legal",
    "patient.mlc_number",
    "patient.is_vip",
  ]);

  for (const [key, value] of Object.entries(data)) {
    if (directFields.has(key) || !value) continue;
    if (key.startsWith("patient_addresses.")) {
      const field = key.replace("patient_addresses.", "");
      address[field] = value;
    } else {
      const attrKey = key.startsWith("patient.") ? key.slice(8) : key;
      attributes[attrKey] = value;
    }
  }

  const rawGender = data["patient.biological_sex"] as string | undefined;
  const gender = mapGender(rawGender);
  const rawCategory = data["patient.category"] as string | undefined;
  const category = mapCategory(rawCategory);

  return {
    first_name: (data["patient.first_name"] as string) ?? "",
    last_name: (data["patient.last_name"] as string) ?? "",
    date_of_birth: (data["patient.date_of_birth"] as string) || null,
    gender,
    phone: (data["patient.phone_primary"] as string) ?? "",
    email: (data["patient.email"] as string) || null,
    address: Object.keys(address).length > 0 ? address : null,
    category,
    prefix: (data["patient.prefix"] as string) || undefined,
    middle_name: (data["patient.middle_name"] as string) || undefined,
    suffix: (data["patient.suffix"] as string) || undefined,
    father_name: (data["patient.father_name"] as string) || undefined,
    guardian_name: (data["patient.guardian_name"] as string) || undefined,
    guardian_relation: (data["patient.guardian_relation"] as string) || undefined,
    marital_status: (data["patient.marital_status"] as MaritalStatus) || undefined,
    religion: (data["patient.religion"] as string) || undefined,
    blood_group: (data["patient.blood_group"] as BloodGroup) || undefined,
    occupation: (data["patient.occupation"] as string) || undefined,
    phone_secondary: (data["patient.phone_secondary"] as string) || undefined,
    registration_type: (data["patient.registration_type"] as RegistrationType) || undefined,
    registration_source: (data["patient.registration_source"] as RegistrationSource) || undefined,
    financial_class: (data["patient.financial_class"] as FinancialClass) || undefined,
    is_medico_legal: data["patient.is_medico_legal"] === true || data["patient.is_medico_legal"] === "true" || undefined,
    mlc_number: (data["patient.mlc_number"] as string) || undefined,
    is_vip: data["patient.is_vip"] === true || data["patient.is_vip"] === "true" || undefined,
    attributes,
  };
}

function mapGender(raw: string | undefined): Gender {
  if (!raw) return "unknown";
  const normalized = raw.toLowerCase();
  if (normalized === "male" || normalized === "m") return "male";
  if (normalized === "female" || normalized === "f") return "female";
  if (normalized === "other" || normalized === "transgender") return "other";
  return "unknown";
}

function mapCategory(raw: string | undefined): PatientCategory {
  if (!raw) return "general";
  const normalized = raw.toLowerCase().replace(/[\s-]/g, "_");
  const validCategories: PatientCategory[] = [
    "general",
    "private",
    "insurance",
    "pmjay",
    "cghs",
    "staff",
    "vip",
    "mlc",
    "esi",
    "corporate",
    "free",
    "charity",
    "research_subject",
    "staff_dependent",
  ];
  if (validCategories.includes(normalized as PatientCategory)) {
    return normalized as PatientCategory;
  }
  return "general";
}

// #endregion

export function PatientsPage() {
  useRequirePermission(P.PATIENTS.LIST);
  const { t } = useTranslation("patients");
  const canCreate = useHasPermission(P.PATIENTS.CREATE);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // State
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<MpiMatchResult[]>([]);
  const [pendingRequest, setPendingRequest] = useState<CreatePatientRequest | null>(null);
  const [dupModalOpen, dupModalHandlers] = useDisclosure(false);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ["patients", page, debouncedSearch],
    queryFn: () =>
      api.listPatients({
        page,
        per_page: PER_PAGE,
        search: debouncedSearch || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (req: CreatePatientRequest) => api.createPatient(req),
    onSuccess: (patient) => {
      notifications.show({
        title: "Patient registered",
        message: `UHID: ${patient.uhid}`,
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      setDrawerOpen(false);
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Registration failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleRegisterSubmit = async (data: Record<string, unknown>) => {
    const req = mapFormDataToRequest(data);
    // Check for duplicates via MPI before creating
    try {
      const matches = await api.matchPatients({
        first_name: req.first_name,
        last_name: req.last_name,
        date_of_birth: req.date_of_birth ?? undefined,
        phone: req.phone ?? undefined,
      });
      if (matches.length > 0) {
        setDuplicateMatches(matches);
        setPendingRequest(req);
        dupModalHandlers.open();
        return;
      }
    } catch {
      // If match endpoint fails, proceed with creation
    }
    createMutation.mutate(req);
  };

  const handleCreateAnyway = () => {
    if (pendingRequest) {
      createMutation.mutate(pendingRequest);
    }
    dupModalHandlers.close();
    setPendingRequest(null);
    setDuplicateMatches([]);
  };

  const openRegister = (quick: boolean) => {
    setQuickMode(quick);
    setDrawerOpen(true);
  };

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  const columns = [
    {
      key: "uhid",
      label: "UHID",
      render: (row: Patient) => (
        <Text fw={600} size="sm">
          {row.uhid}
        </Text>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row: Patient) => (
        <Group gap={6}>
          <Text size="sm">{buildFullName(row)}</Text>
          {row.is_vip && (
            <Tooltip label="VIP Patient">
              <ThemeIcon variant="light" color="warning" size="xs">
                <IconStarFilled size={10} />
              </ThemeIcon>
            </Tooltip>
          )}
          {row.is_medico_legal && (
            <Tooltip label={`MLC${row.mlc_number ? ` #${row.mlc_number}` : ""}`}>
              <ThemeIcon variant="light" color="danger" size="xs">
                <IconAlertTriangle size={10} />
              </ThemeIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (row: Patient) => row.phone || "-",
    },
    {
      key: "gender",
      label: "Gender",
      render: (row: Patient) => (
        <StatusDot color={genderColors[row.gender] ?? "slate"} label={row.gender} size="sm" />
      ),
    },
    {
      key: "blood_group",
      label: "Blood Group",
      render: (row: Patient) =>
        row.blood_group && row.blood_group !== "unknown" ? (
          <StatusDot color="danger" label={bloodGroupLabels[row.blood_group] ?? row.blood_group} size="sm" />
        ) : (
          <Text size="sm" c="dimmed">-</Text>
        ),
    },
    {
      key: "category",
      label: "Category",
      render: (row: Patient) => (
        <StatusDot color={categoryColors[row.category] ?? "slate"} label={row.category.replace(/_/g, " ")} size="sm" />
      ),
    },
    {
      key: "registration_type",
      label: "Status",
      render: (row: Patient) => {
        const label = registrationTypeLabels[row.registration_type] ?? row.registration_type;
        const color = row.registration_type === "revisit" ? "success" : row.registration_type === "emergency" ? "danger" : "slate";
        return <StatusDot color={color} label={label} size="sm" />;
      },
    },
    {
      key: "actions",
      label: "",
      render: (row: Patient) => (
        <Tooltip label="Full profile">
          <ActionIcon
            variant="subtle"
            color="teal"
            onClick={() => navigate(`/patients/${row.id}`)}
          >
            <IconUsers size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("title.patients")}
        subtitle={t("subtitle.registration&Records")}
        icon={<IconUsers size={20} stroke={1.5} />}
        color="teal"
        actions={
          <>
            <Button
              variant="light"
              leftSection={<IconBolt size={16} />}
              onClick={() => openRegister(true)}
            >
              Quick Register
            </Button>
            <Button
              leftSection={<IconUserPlus size={16} />}
              onClick={() => openRegister(false)}
              disabled={!canCreate}
            >
              Register Patient
            </Button>
          </>
        }
      />

      <DataTable<Patient>
        columns={columns}
        data={data?.patients ?? []}
        loading={isLoading}
        total={data?.total}
        rowKey={(row) => row.id}
        emptyIcon={<IconUsers size={32} />}
        emptyTitle="No patients found"
        emptyDescription={
          debouncedSearch
            ? "Try adjusting your search terms"
            : "Register your first patient to get started"
        }
        emptyAction={
          !debouncedSearch
            ? { label: "Register Patient", onClick: () => openRegister(false) }
            : undefined
        }
        page={page}
        totalPages={totalPages}
        perPage={PER_PAGE}
        onPageChange={setPage}
        toolbar={
          <TextInput
            placeholder="Search by UHID, name, or phone..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => handleSearchChange(e.currentTarget.value)}
            size="sm"
            style={{ maxWidth: 360 }}
          />
        }
      />

      {/* Registration Drawer */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={quickMode ? "Quick Registration" : "Register Patient"}
        position="right"
        size="100%"
        padding="md"
      >
        <DynamicForm
          formCode="patient_registration"
          quickMode={quickMode}
          onSubmit={handleRegisterSubmit}
          onCancel={() => setDrawerOpen(false)}
          isSubmitting={createMutation.isPending}
          submitLabel="Register"
        />
      </Drawer>

      {/* MPI Duplicate Detection Modal */}
      <Modal opened={dupModalOpen} onClose={() => { dupModalHandlers.close(); setPendingRequest(null); }} title="Potential Duplicates Found" size="lg">
        <Alert color="orange" icon={<IconAlertTriangle size={16} />} mb="md">
          The following existing patients match the registration data. Please verify before creating a new record.
        </Alert>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>UHID</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Phone</Table.Th>
              <Table.Th>Score</Table.Th>
              <Table.Th w={60} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {duplicateMatches.map((m) => (
              <Table.Tr key={m.patient.id}>
                <Table.Td><Text size="sm" fw={500}>{m.patient.uhid}</Text></Table.Td>
                <Table.Td><Text size="sm">{m.patient.first_name} {m.patient.last_name}</Text></Table.Td>
                <Table.Td><Text size="sm">{m.patient.phone ?? "—"}</Text></Table.Td>
                <Table.Td>
                  <Badge size="sm" color={m.score >= 0.8 ? "danger" : "orange"}>
                    {Math.round(m.score * 100)}%
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <ActionIcon variant="light" size="sm" onClick={() => { dupModalHandlers.close(); navigate(`/patients/${m.patient.id}`); }}>
                    <IconEye size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => { dupModalHandlers.close(); setPendingRequest(null); }}>Cancel</Button>
          <Button color="orange" onClick={handleCreateAnyway}>Create Anyway</Button>
        </Group>
      </Modal>
    </div>
  );
}

// #endregion
