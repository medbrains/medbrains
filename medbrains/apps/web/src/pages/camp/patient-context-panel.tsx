// CAMP CampPatientContextPanel — split from camp.tsx (pure move).

import { Card, Group, Select, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CampRegistration, ClinicalEventName, ClinicalJourneyContext } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { deriveCampJourneyCompletedEvents } from "@/components/Patient/patient-journey-events";
import { Alert, Button } from "@/components/ui";
import { campService } from "@/services/camp.service";
import { campJourneyContext } from "../camp-workspace";
import { CampRegistrationSignals, campClinicalRoutePath, campWorkPath } from "./shared";

interface PatientCampRegistrationRow extends CampRegistration {
  camp_name: string;
  camp_code: string;
  camp_status: string;
}

function CampPatientActionBar({
  activeCampId,
  activeCampRegistrationId,
  patientId,
  completedEvents,
}: {
  activeCampId?: string | null;
  activeCampRegistrationId?: string | null;
  patientId: string;
  completedEvents?: readonly ClinicalEventName[];
}) {
  const { t } = useTranslation("camp");
  const journeyContext = useMemo<ClinicalJourneyContext>(
    () =>
      campJourneyContext({
        patientId,
        activeCampId,
        activeCampRegistrationId,
        completedEvents,
      }),
    [activeCampId, activeCampRegistrationId, completedEvents, patientId],
  );

  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" gap="sm" align="center">
        <Stack gap={2}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            {t("handoff.patient.title")}
          </Text>
          <Text size="xs" c="dimmed">
            {t("handoff.patient.message")}
          </Text>
        </Stack>
        <PatientJourneyActions
          context={journeyContext}
          hiddenActionIds={["camp.open_context"]}
          size="xs"
        />
      </Group>
    </Card>
  );
}

export function CampPatientContextPanel({ patientId }: { patientId: string }) {
  const { t } = useTranslation("camp");
  const navigate = useNavigate();
  const canViewRegistrations = useHasPermission(P.CAMP.REGISTRATIONS_LIST);
  const { data: camps = [] } = useQuery({
    queryKey: ["camps"],
    queryFn: () => campService.listCamps(),
    enabled: canViewRegistrations,
  });
  const campLookup = useMemo(() => new Map(camps.map((camp) => [camp.id, camp])), [camps]);
  const { data: patientRegistrations = [], isLoading } = useQuery<CampRegistration[]>({
    queryKey: ["camp-registrations", "patient", patientId],
    queryFn: () => campService.listCampRegistrations({ patient_id: patientId }),
    enabled: canViewRegistrations && patientId.length > 0,
  });
  const registrations = useMemo<PatientCampRegistrationRow[]>(
    () =>
      patientRegistrations.map((registration) => {
        const camp = campLookup.get(registration.camp_id);
        return {
          ...registration,
          camp_name: camp?.name ?? registration.camp_id,
          camp_code: camp?.camp_code ?? registration.camp_id.slice(0, 8),
          camp_status: camp?.status ?? "unknown",
        };
      }),
    [campLookup, patientRegistrations],
  );
  const patientCampCompletedEvents = useMemo(
    () => deriveCampJourneyCompletedEvents(registrations),
    [registrations],
  );

  const activeCamps = camps.filter((camp) => camp.status === "active");
  const activePatientRegistration =
    registrations.find((registration) => registration.camp_status === "active") ?? null;
  const targetCampId = activePatientRegistration?.camp_id ?? activeCamps[0]?.id ?? null;
  const columns: Column<PatientCampRegistrationRow>[] = [
    {
      key: "camp_code",
      label: t("patientHistory.columns.camp"),
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            {row.camp_code}
          </Text>
          <Text size="xs" c="dimmed">
            {row.camp_name}
          </Text>
        </Stack>
      ),
    },
    {
      key: "registration_number",
      label: t("patientHistory.columns.registration"),
      render: (row) => row.registration_number,
    },
    {
      key: "status",
      label: t("patientHistory.columns.status"),
      render: (row) => <CampRegistrationSignals registration={row} />,
    },
    {
      key: "chief_complaint",
      label: t("patientHistory.columns.complaint"),
      render: (row) => row.chief_complaint ?? "—",
    },
    {
      key: "actions",
      label: t("patientHistory.columns.actions"),
      render: (row) => (
        <Group gap="xs">
          <Button
            tone="secondary"
            size="xs"
            onClick={() => navigate(campClinicalRoutePath(row.camp_id, row.id, patientId))}
          >
            {t("patientHistory.actions.openFlow")}
          </Button>
          <Button
            tone="ghost"
            size="xs"
            onClick={() => navigate(campWorkPath(row.camp_id, patientId))}
          >
            {t("patientHistory.actions.workCamp")}
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <Stack mb="md">
      <PatientContextBanner patientId={patientId} hideLoadingState />
      <PatientFlowNavigator
        patientId={patientId}
        active="camp"
        activeCampId={targetCampId}
        activeCampRegistrationId={activePatientRegistration?.id ?? null}
        completedEvents={patientCampCompletedEvents}
        compact
      />
      <CampPatientActionBar
        patientId={patientId}
        activeCampId={targetCampId}
        activeCampRegistrationId={activePatientRegistration?.id ?? null}
        completedEvents={patientCampCompletedEvents}
      />
      {canViewRegistrations ? (
        <Card withBorder>
          <Stack>
            <Group justify="space-between" align="center">
              <Stack gap={0}>
                <Text fw={700}>{t("patientHistory.title")}</Text>
                <Text size="xs" c="dimmed">
                  {t("patientHistory.description")}
                </Text>
              </Stack>
              {activeCamps.length > 0 && (
                <Select
                  placeholder={t("patientHistory.registerInActiveCamp")}
                  data={activeCamps.map((camp) => ({
                    value: camp.id,
                    label: `${camp.camp_code} - ${camp.name}`,
                  }))}
                  onChange={(campId) => {
                    if (campId) {
                      navigate(campWorkPath(campId, patientId));
                    }
                  }}
                  w={320}
                  searchable
                />
              )}
            </Group>
            <DataTable
              columns={columns}
              data={registrations}
              loading={isLoading}
              rowKey={(row) => row.id}
            />
          </Stack>
        </Card>
      ) : (
        <Alert tone="warning">{t("patientHistory.restricted")}</Alert>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Camps Tab
// ══════════════════════════════════════════════════════════
