// Emergency MlcTab — split from emergency.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { MlcCaseFormInput, MlcCaseUpdateFormInput } from "@medbrains/schemas";
import { mlcCaseFormSchema, mlcCaseUpdateFormSchema } from "@medbrains/schemas";
import { useFieldAccess } from "@medbrains/stores";
import type { CreateMlcCaseRequest, MlcCase, UpdateMlcCaseRequest } from "@medbrains/types";
import { IconFileText, IconGavel, IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { useClinicalEmit } from "@/components/ClinicalEventProvider";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Button, IconButton } from "@/components/ui";
import {
  emergencyMlcBroughtByOptions,
  emergencyMlcCaseTypeOptions,
  emergencyMlcStatusOptions,
  emergencyOptionalText,
} from "@/forms/emergency.form";
import { emergencyService } from "@/services/emergency.service";
import { MlcCaseDetail } from "./mlc-case-detail";
import {
  canEditSensitiveField,
  canViewSensitiveField,
  RestrictedValue,
  renderSensitiveValue,
} from "./shared";

const emptyMlcCaseForm: MlcCaseFormInput = {
  patient_id: "",
  case_type: "",
  fir_number: "",
  police_station: "",
  brought_by: "",
  informant_name: "",
  informant_relation: "",
  informant_contact: "",
  history_of_incident: "",
  is_pocso: false,
  is_death_case: false,
};

const emptyMlcCaseUpdateForm: MlcCaseUpdateFormInput = {
  status: "registered",
  case_type: "",
  fir_number: "",
  police_station: "",
  examination_findings: "",
  medical_opinion: "",
  cause_of_death: "",
};

function mlcCaseClinicalPayload(mlcCase: MlcCase): Record<string, unknown> {
  return {
    source_record_id: mlcCase.id,
    mlc_case_id: mlcCase.id,
    mlc_number: mlcCase.mlc_number,
    patient_id: mlcCase.patient_id,
    er_visit_id: mlcCase.er_visit_id,
    status: mlcCase.status,
    registered_at: mlcCase.registered_at,
  };
}

export function MlcTab({
  canList,
  canViewDetails,
  canCreate,
  canUpdate,
  canViewPatientRecord,
  contextAction,
  contextPatientId,
}: {
  canList: boolean;
  canViewDetails: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canViewPatientRecord: boolean;
  contextAction: string;
  contextPatientId: string;
}) {
  const contextMlcDefaults = { ...emptyMlcCaseForm, patient_id: contextPatientId };
  const shouldOpenContextMlc = canCreate && contextAction === "new" && Boolean(contextPatientId);
  const [opened, { open, close }] = useDisclosure(shouldOpenContextMlc);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [updateOpened, { open: openUpdate, close: closeUpdate }] = useDisclosure(false);
  const [selectedCase, setSelectedCase] = useState<MlcCase | null>(null);
  const [caseToUpdate, setCaseToUpdate] = useState<MlcCase | null>(null);
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const firNumberAccess = useFieldAccess("emergency.mlc.fir_number");
  const policeStationAccess = useFieldAccess("emergency.mlc.police_station");
  const informantNameAccess = useFieldAccess("emergency.mlc.informant_name");
  const informantRelationAccess = useFieldAccess("emergency.mlc.informant_relation");
  const informantContactAccess = useFieldAccess("emergency.mlc.informant_contact");
  const historyAccess = useFieldAccess("emergency.mlc.history_of_incident");
  const examinationAccess = useFieldAccess("emergency.mlc.examination_findings");
  const medicalOpinionAccess = useFieldAccess("emergency.mlc.medical_opinion");
  const causeOfDeathAccess = useFieldAccess("emergency.mlc.cause_of_death");
  const canEditFirNumber = canEditSensitiveField(firNumberAccess);
  const canEditPoliceStation = canEditSensitiveField(policeStationAccess);
  const canEditInformantName = canEditSensitiveField(informantNameAccess);
  const canEditInformantRelation = canEditSensitiveField(informantRelationAccess);
  const canEditInformantContact = canEditSensitiveField(informantContactAccess);
  const canEditHistory = canEditSensitiveField(historyAccess);
  const canEditExamination = canEditSensitiveField(examinationAccess);
  const canEditMedicalOpinion = canEditSensitiveField(medicalOpinionAccess);
  const canEditCauseOfDeath = canEditSensitiveField(causeOfDeathAccess);
  const { data = [], isLoading } = useQuery({
    queryKey: ["mlc-cases"],
    queryFn: () => emergencyService.listMlcCases(),
    enabled: canList,
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MlcCaseFormInput>({
    resolver: zodResolver(mlcCaseFormSchema),
    defaultValues: contextMlcDefaults,
  });
  const {
    control: updateControl,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdate,
    formState: { errors: updateErrors },
  } = useForm<MlcCaseUpdateFormInput>({
    resolver: zodResolver(mlcCaseUpdateFormSchema),
    defaultValues: emptyMlcCaseUpdateForm,
  });
  const selectedPatientId = watch("patient_id");
  const mutation = useMutation({
    mutationFn: (d: CreateMlcCaseRequest) => emergencyService.createMlcCase(d),
    onError: (e: Error) =>
      notifications.show({
        title: "Could not register MLC case",
        message: e.message,
        color: "red",
      }),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["mlc-cases"] });
      emit("mlc.created", mlcCaseClinicalPayload(row));
      close();
      reset(contextMlcDefaults);
      notifications.show({ title: "Success", message: "MLC case registered" });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }: { id: string; data: UpdateMlcCaseRequest }) =>
      emergencyService.updateMlcCase(id, payload),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["mlc-cases"] });
      setSelectedCase((current) => (current?.id === row.id ? row : current));
      closeUpdate();
      setCaseToUpdate(null);
      resetUpdate(emptyMlcCaseUpdateForm);
      notifications.show({ title: "MLC Updated", message: "MLC case details updated" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "MLC update blocked", message: e.message, color: "red" }),
  });

  const mlcStatusColor = (s: string) => {
    switch (s) {
      case "registered":
        return "primary";
      case "under_investigation":
        return "orange";
      case "opinion_given":
        return "teal";
      case "court_pending":
        return "warning";
      case "closed":
        return "success";
      default:
        return "gray";
    }
  };

  const handleViewCase = (mlc: MlcCase) => {
    setSelectedCase(mlc);
    openDetail();
  };

  const editableMlcCaseType = (caseType: string | null): MlcCaseUpdateFormInput["case_type"] => {
    switch (caseType) {
      case "assault":
      case "rta":
      case "burn":
      case "poisoning":
      case "sexual_assault":
      case "suicide_attempt":
      case "unknown":
        return caseType;
      default:
        return "";
    }
  };

  const handleOpenUpdateCase = (mlc: MlcCase) => {
    setCaseToUpdate(mlc);
    resetUpdate({
      status: mlc.status,
      case_type: editableMlcCaseType(mlc.case_type),
      fir_number: mlc.fir_number ?? "",
      police_station: mlc.police_station ?? "",
      examination_findings: mlc.examination_findings ?? "",
      medical_opinion: mlc.medical_opinion ?? "",
      cause_of_death: mlc.cause_of_death ?? "",
    });
    openUpdate();
  };

  const handleCloseUpdateCase = () => {
    closeUpdate();
    setCaseToUpdate(null);
    resetUpdate(emptyMlcCaseUpdateForm);
  };

  const submitMlcCase = (values: MlcCaseFormInput) => {
    mutation.mutate({
      patient_id: values.patient_id,
      case_type: values.case_type || undefined,
      fir_number: canEditFirNumber ? emergencyOptionalText(values.fir_number) : undefined,
      police_station: canEditPoliceStation
        ? emergencyOptionalText(values.police_station)
        : undefined,
      brought_by: values.brought_by || undefined,
      informant_name: canEditInformantName
        ? emergencyOptionalText(values.informant_name)
        : undefined,
      informant_relation: canEditInformantRelation
        ? emergencyOptionalText(values.informant_relation)
        : undefined,
      informant_contact: canEditInformantContact
        ? emergencyOptionalText(values.informant_contact)
        : undefined,
      history_of_incident: canEditHistory
        ? emergencyOptionalText(values.history_of_incident)
        : undefined,
      is_pocso: values.is_pocso,
      is_death_case: values.is_death_case,
    });
  };

  const submitMlcCaseUpdate = (values: MlcCaseUpdateFormInput) => {
    if (!caseToUpdate) {
      return;
    }
    updateMutation.mutate({
      id: caseToUpdate.id,
      data: {
        status: values.status,
        case_type: values.case_type || undefined,
        fir_number: canEditFirNumber ? emergencyOptionalText(values.fir_number) : undefined,
        police_station: canEditPoliceStation
          ? emergencyOptionalText(values.police_station)
          : undefined,
        examination_findings: canEditExamination
          ? emergencyOptionalText(values.examination_findings)
          : undefined,
        medical_opinion: canEditMedicalOpinion
          ? emergencyOptionalText(values.medical_opinion)
          : undefined,
        cause_of_death: canEditCauseOfDeath
          ? emergencyOptionalText(values.cause_of_death)
          : undefined,
      },
    });
  };

  const columns = [
    {
      key: "mlc_number",
      label: "MLC #",
      render: (r: MlcCase) => <Text fw={600}>{r.mlc_number}</Text>,
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r: MlcCase) =>
        canViewPatientRecord ? (
          <PatientNameCell patientId={r.patient_id} showUhid={false} />
        ) : (
          <RestrictedValue />
        ),
    },
    {
      key: "registered_at",
      label: "Registered",
      render: (r: MlcCase) => new Date(r.registered_at).toLocaleString(),
    },
    {
      key: "case_type",
      label: "Type",
      render: (r: MlcCase) =>
        r.case_type ? <TableValueBadge value={r.case_type} kind="category" /> : "---",
    },
    {
      key: "status",
      label: "Status",
      render: (r: MlcCase) => (
        <TableValueBadge value={r.status} color={mlcStatusColor(r.status)} variant="filled" />
      ),
    },
    {
      key: "fir_number",
      label: "FIR #",
      render: (r: MlcCase) => renderSensitiveValue(firNumberAccess, r.fir_number),
    },
    {
      key: "police_station",
      label: "Police Station",
      render: (r: MlcCase) => renderSensitiveValue(policeStationAccess, r.police_station),
    },
    {
      key: "is_pocso",
      label: "POCSO",
      render: (r: MlcCase) =>
        r.is_pocso ? (
          <TableValueBadge
            value="mlc"
            kind="category"
            color="danger"
            label="POCSO"
            variant="filled"
          />
        ) : null,
    },
    {
      key: "is_death_case",
      label: "Death",
      render: (r: MlcCase) =>
        r.is_death_case ? (
          <TableValueBadge
            value="mlc"
            kind="category"
            color="dark"
            label="Death"
            variant="filled"
          />
        ) : null,
    },
    {
      key: "actions",
      label: "Actions",
      render: (r: MlcCase) => (
        <Group gap="xs">
          {canViewDetails && (
            <Tooltip label="View Details & Documents">
              <IconButton
                tone="primary"
                aria-label="View MLC case details and documents"
                onClick={() => handleViewCase(r)}
              >
                <IconFileText size={16} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip label="Update MLC case">
              <IconButton
                tone="primary"
                aria-label="Update MLC case"
                disabled={updateMutation.isPending}
                onClick={() => handleOpenUpdateCase(r)}
              >
                <IconPencil size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(contextMlcDefaults);
              open();
            }}
          >
            Register MLC Case
          </Button>
        </Group>
      )}
      {canList ? (
        <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            MLC case list is not available for your role. You can register a new MLC case when MLC
            creation is allowed.
          </Text>
        </Card>
      )}

      <Drawer
        opened={updateOpened}
        onClose={handleCloseUpdateCase}
        title={caseToUpdate ? `Update ${caseToUpdate.mlc_number}` : "Update MLC Case"}
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={handleUpdateSubmit(submitMlcCaseUpdate)}>
          {caseToUpdate && (
            <Alert tone="warning" icon={<IconGavel size={16} />}>
              <Text size="sm" fw={600}>
                {caseToUpdate.mlc_number}
              </Text>
              <Text size="sm" c="dimmed">
                Registered {new Date(caseToUpdate.registered_at).toLocaleString()}
              </Text>
            </Alert>
          )}
          <Controller
            name="status"
            control={updateControl}
            render={({ field }) => (
              <Select
                label="Case status"
                required
                data={emergencyMlcStatusOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "registered")}
                error={updateErrors.status?.message}
              />
            )}
          />
          <Controller
            name="case_type"
            control={updateControl}
            render={({ field }) => (
              <Select
                label="Case type"
                data={emergencyMlcCaseTypeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={updateErrors.case_type?.message}
              />
            )}
          />
          {canViewSensitiveField(firNumberAccess) && (
            <Controller
              name="fir_number"
              control={updateControl}
              render={({ field }) => (
                <TextInput label="FIR Number" disabled={!canEditFirNumber} {...field} />
              )}
            />
          )}
          {canViewSensitiveField(policeStationAccess) && (
            <Controller
              name="police_station"
              control={updateControl}
              render={({ field }) => (
                <TextInput label="Police Station" disabled={!canEditPoliceStation} {...field} />
              )}
            />
          )}
          {canViewSensitiveField(examinationAccess) && (
            <Controller
              name="examination_findings"
              control={updateControl}
              render={({ field }) => (
                <Textarea
                  label="Examination findings"
                  disabled={!canEditExamination}
                  minRows={3}
                  {...field}
                />
              )}
            />
          )}
          {canViewSensitiveField(medicalOpinionAccess) && (
            <Controller
              name="medical_opinion"
              control={updateControl}
              render={({ field }) => (
                <Textarea
                  label="Medical opinion"
                  disabled={!canEditMedicalOpinion}
                  minRows={3}
                  {...field}
                />
              )}
            />
          )}
          {canViewSensitiveField(causeOfDeathAccess) && (
            <Controller
              name="cause_of_death"
              control={updateControl}
              render={({ field }) => (
                <Textarea
                  label="Cause of death"
                  disabled={!canEditCauseOfDeath}
                  minRows={2}
                  {...field}
                />
              )}
            />
          )}
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleCloseUpdateCase}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={updateMutation.isPending}>
              Save Update
            </Button>
          </Group>
        </Stack>
      </Drawer>

      {/* Create MLC Drawer */}
      <Drawer opened={opened} onClose={close} title="Register MLC Case" position="right" size="lg">
        <Stack component="form" onSubmit={handleSubmit(submitMlcCase)}>
          <Controller
            name="patient_id"
            control={control}
            render={({ field }) => (
              <PatientSearchSelect value={field.value} onChange={field.onChange} required />
            )}
          />
          {errors.patient_id?.message && (
            <Text size="xs" c="danger">
              {errors.patient_id.message}
            </Text>
          )}
          {canViewPatientRecord && (
            <PatientContextBanner patientId={selectedPatientId} hideLoadingState />
          )}
          <Controller
            name="case_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Case Type"
                data={emergencyMlcCaseTypeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.case_type?.message}
              />
            )}
          />
          {canViewSensitiveField(firNumberAccess) && (
            <Controller
              name="fir_number"
              control={control}
              render={({ field }) => (
                <TextInput label="FIR Number" disabled={!canEditFirNumber} {...field} />
              )}
            />
          )}
          {canViewSensitiveField(policeStationAccess) && (
            <Controller
              name="police_station"
              control={control}
              render={({ field }) => (
                <TextInput label="Police Station" disabled={!canEditPoliceStation} {...field} />
              )}
            />
          )}
          <Controller
            name="brought_by"
            control={control}
            render={({ field }) => (
              <Select
                label="Brought By"
                data={emergencyMlcBroughtByOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.brought_by?.message}
              />
            )}
          />
          {canViewSensitiveField(informantNameAccess) && (
            <Controller
              name="informant_name"
              control={control}
              render={({ field }) => (
                <TextInput label="Informant Name" disabled={!canEditInformantName} {...field} />
              )}
            />
          )}
          {canViewSensitiveField(informantRelationAccess) && (
            <Controller
              name="informant_relation"
              control={control}
              render={({ field }) => (
                <TextInput
                  label="Informant Relation"
                  disabled={!canEditInformantRelation}
                  {...field}
                />
              )}
            />
          )}
          {canViewSensitiveField(informantContactAccess) && (
            <Controller
              name="informant_contact"
              control={control}
              render={({ field }) => (
                <TextInput
                  label="Informant Contact"
                  disabled={!canEditInformantContact}
                  {...field}
                  error={errors.informant_contact?.message}
                />
              )}
            />
          )}
          {canViewSensitiveField(historyAccess) && (
            <Controller
              name="history_of_incident"
              control={control}
              render={({ field }) => (
                <Textarea
                  label="History of Incident"
                  disabled={!canEditHistory}
                  {...field}
                  minRows={3}
                />
              )}
            />
          )}
          <Controller
            name="is_pocso"
            control={control}
            render={({ field }) => (
              <Select
                label="POCSO Case"
                data={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
                value={field.value ? "true" : "false"}
                onChange={(value) => field.onChange(value === "true")}
              />
            )}
          />
          <Controller
            name="is_death_case"
            control={control}
            render={({ field }) => (
              <Select
                label="Death Case"
                data={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
                value={field.value ? "true" : "false"}
                onChange={(value) => field.onChange(value === "true")}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={mutation.isPending}>
            Register MLC Case
          </Button>
        </Stack>
      </Drawer>

      {/* MLC Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={() => {
          closeDetail();
          setSelectedCase(null);
        }}
        title={selectedCase ? `MLC Case: ${selectedCase.mlc_number}` : "MLC Case Details"}
        position="right"
        size="xl"
      >
        {selectedCase && (
          <MlcCaseDetail mlcCase={selectedCase} canViewPatientRecord={canViewPatientRecord} />
        )}
      </Drawer>
    </Stack>
  );
}

// ── Mass Casualty Tab ──────────────────────────────────
