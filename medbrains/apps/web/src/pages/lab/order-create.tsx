import { Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CreateLabOrderRequest, LabPriority } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconArrowLeft, IconFlask } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ClinicalEventProvider, PageHeader, useClinicalEmit } from "@/components";
import { EncounterSelect } from "@/components/EncounterSelect";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { labService } from "@/services/lab.service";
import { lookupsService } from "@/services/lookups.service";
import { toLabPriority } from "./shared";

/**
 * Placing a lab order, on a screen rather than in a drawer.
 *
 * The drawer this replaces let the order be submitted with no encounter.
 * `lab_orders.encounter_id` is NOT NULL in the database, so that request
 * reached Postgres, violated the constraint and came back as "Failed to
 * create order" — a message that gave the person at the counter nothing to
 * act on and no hint that the empty Encounter field was the cause.
 */
export function LabOrderCreatePage() {
  useRequirePermission(P.LAB.ORDERS_CREATE);

  return (
    <ClinicalEventProvider moduleCode="lab" contextCode="lab-order-create">
      <LabOrderCreatePageInner />
    </ClinicalEventProvider>
  );
}

function LabOrderCreatePageInner() {
  const { t } = useTranslation("lab");
  const navigate = useNavigate();
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [testId, setTestId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [priority, setPriority] = useState<LabPriority>("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");

  // Read separately from EncounterSelect so the screen can say *why* the
  // encounter box is empty. TanStack de-duplicates the two reads — this is
  // the same query key the select uses, not a second round trip.
  const { data: visits, isLoading: visitsLoading } = useQuery({
    queryKey: ["encounter-search", patientId],
    queryFn: () => lookupsService.listPatientVisits(patientId),
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
  const hasNoVisits = Boolean(patientId) && !visitsLoading && (visits ?? []).length === 0;

  const createMutation = useMutation({
    mutationFn: (data: CreateLabOrderRequest) => labService.createLabOrder(data),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      notifications.show({ title: "Order created", message: "Lab order placed", color: "success" });
      emit("order.created", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        order_type: "lab",
        patient_id: result.patient_id,
        priority: result.priority,
        test_id: result.test_id,
        source_test_id: variables.test_id,
      });
      // Onto the order that was just placed, not back to a list the user then
      // has to search to find it in.
      navigate(`/lab/orders/${result.id}`);
    },
    onError: (error: Error) => {
      notifications.show({ title: "Error", message: error.message, color: "danger" });
    },
  });

  const canSubmit = Boolean(patientId && testId && encounterId);

  return (
    <Stack>
      <PageHeader
        title={t("title.newLabOrder")}
        icon={<IconFlask size={20} stroke={1.5} />}
        actions={
          <Button
            tone="secondary"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate("/lab")}
          >
            {t("title.laboratory")}
          </Button>
        }
      />
      <Stack maw={640}>
        <PatientSearchSelect value={patientId} onChange={setPatientId} required />
        <PatientContextBanner patientId={patientId} hideLoadingState />
        <LabTestSearchSelect value={testId} onChange={(id) => setTestId(id)} required />
        <EncounterSelect
          value={encounterId}
          onChange={(id) => setEncounterId(id)}
          patientId={patientId || undefined}
          required
        />
        {hasNoVisits && (
          <Alert tone="warning">
            This patient has no recorded visit. A lab order belongs to one — register the visit in
            OPD, or at a camp check the patient in first, then place the order.
          </Alert>
        )}
        <Select
          label={t("label.priority")}
          data={[
            { value: "routine", label: "Routine" },
            { value: "urgent", label: "Urgent" },
            { value: "stat", label: "STAT" },
          ]}
          value={priority}
          onChange={(value) => setPriority(toLabPriority(value))}
        />
        <TextInput
          label={t("label.clinicalNotes")}
          value={clinicalNotes}
          onChange={(e) => setClinicalNotes(e.currentTarget.value)}
        />
        <Button
          tone="primary"
          disabled={!canSubmit}
          onClick={() =>
            createMutation.mutate({
              patient_id: patientId,
              test_id: testId,
              encounter_id: encounterId,
              priority,
              notes: clinicalNotes || undefined,
            })
          }
          loading={createMutation.isPending}
        >
          Place Order
        </Button>
      </Stack>
    </Stack>
  );
}
