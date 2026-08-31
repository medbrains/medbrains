import { zodResolver } from "@hookform/resolvers/zod";
import { Select, Stack, Textarea } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import type { CampFollowupFormInput } from "@medbrains/schemas";
import { campFollowupFormSchema } from "@medbrains/schemas";
import type { CampRegistration, CreateCampFollowupRequest } from "@medbrains/types";
import {
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  P,
} from "@medbrains/types";
import { IconArrowLeft, IconCalendarCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { PageHeader, useProtectedFieldAccess } from "@/components";
import { Alert, Button } from "@/components/ui";
import { campFollowupTypeOptions, campOptionalText } from "@/forms/camp.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { campRegistrationOptionLabel, campWorkPath } from "./shared";

/**
 * Scheduling the call that turns a camp contact into a patient.
 *
 * `camp/:campId/work/followups/new` was routed and led to the followups
 * tab; the form only opened as a right-hand drawer.
 *
 * This is the hinge of the whole camp model: a screening finds something,
 * and whether the person ever reaches the hospital depends on somebody
 * ringing them on the day this form says. A camp with no follow-ups is an
 * afternoon of blood pressures written down and nothing else.
 */
export function CampFollowupCreatePage() {
  useRequirePermission(P.CAMP.FOLLOWUPS_MANAGE);

  const { t } = useTranslation("camp");
  const navigate = useNavigate();
  const { campId } = useParams();
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const qc = useQueryClient();
  const campNameAccess = useProtectedFieldAccess(CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY);
  const campPhoneAccess = useProtectedFieldAccess(CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY);

  const backToList = () => navigate(campWorkPath(campId ?? "", contextPatientId, "followups"));

  const { data: registrations = [] } = useQuery({
    queryKey: ["camp-registrations", campId ?? null, "followup-selector"],
    queryFn: () => campService.listCampRegistrations({ camp_id: campId ?? "" }),
    enabled: Boolean(campId),
  });
  const registrationOptions = useMemo(
    () =>
      registrations.map((registration: CampRegistration) => ({
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

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CampFollowupFormInput>({
    resolver: zodResolver(campFollowupFormSchema),
    defaultValues: {
      registration_id: searchParams.get("registration_id") ?? "",
      followup_date: "",
      followup_type: "phone_call",
      notes: "",
    },
  });

  const createFollowup = useMutation({
    mutationFn: (data: CreateCampFollowupRequest) => campService.createCampFollowup(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-followups"] });
      void qc.invalidateQueries({ queryKey: ["camp-stats"] });
      notifications.show({
        title: t("notify.followupCreated"),
        message: t("notify.followupScheduled"),
        color: "success",
      });
      backToList();
    },
  });

  const submit = (values: CampFollowupFormInput) => {
    createFollowup.mutate({
      registration_id: values.registration_id.trim(),
      followup_date: values.followup_date.trim(),
      followup_type: values.followup_type,
      notes: campOptionalText(values.notes),
    });
  };

  return (
    <Stack>
      <PageHeader
        title={t("followups.drawer.title")}
        icon={<IconCalendarCheck size={20} stroke={1.5} />}
        actions={
          <Button tone="secondary" leftSection={<IconArrowLeft size={14} />} onClick={backToList}>
            {t("followups.title")}
          </Button>
        }
      />
      {campId ? (
        <Stack maw={520}>
          <Stack component="form" onSubmit={handleSubmit(submit)}>
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
            <Button tone="primary" type="submit" loading={createFollowup.isPending}>
              {t("followups.actions.schedule")}
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Alert tone="warning">Camp id is missing from the route.</Alert>
      )}
    </Stack>
  );
}
