// CAMP ScreeningsTab — split from camp.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { CampLabSampleFormInput } from "@medbrains/schemas";
import { campLabSampleFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  Camp,
  CampLabSample,
  CampScreening,
  CreateCampLabSampleRequest,
} from "@medbrains/types";
import {
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  P,
} from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { DataTable, useProtectedFieldAccess } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { campOptionalText } from "@/forms/camp.form";
import { campService } from "@/services/camp.service";
import {
  campRegistrationOptionLabel,
  campScreeningCreatePath,
  campWorkflowLabel,
  protectedCampParticipantName,
  protectedCampPhone,
} from "./shared";

const SAMPLE_TYPES = [
  { value: "blood", label: "Blood" },
  { value: "urine", label: "Urine" },
  { value: "sputum", label: "Sputum" },
  { value: "swab", label: "Swab" },
  { value: "other", label: "Other" },
];

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
  const qc = useQueryClient();
  const [labOpen, labHandlers] = useDisclosure(false);
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

  const labSampleDefaults: CampLabSampleFormInput = {
    registration_id: "",
    sample_type: "blood",
    test_requested: "",
    barcode: "",
  };
  const {
    control: labControl,
    register: registerLab,
    reset: resetLab,
    handleSubmit: handleSubmitLab,
    formState: { errors: labErrors },
  } = useForm<CampLabSampleFormInput>({
    resolver: zodResolver(campLabSampleFormSchema),
    defaultValues: labSampleDefaults,
  });
  const registrationOptions = useMemo(
    () =>
      registrations.map((registration) => ({
        value: registration.id,
        label: campRegistrationOptionLabel(registration, {
          name: campNameAccess,
          phone: campPhoneAccess,
        }),
      })),
    [campNameAccess, campPhoneAccess, registrations],
  );
  const sampleTypeOptions = useMemo(
    () =>
      SAMPLE_TYPES.map((sampleType) => ({
        value: sampleType.value,
        label: t(`samples.type.${sampleType.value}`, { defaultValue: sampleType.label }),
      })),
    [t],
  );
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

  const labMut = useMutation({
    mutationFn: (data: CreateCampLabSampleRequest) => campService.createCampLabSample(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-lab-samples"] });
      labHandlers.close();
      resetLab(labSampleDefaults);
      notifications.show({
        title: t("notify.sampleRecorded"),
        message: t("notify.labSampleRecorded"),
        color: "success",
      });
    },
  });

  const handleCreateLabSample = (values: CampLabSampleFormInput) => {
    labMut.mutate({
      registration_id: values.registration_id.trim(),
      sample_type: values.sample_type.trim(),
      test_requested: values.test_requested.trim(),
      barcode: campOptionalText(values.barcode),
    });
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
                onClick={labHandlers.open}
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
      <Drawer
        opened={labOpen}
        onClose={labHandlers.close}
        title={t("samples.drawer.title")}
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleSubmitLab(handleCreateLabSample)}>
          <Controller
            control={labControl}
            name="registration_id"
            render={({ field }) => (
              <Select
                label={t("common.campParticipant")}
                placeholder={t("common.searchRegistrationNamePhone")}
                data={registrationOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                required
                searchable
                error={labErrors.registration_id?.message}
              />
            )}
          />
          <Controller
            control={labControl}
            name="sample_type"
            render={({ field }) => (
              <Select
                label={t("samples.form.sampleType")}
                required
                data={sampleTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "blood")}
                error={labErrors.sample_type?.message}
              />
            )}
          />
          <TextInput
            label={t("samples.form.testRequested")}
            error={labErrors.test_requested?.message}
            {...registerLab("test_requested")}
          />
          <TextInput
            label={t("samples.form.barcode")}
            error={labErrors.barcode?.message}
            {...registerLab("barcode")}
          />
          <Button tone="primary" type="submit" loading={labMut.isPending}>
            {t("samples.actions.saveSample")}
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Follow-ups & Conversion Tab
// ══════════════════════════════════════════════════════════
