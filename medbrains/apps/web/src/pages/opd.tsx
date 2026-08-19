import { Card, Group, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CreateVitalRequest, FieldAccessLevel, Patient, QueueEntry } from "@medbrains/types";
import { P, PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconHeartbeat,
  IconStethoscope,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  OperationalSignal,
  PageHeader,
  useClinicalEmit,
  useProtectedFieldAccess,
  VitalsRecorder,
} from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { opdService } from "@/services/opd.service";
import { EncounterDetail } from "./opd/encounter-detail";
import { OpdPageInner } from "./opd/page-inner";

export { EncounterDetail } from "./opd/encounter-detail";

import {
  protectedOpdQueueIdentity,
  queueStatusIcon,
  queueStatusLabel,
  queueStatusShape,
  queueStatusTone,
} from "./opd/shared";
import { OpdVisitForm } from "./opd/visit-form";
import {
  type OpdQueueRowActionId,
  type OpdQueueRowActionPermissions,
  resolveOpdQueueRowActions,
} from "./opd-queue-actions";

export function OpdPage() {
  useRequirePermission(P.OPD.QUEUE_LIST);

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode="opd-queue">
      <OpdPageInner />
    </ClinicalEventProvider>
  );
}

export function OpdEncounterPage() {
  useRequirePermission(P.OPD.QUEUE_VIEW);
  const { encounterId } = useParams<{ encounterId: string }>();
  const navigate = useNavigate();
  const canUpdate = useHasPermission(P.OPD.VISIT_UPDATE);
  // opd.queue.view opens this page; the demographics fetch below needs
  // patients.view. Refused, `patient` stays undefined and the page falls
  // through to "OPD visit not found." — a live visit reported as absent,
  // which is the existence oracle running backwards.
  const canViewPatient = useHasPermission(P.PATIENTS.VIEW);
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const requestedEncounterId = encounterId ?? "";

  const { data: encounter, isLoading: encounterLoading } = useQuery({
    queryKey: ["opd-encounter", requestedEncounterId],
    queryFn: () => opdService.getEncounter(requestedEncounterId),
    enabled: requestedEncounterId.length > 0,
  });
  const patientId = encounter?.patient_id ?? "";

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => opdService.getPatient(patientId),
    enabled: patientId.length > 0 && canViewPatient,
  });

  const loading = encounterLoading || patientLoading;

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading OPD visit...</Text>
      </Stack>
    );
  }

  if (encounter && !canViewPatient) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed">
          This visit exists, but you do not have permission to view the patient's record.
        </Text>
        <Button tone="secondary" onClick={() => navigate("/opd")}>
          Back to OPD queue
        </Button>
      </Stack>
    );
  }

  if (!encounter || !patient) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed">OPD visit not found.</Text>
        <Button tone="secondary" onClick={() => navigate("/opd")}>
          Back to OPD queue
        </Button>
      </Stack>
    );
  }

  const patientName = formatPatientName(patient);
  const displayPatientName = protectedPatientName(patientName, patientNameAccess);
  const displayUhid = protectedPatientIdentifier(patient.uhid, uhidAccess);

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode={`opd-encounter-${encounter.id}`}>
      <Stack gap="xs" h="calc(100vh - 96px)">
        <Group justify="space-between" align="center">
          <Group gap="xs" align="baseline">
            <Text size="md" fw={700}>
              OPD Visit
            </Text>
            <Badge tone="primary" size="sm" tt="capitalize">
              {encounter.status.replace(/_/g, " ")}
            </Badge>
          </Group>
          <Button
            tone="ghost"
            size="xs"
            leftSection={<IconArrowRight size={14} style={{ transform: "rotate(180deg)" }} />}
            onClick={() => navigate("/opd")}
          >
            Back to Queue
          </Button>
        </Group>

        <Card withBorder p={0} style={{ flex: 1, overflow: "hidden" }}>
          <EncounterDetail
            encounterId={encounter.id}
            patientId={patient.id}
            patientName={displayPatientName}
            uhid={displayUhid}
            doctorId={encounter.doctor_id}
            departmentId={encounter.department_id ?? ""}
            canUpdate={canUpdate}
          />
        </Card>
      </Stack>
    </ClinicalEventProvider>
  );
}

export function OpdNewVisitPage() {
  useRequirePermission(P.OPD.VISIT_CREATE);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patient_id") ?? "";

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode="opd-new-visit">
      <Stack>
        <PageHeader
          title="New OPD visit"
          subtitle="Register a patient into the OPD queue and open the consultation workspace."
          icon={<IconStethoscope size={20} stroke={1.5} />}
          color="primary"
          actions={
            <Button tone="ghost" onClick={() => navigate("/opd")}>
              Back to OPD
            </Button>
          }
        />
        {initialPatientId && <PatientContextBanner patientId={initialPatientId} />}
        <Card withBorder radius="md" p="md">
          <OpdVisitForm
            key={initialPatientId}
            initialPatientId={initialPatientId}
            onCancel={() => navigate("/opd")}
            onCreated={(result) => navigate(`/opd/encounters/${result.encounter.id}#consultation`)}
          />
        </Card>
      </Stack>
    </ClinicalEventProvider>
  );
}

export function OpdVitalsPage() {
  useRequirePermission(P.OPD.QUEUE_VIEW);

  const { t } = useTranslation("opd");
  const navigate = useNavigate();
  const { queueEntryId } = useParams<{ queueEntryId: string }>();
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const canRecordNurseVitals = useHasPermission(P.NURSE.VITALS_RECORD);
  // The fallback endpoint when the nurse code is absent is createVital,
  // which the server gates on opd.vitals.create — not on opd.visit.update.
  // Asking for the wrong one let a doctor fill the whole vitals form and
  // collect a 403 on save.
  const canCreateOpdVitals = useHasPermission(P.OPD.VITALS_CREATE);
  const canRecordVitals = canRecordNurseVitals || canCreateOpdVitals;
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const requestedQueueEntryId = queueEntryId ?? "";

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["opd-queue", "vitals-route"],
    queryFn: () => opdService.listQueue(),
    enabled: requestedQueueEntryId.length > 0,
  });
  const entry = queue.find((row) => row.id === requestedQueueEntryId);
  const entryIdentity = entry
    ? protectedOpdQueueIdentity(
        entry,
        { name: patientNameAccess, uhid: uhidAccess },
        { patient: t("queueFallback.patient"), uhid: t("queueFallback.uhid") },
      )
    : null;

  const vitalsMutation = useMutation({
    mutationFn: (data: CreateVitalRequest) => {
      if (!entry) {
        throw new Error(t("vitals.error.queueEntryNotLoaded"));
      }
      return canRecordNurseVitals
        ? opdService.createNurseVital({ ...data, encounter_id: entry.encounter_id })
        : opdService.createVital(entry.encounter_id, data);
    },
    onSuccess: (vital) => {
      if (!entry) return;
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["vitals", entry.encounter_id] });
      void queryClient.invalidateQueries({
        queryKey: ["patient-vitals-history", entry.patient_id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["patient-vitals-history", entry.patient_id, "timeline"],
      });
      emit("opd.vitals.recorded", {
        encounter_id: entry.encounter_id,
        patient_id: entry.patient_id,
        source_record_id: vital.id,
        vital_id: vital.id,
      });
      toast.success(
        t("vitals.notify.saved", {
          patient: entryIdentity?.name ?? t("queueFallback.patient"),
        }),
        { title: t("vitals.notify.recorded") },
      );
      navigate("/opd");
    },
    onError: () => {
      toast.error(t("vitals.notify.permissionCheck"), {
        title: t("vitals.notify.unableToRecord"),
      });
    },
  });

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">{t("vitals.loadingQueueEntry")}</Text>
      </Stack>
    );
  }

  if (!entry) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed">{t("vitals.queueEntryNotFound")}</Text>
        <Button tone="secondary" onClick={() => navigate("/opd")}>
          {t("vitals.backToOpd")}
        </Button>
      </Stack>
    );
  }

  const vitalsAllowed = canRecordVitals && canRecordVitalsFromQueue(entry);
  const identity =
    entryIdentity ??
    protectedOpdQueueIdentity(
      entry,
      { name: patientNameAccess, uhid: uhidAccess },
      { patient: t("queueFallback.patient"), uhid: t("queueFallback.uhid") },
    );

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode={`opd-vitals-${entry.id}`}>
      <Stack>
        <PageHeader
          title={t("vitals.recordOpdVitals")}
          subtitle={t("vitals.subtitle", { patient: identity.name, token: identity.token })}
          icon={<IconHeartbeat size={20} stroke={1.5} />}
          color="primary"
          actions={
            <Button tone="ghost" onClick={() => navigate("/opd")}>
              {t("vitals.backToOpd")}
            </Button>
          }
        />
        <Card withBorder p="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>{identity.name}</Text>
              <Text size="xs" c="dimmed">
                {t("vitals.identityLine", { token: identity.token, uhid: identity.uhid })}
              </Text>
            </Stack>
            <OperationalSignal
              icon={queueStatusIcon(entry.status)}
              label={queueStatusLabel(t, entry.status)}
              shape={queueStatusShape(entry.status)}
              tone={queueStatusTone(entry.status)}
            />
          </Group>
        </Card>
        {!vitalsAllowed ? (
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            {t("vitals.permissionBlocked")}
          </Alert>
        ) : (
          <Card withBorder radius="md" p="md">
            <VitalsRecorder
              onSubmit={(data) => vitalsMutation.mutate(data)}
              isSubmitting={vitalsMutation.isPending}
              onCancel={() => navigate("/opd")}
            />
          </Card>
        )}
      </Stack>
    </ClinicalEventProvider>
  );
}

function formatPatientName(patient: Patient): string {
  return `${patient.first_name} ${patient.last_name}`.trim() || patient.uhid;
}

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

const OPD_QUEUE_STATUS_ONLY_PERMISSIONS: OpdQueueRowActionPermissions = {
  canManageToken: true,
  canOpenVisit: true,
  canRecordVitals: true,
};

function queueActionEnabled(row: QueueEntry, actionId: OpdQueueRowActionId): boolean {
  return (
    resolveOpdQueueRowActions(row, OPD_QUEUE_STATUS_ONLY_PERMISSIONS).find(
      (action) => action.id === actionId,
    )?.enabled ?? false
  );
}

function canRecordVitalsFromQueue(row: QueueEntry): boolean {
  return queueActionEnabled(row, "record_vitals");
}
