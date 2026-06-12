import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Modal,
  Stack,
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
import { P, PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCash,
  IconCircleCheck,
  IconClipboardCheck,
  IconClock,
  IconDroplet,
  IconEye,
  IconGenderFemale,
  IconGenderMale,
  IconSearch,
  IconShieldCheck,
  IconStarFilled,
  IconStethoscope,
  IconUserCheck,
  IconUserPlus,
  IconUserQuestion,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  PageHeader,
  StatusDot,
  useClinicalEmit,
} from "@/components";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { statusColor } from "@/lib/status-colors";
import {
  PatientRegisterForm,
  type PatientRegistrationLinkedServicesOptions,
} from "@/components/Patient/PatientRegisterForm";
import { usePacedQueryValue } from "@/hooks/usePacedQueryValue";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { opdService } from "@/services/opd.service";
import { patientsService } from "@/services/patients.service";
import { patientRegistrationOpdHandoffRoute } from "./patient-registration-flow";
import classes from "./patients.module.scss";

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

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

// #endregion

export function PatientsPage() {
  return (
    <ClinicalEventProvider moduleCode="patients" contextCode="patient-directory">
      <PatientsPageInner />
    </ClinicalEventProvider>
  );
}

function PatientsPageInner() {
  useRequirePermission(P.PATIENTS.LIST);
  const { t } = useTranslation("patients");
  const canCreate = useHasPermission(P.PATIENTS.CREATE);
  const navigate = useNavigate();
  const emit = useClinicalEmit();

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
    queryFn: async () => {
      const response = await patientsService.listPatients({
        page,
        per_page: PER_PAGE,
        search: debouncedSearch || undefined,
      });
      const trimmedSearch = debouncedSearch.trim();
      if (trimmedSearch.length > 0) {
        emit("patient.search.completed", {
          source_record_id: `patient-search:${page}:${trimmedSearch.length}:${response.total}`,
          search_id: `patient-search:${page}:${trimmedSearch.length}:${response.total}`,
          page,
          query_length: trimmedSearch.length,
          result_count: response.total,
        });
      }
      return response;
    },
  });

  const openRegister = () => {
    navigate("/patients/register");
  };

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  const columns = [
    {
      key: "uhid",
      label: t("label.uhid"),
      fieldAccessKey: PATIENT_UHID_FIELD_ACCESS_KEY,
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
      label: t("name"),
      fieldAccessKeys: PATIENT_NAME_FIELD_ACCESS_KEYS,
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
              <Tooltip label={t("label.vipPatient")}>
                <ThemeIcon variant="light" color="warning" size="xs">
                  <IconStarFilled size={10} />
                </ThemeIcon>
              </Tooltip>
            )}
            {row.is_medico_legal && (
              <Tooltip
                label={
                  row.mlc_number
                    ? t("directory.tooltip.mlcWithNumber", { number: row.mlc_number })
                    : t("directory.tooltip.mlc")
                }
              >
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
      label: t("phone"),
      fieldAccessKey: "patients.phone",
      accessor: (row: Patient) => row.phone,
      fieldKind: "phone",
      render: (row: Patient) => row.phone || "-",
    },
    {
      key: "gender",
      label: t("label.gender"),
      render: (row: Patient) => (
        <StatusDot
          color={genderColors[row.gender] ?? "slate"}
          icon={genderIcon(row.gender)}
          label={t(`options.gender.${row.gender}`, { defaultValue: row.gender })}
          size="sm"
        />
      ),
    },
    {
      key: "blood_group",
      label: t("label.bloodGroup"),
      render: (row: Patient) =>
        row.blood_group && row.blood_group !== "unknown" ? (
          <StatusDot
            color="danger"
            icon={IconDroplet}
            label={t(`options.bloodGroup.${row.blood_group}`, {
              defaultValue: bloodGroupLabels[row.blood_group] ?? row.blood_group,
            })}
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
      label: t("label.category"),
      render: (row: Patient) => (
        <StatusDot
          color={statusColor(row.category) ?? "slate"}
          label={t(`options.category.${row.category}`, {
            defaultValue: row.category.replace(/_/g, " "),
          })}
          size="sm"
        />
      ),
    },
    {
      key: "registration_type",
      label: t("status"),
      render: (row: Patient) => {
        const label = t(`directory.registrationStatus.${row.registration_type}`, {
          defaultValue: row.registration_type,
        });
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
      label: t("directory.column.payment"),
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
          <Tooltip label={t("directory.paymentPendingTooltip", { count: pendingCount || 1 })}>
            <Badge color="danger" variant="light" leftSection={<IconCash size={12} />}>
              {t("directory.paymentPending", { amount: formatMoney(balance) })}
            </Badge>
          </Tooltip>
        );
      },
    },
    {
      key: "next_actions",
      label: t("directory.column.nextActions"),
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
        <Tooltip label={t("label.fullProfile")}>
          <ActionIcon
            variant="subtle"
            color="teal"
            size={44}
            aria-label={t("label.fullProfile")}
            onClick={() => navigate(`/patients/${row.id}`)}
          >
            <IconUsers size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ] satisfies Column<Patient>[];

  return (
    <Stack className={classes.patientDirectory}>
      <PageHeader
        title={t("title.patients")}
        subtitle={t("subtitle.registration&Records")}
        icon={<IconUsers size={20} stroke={1.5} />}
        color="teal"
      />

      <Card withBorder className={classes.directoryCommandBar}>
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              {t("directory.commandTitle")}
            </Text>
            <Group gap="xs">
              <Badge color="teal" variant="light">
                {data?.total == null
                  ? t("directory.loadingRecords")
                  : t("directory.recordCount", { count: data.total })}
              </Badge>
              <Badge color="blue" variant="light">
                {t("directory.badge.permissionedFields")}
              </Badge>
              <Badge color="orange" variant="light">
                {t("directory.badge.pacedSearch")}
              </Badge>
            </Group>
          </Stack>
          <Group gap="xs" className={classes.directoryControls}>
            <TextInput
              placeholder={t("placeholder.searchByUhid,Name,OrPhone...")}
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => handleSearchChange(e.currentTarget.value)}
              size="sm"
              className={classes.directorySearch}
            />
            {canCreate && (
              <Button leftSection={<IconUserPlus size={16} />} onClick={openRegister}>
                {t("actions.registerPatient")}
              </Button>
            )}
          </Group>
        </Group>
      </Card>

      <DataTable<Patient>
        columns={columns}
        data={data?.patients ?? []}
        loading={isLoading}
        total={data?.total}
        rowKey={(row) => row.id}
        emptyIcon={<IconUsers size={32} />}
        emptyTitle={t("directory.empty.title")}
        emptyDescription={
          debouncedSearch
            ? t("directory.empty.searchDescription")
            : t("directory.empty.registerDescription")
        }
        emptyAction={
          !debouncedSearch && canCreate
            ? { label: t("actions.registerPatient"), onClick: openRegister }
            : undefined
        }
        page={page}
        totalPages={totalPages}
        perPage={PER_PAGE}
        onPageChange={setPage}
        virtualized="auto"
        virtualizeAt={40}
        virtualRowHeight={72}
        tableMaxHeight="calc(100vh - 360px)"
      />
    </Stack>
  );
}

export function PatientRegisterPage() {
  useRequirePermission(P.PATIENTS.CREATE);

  return (
    <ClinicalEventProvider moduleCode="patients" contextCode="patient-registration">
      <PatientRegisterPageInner />
    </ClinicalEventProvider>
  );
}

function PatientRegisterPageInner() {
  const { t } = useTranslation("patients");
  const emit = useClinicalEmit();
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
  const backTarget = isCampRegistration && returnTo ? returnTo : "/patients";
  const backLabel =
    isCampRegistration && returnTo ? t("actions.backToCamp") : t("actions.backToPatients");
  const registrationModeLabel = isCampRegistration
    ? (selectedCamp?.name ?? t("registrationPage.mode.camp"))
    : t("registrationPage.mode.hospital");
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
              const queueWarning = errorMessage(error, t("errors.unknown"));
              return {
                patient,
                queueWarning,
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
          const queueWarning = errorMessage(error, t("errors.unknown"));
          return {
            patient,
            queueWarning,
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
        const queueWarning = errorMessage(error, t("errors.unknown"));
        return {
          patient,
          queueWarning,
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
        campRegistrationId,
        returnTo: resultReturnTo,
      } = result;
      emit("patient.created", { patient_id: patient.id });
      if (campId && campRegistrationId) {
        emit("camp.registration.created", {
          camp_id: campId,
          patient_id: patient.id,
          registration_id: campRegistrationId,
        });
      }
      if (encounterId) {
        emit("opd.encounter.created", {
          encounter_id: encounterId,
          patient_id: patient.id,
        });
      }
      notifications.show({
        title: queueWarning
          ? t("notify.patientRegisteredOpdQueuePending")
          : t("notify.patientRegistered"),
        message: queueWarning
          ? t("notify.patientRegisteredQueueWarning", {
              queueWarning,
              uhid: patient.uhid,
            })
          : tokenNumber
            ? t("notify.patientRegisteredWithToken", {
                token: String(tokenNumber).padStart(3, "0"),
                uhid: patient.uhid,
              })
            : t("notify.patientRegisteredWithUhid", { uhid: patient.uhid }),
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
        navigate(
          patientRegistrationOpdHandoffRoute({
            campId,
            campRegistrationId: result.campRegistrationId,
            encounterId,
            patientId: patient.id,
          }),
        );
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
        title: t("notify.registrationFailed"),
        message: err.message || t("errors.unknown"),
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
    <Stack className={classes.registrationWorkspace}>
      <PageHeader
        title={t("registrationPage.title")}
        subtitle={
          isCampRegistration
            ? t("registrationPage.subtitle.camp")
            : t("registrationPage.subtitle.hospital")
        }
        icon={<IconUserPlus size={20} stroke={1.5} />}
        color="teal"
        breadcrumbs={[
          { label: t("title.patients"), href: "/patients" },
          { label: t("registrationPage.title") },
        ]}
        actions={
          <Button
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(backTarget)}
          >
            {backLabel}
          </Button>
        }
      />

      <Card withBorder className={classes.registrationCommandBar}>
        <Group justify="space-between" align="flex-start" gap="sm">
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              {t("registrationPage.contextTitle")}
            </Text>
            <Group gap="xs">
              <Badge color={isCampRegistration ? "green" : "teal"} variant="light">
                {registrationModeLabel}
              </Badge>
              <Badge color="blue" variant="light">
                {t("registrationPage.badge.mpiDuplicateCheck")}
              </Badge>
              <Badge color="orange" variant="light">
                {t("registrationPage.badge.opdQueueLink")}
              </Badge>
            </Group>
          </Stack>
        </Group>
      </Card>

      <Grid align="flex-start" className={classes.registrationGrid}>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack className={classes.registrationMain}>
            {isCampRegistration && campContextLoading ? (
              <Card withBorder>
                <Text c="dimmed">{t("registrationPage.loadingCampContext")}</Text>
              </Card>
            ) : (
              <PatientRegisterForm
                onSubmit={handleRegisterSubmit}
                onCancel={() => navigate(backTarget)}
                isSubmitting={createMutation.isPending}
                submitLabel={t("actions.register")}
                initialValues={campInitialValues}
              />
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card withBorder className={classes.registrationRail}>
            <Stack gap="sm">
              <Stack gap={2}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  {t("registrationPage.checklistTitle")}
                </Text>
                <Text size="sm" fw={700}>
                  {registrationModeLabel}
                </Text>
                {isCampRegistration && selectedCamp?.venue_name && (
                  <Text size="xs" c="dimmed">
                    {selectedCamp.venue_name}
                  </Text>
                )}
              </Stack>
              <Divider />
              <Stack gap="xs">
                <Group gap="xs" align="flex-start" className={classes.railItem}>
                  <IconClipboardCheck size={16} />
                  <Stack gap={0}>
                    <Text size="sm" fw={600}>
                      {t("registrationPage.checklist.minimumSave.title")}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("registrationPage.checklist.minimumSave.description")}
                    </Text>
                  </Stack>
                </Group>
                <Group gap="xs" align="flex-start" className={classes.railItem}>
                  <IconShieldCheck size={16} />
                  <Stack gap={0}>
                    <Text size="sm" fw={600}>
                      {t("registrationPage.checklist.duplicateGuard.title")}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("registrationPage.checklist.duplicateGuard.description")}
                    </Text>
                  </Stack>
                </Group>
                <Group gap="xs" align="flex-start" className={classes.railItem}>
                  <IconStethoscope size={16} />
                  <Stack gap={0}>
                    <Text size="sm" fw={600}>
                      {t("registrationPage.checklist.opdHandoff.title")}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("registrationPage.checklist.opdHandoff.description")}
                    </Text>
                  </Stack>
                </Group>
              </Stack>
              {isCampRegistration && (
                <>
                  <Divider />
                  <Alert color="green" variant="light" icon={<IconUsers size={16} />}>
                    {t("registrationPage.campLinkedAlert")}
                  </Alert>
                </>
              )}
              <Button
                variant="light"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate(backTarget)}
                fullWidth
              >
                {backLabel}
              </Button>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Modal
        opened={dupModalOpen}
        onClose={() => {
          dupModalHandlers.close();
          pendingRegistrationRef.current = null;
        }}
        title={t("title.potentialDuplicatesFound")}
        size="lg"
      >
        <Alert color="orange" icon={<IconAlertTriangle size={16} />} mb="md">
          {t("registrationPage.duplicateAlert")}
        </Alert>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("uhid")}</Table.Th>
              <Table.Th>{t("name")}</Table.Th>
              <Table.Th>{t("phone")}</Table.Th>
              <Table.Th>{t("score")}</Table.Th>
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
                    size={44}
                    aria-label={t("aria.viewDetails")}
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
            {t("cancel")}
          </Button>
          <Button color="orange" onClick={handleCreateAnyway}>
            {t("createAnyway")}
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

// #endregion
