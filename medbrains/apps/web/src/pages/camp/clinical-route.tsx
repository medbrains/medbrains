import { zodResolver } from "@hookform/resolvers/zod";
import { Select, Stack, Text } from "@mantine/core";
import type { CampClinicalVisitFormInput } from "@medbrains/schemas";
import { campClinicalVisitFormSchema } from "@medbrains/schemas";
import type { CampRegistration, DepartmentRow } from "@medbrains/types";
import { CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY, P } from "@medbrains/types";
import { IconArrowLeft, IconStethoscope } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  DoctorSearchSelect,
  PageHeader,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import { Alert, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { lookupsService } from "@/services/lookups.service";
import { campWorkPath, protectedCampParticipantName } from "./shared";

/**
 * Sending a camp participant into a consultation.
 *
 * `camp/:campId/work/registrations/:registrationId/clinical-route` was
 * routed and had a path helper, and the component behind it returned the
 * camp workspace with a tab selected — the form itself only ever opened as
 * a right-hand drawer from a button.
 *
 * There is no GET for one registration; the API offers the camp's list, a
 * PUT and the open-encounter POST. So this reads the list the workspace has
 * already cached under the same key and picks the row out of it, which
 * costs nothing when arriving from the tab and one bounded request on a
 * cold load. A single-registration endpoint would be the tidier answer and
 * is not worth adding for one screen.
 */
export function CampClinicalRoutePage() {
  useRequirePermission(P.OPD.VISIT_CREATE);

  return (
    <ClinicalEventProvider moduleCode="camp" contextCode="camp-clinical-route">
      <CampClinicalRoutePageInner />
    </ClinicalEventProvider>
  );
}

function CampClinicalRoutePageInner() {
  const { t } = useTranslation("camp");
  const navigate = useNavigate();
  const { campId, registrationId } = useParams();
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const campNameAccess = useProtectedFieldAccess(CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY);

  const backToList = () => navigate(campWorkPath(campId ?? "", contextPatientId, "registrations"));

  // Same query key the workspace uses, so navigating in from the tab serves
  // this from cache rather than refetching a list already on screen.
  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["camp-registrations", campId ?? null, contextPatientId],
    queryFn: () =>
      campService.listCampRegistrations({
        camp_id: campId ?? "",
        patient_id: contextPatientId || undefined,
      }),
    enabled: Boolean(campId),
  });
  const registration = registrations.find((row: CampRegistration) => row.id === registrationId);

  const { data: camp } = useQuery({
    queryKey: ["camp", campId],
    queryFn: () => campService.getCamp(campId ?? ""),
    enabled: Boolean(campId),
  });

  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["departments"],
    queryFn: () => lookupsService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) =>
          ["clinical", "para_clinical", "diagnostic"].includes(department.department_type),
        )
        .map((department) => ({ value: department.id, label: department.name })),
    [departments],
  );

  // `values` rather than `defaultValues`: the registration arrives from a
  // query, and defaults captured at mount would leave both fields empty on
  // a cold load — the department already chosen at the desk silently lost.
  const { control, handleSubmit, formState } = useForm<CampClinicalVisitFormInput>({
    resolver: zodResolver(campClinicalVisitFormSchema),
    values: {
      department_id: registration?.clinical_department_id ?? camp?.organizing_department_id ?? null,
      doctor_id: registration?.attending_doctor_id ?? null,
    },
  });

  const openVisit = useMutation({
    mutationFn: (values: CampClinicalVisitFormInput) =>
      campService.openCampRegistrationEncounter(registrationId ?? "", {
        department_id: values.department_id,
        doctor_id: values.doctor_id,
      }),
    onSuccess: (result) => {
      if (registration) {
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
      }
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      void qc.invalidateQueries({ queryKey: ["opd-queue"] });
      navigate(
        `/opd/encounters/${result.encounter_id}?return=${encodeURIComponent(
          campWorkPath(campId ?? "", contextPatientId, "registrations"),
        )}`,
      );
    },
  });

  const title = registration?.clinical_department_id
    ? t("registrations.routeDrawer.changeTitle")
    : t("registrations.routeDrawer.openTitle");

  return (
    <Stack>
      <PageHeader
        title={title}
        icon={<IconStethoscope size={20} stroke={1.5} />}
        actions={
          <Button tone="secondary" leftSection={<IconArrowLeft size={14} />} onClick={backToList}>
            {t("registrations.title")}
          </Button>
        }
      />
      {!registrationId || !campId ? (
        <Alert tone="warning">This address is missing the camp or the registration.</Alert>
      ) : isLoading ? null : !registration ? (
        // Distinct from "no registrations": this camp's list loaded and does
        // not contain the one addressed, which is a wrong or stale link.
        <Alert tone="warning">
          That registration is not on this camp. It may have been moved, or the link may be old.
        </Alert>
      ) : (
        <Stack component="form" onSubmit={handleSubmit((v) => openVisit.mutate(v))} maw={520}>
          <Stack gap={2}>
            <Text fw={600}>
              {protectedCampParticipantName(registration.person_name, campNameAccess)}
            </Text>
            <Text size="xs" c="dimmed">
              {t("registrations.routeDrawer.description")}
            </Text>
          </Stack>
          <Controller
            control={control}
            name="department_id"
            render={({ field }) => (
              <Select
                label={t("registrations.routeDrawer.department")}
                placeholder={t("registrations.routeDrawer.selectDepartment")}
                data={departmentOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? null)}
                error={formState.errors.department_id?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            control={control}
            name="doctor_id"
            render={({ field }) => (
              <DoctorSearchSelect
                label={t("registrations.routeDrawer.doctor")}
                placeholder={t("registrations.routeDrawer.selectDoctor")}
                value={field.value ?? ""}
                onChange={(value) => field.onChange(value || null)}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={openVisit.isPending}>
            {t("registrations.routeDrawer.openOpd")}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
