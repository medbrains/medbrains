// OPD InvestigationsTab — this visit's orders plus the patient's earlier and
// direct (walk-in) orders, each openable to its results.

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { OpdLabOrderFormInput } from "@medbrains/schemas";
import { opdLabOrderFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  DuplicateOrderInfo,
  LabOrder,
  LabOrderListResponse,
  LabTestCatalog,
  PatientLabOrderRow,
  RadiologyDicomStudy,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconFlask, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useClinicalEmit } from "@/components";
import {
  LabOrderHistoryTable,
  ResultsToggle,
  useToggleSet,
} from "@/components/Lab/LabOrderHistoryTable";
import { LabOrderResults } from "@/components/Lab/LabOrderResults";
import { RadiologyReportList } from "@/components/Radiology/RadiologyReportList";
import { StudyImageActions } from "@/components/Radiology/StudyImageActions";
import { Alert, Badge, type BadgeTone, Button, IconButton, Table, toast } from "@/components/ui";
import {
  DEFAULT_OPD_LAB_ORDER_FORM_VALUES,
  OPD_LAB_PRIORITY_OPTIONS,
  toCreateLabOrderRequest,
} from "@/forms/opd.form";
import { useCanCancelOrder } from "@/hooks/useCanCancelOrder";
import { type CheckResult, nextCheckState } from "@/lib/advisoryCheck";
import { confirmDestructive } from "@/lib/confirm";
import { statusColor } from "@/lib/status-colors";
import { opdService } from "@/services/opd.service";

const NO_DUPES: DuplicateOrderInfo[] = [];

const LAB_STATUS_COLORS: Record<string, BadgeTone> = {
  ordered: "primary",
  sample_collected: "info",
  processing: "warning",
  completed: "success",
  verified: "success",
  cancelled: "danger",
};

const STATUS_COLOR_TO_BADGE_TONE: Record<string, BadgeTone> = {
  slate: "neutral",
  gray: "neutral",
  green: "success",
  teal: "success",
  success: "success",
  yellow: "warning",
  orange: "warning",
  warning: "warning",
  red: "danger",
  danger: "danger",
  blue: "info",
  info: "info",
  primary: "primary",
  violet: "accent",
  grape: "accent",
};

function priorityBadgeTone(color: string | null | undefined): BadgeTone {
  return (color ? STATUS_COLOR_TO_BADGE_TONE[color] : undefined) ?? "neutral";
}

/**
 * An order still owed to this patient.
 *
 * Anything not yet verified and not rejected is outstanding — the sample may
 * not be taken, may be in the analyser, or may be waiting on a pathologist,
 * and from the consulting room all three mean the same thing: no answer yet.
 */
function isOutstanding(order: PatientLabOrderRow): boolean {
  return order.status !== "verified" && order.status !== "cancelled";
}

export function InvestigationsTab({
  encounterId,
  patientId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  // Prior imaging and lab detail carry their own module permissions. A
  // refused imaging fetch left `imagingStudies` empty, and this card renders
  // its count in a badge — so "Imaging 0" on a doctor's investigations tab
  // would have stated that the patient has never been imaged.
  const canViewImaging = useHasPermission(P.RADIOLOGY.ORDERS_LIST);
  // `/patients/{id}/lab-orders` answers `lab.orders.list`; without it the
  // query is not issued and the card says so rather than "nothing ordered".
  const canListLabOrders = useHasPermission(P.LAB.ORDERS_LIST);
  // `cancel_order`: lab.orders.create, and the order is yours or you are the lab desk.
  const canCancelLab = useCanCancelOrder(P.LAB.ORDERS_CREATE, P.LAB.ORDERS_CANCEL_ANY);
  const [openVisitOrders, toggleVisitOrder] = useToggleSet();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [labDupeWarning, setLabDupeWarning] = useState<DuplicateOrderInfo[]>(NO_DUPES);
  const [dupeCheckUnavailable, setDupeCheckUnavailable] = useState(false);
  const applyDupeCheck = (next: CheckResult<DuplicateOrderInfo[]>) => {
    setLabDupeWarning(next.findings);
    setDupeCheckUnavailable(next.unavailable);
  };
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OpdLabOrderFormInput>({
    resolver: zodResolver(opdLabOrderFormSchema),
    defaultValues: DEFAULT_OPD_LAB_ORDER_FORM_VALUES,
    mode: "onTouched",
  });
  const selectedTestId = watch("test_id");

  const { data: catalog = [] } = useQuery<LabTestCatalog[]>({
    queryKey: ["lab-catalog"],
    queryFn: () => opdService.listLabCatalog(),
  });

  const { data: ordersResponse } = useQuery<LabOrderListResponse>({
    queryKey: ["lab-orders", encounterId],
    queryFn: () => opdService.listLabOrders({ encounter_id: encounterId }),
  });
  const orders = ordersResponse?.orders ?? [];

  const { data: patientLabOrders = [], isError: patientLabOrdersFailed } = useQuery<
    PatientLabOrderRow[]
  >({
    queryKey: ["patient-lab-orders", patientId],
    queryFn: () => opdService.listPatientLabOrders(patientId),
    enabled: canListLabOrders,
  });

  const { data: imagingStudies = [] } = useQuery<RadiologyDicomStudy[]>({
    queryKey: ["patient-dicom-studies", patientId],
    queryFn: () => opdService.getPriorRadiologyDicomStudies(patientId),
    enabled: canViewImaging,
  });

  // Everything ordered for this patient, not only what has come back.
  //
  // This list used to filter to `result_count > 0 || status === 'verified'`,
  // so a test the clinician had just ordered vanished from their own screen
  // until results arrived. They could not tell an outstanding investigation
  // from one they had forgotten to place — and at a weekly camp, where the
  // patient is physically present for one short window, an invisible pending
  // order is somebody going home without a result.
  //
  // Outstanding orders sort first: they are the ones that still need a
  // decision before this patient leaves.
  //
  // This visit's orders are listed (with their results) in the visit table
  // below, so this section holds everything else: earlier visits and orders
  // placed directly at the lab desk with no encounter at all — the walk-in
  // result a doctor otherwise never sees.
  const visitOrderIds = useMemo(() => new Set(orders.map((o) => o.id)), [orders]);
  const resultCountById = useMemo(
    () => new Map(patientLabOrders.map((o) => [o.id, o.result_count ?? 0])),
    [patientLabOrders],
  );
  const earlierLabOrders = patientLabOrders.filter((o) => !visitOrderIds.has(o.id));
  const recentLabReports = [...earlierLabOrders]
    .sort((a, b) => {
      const pending = (o: PatientLabOrderRow) => (isOutstanding(o) ? 0 : 1);
      return pending(a) - pending(b) || +new Date(b.updated_at) - +new Date(a.updated_at);
    })
    .slice(0, 10);

  const outstandingCount = earlierLabOrders.filter(isOutstanding).length;

  const recentImagingStudies = imagingStudies.slice(0, 5);

  const testOptions = catalog
    .filter((test) => test.is_active)
    .map((test) => ({
      value: test.id,
      label: `${test.code} — ${test.name}${test.sample_type ? ` (${test.sample_type})` : ""}`,
    }));

  const createMutation = useMutation({
    mutationFn: opdService.createLabOrder,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["patient-lab-orders", patientId] });
      toast.success("Lab order placed successfully", { title: "Investigation ordered" });
      emit("order.created", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        order_type: "lab",
        patient_id: result.patient_id,
        priority: result.priority,
        test_id: result.test_id,
      });
      reset(DEFAULT_OPD_LAB_ORDER_FORM_VALUES);
      setLabDupeWarning([]);
      formHandlers.close();
    },
    onError: () => {
      toast.error("Failed to place lab order", { title: "Error" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => opdService.cancelLabOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["patient-lab-orders", patientId] });
      toast.warning("Lab order has been cancelled", { title: "Order cancelled" });
    },
  });

  const handleOrder = handleSubmit((values) => {
    createMutation.mutate(toCreateLabOrderRequest(values, patientId, encounterId));
  });

  const getTestName = (testId: string) => {
    const test = catalog.find((t: LabTestCatalog) => t.id === testId);
    return test ? `${test.code} — ${test.name}` : testId;
  };

  // The fasting requirement, at the one moment it can still be acted on: the
  // patient is in the room. The catalogue has carried this field and the API
  // has returned it since the catalogue existed, and no screen ever showed it
  // — so a patient sent for a fasting glucose was never told, arrived having
  // eaten, and either gave a meaningless sample or was sent home to return
  // tomorrow.
  const fastingTest = useMemo(() => {
    const test = catalog.find((t: LabTestCatalog) => t.id === selectedTestId);
    return test?.fasting_required ? test : null;
  }, [catalog, selectedTestId]);

  return (
    <Stack>
      {canUpdate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.open}
          >
            Order Investigation
          </Button>
        </Group>
      )}

      <Modal opened={formOpened} onClose={formHandlers.close} title="Order Investigation" size="lg">
        <Card padding="sm" radius="md" withBorder style={{ border: "none", boxShadow: "none" }}>
          <Stack gap="xs">
            <Controller
              control={control}
              name="test_id"
              render={({ field }) => (
                <Select
                  label="Lab Test"
                  placeholder="Search tests..."
                  data={testOptions}
                  value={field.value}
                  onChange={async (testId) => {
                    field.onChange(testId);
                    if (!testId) {
                      applyDupeCheck(nextCheckState({ type: "reset" }, NO_DUPES));
                      return;
                    }
                    try {
                      const dupes = await opdService.checkDuplicateOrders({
                        patient_id: patientId,
                        test_id: testId,
                      });
                      applyDupeCheck(
                        nextCheckState({ type: "checked", findings: dupes }, NO_DUPES),
                      );
                    } catch {
                      // Warns but never blocks, and nothing re-checks it
                      // server-side — so if it fails, say so rather than
                      // showing an empty result that reads as "no duplicates".
                      applyDupeCheck(nextCheckState({ type: "failed" }, NO_DUPES));
                    }
                  }}
                  searchable
                  nothingFoundMessage="No tests found"
                  error={errors.test_id?.message}
                  required
                />
              )}
            />
            {fastingTest && (
              <Alert icon={<IconAlertTriangle size={14} />} tone="info" title="Patient must fast">
                <Text size="xs">
                  {fastingTest.name} requires
                  {fastingTest.fasting_hours
                    ? ` ${fastingTest.fasting_hours} hours of`
                    : " a period of"}{" "}
                  fasting before the sample is drawn. Tell the patient before they leave — water is
                  allowed.
                </Text>
              </Alert>
            )}
            {dupeCheckUnavailable && (
              <Alert
                icon={<IconAlertTriangle size={14} />}
                tone="warning"
                title="Duplicate check unavailable"
              >
                <Text size="xs">
                  This test could not be checked against recent orders. Confirm it has not already
                  been ordered before proceeding.
                </Text>
              </Alert>
            )}
            {labDupeWarning.length > 0 && (
              <Alert
                icon={<IconAlertTriangle size={14} />}
                tone="warning"
                title="Duplicate Warning"
              >
                <Text size="xs">
                  This test was already ordered {labDupeWarning.length} time(s) in the last 24
                  hours. ({labDupeWarning.map((d) => d.status).join(", ")})
                </Text>
              </Alert>
            )}
            <Group gap="xs" grow>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select
                    label="Priority"
                    data={OPD_LAB_PRIORITY_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.priority?.message}
                  />
                )}
              />
            </Group>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <Textarea
                  label="Clinical Notes"
                  placeholder="Reason for investigation, clinical context..."
                  value={field.value}
                  onChange={field.onChange}
                  autosize
                  minRows={2}
                  maxRows={4}
                />
              )}
            />
            <Group justify="flex-end" gap="xs">
              <Button
                tone="ghost"
                size="sm"
                onClick={() => {
                  formHandlers.close();
                  reset(DEFAULT_OPD_LAB_ORDER_FORM_VALUES);
                }}
              >
                Cancel
              </Button>
              <Button
                tone="primary"
                size="sm"
                leftSection={<IconFlask size={14} />}
                onClick={handleOrder}
                loading={createMutation.isPending}
                disabled={!selectedTestId}
              >
                Place Order
              </Button>
            </Group>
          </Stack>
        </Card>
      </Modal>

      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Text fw={600}>Earlier and direct orders for this patient</Text>
            <Text size="xs" c="dimmed">
              Lab and imaging results from earlier visits and from orders placed directly at the lab
              or radiology desk.
            </Text>
          </Stack>
          <Badge tone="primary">Patient history</Badge>
        </Group>

        <Card padding="xs" radius="md" withBorder>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                Lab results
              </Text>
              {canListLabOrders && !patientLabOrdersFailed && (
                <Badge size="xs" tone={outstandingCount > 0 ? "warning" : "info"}>
                  {outstandingCount > 0
                    ? `${outstandingCount} awaiting`
                    : `${recentLabReports.length}`}
                </Badge>
              )}
            </Group>
            {!canListLabOrders ? (
              <Text size="sm" c="dimmed">
                You do not have permission to see this patient's lab orders. This is not the same as
                having none.
              </Text>
            ) : patientLabOrdersFailed ? (
              <Alert tone="danger" title="Lab orders could not be loaded">
                This does not mean the patient has none. Try again in a moment.
              </Alert>
            ) : recentLabReports.length > 0 ? (
              <>
                <LabOrderHistoryTable orders={recentLabReports} />
                {earlierLabOrders.length > recentLabReports.length && (
                  <Text size="xs" c="dimmed">
                    Showing {recentLabReports.length} of {earlierLabOrders.length}. Every order is
                    on the patient's Lab Orders tab.
                  </Text>
                )}
              </>
            ) : (
              <Text size="sm" c="dimmed">
                No other lab orders for this patient.
              </Text>
            )}
          </Stack>
        </Card>

        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Card padding="xs" radius="md" withBorder>
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Radiology reports
              </Text>
              <RadiologyReportList patientId={patientId} />
            </Stack>
          </Card>

          <Card padding="xs" radius="md" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  Imaging
                </Text>
                <Badge size="xs" tone={canViewImaging ? "accent" : "neutral"}>
                  {canViewImaging ? recentImagingStudies.length : "—"}
                </Badge>
              </Group>
              {!canViewImaging ? (
                <Text size="sm" c="dimmed">
                  You do not have permission to see this patient's imaging history. This is not the
                  same as having none.
                </Text>
              ) : recentImagingStudies.length > 0 ? (
                <Table striped highlightOnHover>
                  <Table.Tbody>
                    {recentImagingStudies.map((study) => (
                      <Table.Tr key={study.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <Badge size="xs">{study.modality}</Badge>
                            <div>
                              <Text size="sm" fw={500}>
                                {study.study_description ?? "Imaging study"}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {study.study_date
                                  ? new Date(study.study_date).toLocaleDateString()
                                  : "No date"}{" "}
                                · {study.series_count} series / {study.instance_count} images
                              </Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Group justify="flex-end">
                            <StudyImageActions studyId={study.id} size="xs" />
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text size="sm" c="dimmed">
                  No X-ray, CT, MRI or ultrasound studies linked yet.
                </Text>
              )}
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>

      {orders.length > 0 && <Text fw={600}>Ordered in this visit</Text>}
      {orders.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Test</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ordered</Table.Th>
              <Table.Th>Results</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orders.map((order: LabOrder) => (
              <Fragment key={order.id}>
                <Table.Tr>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {getTestName(order.test_id)}
                    </Text>
                    {order.notes && (
                      <Text size="xs" c="dimmed">
                        {order.notes}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" tone={priorityBadgeTone(statusColor(order.priority))}>
                      {order.priority.toUpperCase()}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" tone={LAB_STATUS_COLORS[order.status] ?? "neutral"}>
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(order.created_at).toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ResultsToggle
                      count={resultCountById.get(order.id) ?? 0}
                      isOpen={openVisitOrders.has(order.id)}
                      onToggle={() => toggleVisitOrder(order.id)}
                    />
                  </Table.Td>
                  <Table.Td>
                    {canUpdate &&
                      canCancelLab(order.ordered_by) &&
                      (order.status === "ordered" || order.status === "sample_collected") && (
                        <Tooltip label="Cancel order">
                          <IconButton
                            tone="danger"
                            size="xs"
                            onClick={() =>
                              confirmDestructive({
                                title: "Cancel order",
                                message: "Cancel this order? This cannot be undone.",
                                confirmLabel: "Cancel order",
                                cancelLabel: "Keep",
                                onConfirm: () => cancelMutation.mutate(order.id),
                              })
                            }
                            loading={cancelMutation.isPending}
                            aria-label="Cancel order"
                          >
                            <IconX size={12} />
                          </IconButton>
                        </Tooltip>
                      )}
                  </Table.Td>
                </Table.Tr>
                {openVisitOrders.has(order.id) && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <LabOrderResults orderId={order.id} />
                    </Table.Td>
                  </Table.Tr>
                )}
              </Fragment>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {!formOpened && orders.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No investigations ordered yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Follow-up Scheduling ─────────────────────────────────
