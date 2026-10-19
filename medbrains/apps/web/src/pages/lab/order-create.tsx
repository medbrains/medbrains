import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { DirectLabOrderResponse, LabPriority } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconArrowLeft, IconFlask, IconReceipt } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ClinicalEventProvider, PageHeader, useClinicalEmit } from "@/components";
import { EncounterSelect } from "@/components/EncounterSelect";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Button, Panel, SegmentedControl } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { labService } from "@/services/lab.service";
import { lookupsService } from "@/services/lookups.service";
import { billingInvoicePaymentRoute, billingInvoiceWorkspaceRoute } from "../billing-workspace";
import {
  addCounterTest,
  emptyCounterForm,
  formatRupees,
  LAB_ORDERS_DIRECT,
  type LabCounterFormValues,
  labCounterFormSchema,
  toDirectLabOrderRequest,
} from "./order-create.form";
import { ReferralFields } from "./order-create-referral";
import { SelectedTests } from "./order-create-tests";

const PRIORITY_OPTIONS = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "stat", label: "STAT" },
];

/**
 * The lab counter: order tests against a patient's visit, or — for a walk-in
 * with no doctor's order here — open the lab visit, record who referred
 * them and raise the bill in one step.
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
  const canWalkIn = useHasPermission(LAB_ORDERS_DIRECT);
  const canTakePayment = useHasPermission(P.BILLING.PAYMENTS_CREATE);
  // Visit lookup is a patient read the create permission does not imply.
  const canViewPatient = useHasPermission(P.PATIENTS.VIEW);
  const [raised, setRaised] = useState<DirectLabOrderResponse | null>(null);
  const form = useForm<LabCounterFormValues>({
    resolver: zodResolver(labCounterFormSchema),
    defaultValues: emptyCounterForm(canWalkIn ? "walk_in" : "visit"),
  });
  const { control, handleSubmit, reset, setValue, formState } = form;
  const [mode, patientId, tests] = useWatch({ control, name: ["mode", "patient_id", "tests"] });

  // Same key as EncounterSelect: says *why* the visit box is empty.
  const { data: visits, isLoading: visitsLoading } = useQuery({
    queryKey: ["encounter-search", patientId],
    queryFn: () => lookupsService.listPatientVisits(patientId),
    enabled: mode === "visit" && Boolean(patientId) && canViewPatient,
    staleTime: 30_000,
  });
  const hasNoVisits =
    mode === "visit" && Boolean(patientId) && !visitsLoading && (visits ?? []).length === 0;

  const onError = (error: Error) =>
    notifications.show({ title: "Order not placed", message: error.message, color: "danger" });

  const visitMutation = useMutation({
    // ponytail: one request per test (a handful at most) through the
    // existing order endpoint; the walk-in path is the batched one.
    mutationFn: async (v: LabCounterFormValues) => {
      const placed = [];
      for (const test of v.tests) {
        placed.push(
          await labService.createLabOrder({
            patient_id: v.patient_id,
            test_id: test.id,
            encounter_id: v.encounter_id,
            priority: v.priority as LabPriority,
            notes: v.clinical_history || undefined,
          }),
        );
      }
      return placed;
    },
    onSuccess: (orders) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      for (const order of orders) {
        emit("order.created", {
          encounter_id: order.encounter_id,
          order_id: order.id,
          order_type: "lab",
          patient_id: order.patient_id,
          priority: order.priority,
          test_id: order.test_id,
        });
      }
      notifications.show({ title: "Order placed", message: "", color: "success" });
      navigate(orders.length === 1 ? `/lab/orders/${orders[0]?.id}` : "/lab");
    },
    onError,
  });

  const walkInMutation = useMutation({
    mutationFn: (v: LabCounterFormValues) =>
      labService.createDirectLabOrder(toDirectLabOrderRequest(v)),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      if (canTakePayment && result.invoice_id) {
        navigate(billingInvoicePaymentRoute(result.invoice_id));
        return;
      }
      setRaised(result);
    },
    onError,
  });

  const submit = handleSubmit((v) =>
    v.mode === "walk_in" ? walkInMutation.mutate(v) : visitMutation.mutate(v),
  );

  if (raised) {
    return (
      <BillRaised
        result={raised}
        onNext={() => {
          setRaised(null);
          reset(emptyCounterForm("walk_in"));
        }}
      />
    );
  }

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
      <Stack component="form" maw={720} onSubmit={submit}>
        {canWalkIn && (
          <Controller
            control={control}
            name="mode"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Order type"
                data={[
                  { value: "walk_in", label: "Walk-in (no doctor's order here)" },
                  { value: "visit", label: "Against a visit" },
                ]}
                value={field.value}
                onChange={(value) => field.onChange(value)}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="patient_id"
          render={({ field }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              error={formState.errors.patient_id?.message}
              required
            />
          )}
        />
        <PatientContextBanner patientId={patientId} hideLoadingState />

        <Panel title="Tests">
          <Stack gap="xs">
            <LabTestSearchSelect
              label="Add a test"
              value=""
              clearOnSelect
              onChange={(_, test) => {
                if (test) setValue("tests", addCounterTest(tests, test), { shouldValidate: true });
              }}
              error={formState.errors.tests?.message}
            />
            <SelectedTests
              tests={tests}
              onRemove={(id) =>
                setValue(
                  "tests",
                  tests.filter((x) => x.id !== id),
                  { shouldValidate: true },
                )
              }
            />
          </Stack>
        </Panel>

        {mode === "visit" ? (
          <>
            <Controller
              control={control}
              name="encounter_id"
              render={({ field }) => (
                <EncounterSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  patientId={patientId || undefined}
                  error={formState.errors.encounter_id?.message}
                  required
                />
              )}
            />
            {hasNoVisits && (
              <Alert tone="warning">
                This patient has no recorded visit.
                {canWalkIn
                  ? " Switch to Walk-in to book the tests at the lab counter."
                  : " Register the visit in OPD, or check the patient in at the camp, first."}
              </Alert>
            )}
          </>
        ) : (
          <ReferralFields control={control} errors={formState.errors} />
        )}

        <Group grow align="flex-start">
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select
                label={t("label.priority")}
                data={PRIORITY_OPTIONS}
                value={field.value}
                onChange={(value) => value && field.onChange(value)}
              />
            )}
          />
          <Controller
            control={control}
            name="clinical_history"
            render={({ field }) => (
              <TextInput label="Clinical history" placeholder="e.g. fever 3 days" {...field} />
            )}
          />
        </Group>
        <Group justify="flex-end">
          <Button
            tone="primary"
            type="submit"
            loading={walkInMutation.isPending || visitMutation.isPending}
          >
            {mode === "walk_in" ? "Book tests and raise bill" : "Place order"}
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}

function BillRaised({ result, onNext }: { result: DirectLabOrderResponse; onNext: () => void }) {
  const navigate = useNavigate();
  return (
    <Stack maw={720}>
      <Alert
        tone="success"
        title={`Bill raised ${formatRupees(result.total)} — collect at billing`}
      >
        <Text size="sm">
          {result.orders.length} {result.orders.length === 1 ? "test is" : "tests are"} booked. Send
          the patient to the billing desk; the sample is drawn once the bill is paid.
        </Text>
      </Alert>
      <Group>
        {result.invoice_id && (
          <Button
            tone="secondary"
            leftSection={<IconReceipt size={16} />}
            onClick={() => navigate(billingInvoiceWorkspaceRoute(result.invoice_id ?? ""))}
          >
            Open the bill
          </Button>
        )}
        <Button tone="secondary" onClick={() => navigate(`/lab/orders/${result.orders[0]?.id}`)}>
          Open the order
        </Button>
        <Button tone="primary" onClick={onNext}>
          Next walk-in
        </Button>
      </Group>
    </Stack>
  );
}
