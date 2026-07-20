import { Card, Group, Stack, Text, TextInput, ThemeIcon, Tooltip } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { ClinicalJourneyActionId, ClinicalJourneyContext, Patient } from "@medbrains/types";
import { P, PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCash,
  IconCircleCheck,
  IconClock,
  IconDroplet,
  IconGenderFemale,
  IconGenderMale,
  IconSearch,
  IconStarFilled,
  IconUserCheck,
  IconUserPlus,
  IconUserQuestion,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  PageHeader,
  type SortState,
  StatusDot,
  useClinicalEmit,
} from "@/components";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { Badge, Button, IconButton } from "@/components/ui";
import { usePacedQueryValue } from "@/hooks/usePacedQueryValue";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { statusColor } from "@/lib/status-colors";
import { patientsService } from "@/services/patients.service";
import { PatientRegisterPageInner } from "./patients/register-page-inner";
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

function directoryJourneyContext(patient: Patient): ClinicalJourneyContext {
  return {
    patientId: patient.id,
    isDeceased: patient.is_deceased,
  };
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
  const [sort, setSort] = useState<SortState | null>(null);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ["patients", page, debouncedSearch, sort],
    queryFn: async () => {
      const response = await patientsService.listPatients({
        page,
        per_page: PER_PAGE,
        search: debouncedSearch || undefined,
        sort: sort?.key,
        order: sort?.dir,
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
      sortable: true,
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
      sortable: true,
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
      sortable: true,
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
      sortable: true,
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
      sortable: true,
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
      sortable: true,
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
            <Badge tone="danger" leftSection={<IconCash size={12} />}>
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
          <IconButton
            tone="success"
            size={44}
            aria-label={t("label.fullProfile")}
            onClick={() => navigate(`/patients/${row.id}`)}
          >
            <IconUsers size={16} />
          </IconButton>
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
              <Badge tone="success">
                {data?.total == null
                  ? t("directory.loadingRecords")
                  : t("directory.recordCount", { count: data.total })}
              </Badge>
              <Badge tone="info">{t("directory.badge.permissionedFields")}</Badge>
              <Badge tone="warning">{t("directory.badge.pacedSearch")}</Badge>
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
              <Button
                tone="primary"
                leftSection={<IconUserPlus size={16} />}
                onClick={openRegister}
              >
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
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
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
