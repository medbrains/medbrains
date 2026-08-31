// CAMP ScreeningsTab — split from camp.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { Camp, CampLabSample, CampScreening } from "@medbrains/types";
import {
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  P,
} from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { DataTable, useProtectedFieldAccess } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { campService } from "@/services/camp.service";
import {
  campLabSampleCreatePath,
  campScreeningCreatePath,
  campWorkflowLabel,
  protectedCampParticipantName,
  protectedCampPhone,
} from "./shared";

export function ScreeningsTab({
  campId,
  selectedCamp,
}: {
  campId: string | null;
  selectedCamp: Camp | null;
}) {
  const { t } = useTranslation("camp");
  const navigate = useNavigate();
  const canManageScreenings = useHasPermission(P.CAMP.SCREENINGS_MANAGE);
  const canManageLab = useHasPermission(P.CAMP.LAB_MANAGE);
  const campNameAccess = useProtectedFieldAccess(CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY);
  const campPhoneAccess = useProtectedFieldAccess(CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY);
  const currentCampId = campId;

  const { data: screenings = [], isLoading: scrLoading } = useQuery({
    queryKey: ["camp-screenings", currentCampId],
    queryFn: () =>
      campService.listCampScreenings(currentCampId ? { camp_id: currentCampId } : undefined),
    enabled: !!currentCampId,
  });

  const { data: labSamples = [], isLoading: labLoading } = useQuery({
    queryKey: ["camp-lab-samples", currentCampId],
    queryFn: () =>
      campService.listCampLabSamples(currentCampId ? { camp_id: currentCampId } : undefined),
    enabled: !!currentCampId,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["camp-registrations", currentCampId, "screening-selector"],
    queryFn: () => campService.listCampRegistrations({ camp_id: currentCampId ?? "" }),
    enabled: !!currentCampId,
  });

  const registrationsById = useMemo(
    () => new Map(registrations.map((registration) => [registration.id, registration])),
    [registrations],
  );
  const renderRegistrationCell = (registrationId: string) => {
    const registration = registrationsById.get(registrationId);
    if (!registration) {
      return (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            {t("registrations.unlinkedRegistration")}
          </Text>
          <Text size="xs" c="dimmed">
            {registrationId.slice(0, 8)}
          </Text>
        </Stack>
      );
    }

    return (
      <Stack gap={2}>
        <Text size="sm" fw={600}>
          {protectedCampParticipantName(registration.person_name, campNameAccess)}
        </Text>
        <Text size="xs" c="dimmed">
          {registration.registration_number}
          {registration.phone
            ? ` · ${protectedCampPhone(registration.phone, campPhoneAccess)}`
            : ""}
        </Text>
      </Stack>
    );
  };

  const scrCols: Column<CampScreening>[] = [
    {
      key: "registration_id",
      label: t("screenings.columns.participant"),
      render: (r) => renderRegistrationCell(r.registration_id),
    },
    {
      key: "bp",
      label: t("screenings.columns.bp"),
      render: (r) => (r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : "—"),
    },
    {
      key: "pulse_rate",
      label: t("screenings.columns.pulse"),
      render: (r) => r.pulse_rate?.toString() ?? "—",
    },
    {
      key: "spo2",
      label: t("screenings.columns.spo2"),
      render: (r) => (r.spo2 ? `${r.spo2}%` : "—"),
    },
    {
      key: "blood_sugar_random",
      label: t("screenings.columns.bsr"),
      render: (r) => r.blood_sugar_random?.toString() ?? "—",
    },
    { key: "bmi", label: t("screenings.columns.bmi"), render: (r) => r.bmi?.toString() ?? "—" },
    { key: "findings", label: t("screenings.columns.findings"), render: (r) => r.findings ?? "—" },
    {
      key: "referred",
      label: t("screenings.columns.referred"),
      render: (r) =>
        r.referred_to_hospital ? (
          <Badge tone="warning" size="sm">
            {r.referral_urgency
              ? t(`screenings.referralUrgency.${r.referral_urgency}`, {
                  defaultValue: campWorkflowLabel(r.referral_urgency),
                })
              : t("common.yes")}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            {t("common.no")}
          </Text>
        ),
    },
  ];

  const labCols: Column<CampLabSample>[] = [
    {
      key: "registration_id",
      label: t("screenings.columns.participant"),
      render: (r) => renderRegistrationCell(r.registration_id),
    },
    {
      key: "sample_type",
      label: t("samples.columns.sample"),
      render: (r) => t(`samples.type.${r.sample_type}`, { defaultValue: r.sample_type }),
    },
    {
      key: "test_requested",
      label: t("samples.columns.test"),
      render: (r) => r.test_requested ?? "—",
    },
    { key: "barcode", label: t("samples.columns.barcode"), render: (r) => r.barcode ?? "—" },
    {
      key: "sent_to_lab",
      label: t("samples.columns.sentToLab"),
      render: (r) =>
        r.sent_to_lab ? (
          <Badge tone="success" size="sm">
            {t("common.yes")}
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            {t("common.no")}
          </Badge>
        ),
    },
    {
      key: "result_summary",
      label: t("samples.columns.result"),
      render: (r) => r.result_summary ?? "—",
    },
  ];

  return (
    <>
      {currentCampId ? (
        <Stack>
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={600} size="lg">
                {t("screenings.title")}
              </Text>
              <Text size="xs" c="dimmed">
                {selectedCamp
                  ? `${selectedCamp.camp_code} · ${selectedCamp.name}`
                  : t("common.selectedCamp")}
              </Text>
            </Stack>
            {canManageScreenings && (
              <Button
                tone="primary"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => navigate(campScreeningCreatePath(campId ?? "", "", ""))}
              >
                {t("screenings.actions.recordScreening")}
              </Button>
            )}
          </Group>
          <DataTable
            columns={scrCols}
            data={screenings}
            loading={scrLoading}
            rowKey={(r) => r.id}
          />

          <Group justify="space-between" mt="lg">
            <Text fw={600} size="lg">
              {t("samples.title")}
            </Text>
            {canManageLab && (
              <Button
                tone="primary"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => navigate(campLabSampleCreatePath(campId ?? "", ""))}
              >
                {t("samples.actions.recordSample")}
              </Button>
            )}
          </Group>
          <DataTable
            columns={labCols}
            data={labSamples}
            loading={labLoading}
            rowKey={(r) => r.id}
          />
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" mt="xl">
          {t("screenings.selectActiveCampToView")}
        </Text>
      )}

      {/* Screening Drawer */}

      {/* Lab Sample Drawer */}
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Follow-ups & Conversion Tab
// ══════════════════════════════════════════════════════════
