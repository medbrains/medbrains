import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { MpiMatchResult } from "@medbrains/types";
import { P, PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import { IconUsers } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { type Column, DataTable } from "@/components";
import { PrintPatientCardButton } from "@/components/Patients/PatientCard";
import { lookupsService } from "@/services/lookups.service";

interface RegisterMatchesProps {
  /** What the desk typed into the directory search. */
  search: string;
  /** Patients the directory already shows, so a patient is listed once. */
  shown: readonly { id: string }[] | undefined;
}

/** The hospital-wide lookup's floor: two characters match half the register. */
const MIN_LOOKUP_CHARS = 3;

/**
 * Patients the directory cannot show, found in the whole hospital register.
 *
 * The directory lists the patients this user has a relationship with. A
 * returning patient registered by another shift is not among them, so the
 * desk found nothing and registered them a second time. This answers from
 * the desk lookup (`patients.find`, identity only) and lets the desk reprint
 * the patient's card (`patients.card.reprint`) without opening the chart.
 */
export function RegisterMatches({ search, shown }: RegisterMatchesProps) {
  const { t } = useTranslation("patients");
  const canFind = useHasPermission(P.PATIENTS.FIND);
  const query = search.trim();
  const isLookup = canFind && query.length >= MIN_LOOKUP_CHARS;
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-register-lookup", query],
    queryFn: () => lookupsService.findPatients(query),
    enabled: isLookup,
    staleTime: 30_000,
  });
  if (!isLookup) return null;
  const shownIds = new Set((shown ?? []).map((patient) => patient.id));
  const rows = (data ?? []).filter((match) => !shownIds.has(match.id));
  if (!isLoading && !error && rows.length === 0) return null;

  const columns = [
    {
      key: "uhid",
      label: t("label.uhid"),
      fieldAccessKey: PATIENT_UHID_FIELD_ACCESS_KEY,
      accessor: (row: MpiMatchResult) => row.uhid,
      fieldKind: "identifier",
      render: (row: MpiMatchResult) => row.uhid,
    },
    {
      key: "name",
      label: t("name"),
      fieldAccessKeys: PATIENT_NAME_FIELD_ACCESS_KEYS,
      accessor: (row: MpiMatchResult) => `${row.first_name} ${row.last_name}`.trim(),
      fieldKind: "name",
      render: (row: MpiMatchResult) => `${row.first_name} ${row.last_name}`.trim(),
    },
    {
      key: "phone",
      label: t("phone"),
      fieldAccessKey: "patients.phone",
      accessor: (row: MpiMatchResult) => row.phone,
      fieldKind: "phone",
      render: (row: MpiMatchResult) => row.phone || "-",
    },
    {
      key: "card",
      label: t("directory.register.card"),
      render: (row: MpiMatchResult) => (
        <PrintPatientCardButton
          patientId={row.id}
          ariaLabel={t("directory.register.printCardFor", { uhid: row.uhid })}
        />
      ),
    },
  ] satisfies Column<MpiMatchResult>[];

  return (
    <Stack gap="xs" component="section" aria-label={t("directory.register.title")}>
      <Text size="sm" fw={700}>
        {t("directory.register.title")}
      </Text>
      <Text size="xs" c="dimmed">
        {t("directory.register.description")}
      </Text>
      <DataTable<MpiMatchResult>
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error}
        rowKey={(row) => row.id}
        emptyIcon={<IconUsers size={32} />}
        emptyTitle={t("directory.empty.title")}
        emptyDescription={t("directory.empty.searchDescription")}
      />
    </Stack>
  );
}
