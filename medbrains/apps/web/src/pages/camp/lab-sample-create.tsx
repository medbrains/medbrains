import { zodResolver } from "@hookform/resolvers/zod";
import { Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CampLabSampleFormInput } from "@medbrains/schemas";
import { campLabSampleFormSchema } from "@medbrains/schemas";
import type { CampRegistration, CreateCampLabSampleRequest } from "@medbrains/types";
import {
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  P,
} from "@medbrains/types";
import { IconArrowLeft, IconTestPipe } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { PageHeader, useProtectedFieldAccess } from "@/components";
import { Alert, Button } from "@/components/ui";
import { campOptionalText } from "@/forms/camp.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { CAMP_SAMPLE_TYPES, campRegistrationOptionLabel, campWorkPath } from "./shared";

/**
 * Recording a sample taken at a camp, on a screen of its own.
 *
 * `camp/:campId/work/lab/new` was routed and led to the workspace tab; the
 * form only opened as a right-hand drawer. Small as it is, it is the point
 * where a tube acquires the identity it will carry to the bench — a barcode
 * against a named participant — and getting the wrong participant here is a
 * result filed against the wrong person.
 */
export function CampLabSampleCreatePage() {
  useRequirePermission(P.CAMP.LAB_MANAGE);

  const { t } = useTranslation("camp");
  const navigate = useNavigate();
  const { campId } = useParams();
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const qc = useQueryClient();
  const campNameAccess = useProtectedFieldAccess(CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY);
  const campPhoneAccess = useProtectedFieldAccess(CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY);

  const backToList = () => navigate(campWorkPath(campId ?? "", contextPatientId, "screenings"));

  const { data: registrations = [] } = useQuery({
    queryKey: ["camp-registrations", campId ?? null, "screening-selector"],
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
  const sampleTypeOptions = useMemo(
    () =>
      CAMP_SAMPLE_TYPES.map((sampleType) => ({
        value: sampleType.value,
        label: t(`samples.type.${sampleType.value}`, { defaultValue: sampleType.label }),
      })),
    [t],
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CampLabSampleFormInput>({
    resolver: zodResolver(campLabSampleFormSchema),
    defaultValues: {
      registration_id: "",
      sample_type: "blood",
      test_requested: "",
      barcode: "",
    },
  });

  const createSample = useMutation({
    mutationFn: (data: CreateCampLabSampleRequest) => campService.createCampLabSample(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-lab-samples"] });
      notifications.show({
        title: t("notify.sampleRecorded"),
        message: t("notify.labSampleRecorded"),
        color: "success",
      });
      backToList();
    },
  });

  const submit = (values: CampLabSampleFormInput) => {
    createSample.mutate({
      registration_id: values.registration_id.trim(),
      sample_type: values.sample_type.trim(),
      test_requested: values.test_requested.trim(),
      barcode: campOptionalText(values.barcode),
    });
  };

  return (
    <Stack>
      <PageHeader
        title={t("samples.drawer.title")}
        icon={<IconTestPipe size={20} stroke={1.5} />}
        actions={
          <Button tone="secondary" leftSection={<IconArrowLeft size={14} />} onClick={backToList}>
            {t("screenings.title")}
          </Button>
        }
      />
      {campId ? (
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
            name="sample_type"
            render={({ field }) => (
              <Select
                label={t("samples.form.sampleType")}
                required
                data={sampleTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "blood")}
                error={errors.sample_type?.message}
              />
            )}
          />
          <TextInput
            label={t("samples.form.testRequested")}
            error={errors.test_requested?.message}
            {...register("test_requested")}
          />
          <TextInput
            label={t("samples.form.barcode")}
            error={errors.barcode?.message}
            {...register("barcode")}
          />
          <Button tone="primary" type="submit" loading={createSample.isPending}>
            {t("samples.actions.saveSample")}
          </Button>
        </Stack>
      ) : (
        <Alert tone="warning">Camp id is missing from the route.</Alert>
      )}
    </Stack>
  );
}
