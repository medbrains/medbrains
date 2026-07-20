// Patients PatientRegisterPageInner — split from patients.tsx (pure move).

import { Card, Divider, Grid, Group, Modal, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { PatientRegistrationInitialValues } from "@medbrains/schemas";
import type { CreatePatientRequest, MpiMatchResult, Patient } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconClipboardCheck,
  IconEye,
  IconShieldCheck,
  IconStethoscope,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { DataTable, PageHeader, useClinicalEmit } from "@/components";
import type { PatientRegistrationLinkedServicesOptions } from "@/components/Patient/PatientRegisterForm";
import { PatientRegisterForm } from "@/components/Patient/PatientRegisterForm";
import { Alert, Badge, Button, IconButton } from "@/components/ui";
import { campService } from "@/services/camp.service";
import { opdService } from "@/services/opd.service";
import { patientsService } from "@/services/patients.service";
import { patientRegistrationOpdHandoffRoute } from "../patient-registration-flow";
import classes from "../patients.module.scss";

interface RegisterPatientMutationInput {
  req: CreatePatientRequest;
  linkedServices?: PatientRegistrationLinkedServicesOptions;
  campContext?: PatientRegistrationCampContext;
}

interface RegisterPatientMutationResult {
  patient: Patient;
  encounterId?: string;
  tokenNumber?: number;
  queueWarning?: string;
  linkedServices?: PatientRegistrationLinkedServicesOptions;
  campId?: string;
  campRegistrationId?: string;
  returnTo?: string;
}

interface PatientRegistrationCampContext {
  campId: string;
  returnTo?: string;
}

function registrationVisitType(req: CreatePatientRequest): string {
  if (req.registration_type === "camp" || req.registration_source === "camp") return "camp";
  if (req.registration_type === "emergency" || req.registration_source === "ambulance") {
    return "emergency";
  }
  if (req.registration_type === "referral" || req.registration_source === "referral") {
    return "referral";
  }
  if (req.registration_type === "revisit") return "follow_up";
  return "walk_in";
}

function registrationQueueNotes(req: CreatePatientRequest): string {
  const notes = ["Created from patient registration"];
  if (req.registration_type) notes.push(`Registration type: ${req.registration_type}`);
  if (req.registration_source) notes.push(`Source: ${req.registration_source}`);
  if (req.camp_name) notes.push(`Camp: ${req.camp_name}`);
  if (req.referred_by_name) notes.push(`Referred by: ${req.referred_by_name}`);
  if (req.initial_diagnosis_text)
    notes.push(`Provisional diagnosis: ${req.initial_diagnosis_text}`);
  return notes.join("\n");
}

function patientRegistrationName(req: CreatePatientRequest): string {
  return [req.first_name, req.last_name].filter(Boolean).join(" ").trim() || req.phone;
}

function patientAddressText(address: CreatePatientRequest["address"]): string | undefined {
  if (!address || typeof address !== "object" || Array.isArray(address)) return undefined;
  return ["line1", "line2", "landmark", "city", "district", "state", "postal_code", "country"]
    .map((key) => {
      const value = address[key];
      return typeof value === "string" ? value.trim() : "";
    })
    .filter(Boolean)
    .join(", ");
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

export function PatientRegisterPageInner() {
  const { t } = useTranslation("patients");
  const emit = useClinicalEmit();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const source = params.get("source");
  const sourceCampId = params.get("campId") ?? "";
  const returnTo = params.get("returnTo") ?? undefined;
  const isCampRegistration = source === "camp" && Boolean(sourceCampId);
  const { data: camps = [], isLoading: campContextLoading } = useQuery({
    queryKey: ["camp-camps", "patient-registration-page", sourceCampId],
    queryFn: () => patientsService.listCamps(),
    enabled: isCampRegistration,
    staleTime: 300_000,
  });
  const selectedCamp = camps.find((camp) => camp.id === sourceCampId);
  const backTarget = isCampRegistration && returnTo ? returnTo : "/patients";
  const backLabel =
    isCampRegistration && returnTo ? t("actions.backToCamp") : t("actions.backToPatients");
  const registrationModeLabel = isCampRegistration
    ? (selectedCamp?.name ?? t("registrationPage.mode.camp"))
    : t("registrationPage.mode.hospital");
  const campInitialValues: PatientRegistrationInitialValues | undefined = isCampRegistration
    ? {
        registration_type: "camp",
        registration_source: "camp",
        camp_id: sourceCampId,
        camp_name: selectedCamp?.name,
        department_id: selectedCamp?.organizing_department_id ?? undefined,
        referred_by_facility: selectedCamp?.venue_name ?? selectedCamp?.name,
        create_opd_visit: true,
        open_opd_after_registration: true,
      }
    : undefined;
  const [duplicateMatches, setDuplicateMatches] = useState<MpiMatchResult[]>([]);
  const pendingRegistrationRef = useRef<RegisterPatientMutationInput | null>(null);
  const [dupModalOpen, dupModalHandlers] = useDisclosure(false);
  const [checklistOpen, checklistHandlers] = useDisclosure(false);

  const createMutation = useMutation({
    mutationFn: async ({
      req,
      linkedServices,
      campContext,
    }: RegisterPatientMutationInput): Promise<RegisterPatientMutationResult> => {
      const patient = await patientsService.createPatient(req);
      if (campContext?.campId) {
        try {
          const campRegistration = await campService.createCampRegistration({
            camp_id: campContext.campId,
            person_name: patientRegistrationName(req),
            gender: req.gender,
            phone: req.phone,
            address: patientAddressText(req.address),
            patient_id: patient.id,
            clinical_department_id: req.department_id,
            attending_doctor_id: req.consultant_id,
            chief_complaint: req.initial_diagnosis_text,
            is_walk_in: true,
          });

          if (linkedServices?.createOpdVisit && req.department_id) {
            try {
              const result = await campService.openCampRegistrationEncounter(campRegistration.id, {
                department_id: req.department_id,
                doctor_id: req.consultant_id,
              });
              return {
                patient,
                encounterId: result.encounter_id,
                linkedServices,
                campId: campContext.campId,
                campRegistrationId: campRegistration.id,
                returnTo: campContext.returnTo,
              };
            } catch (error) {
              const queueWarning = errorMessage(error, t("errors.unknown"));
              return {
                patient,
                queueWarning,
                linkedServices,
                campId: campContext.campId,
                campRegistrationId: campRegistration.id,
                returnTo: campContext.returnTo,
              };
            }
          }

          return {
            patient,
            linkedServices,
            campId: campContext.campId,
            campRegistrationId: campRegistration.id,
            returnTo: campContext.returnTo,
          };
        } catch (error) {
          const queueWarning = errorMessage(error, t("errors.unknown"));
          return {
            patient,
            queueWarning,
            linkedServices,
            campId: campContext.campId,
            returnTo: campContext.returnTo,
          };
        }
      }

      if (!linkedServices?.createOpdVisit || !req.department_id) {
        return { patient, linkedServices };
      }

      try {
        const result = await opdService.createEncounter({
          patient_id: patient.id,
          department_id: req.department_id,
          doctor_id: req.consultant_id,
          visit_type: registrationVisitType(req),
          camp_id: req.camp_id,
          notes: registrationQueueNotes(req),
        });
        return {
          patient,
          encounterId: result.encounter.id,
          tokenNumber: result.queue.token_number,
          linkedServices,
        };
      } catch (error) {
        const queueWarning = errorMessage(error, t("errors.unknown"));
        return {
          patient,
          queueWarning,
          linkedServices,
        };
      }
    },
    onSuccess: (result) => {
      const {
        patient,
        queueWarning,
        tokenNumber,
        encounterId,
        linkedServices,
        campId,
        campRegistrationId,
        returnTo: resultReturnTo,
      } = result;
      emit("patient.created", { patient_id: patient.id });
      if (campId && campRegistrationId) {
        emit("camp.registration.created", {
          camp_id: campId,
          patient_id: patient.id,
          registration_id: campRegistrationId,
        });
      }
      if (encounterId) {
        emit("opd.encounter.created", {
          encounter_id: encounterId,
          patient_id: patient.id,
        });
      }
      notifications.show({
        title: queueWarning
          ? t("notify.patientRegisteredOpdQueuePending")
          : t("notify.patientRegistered"),
        message: queueWarning
          ? t("notify.patientRegisteredQueueWarning", {
              queueWarning,
              uhid: patient.uhid,
            })
          : tokenNumber
            ? t("notify.patientRegisteredWithToken", {
                token: String(tokenNumber).padStart(3, "0"),
                uhid: patient.uhid,
              })
            : t("notify.patientRegisteredWithUhid", { uhid: patient.uhid }),
        color: queueWarning ? "warning" : "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      if (encounterId) {
        void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
        void queryClient.invalidateQueries({ queryKey: ["opd-encounter", encounterId] });
      }
      if (campId) {
        void queryClient.invalidateQueries({ queryKey: ["camp-registrations"] });
      }
      if (encounterId && linkedServices?.openOpdAfterRegistration) {
        navigate(
          patientRegistrationOpdHandoffRoute({
            campId,
            campRegistrationId: result.campRegistrationId,
            encounterId,
            patientId: patient.id,
          }),
        );
        return;
      }
      if (campId && resultReturnTo) {
        navigate(resultReturnTo);
        return;
      }
      navigate(`/patients/${patient.id}`);
    },
    onError: (err: Error) => {
      notifications.show({
        title: t("notify.registrationFailed"),
        message: err.message || t("errors.unknown"),
        color: "danger",
      });
    },
  });

  const handleRegisterSubmit = async (
    req: CreatePatientRequest,
    linkedServices?: PatientRegistrationLinkedServicesOptions,
  ) => {
    const campContext = isCampRegistration
      ? {
          campId: sourceCampId,
          returnTo,
        }
      : undefined;
    try {
      const matches = await patientsService.matchPatients({
        first_name: req.first_name,
        last_name: req.last_name,
        date_of_birth: req.date_of_birth ?? undefined,
        phone: req.phone ?? undefined,
      });
      if (matches.length > 0) {
        setDuplicateMatches(matches);
        pendingRegistrationRef.current = { req, linkedServices, campContext };
        dupModalHandlers.open();
        return;
      }
    } catch {
      // If MPI matching fails, proceed; registration still needs to work during camp load.
    }
    createMutation.mutate({ req, linkedServices, campContext });
  };

  const handleCreateAnyway = () => {
    if (pendingRegistrationRef.current) {
      createMutation.mutate(pendingRegistrationRef.current);
    }
    dupModalHandlers.close();
    pendingRegistrationRef.current = null;
    setDuplicateMatches([]);
  };

  return (
    <Stack className={classes.registrationWorkspace}>
      <PageHeader
        title={t("registrationPage.title")}
        subtitle={
          isCampRegistration
            ? t("registrationPage.subtitle.camp")
            : t("registrationPage.subtitle.hospital")
        }
        icon={<IconUserPlus size={20} stroke={1.5} />}
        color="teal"
        breadcrumbs={[
          { label: t("title.patients"), href: "/patients" },
          { label: t("registrationPage.title") },
        ]}
        actions={
          <Button
            tone="secondary"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(backTarget)}
          >
            {backLabel}
          </Button>
        }
      />

      <Stack gap="sm">
        <Group justify="flex-end">
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconClipboardCheck size={14} />}
            rightSection={
              <Badge size="xs" tone="primary">
                3
              </Badge>
            }
            onClick={checklistHandlers.toggle}
            aria-pressed={checklistOpen}
          >
            {checklistOpen
              ? t("registrationPage.hideChecklist", "Hide checklist")
              : t("registrationPage.showChecklist", "Show checklist")}
          </Button>
        </Group>

        <Grid align="flex-start" className={classes.registrationGrid}>
          <Grid.Col span={checklistOpen ? { base: 12, lg: 9 } : 12}>
            {isCampRegistration && campContextLoading ? (
              <Card withBorder>
                <Text c="dimmed">{t("registrationPage.loadingCampContext")}</Text>
              </Card>
            ) : (
              <Card withBorder p={0}>
                <PatientRegisterForm
                  onSubmit={handleRegisterSubmit}
                  onCancel={() => navigate(backTarget)}
                  isSubmitting={createMutation.isPending}
                  submitLabel={t("actions.register")}
                  initialValues={campInitialValues}
                />
              </Card>
            )}
          </Grid.Col>

          {checklistOpen && (
            <Grid.Col span={{ base: 12, lg: 3 }}>
              <Card withBorder className={classes.registrationRail}>
                <Stack gap="sm">
                  <Group gap="xs">
                    <Badge tone={isCampRegistration ? "success" : "primary"}>
                      {registrationModeLabel}
                    </Badge>
                    {isCampRegistration && selectedCamp?.venue_name && (
                      <Text size="xs" c="dimmed">
                        {selectedCamp.venue_name}
                      </Text>
                    )}
                  </Group>
                  <Divider />
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    {t("registrationPage.checklistTitle")}
                  </Text>
                  {[
                    {
                      icon: <IconClipboardCheck size={15} />,
                      title: t("registrationPage.checklist.minimumSave.title"),
                      desc: t("registrationPage.checklist.minimumSave.description"),
                    },
                    {
                      icon: <IconShieldCheck size={15} />,
                      title: t("registrationPage.checklist.duplicateGuard.title"),
                      desc: t("registrationPage.checklist.duplicateGuard.description"),
                    },
                    {
                      icon: <IconStethoscope size={15} />,
                      title: t("registrationPage.checklist.opdHandoff.title"),
                      desc: t("registrationPage.checklist.opdHandoff.description"),
                    },
                  ].map((item) => (
                    <Group key={item.title} gap="xs" align="flex-start" wrap="nowrap">
                      <Text c="var(--mb-text-muted)" mt={2}>
                        {item.icon}
                      </Text>
                      <div>
                        <Text size="sm" fw={600}>
                          {item.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {item.desc}
                        </Text>
                      </div>
                    </Group>
                  ))}
                  {isCampRegistration && (
                    <Alert tone="success" icon={<IconUsers size={16} />}>
                      {t("registrationPage.campLinkedAlert")}
                    </Alert>
                  )}
                </Stack>
              </Card>
            </Grid.Col>
          )}
        </Grid>
      </Stack>

      <Modal
        opened={dupModalOpen}
        onClose={() => {
          dupModalHandlers.close();
          pendingRegistrationRef.current = null;
        }}
        title={t("title.potentialDuplicatesFound")}
        size="lg"
      >
        <Alert tone="warning" icon={<IconAlertTriangle size={16} />} mb="md">
          {t("registrationPage.duplicateAlert")}
        </Alert>
        <DataTable
          columns={[
            {
              key: "uhid",
              label: t("uhid"),
              render: (m: MpiMatchResult) => (
                <Text size="sm" fw={500}>
                  {m.uhid}
                </Text>
              ),
            },
            {
              key: "name",
              label: t("name"),
              render: (m: MpiMatchResult) => (
                <Text size="sm">
                  {m.first_name} {m.last_name}
                </Text>
              ),
            },
            {
              key: "phone",
              label: t("phone"),
              render: (m: MpiMatchResult) => <Text size="sm">{m.phone || "—"}</Text>,
            },
            {
              key: "score",
              label: t("score"),
              render: (m: MpiMatchResult) => (
                <Badge size="sm" tone={m.score >= 0.8 ? "danger" : "warning"}>
                  {Math.round(m.score * 100)}%
                </Badge>
              ),
            },
            {
              key: "actions",
              label: "",
              render: (m: MpiMatchResult) => (
                <IconButton
                  size={44}
                  aria-label={t("aria.viewDetails")}
                  onClick={() => {
                    dupModalHandlers.close();
                    navigate(`/patients/${m.id}`);
                  }}
                >
                  <IconEye size={14} />
                </IconButton>
              ),
            },
          ]}
          data={duplicateMatches}
          rowKey={(m) => m.id}
        />
        <Group justify="flex-end" mt="md">
          <Button
            tone="ghost"
            onClick={() => {
              dupModalHandlers.close();
              pendingRegistrationRef.current = null;
            }}
          >
            {t("cancel")}
          </Button>
          <Button tone="primary" onClick={handleCreateAnyway}>
            {t("createAnyway")}
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

// #endregion
