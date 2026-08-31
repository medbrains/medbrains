// OPD InvestigationsTab — split from opd.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Group,
  Loader,
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
  LabResult,
  LabTestCatalog,
  PatientLabOrderRow,
  RadiologyDicomStudy,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconEye, IconFlask, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useClinicalEmit } from "@/components";
import { Alert, Badge, type BadgeTone, Button, IconButton, Table, toast } from "@/components/ui";
import {
  DEFAULT_OPD_LAB_ORDER_FORM_VALUES,
  OPD_LAB_PRIORITY_OPTIONS,
  toCreateLabOrderRequest,
} from "@/forms/opd.form";
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

const LAB_RESULT_FLAG_COLORS: Record<string, BadgeTone> = {
  normal: "success",
  low: "warning",
  high: "warning",
  critical_low: "danger",
  critical_high: "danger",
  abnormal: "warning",
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
/**
 * How far this value has moved since the patient's last one.
 *
 * A reference range answers "is this normal for a population". A delta
 * answers "is this normal for this person", and the two disagree in the case
 * that matters: a creatinine going 0.7 to 1.2 sits inside the range at both
 * ends and is a kidney changing. The lab already computes `previous_value`,
 * `delta_percent` and `is_delta_flagged` on every result and nothing showed
 * them.
 *
 * `is_delta_flagged` is the lab's own judgement against that analyte's
 * threshold — a 20% move means something different for sodium than for a
 * white count — so the flag is trusted rather than recomputed from the
 * percentage here.
 */
function DeltaCell({ result }: { result: LabResult }) {
  if (result.previous_value === null || result.delta_percent === null) {
    // No prior value is not a zero change. First results are common and
    // rendering "0%" would assert a comparison that was never made.
    return (
      <Text size="sm" c="dimmed">
        First result
      </Text>
    );
  }

  const pct = Number(result.delta_percent);
  const arrow = pct > 0 ? "\u2191" : pct < 0 ? "\u2193" : "";
  const label = `${arrow}${Math.abs(pct).toFixed(0)}%`;

  return (
    <Stack gap={0}>
      {result.is_delta_flagged ? (
        // Not colour alone — "changed" carries it in words.
        <Badge size="xs" tone="warning">
          Changed {label}
        </Badge>
      ) : (
        <Text size="sm">{label}</Text>
      )}
      <Text size="xs" c="dimmed">
        was {result.previous_value}
        {result.unit ? ` ${result.unit}` : ""}
      </Text>
    </Stack>
  );
}

function isOutstanding(order: PatientLabOrderRow): boolean {
  return order.status !== "verified" && order.status !== "cancelled";
}

/**
 * Where an order has got to, in the words a clinician would use.
 *
 * Elapsed time is shown against the catalogue's expected turnaround rather
 * than as a bare timestamp. At a weekly camp the only question that matters
 * is whether the result arrives before this patient leaves, and "38 min —
 * expected 30" answers it where "ordered at 10:42" does not.
 */
function orderProgress(order: PatientLabOrderRow): string {
  // A rejected sample is a note on the order, not a status: it can be
  // re-collected and the order carries on. It is shown first regardless of
  // status, because somebody has to go and draw blood again.
  if (order.rejection_reason) {
    return `Sample rejected — ${order.rejection_reason}`;
  }
  if (order.status === "cancelled") {
    return "Cancelled";
  }
  if (order.status === "verified") {
    const when = order.verified_at ?? order.updated_at;
    return `Verified ${new Date(when).toLocaleString()} · ${order.result_count ?? 0} value(s)`;
  }

  const startedAt = order.collected_at ?? order.created_at;
  const mins = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  const elapsed = mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} h`;
  const stage = order.collected_at ? "In the lab" : "Sample not collected";
  // Only compared when the catalogue actually states one. An expectation
  // nobody set is not a deadline anybody missed.
  const target = order.expected_tat_minutes;
  const against = target ? ` · expected ${target} min${mins > target ? " — overdue" : ""}` : "";
  return `${stage} · ${elapsed}${against}`;
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
  const canViewLabReport = useHasPermission(P.LAB.ORDERS_VIEW);
  const [formOpened, formHandlers] = useDisclosure(false);
  const [labDupeWarning, setLabDupeWarning] = useState<DuplicateOrderInfo[]>(NO_DUPES);
  const [dupeCheckUnavailable, setDupeCheckUnavailable] = useState(false);
  const applyDupeCheck = (next: CheckResult<DuplicateOrderInfo[]>) => {
    setLabDupeWarning(next.findings);
    setDupeCheckUnavailable(next.unavailable);
  };
  const [selectedLabReportId, setSelectedLabReportId] = useState<string | null>(null);
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

  const { data: patientLabOrders = [] } = useQuery<PatientLabOrderRow[]>({
    queryKey: ["patient-lab-orders", patientId],
    queryFn: () => opdService.listPatientLabOrders(patientId),
  });

  const { data: imagingStudies = [] } = useQuery<RadiologyDicomStudy[]>({
    queryKey: ["patient-dicom-studies", patientId],
    queryFn: () => opdService.getPriorRadiologyDicomStudies(patientId),
    enabled: canViewImaging,
  });

  const { data: selectedLabReport, isLoading: selectedLabReportLoading } = useQuery({
    queryKey: ["lab-order-detail", selectedLabReportId],
    queryFn: () => opdService.getLabOrder(selectedLabReportId ?? ""),
    enabled: selectedLabReportId !== null && canViewLabReport,
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
  const recentLabReports = [...patientLabOrders]
    .sort((a, b) => {
      const pending = (o: PatientLabOrderRow) => (isOutstanding(o) ? 0 : 1);
      return pending(a) - pending(b) || +new Date(b.updated_at) - +new Date(a.updated_at);
    })
    .slice(0, 8);

  const outstandingCount = patientLabOrders.filter(isOutstanding).length;

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
          <div>
            <Text fw={600}>Reports & Imaging</Text>
            <Text size="xs" c="dimmed">
              Doctor view for completed lab reports and X-ray/CT/MRI prior imaging.
            </Text>
          </div>
          <Badge tone="primary">Patient history</Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Card padding="xs" radius="md" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  Lab Reports
                </Text>
                <Badge size="xs" tone={outstandingCount > 0 ? "warning" : "info"}>
                  {outstandingCount > 0
                    ? `${outstandingCount} awaiting`
                    : `${recentLabReports.length}`}
                </Badge>
              </Group>
              {recentLabReports.length > 0 ? (
                <Table striped highlightOnHover>
                  <Table.Tbody>
                    {recentLabReports.map((report) => (
                      <Table.Tr key={report.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {report.test_name ?? "Lab test"}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {orderProgress(report)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" tone={LAB_STATUS_COLORS[report.status] ?? "neutral"}>
                            {report.status.replace(/_/g, " ")}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {(report.result_count ?? 0) > 0 ? (
                            <Button
                              tone="secondary"
                              size="xs"
                              leftSection={<IconEye size={14} />}
                              onClick={() => setSelectedLabReportId(report.id)}
                            >
                              View
                            </Button>
                          ) : (
                            // Nothing to open yet. A View button that shows an
                            // empty report teaches the clinician not to press it.
                            <Text size="xs" c="dimmed">
                              Awaiting result
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text size="sm" c="dimmed">
                  Nothing ordered for this patient yet.
                </Text>
              )}
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
                          <Group gap="xs" wrap="nowrap" justify="flex-end">
                            {study.viewer_url ? (
                              <Button
                                tone="secondary"
                                component="a"
                                href={study.viewer_url}
                                target="_blank"
                                rel="noreferrer"
                                size="xs"
                                leftSection={<IconEye size={14} />}
                              >
                                Viewer
                              </Button>
                            ) : null}
                            {study.pacs_url ? (
                              <Button
                                tone="ghost"
                                component="a"
                                href={study.pacs_url}
                                target="_blank"
                                rel="noreferrer"
                                size="xs"
                              >
                                DICOM
                              </Button>
                            ) : null}
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

      {orders.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Test</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ordered</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orders.map((order: LabOrder) => (
              <Table.Tr key={order.id}>
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
                  {canUpdate &&
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
            ))}
          </Table.Tbody>
        </Table>
      )}

      {!formOpened && orders.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No investigations ordered yet.
        </Text>
      )}

      <Modal
        opened={selectedLabReportId !== null}
        onClose={() => setSelectedLabReportId(null)}
        title="Lab Report"
        size="lg"
      >
        {selectedLabReportLoading ? (
          <Loader size="sm" />
        ) : selectedLabReport?.results.length ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Parameter</Table.Th>
                <Table.Th>Result</Table.Th>
                <Table.Th>Range</Table.Th>
                <Table.Th>Since last</Table.Th>
                <Table.Th>Flag</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {selectedLabReport.results.map((result: LabResult) => (
                <Table.Tr key={result.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {result.parameter_name}
                    </Text>
                    {result.notes && (
                      <Text size="xs" c="dimmed">
                        {result.notes}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {result.value}
                      {result.unit ? ` ${result.unit}` : ""}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {result.normal_range ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {/* The delta. A value inside its reference range that has
                        moved sharply since last time is the finding a range
                        cannot show — a creatinine going 0.7 → 1.2 is still
                        "normal" and is still a kidney changing. The lab
                        already computes and stores this; nothing rendered it. */}
                    <DeltaCell result={result} />
                  </Table.Td>
                  <Table.Td>
                    {result.flag ? (
                      <Badge size="xs" tone={LAB_RESULT_FLAG_COLORS[result.flag] ?? "neutral"}>
                        {result.flag.replace(/_/g, " ")}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : canViewLabReport ? (
          <Text size="sm" c="dimmed">
            No structured result values are available for this report.
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            You do not have permission to view lab report values.
          </Text>
        )}
      </Modal>
    </Stack>
  );
}

// ── Follow-up Scheduling ─────────────────────────────────
