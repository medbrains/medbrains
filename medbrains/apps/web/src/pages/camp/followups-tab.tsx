// CAMP FollowupsTab — split from camp.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { CampFollowupFormInput } from "@medbrains/schemas";
import { campFollowupFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  Camp,
  CampFollowup,
  CreateCampFollowupRequest,
  UpdateCampFollowupRequest,
} from "@medbrains/types";
import {
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  P,
} from "@medbrains/types";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable, useProtectedFieldAccess } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { campFollowupTypeOptions, campOptionalText } from "@/forms/camp.form";
import { campService } from "@/services/camp.service";
import type { CampTranslate } from "./shared";
import {
  campRegistrationOptionLabel,
  campWorkflowLabel,
  protectedCampParticipantName,
  protectedCampPhone,
  StatCard,
} from "./shared";

const FOLLOWUP_STATUS_COLORS: Record<string, BadgeTone> = {
  scheduled: "primary",
  completed: "success",
  missed: "danger",
  cancelled: "neutral",
};

function campFollowupStatusLabel(t: CampTranslate, status: string): string {
  return t(`followups.status.${status}`, { defaultValue: campWorkflowLabel(status) });
}

export function FollowupsTab({
  campId,
  selectedCamp,
}: {
  campId: string | null;
  selectedCamp: Camp | null;
}) {
  const { t } = useTranslation("camp");
  // Gate each action on the permission its handler actually requires:
  // POST /camp/followups checks followups.schedule, PUT checks followups.outcome.
  const canSchedule = useHasPermission(P.CAMP.FOLLOWUPS_SCHEDULE);
  const canRecordOutcome = useHasPermission(P.CAMP.FOLLOWUPS_OUTCOME);
  const campNameAccess = useProtectedFieldAccess(CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY);
  const campPhoneAccess = useProtectedFieldAccess(CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [statusTab, setStatusTab] = useState<string | null>("all");
  const followupDefaults: CampFollowupFormInput = {
    registration_id: "",
    followup_date: "",
    followup_type: "phone_call",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CampFollowupFormInput>({
    resolver: zodResolver(campFollowupFormSchema),
    defaultValues: followupDefaults,
  });

  const { data: followups = [], isLoading } = useQuery({
    queryKey: ["camp-followups", campId],
    queryFn: () => campService.listCampFollowups(campId ? { camp_id: campId } : undefined),
    enabled: !!campId,
  });

  const { data: stats } = useQuery({
    queryKey: ["camp-stats", campId],
    queryFn: () => campService.getCampStats(campId ?? ""),
    enabled: !!campId,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["camp-registrations", campId, "followup-selector"],
    queryFn: () => campService.listCampRegistrations({ camp_id: campId ?? "" }),
    enabled: !!campId,
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
  const followupTypeOptions = useMemo(
    () =>
      campFollowupTypeOptions.map((followupType) => ({
        value: followupType.value,
        label: t(`followups.type.${followupType.value}`, { defaultValue: followupType.label }),
      })),
    [t],
  );
  const registrationsById = useMemo(
    () => new Map(registrations.map((registration) => [registration.id, registration])),
    [registrations],
  );
  const filteredFollowups = useMemo(
    () => (statusTab === "all" ? followups : followups.filter((row) => row.status === statusTab)),
    [followups, statusTab],
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

  const createMut = useMutation({
    mutationFn: (data: CreateCampFollowupRequest) => campService.createCampFollowup(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-followups"] });
      void qc.invalidateQueries({ queryKey: ["camp-stats"] });
      createHandlers.close();
      reset(followupDefaults);
      notifications.show({
        title: t("notify.followupCreated"),
        message: t("notify.followupScheduled"),
        color: "success",
      });
    },
  });

  const handleCreateFollowup = (values: CampFollowupFormInput) => {
    createMut.mutate({
      registration_id: values.registration_id.trim(),
      followup_date: values.followup_date.trim(),
      followup_type: values.followup_type,
      notes: campOptionalText(values.notes),
    });
  };

  const completeMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCampFollowupRequest }) =>
      campService.updateCampFollowup(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-followups"] });
      void qc.invalidateQueries({ queryKey: ["camp-stats"] });
    },
  });

  const columns: Column<CampFollowup>[] = [
    {
      key: "registration_id",
      label: t("followups.columns.participant"),
      render: (r) => renderRegistrationCell(r.registration_id),
    },
    { key: "followup_date", label: t("followups.columns.date"), render: (r) => r.followup_date },
    {
      key: "followup_type",
      label: t("followups.columns.type"),
      render: (r) =>
        followupTypeOptions.find((option) => option.value === r.followup_type)?.label ??
        r.followup_type,
    },
    {
      key: "status",
      label: t("followups.columns.status"),
      render: (r) => (
        <Badge tone={FOLLOWUP_STATUS_COLORS[r.status] ?? "neutral"} variant="filled" size="sm">
          {campFollowupStatusLabel(t, r.status)}
        </Badge>
      ),
    },
    {
      key: "converted",
      label: t("followups.columns.converted"),
      render: (r) =>
        r.converted_to_patient ? (
          <Badge tone="success" size="sm">
            {t("common.yes")}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            {t("common.no")}
          </Text>
        ),
    },
    { key: "outcome", label: t("followups.columns.outcome"), render: (r) => r.outcome ?? "—" },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canRecordOutcome && r.status === "scheduled" ? (
          <Group gap={4}>
            <Tooltip label={t("followups.actions.markCompleted")}>
              <IconButton
                tone="success"
                size="sm"
                onClick={() => completeMut.mutate({ id: r.id, data: { status: "completed" } })}
                aria-label={t("followups.actions.markCompleted")}
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label={t("followups.actions.markMissed")}>
              <IconButton
                tone="danger"
                size="sm"
                onClick={() => completeMut.mutate({ id: r.id, data: { status: "missed" } })}
                aria-label={t("followups.actions.markMissed")}
              >
                <IconX size={14} />
              </IconButton>
            </Tooltip>
          </Group>
        ) : null,
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
            {t("followups.description")}
          </Text>
        </Stack>
        {canSchedule && campId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            {t("followups.actions.scheduleFollowup")}
          </Button>
        )}
      </Group>

      {stats && campId && (
        <SimpleGrid cols={5} mb="md">
          <StatCard
            label={t("followups.stats.totalRegistrations")}
            value={stats.total_registrations}
          />
          <StatCard label={t("followups.stats.referred")} value={stats.referred} />
          <StatCard label={t("followups.stats.followups")} value={stats.followups_scheduled} />
          <StatCard label={t("followups.stats.converted")} value={stats.converted} />
          <StatCard
            label={t("followups.stats.conversionRate")}
            value={
              stats.total_registrations > 0
                ? Math.round((stats.converted / stats.total_registrations) * 100)
                : 0
            }
            prefix=""
          />
        </SimpleGrid>
      )}

      {campId ? (
        <Stack>
          <Tabs value={statusTab} onChange={setStatusTab}>
            <Tabs.List>
              <Tabs.Tab value="all">{t("followups.status.all")}</Tabs.Tab>
              <Tabs.Tab value="scheduled">{t("followups.status.scheduled")}</Tabs.Tab>
              <Tabs.Tab value="completed">{t("followups.status.completed")}</Tabs.Tab>
              <Tabs.Tab value="missed">{t("followups.status.missed")}</Tabs.Tab>
              <Tabs.Tab value="cancelled">{t("followups.status.cancelled")}</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <DataTable
            columns={columns}
            data={filteredFollowups}
            loading={isLoading}
            rowKey={(r) => r.id}
          />
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" mt="xl">
          {t("followups.openActiveCamp")}
        </Text>
      )}

      <Drawer
        opened={createOpen}
        onClose={() => {
          createHandlers.close();
          reset(followupDefaults);
        }}
        title={t("followups.drawer.title")}
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateFollowup)}>
          <Controller
            control={control}
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
                error={errors.registration_id?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="followup_date"
            render={({ field }) => (
              <DateInput
                label={t("followups.form.followupDate")}
                required
                value={field.value ? new Date(field.value) : null}
                onChange={(date) =>
                  field.onChange(date ? new Date(date).toISOString().slice(0, 10) : "")
                }
                error={errors.followup_date?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="followup_type"
            render={({ field }) => (
              <Select
                label={t("followups.form.followupType")}
                data={followupTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "phone_call")}
                error={errors.followup_type?.message}
              />
            )}
          />
          <Textarea
            label={t("followups.form.notes")}
            error={errors.notes?.message}
            {...register("notes")}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            {t("followups.actions.schedule")}
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Analytics & Reports Tab
// ══════════════════════════════════════════════════════════
