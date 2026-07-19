// CAMP RegistrationsTab — split from camp.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { CampClinicalVisitFormInput, CampRegistrationFormInput } from "@medbrains/schemas";
import { campClinicalVisitFormSchema, campRegistrationFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  Camp,
  CampOpenEncounterResponse,
  CampRegistration,
  CreateCampRegistrationRequest,
  DepartmentRow,
  FieldAccessLevel,
} from "@medbrains/types";
import {
  CAMP_REGISTRATION_ID_PROOF_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  P,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
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
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  DataTable,
  DoctorSearchSelect,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import type { Column } from "@/components/DataTable";
import { Button, IconButton } from "@/components/ui";
import { campIdProofTypeOptions, campOptionalInteger, campOptionalText } from "@/forms/camp.form";
import { EncounterDetail } from "@/pages/opd";
import { campService } from "@/services/camp.service";
import { lookupsService } from "@/services/lookups.service";
import { CampRegistrationSignals, protectedCampParticipantName } from "./shared";

const CAMP_SERVICE_LINE_OPTIONS = [
  { value: "opinion", label: "Opinion / specialist review" },
  { value: "consultation", label: "Consultation" },
  { value: "xray", label: "X-ray / imaging" },
  { value: "lab", label: "Lab test" },
  { value: "procedure", label: "Procedure" },
  { value: "pharmacy", label: "Pharmacy / medicines" },
  { value: "emergency", label: "Emergency" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Other" },
];

function protectedPatientName(
  patientName: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, patientName, "name");
  return displayValue === "—" ? "Patient" : displayValue;
}

function protectedPatientIdentifier(
  identifier: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, identifier, "identifier");
  return displayValue === "—" ? "No UHID" : displayValue;
}

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
  const canCreate = useHasPermission(P.CAMP.REGISTRATIONS_CREATE);
  const canOpenClinicalVisit = useHasPermission(P.OPD.VISIT_CREATE);
  const campNameAccess = useProtectedFieldAccess(CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY);
  const campPhoneAccess = useProtectedFieldAccess(CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY);
  const campIdProofAccess = useProtectedFieldAccess(CAMP_REGISTRATION_ID_PROOF_FIELD_ACCESS_KEY);
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const patientUhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const canEditCampName = campNameAccess === "edit";
  const canEditCampPhone = campPhoneAccess === "edit";
  const canEditCampIdProof = campIdProofAccess === "edit";
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [routeOpen, routeHandlers] = useDisclosure(false);
  const [clinicalOpen, clinicalHandlers] = useDisclosure(false);
  const [clinicalContext, setClinicalContext] = useState<CampOpenEncounterResponse | null>(null);
  const [selectedRegistrationForClinical, setSelectedRegistrationForClinical] =
    useState<CampRegistration | null>(null);
  const [statusTab, setStatusTab] = useState<string | null>("all");
  const [patientSearch, setPatientSearch] = useState("");
  const registrationDefaults: CampRegistrationFormInput = {
    person_name: "",
    age: "",
    gender: "",
    phone: "",
    address: "",
    id_proof_type: "",
    id_proof_number: "",
    clinical_department_id: null,
    attending_doctor_id: null,
    service_line: "",
    chief_complaint: "",
    is_walk_in: true,
  };
  const clinicalVisitDefaults: CampClinicalVisitFormInput = {
    department_id: null,
    doctor_id: null,
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CampRegistrationFormInput>({
    resolver: zodResolver(campRegistrationFormSchema),
    defaultValues: registrationDefaults,
  });
  const {
    control: clinicalControl,
    reset: resetClinicalVisit,
    handleSubmit: handleClinicalVisitSubmit,
    formState: { errors: clinicalErrors },
  } = useForm<CampClinicalVisitFormInput>({
    resolver: zodResolver(campClinicalVisitFormSchema),
    defaultValues: clinicalVisitDefaults,
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

  const createMut = useMutation({
    mutationFn: (data: CreateCampRegistrationRequest) => campService.createCampRegistration(data),
    onSuccess: (registration) => {
      if (registration.patient_id) {
        emit("camp.registration.created", {
          camp_id: registration.camp_id,
          patient_id: registration.patient_id,
          registration_number: registration.registration_number,
          registration_id: registration.id,
          source_record_id: registration.id,
        });
      }
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      createHandlers.close();
      reset(registrationDefaults);
      notifications.show({
        title: t("notify.registered"),
        message: t("notify.participantRegistered"),
        color: "success",
      });
    },
  });

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
      setClinicalContext(result);
      routeHandlers.close();
      setSelectedRegistrationForClinical(null);
      resetClinicalVisit(clinicalVisitDefaults);
      clinicalHandlers.open();
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      void qc.invalidateQueries({ queryKey: ["opd-queue"] });
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

    setSelectedRegistrationForClinical(registration);
    resetClinicalVisit(values);
    routeHandlers.open();
  };

  const submitClinicalRouting = (values: CampClinicalVisitFormInput) => {
    if (!selectedRegistrationForClinical) return;
    openClinicalVisitMut.mutate({
      registration: selectedRegistrationForClinical,
      values,
    });
  };

  const handleCreateRegistration = (values: CampRegistrationFormInput) => {
    if (!campId) return;
    createMut.mutate({
      camp_id: campId,
      person_name: values.person_name.trim(),
      age: campOptionalInteger(values.age),
      gender: campOptionalText(values.gender),
      phone: campOptionalText(values.phone),
      address: campOptionalText(values.address),
      id_proof_type: campOptionalText(values.id_proof_type),
      id_proof_number: campOptionalText(values.id_proof_number),
      clinical_department_id: values.clinical_department_id ?? undefined,
      attending_doctor_id: values.attending_doctor_id ?? undefined,
      service_line: campOptionalText(values.service_line),
      chief_complaint: campOptionalText(values.chief_complaint),
      is_walk_in: values.is_walk_in,
      patient_id: contextPatientId || undefined,
    });
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
                onClick={createHandlers.open}
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

      <Drawer
        opened={createOpen}
        onClose={() => {
          createHandlers.close();
          reset(registrationDefaults);
        }}
        title="Register Participant"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateRegistration)}>
          <TextInput
            label="Person Name"
            required
            error={errors.person_name?.message}
            disabled={!canEditCampName}
            {...register("person_name")}
          />
          <Group grow>
            <Controller
              control={control}
              name="age"
              render={({ field }) => (
                <NumberInput
                  label="Age"
                  min={0}
                  max={150}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.age?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select
                  label="Gender"
                  data={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ]}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.gender?.message}
                  clearable
                />
              )}
            />
          </Group>
          <TextInput
            label="Phone"
            error={errors.phone?.message}
            disabled={!canEditCampPhone}
            {...register("phone")}
          />
          <Textarea label="Address" error={errors.address?.message} {...register("address")} />
          <Group grow>
            <Controller
              control={control}
              name="clinical_department_id"
              render={({ field }) => (
                <Select
                  label="Service department"
                  placeholder="Optional at registration"
                  data={departmentOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? null)}
                  error={errors.clinical_department_id?.message}
                  clearable
                  searchable
                />
              )}
            />
            <Controller
              control={control}
              name="attending_doctor_id"
              render={({ field }) => (
                <DoctorSearchSelect
                  label="Attending doctor"
                  placeholder="Optional at registration"
                  value={field.value ?? ""}
                  onChange={(value) => field.onChange(value || null)}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="service_line"
            render={({ field }) => (
              <Select
                label="Camp service needed"
                placeholder="Opinion, X-ray, lab, pharmacy..."
                data={CAMP_SERVICE_LINE_OPTIONS}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.service_line?.message}
                clearable
                searchable
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="id_proof_type"
              render={({ field }) => (
                <Select
                  label="ID Proof Type"
                  data={campIdProofTypeOptions}
                  placeholder="Select ID type"
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.id_proof_type?.message}
                  clearable
                  searchable
                  disabled={!canEditCampIdProof}
                />
              )}
            />
            <TextInput
              label="ID Proof Number"
              error={errors.id_proof_number?.message}
              disabled={!canEditCampIdProof}
              {...register("id_proof_number")}
            />
          </Group>
          <Textarea
            label="Chief Complaint"
            error={errors.chief_complaint?.message}
            {...register("chief_complaint")}
          />
          <Controller
            control={control}
            name="is_walk_in"
            render={({ field }) => (
              <Switch
                label="Walk-in"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={routeOpen}
        onClose={() => {
          routeHandlers.close();
          setSelectedRegistrationForClinical(null);
          resetClinicalVisit(clinicalVisitDefaults);
        }}
        title={
          selectedRegistrationForClinical?.clinical_department_id
            ? t("registrations.routeDrawer.changeTitle")
            : t("registrations.routeDrawer.openTitle")
        }
        position="right"
        size="md"
      >
        <Stack component="form" onSubmit={handleClinicalVisitSubmit(submitClinicalRouting)}>
          <Stack gap={2}>
            <Text fw={600}>
              {protectedCampParticipantName(
                selectedRegistrationForClinical?.person_name,
                campNameAccess,
              )}
            </Text>
            <Text size="xs" c="dimmed">
              {t("registrations.routeDrawer.description")}
            </Text>
          </Stack>
          <Controller
            control={clinicalControl}
            name="department_id"
            render={({ field }) => (
              <Select
                label={t("registrations.routeDrawer.department")}
                placeholder={t("registrations.routeDrawer.selectDepartment")}
                data={departmentOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? null)}
                error={clinicalErrors.department_id?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            control={clinicalControl}
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
          <Button tone="primary" type="submit" loading={openClinicalVisitMut.isPending}>
            {t("registrations.routeDrawer.openOpd")}
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={clinicalOpen}
        onClose={() => {
          clinicalHandlers.close();
          setClinicalContext(null);
        }}
        position="right"
        size="100%"
        withCloseButton
        title={
          <Button
            tone="ghost"
            size="xs"
            onClick={() => {
              clinicalHandlers.close();
              setClinicalContext(null);
            }}
            leftSection={<IconArrowRight size={14} style={{ transform: "rotate(180deg)" }} />}
          >
            Back to Camp Work
          </Button>
        }
        styles={{
          header: {
            padding: "6px 12px",
            minHeight: 36,
            borderBottom: "1px solid var(--fc-rule, #e7ebe8)",
          },
          body: { padding: 0, height: "calc(100vh - 36px)", overflow: "hidden" },
        }}
      >
        {clinicalContext && (
          <EncounterDetail
            encounterId={clinicalContext.encounter_id}
            patientId={clinicalContext.patient_id}
            patientName={protectedPatientName(clinicalContext.patient_name, patientNameAccess)}
            uhid={protectedPatientIdentifier(clinicalContext.uhid, patientUhidAccess)}
            doctorId={clinicalContext.doctor_id ?? null}
            departmentId={clinicalContext.department_id}
            canUpdate={canOpenClinicalVisit}
          />
        )}
      </Drawer>
    </>
  );
}
