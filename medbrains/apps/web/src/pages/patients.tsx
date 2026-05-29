import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { PatientRegistrationInitialValues } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  ClinicalJourneyActionId,
  ClinicalJourneyContext,
  CreatePatientRequest,
  MpiMatchResult,
  Patient,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCash,
  IconCircleCheck,
  IconClock,
  IconDroplet,
  IconEye,
  IconGenderFemale,
  IconGenderMale,
  IconSearch,
  IconStarFilled,
  IconUserCheck,
  IconUserPlus,
  IconUserQuestion,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { type Column, DataTable, PageHeader, StatusDot } from "@/components";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import {
  PatientRegisterForm,
  type PatientRegistrationLinkedServicesOptions,
} from "@/components/Patient/PatientRegisterForm";
import { usePacedQueryValue } from "@/hooks/usePacedQueryValue";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { opdService } from "@/services/opd.service";
import { patientsService } from "@/services/patients.service";

const PER_PAGE = 20;

const DIRECTORY_HIDDEN_JOURNEY_ACTIONS = [
  "patient.edit",
  "patient.share",
  "patient.print_card",
  "orders.medication",
  "orders.lab",
  "orders.radiology",
  "pharmacy.open_patient_queue",
] satisfies readonly ClinicalJourneyActionId[];

// #region Helpers

const genderColors: Record<string, string> = {
  male: "info",
  female: "danger",
  other: "violet",
  unknown: "warning",
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

function formatMoney(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface RegisterPatientMutationInput {
  req: CreatePatientRequest;
  linkedServices?: PatientRegistrationLinkedServicesOptions;
  campContext?: PatientRegistrationCampContext;
}

interface RegisterPatientMutationResult {
  patient: Patient;
  encounterId?: string;
  tokenNumber?: number;
  queueWarning?: string;
  linkedServices?: PatientRegistrationLinkedServicesOptions;
  campId?: string;
  campRegistrationId?: string;
  returnTo?: string;
}

interface PatientRegistrationCampContext {
  campId: string;
  returnTo?: string;
}

function registrationVisitType(req: CreatePatientRequest): string {
  if (req.registration_type === "camp" || req.registration_source === "camp") return "camp";
  if (req.registration_type === "emergency" || req.registration_source === "ambulance") {
    return "emergency";
  }
  if (req.registration_type === "referral" || req.registration_source === "referral") {
    return "referral";
  }
  if (req.registration_type === "revisit") return "follow_up";
  return "walk_in";
}

function genderIcon(gender: string) {
  if (gender === "male") return IconGenderMale;
  if (gender === "female") return IconGenderFemale;
  if (gender === "other") return IconUserCheck;
  return IconUserQuestion;
}

function registrationIcon(registrationType: string) {
  if (registrationType === "revisit") return IconCircleCheck;
  if (registrationType === "emergency") return IconAlertTriangle;
  if (registrationType === "camp") return IconUsers;
  return IconClock;
}

function registrationQueueNotes(req: CreatePatientRequest): string {
  const notes = ["Created from patient registration"];
  if (req.registration_type) notes.push(`Registration type: ${req.registration_type}`);
  if (req.registration_source) notes.push(`Source: ${req.registration_source}`);
  if (req.camp_name) notes.push(`Camp: ${req.camp_name}`);
  if (req.referred_by_name) notes.push(`Referred by: ${req.referred_by_name}`);
  if (req.initial_diagnosis_text)
    notes.push(`Provisional diagnosis: ${req.initial_diagnosis_text}`);
  return notes.join("\n");
}

function patientRegistrationName(req: CreatePatientRequest): string {
  return [req.first_name, req.last_name].filter(Boolean).join(" ").trim() || req.phone;
}

function directoryJourneyContext(patient: Patient): ClinicalJourneyContext {
  return {
    patientId: patient.id,
    isDeceased: patient.is_deceased,
  };
}

function patientAddressText(address: CreatePatientRequest["address"]): string | undefined {
  if (!address || typeof address !== "object" || Array.isArray(address)) return undefined;
  return ["line1", "line2", "landmark", "city", "district", "state", "postal_code", "country"]
    .map((key) => {
      const value = address[key];
      return typeof value === "string" ? value.trim() : "";
    })
    .filter(Boolean)
    .join(", ");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

// #endregion

export function PatientsPage() {
  useRequirePermission(P.PATIENTS.LIST);
  const { t } = useTranslation("patients");
  const canCreate = useHasPermission(P.PATIENTS.CREATE);
  const navigate = useNavigate();

  // State
  const [search, setSearch] = useState("");
  const debouncedSearch = usePacedQueryValue(search, 300);
  const [page, setPage] = useState(1);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ["patients", page, debouncedSearch],
    queryFn: () =>
      patientsService.listPatients({
        page,
        per_page: PER_PAGE,
        search: debouncedSearch || undefined,
      }),
  });

  const openRegister = () => {
    navigate("/patients/register");
  };

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  const columns = [
    {
      key: "uhid",
      label: "UHID",
      fieldAccessKey: "patients.uhid",
      accessor: (row: Patient) => row.uhid,
      fieldKind: "identifier",
      render: (row: Patient) => (
        <Text fw={600} size="sm">
          {row.uhid}
        </Text>
      ),
    },
    {
      key: "name",
      label: "Name",
      fieldAccessKeys: ["patients.first_name", "patients.middle_name", "patients.last_name"],
      accessor: buildFullName,
      fieldKind: "name",
      render: (row: Patient) => {
        const fullName = buildFullName(row);

        return (
          <Group gap={6} wrap="nowrap" maw={280}>
            <Tooltip label={fullName} disabled={fullName.length < 24} withArrow>
              <Text size="sm" truncate>
                {fullName}
              </Text>
            </Tooltip>
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
        );
      },
    },
    {
      key: "phone",
      label: "Phone",
      fieldAccessKey: "patients.phone",
      accessor: (row: Patient) => row.phone,
      fieldKind: "phone",
      render: (row: Patient) => row.phone || "-",
    },
    {
      key: "gender",
      label: "Gender",
      render: (row: Patient) => (
        <StatusDot
          color={genderColors[row.gender] ?? "slate"}
          icon={genderIcon(row.gender)}
          label={row.gender}
          size="sm"
        />
      ),
    },
    {
      key: "blood_group",
      label: "Blood Group",
      render: (row: Patient) =>
        row.blood_group && row.blood_group !== "unknown" ? (
          <StatusDot
            color="danger"
            icon={IconDroplet}
            label={bloodGroupLabels[row.blood_group] ?? row.blood_group}
            size="sm"
          />
        ) : (
          <Text size="sm" c="dimmed">
            -
          </Text>
        ),
    },
    {
      key: "category",
      label: "Category",
      render: (row: Patient) => (
        <StatusDot
          color={categoryColors[row.category] ?? "slate"}
          label={row.category.replace(/_/g, " ")}
          size="sm"
        />
      ),
    },
    {
      key: "registration_type",
      label: "Status",
      render: (row: Patient) => {
        const label = registrationTypeLabels[row.registration_type] ?? row.registration_type;
        const color =
          row.registration_type === "revisit"
            ? "success"
            : row.registration_type === "emergency"
              ? "danger"
              : "slate";
        return (
          <StatusDot
            color={color}
            icon={registrationIcon(row.registration_type)}
            label={label}
            size="sm"
          />
        );
      },
    },
    {
      key: "payment_pending",
      label: "Payment",
      requiredPermissions: [P.BILLING.INVOICES_LIST],
      fieldAccessKey: "billing.amount",
      accessor: (row: Patient) => row.outstanding_balance ?? 0,
      fieldKind: "money",
      render: (row: Patient) => {
        const balance = Number(row.outstanding_balance ?? 0);
        const pendingCount = row.pending_invoice_count ?? 0;
        if (!Number.isFinite(balance) || balance <= 0) {
          return (
            <Text size="sm" c="dimmed">
              -
            </Text>
          );
        }
        return (
          <Tooltip
            label={`${pendingCount || 1} invoice${pendingCount === 1 ? "" : "s"} with pending payment`}
          >
            <Badge color="danger" variant="light" leftSection={<IconCash size={12} />}>
              ₹{formatMoney(balance)} pending
            </Badge>
          </Tooltip>
        );
      },
    },
    {
      key: "next_actions",
      label: "Next Actions",
      render: (row: Patient) => (
        <PatientJourneyActions
          context={directoryJourneyContext(row)}
          hiddenActionIds={DIRECTORY_HIDDEN_JOURNEY_ACTIONS}
          size="xs"
        />
      ),
    },
    {
      key: "actions",
      label: "",
      requiredPermissions: [P.PATIENTS.VIEW],
      render: (row: Patient) => (
        <Tooltip label="Full profile">
          <ActionIcon variant="subtle" color="teal" onClick={() => navigate(`/patients/${row.id}`)}>
            <IconUsers size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ] satisfies Column<Patient>[];

  return (
    <div>
      <PageHeader
        title={t("title.patients")}
        subtitle={t("subtitle.registration&Records")}
        icon={<IconUsers size={20} stroke={1.5} />}
        color="teal"
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
          !debouncedSearch ? { label: "Register Patient", onClick: openRegister } : undefined
        }
        page={page}
        totalPages={totalPages}
        perPage={PER_PAGE}
        onPageChange={setPage}
        virtualized="auto"
        virtualizeAt={40}
        virtualRowHeight={72}
        tableMaxHeight="calc(100vh - 320px)"
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
        tableActions={
          <Button
            leftSection={<IconUserPlus size={16} />}
            onClick={openRegister}
            disabled={!canCreate}
          >
            Register Patient
          </Button>
        }
      />
    </div>
  );
}

export function PatientRegisterPage() {
  useRequirePermission(P.PATIENTS.CREATE);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const source = params.get("source");
  const sourceCampId = params.get("campId") ?? "";
  const returnTo = params.get("returnTo") ?? undefined;
  const isCampRegistration = source === "camp" && Boolean(sourceCampId);
  const { data: camps = [], isLoading: campContextLoading } = useQuery({
    queryKey: ["camp-camps", "patient-registration-page", sourceCampId],
    queryFn: () => patientsService.listCamps(),
    enabled: isCampRegistration,
    staleTime: 300_000,
  });
  const selectedCamp = camps.find((camp) => camp.id === sourceCampId);
  const campInitialValues: PatientRegistrationInitialValues | undefined = isCampRegistration
    ? {
        registration_type: "camp",
        registration_source: "camp",
        camp_id: sourceCampId,
        camp_name: selectedCamp?.name,
        department_id: selectedCamp?.organizing_department_id ?? undefined,
        referred_by_facility: selectedCamp?.venue_name ?? selectedCamp?.name,
        create_opd_visit: true,
        open_opd_after_registration: true,
      }
    : undefined;
  const [duplicateMatches, setDuplicateMatches] = useState<MpiMatchResult[]>([]);
  const pendingRegistrationRef = useRef<RegisterPatientMutationInput | null>(null);
  const [dupModalOpen, dupModalHandlers] = useDisclosure(false);

  const createMutation = useMutation({
    mutationFn: async ({
      req,
      linkedServices,
      campContext,
    }: RegisterPatientMutationInput): Promise<RegisterPatientMutationResult> => {
      const patient = await patientsService.createPatient(req);
      if (campContext?.campId) {
        try {
          const campRegistration = await campService.createCampRegistration({
            camp_id: campContext.campId,
            person_name: patientRegistrationName(req),
            gender: req.gender,
            phone: req.phone,
            address: patientAddressText(req.address),
            patient_id: patient.id,
            clinical_department_id: req.department_id,
            attending_doctor_id: req.consultant_id,
            chief_complaint: req.initial_diagnosis_text,
            is_walk_in: true,
          });

          if (linkedServices?.createOpdVisit && req.department_id) {
            try {
              const result = await campService.openCampRegistrationEncounter(campRegistration.id, {
                department_id: req.department_id,
                doctor_id: req.consultant_id,
              });
              return {
                patient,
                encounterId: result.encounter_id,
                linkedServices,
                campId: campContext.campId,
                campRegistrationId: campRegistration.id,
                returnTo: campContext.returnTo,
              };
            } catch (error) {
              return {
                patient,
                queueWarning: errorMessage(error),
                linkedServices,
                campId: campContext.campId,
                campRegistrationId: campRegistration.id,
                returnTo: campContext.returnTo,
              };
            }
          }

          return {
            patient,
            linkedServices,
            campId: campContext.campId,
            campRegistrationId: campRegistration.id,
            returnTo: campContext.returnTo,
          };
        } catch (error) {
          return {
            patient,
            queueWarning: errorMessage(error),
            linkedServices,
            campId: campContext.campId,
            returnTo: campContext.returnTo,
          };
        }
      }

      if (!linkedServices?.createOpdVisit || !req.department_id) {
        return { patient, linkedServices };
      }

      try {
        const result = await opdService.createEncounter({
          patient_id: patient.id,
          department_id: req.department_id,
          doctor_id: req.consultant_id,
          visit_type: registrationVisitType(req),
          camp_id: req.camp_id,
          notes: registrationQueueNotes(req),
        });
        return {
          patient,
          encounterId: result.encounter.id,
          tokenNumber: result.queue.token_number,
          linkedServices,
        };
      } catch (error) {
        return {
          patient,
          queueWarning: errorMessage(error),
          linkedServices,
        };
      }
    },
    onSuccess: (result) => {
      const {
        patient,
        queueWarning,
        tokenNumber,
        encounterId,
        linkedServices,
        campId,
        returnTo: resultReturnTo,
      } = result;
      notifications.show({
        title: queueWarning ? "Patient registered, OPD queue pending" : "Patient registered",
        message: queueWarning
          ? `UHID: ${patient.uhid}. OPD queue was not created: ${queueWarning}`
          : tokenNumber
            ? `UHID: ${patient.uhid} · OPD token T${String(tokenNumber).padStart(3, "0")}`
            : `UHID: ${patient.uhid}`,
        color: queueWarning ? "warning" : "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      if (encounterId) {
        void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
        void queryClient.invalidateQueries({ queryKey: ["opd-encounter", encounterId] });
      }
      if (campId) {
        void queryClient.invalidateQueries({ queryKey: ["camp-registrations"] });
      }
      if (encounterId && linkedServices?.openOpdAfterRegistration) {
        if (campId) {
          const query = new URLSearchParams({ source: "camp", campId });
          if (result.campRegistrationId) query.set("registrationId", result.campRegistrationId);
          navigate(`/opd/encounters/${encounterId}?${query.toString()}`);
          return;
        }
        navigate(`/opd/encounters/${encounterId}`);
        return;
      }
      if (campId && resultReturnTo) {
        navigate(resultReturnTo);
        return;
      }
      navigate(`/patients/${patient.id}`);
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Registration failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleRegisterSubmit = async (
    req: CreatePatientRequest,
    linkedServices?: PatientRegistrationLinkedServicesOptions,
  ) => {
    const campContext = isCampRegistration
      ? {
          campId: sourceCampId,
          returnTo,
        }
      : undefined;
    try {
      const matches = await patientsService.matchPatients({
        first_name: req.first_name,
        last_name: req.last_name,
        date_of_birth: req.date_of_birth ?? undefined,
        phone: req.phone ?? undefined,
      });
      if (matches.length > 0) {
        setDuplicateMatches(matches);
        pendingRegistrationRef.current = { req, linkedServices, campContext };
        dupModalHandlers.open();
        return;
      }
    } catch {
      // If MPI matching fails, proceed; registration still needs to work during camp load.
    }
    createMutation.mutate({ req, linkedServices, campContext });
  };

  const handleCreateAnyway = () => {
    if (pendingRegistrationRef.current) {
      createMutation.mutate(pendingRegistrationRef.current);
    }
    dupModalHandlers.close();
    pendingRegistrationRef.current = null;
    setDuplicateMatches([]);
  };

  return (
    <div>
      <PageHeader
        title="Register Patient"
        subtitle={
          isCampRegistration
            ? "Create the hospital patient record from the camp context and keep camp OPD linked."
            : "Create a patient record and link the first OPD workflow when required."
        }
        icon={<IconUserPlus size={20} stroke={1.5} />}
        color="teal"
        breadcrumbs={[{ label: "Patients", href: "/patients" }, { label: "Register Patient" }]}
        actions={
          <Button
            variant="light"
            onClick={() => navigate(isCampRegistration && returnTo ? returnTo : "/patients")}
          >
            {isCampRegistration && returnTo ? "Back to Camp" : "Back to Patients"}
          </Button>
        }
      />
      {isCampRegistration && campContextLoading ? (
        <Text c="dimmed">Loading camp context...</Text>
      ) : (
        <PatientRegisterForm
          onSubmit={handleRegisterSubmit}
          onCancel={() => navigate(isCampRegistration && returnTo ? returnTo : "/patients")}
          isSubmitting={createMutation.isPending}
          submitLabel="Register"
          initialValues={campInitialValues}
        />
      )}

      <Modal
        opened={dupModalOpen}
        onClose={() => {
          dupModalHandlers.close();
          pendingRegistrationRef.current = null;
        }}
        title="Potential Duplicates Found"
        size="lg"
      >
        <Alert color="orange" icon={<IconAlertTriangle size={16} />} mb="md">
          The following existing patients match the registration data. Please verify before creating
          a new record.
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
              <Table.Tr key={m.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {m.uhid}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {m.first_name} {m.last_name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{m.phone || "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" color={m.score >= 0.8 ? "danger" : "orange"}>
                    {Math.round(m.score * 100)}%
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="light"
                    size="sm"
                    onClick={() => {
                      dupModalHandlers.close();
                      navigate(`/patients/${m.id}`);
                    }}
                  >
                    <IconEye size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify="flex-end" mt="md">
          <Button
            variant="subtle"
            onClick={() => {
              dupModalHandlers.close();
              pendingRegistrationRef.current = null;
            }}
          >
            Cancel
          </Button>
          <Button color="orange" onClick={handleCreateAnyway}>
            Create Anyway
          </Button>
        </Group>
      </Modal>
    </div>
  );
}

// #endregion
