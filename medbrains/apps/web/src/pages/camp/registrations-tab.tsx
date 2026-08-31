// CAMP RegistrationsTab — split from camp.tsx (pure move).

import { Group, Stack, Tabs, Text, TextInput, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CampClinicalVisitFormInput } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { Camp, CampRegistration } from "@medbrains/types";
import {
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  P,
} from "@medbrains/types";
import {
  IconArrowRight,
  IconPlus,
  IconSearch,
  IconStethoscope,
  IconTransferIn,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { DataTable, useClinicalEmit, useProtectedFieldAccess } from "@/components";
import type { Column } from "@/components/DataTable";
import { Button, IconButton } from "@/components/ui";
import { campService } from "@/services/camp.service";
import {
  CampRegistrationSignals,
  campClinicalRoutePath,
  campRegistrationCreatePath,
  campWorkPath,
} from "./shared";

export function RegistrationsTab({
  campId,
  selectedCamp,
  contextPatientId,
  onScreenRegistration,
}: {
  campId: string | null;
  selectedCamp: Camp | null;
  contextPatientId: string;
  onScreenRegistration: (registrationId: string) => void;
}) {
  const { t } = useTranslation("camp");
  const navigate = useNavigate();
  const canCreate = useHasPermission(P.CAMP.REGISTRATIONS_CREATE);
  const canOpenClinicalVisit = useHasPermission(P.OPD.VISIT_CREATE);
  const campNameAccess = useProtectedFieldAccess(CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY);
  const canEditCampName = campNameAccess === "edit";
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const [statusTab, setStatusTab] = useState<string | null>("all");
  const [patientSearch, setPatientSearch] = useState("");

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["camp-registrations", campId, contextPatientId],
    queryFn: () =>
      campService.listCampRegistrations({
        camp_id: campId ?? "",
        patient_id: contextPatientId || undefined,
      }),
    enabled: !!campId,
  });
  const filteredRegs = useMemo(() => {
    const byStatus = statusTab === "all" ? regs : regs.filter((row) => row.status === statusTab);
    const needle = patientSearch.trim().toLowerCase();
    if (!needle) return byStatus;

    return byStatus.filter((row) => {
      const haystack = [
        row.registration_number,
        row.person_name,
        row.phone,
        row.id_proof_number,
        row.patient_id,
        row.chief_complaint,
      ].filter((value): value is string => Boolean(value));

      return haystack.some((value) => value.toLowerCase().includes(needle));
    });
  }, [patientSearch, regs, statusTab]);

  const openClinicalVisitMut = useMutation({
    mutationFn: ({
      registration,
      values,
    }: {
      registration: CampRegistration;
      values: CampClinicalVisitFormInput;
    }) =>
      campService.openCampRegistrationEncounter(registration.id, {
        department_id: values.department_id,
        doctor_id: values.doctor_id,
      }),
    onSuccess: (result, { registration }) => {
      emit("opd.encounter.created", {
        camp_id: registration.camp_id,
        camp_registration_id: registration.id,
        department_id: result.department_id,
        doctor_id: result.doctor_id,
        encounter_id: result.encounter_id,
        patient_id: result.patient_id,
        queue_entry_id: result.queue_id,
        registration_id: registration.id,
        registration_number: registration.registration_number,
        source_record_id: result.encounter_id,
      });
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      void qc.invalidateQueries({ queryKey: ["opd-queue"] });
      // The consultation screen already exists at its own address. The camp
      // copy was the same EncounterDetail in a full-height drawer, with no
      // URL and none of the real page's loading and permission handling.
      navigate(
        `/opd/encounters/${result.encounter_id}?return=${encodeURIComponent(
          campWorkPath(registration.camp_id, contextPatientId, "registrations"),
        )}`,
      );
    },
    onError: () => {
      notifications.show({
        title: t("notify.unableToOpenClinicalDrawer"),
        message: t("notify.selectDepartmentAndPermission"),
        color: "danger",
      });
    },
  });

  const openClinicalRouting = (registration: CampRegistration, forceRoute = false) => {
    const departmentId =
      registration.clinical_department_id ?? selectedCamp?.organizing_department_id ?? null;
    const doctorId = registration.attending_doctor_id ?? null;
    const values: CampClinicalVisitFormInput = {
      department_id: departmentId,
      doctor_id: doctorId,
    };

    if (!forceRoute && registration.clinical_department_id) {
      openClinicalVisitMut.mutate({ registration, values });
      return;
    }

    navigate(campClinicalRoutePath(registration.camp_id, registration.id, contextPatientId));
  };

  const columns: Column<CampRegistration>[] = [
    {
      key: "registration_number",
      label: t("registrations.columns.registration"),
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.registration_number}
        </Text>
      ),
    },
    {
      key: "person_name",
      label: t("registrations.columns.name"),
      fieldAccessKey: CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
      accessor: (r) => r.person_name,
      fieldKind: "name",
      hiddenLabel: t("registrations.restrictedParticipant"),
      render: (r) => r.person_name,
    },
    { key: "age", label: t("registrations.columns.age"), render: (r) => r.age?.toString() ?? "—" },
    { key: "gender", label: t("registrations.columns.gender"), render: (r) => r.gender ?? "—" },
    {
      key: "phone",
      label: t("registrations.columns.phone"),
      fieldAccessKey: CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
      accessor: (r) => r.phone,
      fieldKind: "phone",
      hiddenLabel: t("registrations.restrictedPhone"),
      render: (r) => r.phone ?? "—",
    },
    {
      key: "status",
      label: t("registrations.columns.status"),
      render: (r) => <CampRegistrationSignals registration={r} />,
    },
    {
      key: "chief_complaint",
      label: t("registrations.columns.complaint"),
      render: (r) => r.chief_complaint ?? "—",
    },
    {
      key: "actions",
      label: t("registrations.columns.actions"),
      render: (r) => (
        <Group gap={4}>
          <Tooltip
            label={t("registrations.actions.recordScreening")}
            closeDelay={0}
            withinPortal={false}
          >
            <IconButton
              tone="primary"
              size="sm"
              onClick={(event) => {
                event.currentTarget.blur();
                onScreenRegistration(r.id);
              }}
              aria-label={t("registrations.actions.recordScreening")}
            >
              <IconStethoscope size={14} />
            </IconButton>
          </Tooltip>
          {canOpenClinicalVisit && (
            <Tooltip
              label={
                r.clinical_department_id
                  ? t("registrations.actions.openOpd")
                  : t("registrations.actions.selectDepartmentOpenOpd")
              }
              closeDelay={0}
              withinPortal={false}
            >
              <IconButton
                tone="success"
                size="sm"
                loading={openClinicalVisitMut.isPending}
                onClick={(event) => {
                  event.currentTarget.blur();
                  openClinicalRouting(r);
                }}
                aria-label={t("registrations.actions.openOpd")}
              >
                <IconArrowRight size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canOpenClinicalVisit && r.clinical_department_id && (
            <Tooltip
              label={t("registrations.actions.changeDepartmentDoctor")}
              closeDelay={0}
              withinPortal={false}
            >
              <IconButton
                size="sm"
                onClick={(event) => {
                  event.currentTarget.blur();
                  openClinicalRouting(r, true);
                }}
                aria-label={t("registrations.actions.changeDepartmentDoctor")}
              >
                <IconTransferIn size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Text fw={600}>
            {selectedCamp ? selectedCamp.name : t("registrations.selectActiveCamp")}
          </Text>
          <Text size="xs" c="dimmed">
            {contextPatientId
              ? t("registrations.linkedToPatient")
              : t("registrations.newParticipantsContext")}
          </Text>
        </Stack>
        {canCreate && campId && (
          <Tooltip
            label={
              canEditCampName
                ? t("registrations.actions.registerParticipant")
                : t("registrations.nameEditRequired")
            }
          >
            <span>
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={() => navigate(campRegistrationCreatePath(campId ?? "", contextPatientId))}
                disabled={!canEditCampName}
              >
                {t("registrations.actions.registerParticipant")}
              </Button>
            </span>
          </Tooltip>
        )}
      </Group>

      {campId ? (
        <Stack>
          <TextInput
            label={t("registrations.searchLabel")}
            placeholder={
              contextPatientId
                ? t("registrations.searchLinkedPlaceholder")
                : t("registrations.searchPlaceholder")
            }
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            rightSection={
              patientSearch ? (
                <IconButton
                  size="sm"
                  aria-label={t("registrations.clearSearch")}
                  onClick={() => setPatientSearch("")}
                >
                  <IconX size={14} />
                </IconButton>
              ) : null
            }
          />
          <Tabs value={statusTab} onChange={setStatusTab}>
            <Tabs.List>
              <Tabs.Tab value="all">{t("registrationStatus.all")}</Tabs.Tab>
              <Tabs.Tab value="registered">{t("registrationStatus.registered")}</Tabs.Tab>
              <Tabs.Tab value="screened">{t("registrationStatus.screened")}</Tabs.Tab>
              <Tabs.Tab value="referred">{t("registrationStatus.referred")}</Tabs.Tab>
              <Tabs.Tab value="converted">{t("registrationStatus.converted")}</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <DataTable
            columns={columns}
            data={filteredRegs}
            loading={isLoading}
            rowKey={(r) => r.id}
          />
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" mt="xl">
          {t("registrations.selectActiveCampToView")}
        </Text>
      )}
    </>
  );
}
