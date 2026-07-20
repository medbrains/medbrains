// Emergency EmergencyVisitDetailPage — split from emergency.tsx (pure move).

import { Box, Card, Grid, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconGavel,
  IconHeartbeat,
  IconPlus,
  IconReceipt,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "@/components";
import { PatientConsumablesPanel } from "@/components/Clinical";
import { TriagePanel } from "@/components/crdt/TriagePanel";
import { ErDischargeSummaryPanel } from "@/components/Emergency/ErDischargeSummaryPanel";
import { ErObservationPanel } from "@/components/Emergency/ErObservationPanel";
import { Alert, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { billingService } from "@/services/billing.service";
import { emergencyService } from "@/services/emergency.service";
import { billingInvoiceWorkspaceRoute } from "../billing-workspace";
import classes from "../emergency.module.scss";
import { MlcCaseDetail } from "./mlc-case-detail";
import { ResuscitationVisitPanel } from "./resuscitation-visit-panel";
import { EmergencyVisitCommandBar } from "./visit-command-bar";
import { EmergencyVisitContextRail } from "./visit-context-rail";

export function EmergencyVisitDetailPage() {
  useRequirePermission([
    P.EMERGENCY.VISITS_LIST,
    P.EMERGENCY.VISITS_UPDATE,
    P.EMERGENCY.TRIAGE_LIST,
    P.EMERGENCY.TRIAGE_CREATE,
    P.EMERGENCY.RESUSCITATION_LIST,
    P.EMERGENCY.RESUSCITATION_CREATE,
    P.EMERGENCY.MLC_LIST,
    P.EMERGENCY.MLC_PRINT,
    P.EMERGENCY.MLC_REPRINT,
    P.EMERGENCY.MLC_DOCUMENTS.SBAR_CREATE,
    P.EMERGENCY.MLC_DOCUMENTS.AGE_ESTIMATION_CREATE,
    P.EMERGENCY.MLC_DOCUMENTS.POCSO_CREATE,
    P.EMERGENCY.MLC_DOCUMENTS.COURT_SUMMONS_CREATE,
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.LIST,
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.CREATE,
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.CONFIRM,
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.PRINT,
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.REPRINT,
  ]);
  const navigate = useNavigate();
  const { visitId } = useParams();
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);
  const canViewTriage = useHasPermission(P.EMERGENCY.TRIAGE_LIST);
  const canCreateTriage = useHasPermission(P.EMERGENCY.TRIAGE_CREATE);
  const canViewResuscitation = useHasPermission(P.EMERGENCY.RESUSCITATION_LIST);
  const canCreateResuscitation = useHasPermission(P.EMERGENCY.RESUSCITATION_CREATE);
  const canUpdateVisit = useHasPermission(P.EMERGENCY.VISITS_UPDATE);
  const canCreateIpdAdmission = useHasPermission(P.IPD.ADMISSIONS_CREATE);
  const canViewMlc = useHasPermission(P.EMERGENCY.MLC_LIST);
  const canPrintMlc = useHasPermission(P.EMERGENCY.MLC_PRINT);
  const canReprintMlc = useHasPermission(P.EMERGENCY.MLC_REPRINT);
  const canCreateMlcSbar = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.SBAR_CREATE);
  const canCreateMlcAgeEstimation = useHasPermission(
    P.EMERGENCY.MLC_DOCUMENTS.AGE_ESTIMATION_CREATE,
  );
  const canCreateMlcPocso = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.POCSO_CREATE);
  const canCreateMlcCourtSummons = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.COURT_SUMMONS_CREATE);
  const canListMlcPoliceIntimations = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.LIST);
  const canCreateMlcPoliceIntimation = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.CREATE);
  const canConfirmMlcPoliceReceipt = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.CONFIRM);
  const canPrintMlcPoliceIntimation = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.PRINT);
  const canReprintMlcPoliceIntimation = useHasPermission(
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.REPRINT,
  );
  const canAccessMlc =
    canViewMlc ||
    canPrintMlc ||
    canReprintMlc ||
    canCreateMlcSbar ||
    canCreateMlcAgeEstimation ||
    canCreateMlcPocso ||
    canCreateMlcCourtSummons ||
    canListMlcPoliceIntimations ||
    canCreateMlcPoliceIntimation ||
    canConfirmMlcPoliceReceipt ||
    canPrintMlcPoliceIntimation ||
    canReprintMlcPoliceIntimation;
  const canAdmit = canUpdateVisit && canCreateIpdAdmission;
  const canCreateInvoice = useHasPermission(P.BILLING.INVOICES_CREATE);
  const { data: visit, isLoading } = useQuery({
    queryKey: ["er-visit", visitId],
    queryFn: () => {
      if (!visitId) throw new Error("ER visit id is missing");
      return emergencyService.getErVisit(visitId);
    },
    enabled: Boolean(visitId),
  });

  // Deferred ER billing from the point of care: the visit and patient
  // come straight off the loaded visit, so the clerk never types a
  // raw UUID (#298). Lands on the created invoice.
  const erInvoiceMutation = useMutation({
    mutationFn: () => {
      if (!visit) throw new Error("Visit not loaded");
      return billingService.erFastInvoice({
        emergency_visit_id: visit.id,
        patient_id: visit.patient_id,
      });
    },
    onSuccess: (invoice) => {
      toast.success(`Invoice ${invoice.invoice_number} created.`, { title: "ER invoice created" });
      navigate(billingInvoiceWorkspaceRoute(invoice.id));
    },
    onError: (error: Error) => {
      toast.error(error.message, { title: "Could not create ER invoice" });
    },
  });
  const { data: mlcCases = [], isLoading: mlcCasesLoading } = useQuery({
    queryKey: ["mlc-cases"],
    queryFn: () => emergencyService.listMlcCases(),
    enabled: canAccessMlc,
  });
  const visitMlcCases = useMemo(
    () => mlcCases.filter((mlcCase) => mlcCase.er_visit_id === visitId),
    [mlcCases, visitId],
  );
  const shouldShowMlcWorkspace = Boolean(visit?.is_mlc && canAccessMlc);

  useEffect(() => {
    if (!shouldShowMlcWorkspace || window.location.hash !== "#mlc") {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById("mlc")?.scrollIntoView({ block: "start" });
    });
  }, [shouldShowMlcWorkspace]);

  return (
    <Stack className={classes.emergencyWorkspace}>
      <PageHeader
        title={visit ? `ER Visit ${visit.visit_number}` : "ER Visit"}
        subtitle="Triage, resuscitation, MLC status, and IPD admission context."
        actions={
          <Group gap="xs">
            <Button
              tone="secondary"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate("/emergency?tab=visits")}
            >
              ER Queue
            </Button>
            {canUpdateVisit && (
              <Button
                tone="secondary"
                leftSection={<IconPlus size={14} />}
                onClick={() => navigate("/emergency/visits/new")}
              >
                New Visit
              </Button>
            )}
            {canCreateInvoice && visit && (
              <Button
                tone="subtle-danger"
                leftSection={<IconReceipt size={14} />}
                loading={erInvoiceMutation.isPending}
                onClick={() => erInvoiceMutation.mutate()}
              >
                Fast invoice
              </Button>
            )}
          </Group>
        }
      />
      {isLoading && (
        <Card withBorder>
          <Text size="sm" c="dimmed">
            Loading ER visit...
          </Text>
        </Card>
      )}
      {!isLoading && !visit && (
        <Alert tone="warning">ER visit was not found or is not accessible for this role.</Alert>
      )}
      {visit && (
        <>
          <EmergencyVisitCommandBar
            visit={visit}
            canAdmit={canAdmit}
            canViewPatientRecord={canViewPatientRecord}
          />
          <Grid align="flex-start" className={classes.workspaceGrid}>
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Stack className={classes.workspaceMain}>
                {(canViewTriage || canCreateTriage) && (
                  <Card id="er-triage" withBorder>
                    <Stack>
                      <Group gap="xs">
                        <IconHeartbeat size={18} />
                        <Text fw={700}>Triage</Text>
                      </Group>
                      <TriagePanel visitId={visit.id} canAppend={canCreateTriage} />
                      {!canViewTriage && canCreateTriage && (
                        <Text size="xs" c="dimmed">
                          This role can append triage entries, but full triage history is
                          restricted.
                        </Text>
                      )}
                    </Stack>
                  </Card>
                )}
                {(canViewResuscitation || canCreateResuscitation) && (
                  <Box id="er-resuscitation">
                    <ResuscitationVisitPanel
                      visitId={visit.id}
                      canView={canViewResuscitation}
                      canCreate={canCreateResuscitation}
                    />
                  </Box>
                )}
                <PatientConsumablesPanel
                  patientId={visit.patient_id}
                  encounterId={visit.encounter_id ?? visit.id}
                />
                <ErObservationPanel visitId={visit.id} />
                <ErDischargeSummaryPanel visitId={visit.id} />
                {shouldShowMlcWorkspace && (
                  <Box id="mlc">
                    <Stack>
                      <Group gap="xs">
                        <IconGavel size={18} />
                        <Text fw={700}>MLC case workspace</Text>
                      </Group>
                      {mlcCasesLoading ? (
                        <Text size="sm" c="dimmed">
                          Loading MLC case...
                        </Text>
                      ) : visitMlcCases.length > 0 ? (
                        <Stack>
                          {visitMlcCases.map((mlcCase) => (
                            <MlcCaseDetail
                              key={mlcCase.id}
                              mlcCase={mlcCase}
                              canViewPatientRecord={canViewPatientRecord}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
                          This visit is flagged as MLC, but no linked MLC case is available for your
                          current role.
                        </Alert>
                      )}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <EmergencyVisitContextRail
                visit={visit}
                canShowTriage={canViewTriage || canCreateTriage}
                canShowResuscitation={canViewResuscitation || canCreateResuscitation}
                canShowMlc={shouldShowMlcWorkspace}
              />
            </Grid.Col>
          </Grid>
        </>
      )}
    </Stack>
  );
}

// ── Triage Log Tab ──────────────────────────────────────
//
// CRDT-backed triage log: append-only ESI entries that survive a
// WAN outage. Picks a visit from the live ER queue; the panel
// below switches REST↔CRDT based on TenantConfigProvider.
