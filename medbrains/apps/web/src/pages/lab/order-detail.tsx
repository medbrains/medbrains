// Lab LabOrderDetail — split from lab.tsx (pure move).

import { Card, Group, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  AmendResultRequest,
  AutoValidateResult,
  LabCriticalAlert,
  LabOrderDetailResponse,
  LabResult,
  LabResultAmendment,
  LabTestDefaults,
  ResultInput,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconDroplet,
  IconLock,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconRobot,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable, DocumentActions, useClinicalEmit } from "@/components";
import { PrintLabReportButton } from "@/components/Lab/LabReportPrint";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Alert, Badge, Button, IconButton, Input, Modal, toast } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { statusColor } from "@/lib/status-colors";
import { labService } from "@/services/lab.service";
import { AddOnTestSection } from "./add-on-test";
import { CumulativeTrendDrawer } from "./cumulative-drawer";
import {
  flagColors,
  printLabReportPacket,
  statusColors,
  toBadgeTone,
  toLabResultFlag,
} from "./shared";

/**
 * A catalogue value worth pre-filling.
 *
 * A panel row carries placeholders rather than a measurement — the seeded CBC
 * has unit "-" and range "See parameters" — because a panel has no single
 * unit. Copying those onto every result line would put "-" in the unit column
 * of a printed report, which is worse than leaving it blank: blank invites the
 * technologist to fill it, and "-" looks answered.
 */
function usableDefault(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "-" || trimmed === "--") return undefined;
  if (/^see\b/i.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * One row of the result-entry grid.
 *
 * `rowId` is local bookkeeping and never leaves the browser: it exists so
 * React can keep an input mounted while somebody types into it. The key was
 * previously derived from the values themselves, which changed on every
 * keystroke and cost the field its focus each time.
 */
type ResultRow = ResultInput & { rowId: string };

let nextResultRowId = 0;

function newResultRow(test?: LabTestDefaults | null): ResultRow {
  nextResultRowId += 1;
  return {
    rowId: `result-${nextResultRowId}`,
    // A single-analyte test names itself; a panel does not, so the parameter
    // stays empty and the bench says which analyte this line is.
    parameter_name: "",
    value: "",
    unit: usableDefault(test?.unit),
    normal_range: usableDefault(test?.normal_range),
  };
}

export function LabOrderDetail({
  orderId,
  canCreateResult,
  canCreateOrder,
  canVerify,
  canAmend,
  canPrintReports,
}: {
  orderId: string;
  canCreateResult: boolean;
  /**
   * Cancelling an order and adding a test on to one both require
   * `lab.orders.create`, not `lab.results.create`. They were gated on the
   * results code with the rest of the block, so a doctor -- who orders but
   * does not enter results -- was hidden two controls they hold.
   */
  canCreateOrder: boolean;
  canVerify: boolean;
  canAmend: boolean;
  canPrintReports: boolean;
}) {
  const { t } = useTranslation("lab");
  // The parent passes four write flags but never the read one: opening the
  // order carries lab.orders.view. Refused, `data` never arrives and the
  // panel renders as though the order has no results.
  const canViewOrder = useHasPermission(P.LAB.ORDERS_VIEW);
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [resultFormOpen, resultFormHandlers] = useDisclosure(false);
  const [collectOpened, { open: openCollect, close: closeCollect }] = useDisclosure(false);
  const [scannedId, setScannedId] = useState("");
  // Each row carries an id of its own. The key used to be built from the
  // values being typed, so every keystroke produced a new key, React
  // unmounted the input and remounted it, and the field lost focus after
  // each character. That is the whole of "the value entering is not clear".
  const [resultInputs, setResultInputs] = useState<ResultRow[]>([newResultRow()]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [amendData, setAmendData] = useState<{
    resultId: string;
    value: string;
    reason: string;
  } | null>(null);

  const { data } = useQuery<LabOrderDetailResponse>({
    queryKey: ["lab-order-detail", orderId],
    queryFn: () => labService.getLabOrder(orderId),
    enabled: canViewOrder,
  });

  // What was corrected, and why.
  //
  // Amendment overwrites the value in place and flips a badge to "amended".
  // The prior value, the prior flag and the stated reason all live in
  // `lab_result_amendments`, and `listLabAmendments` had no caller — so a
  // corrected report showed a number with no indication of what it replaced.
  // Fetched only when the report actually says amended, to keep the common
  // path at one round trip.
  const { data: amendments = [] } = useQuery({
    queryKey: ["lab-amendments", orderId],
    queryFn: () => labService.listLabAmendments(orderId),
    enabled: data?.order.report_status === "amended",
  });

  // Outstanding critical values on THIS order, chosen by the server.
  //
  // This used to ask for the tenant's last hundred alerts and keep the ones
  // matching this order, which is two independent ways to miss: the order's
  // alert need only be the hundred-and-first.
  const { data: orderAlerts = [], isError: orderAlertsFailed } = useQuery({
    queryKey: ["lab-critical-alerts", { orderId, acknowledged: false }],
    queryFn: () => labService.listCriticalAlerts({ order_id: orderId, acknowledged: "false" }),
  });

  const collectMutation = useMutation({
    mutationFn: (patientIdentifier: string) =>
      labService.collectSample(orderId, { patient_identifier: patientIdentifier }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      closeCollect();
      setScannedId("");
      toast.success("Identity confirmed — sample collected", { title: "Sample collected" });
      emit("lab.sample_collected", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        patient_id: result.patient_id,
        priority: result.priority,
        sample_barcode: result.sample_barcode,
        test_id: result.test_id,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Identity check failed" }),
  });
  const processMutation = useMutation({
    mutationFn: () => labService.startProcessing(orderId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not start processing" }),
  });
  const completeMutation = useMutation({
    mutationFn: () => labService.completeLabOrder(orderId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      emit("lab.order.completed", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        patient_id: result.patient_id,
        priority: result.priority,
        result_status: result.status,
        test_id: result.test_id,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not complete order" }),
  });
  const verifyMutation = useMutation({
    mutationFn: () => labService.verifyResults(orderId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      emit("lab.result.verified", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        patient_id: result.patient_id,
        priority: result.priority,
        result_status: result.status,
        test_id: result.test_id,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not verify results" }),
  });
  const cancelMutation = useMutation({
    mutationFn: () => labService.cancelLabOrder(orderId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not cancel order" }),
  });
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => labService.rejectSample(orderId, { rejection_reason: reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      setRejectionReason("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not reject sample" }),
  });
  const addResultsMutation = useMutation({
    mutationFn: () =>
      labService.addLabResults(orderId, {
        // The row id is local bookkeeping and is not part of the record.
        results: resultInputs.map(({ rowId: _rowId, ...result }) => result),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["lab-critical-alerts"] });
      emit("lab.results_entered", {
        order_id: orderId,
        patient_id: data?.order.patient_id,
        result_count: resultInputs.length,
      });
      resultFormHandlers.close();
      setResultInputs([newResultRow(data?.test)]);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save results" }),
  });

  // Report status mutations
  const reportStatusMutation = useMutation({
    mutationFn: (status: string) =>
      labService.updateLabReportStatus(orderId, {
        report_status: status as "preliminary" | "final" | "amended",
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not update report status" }),
  });
  const lockReportMutation = useMutation({
    mutationFn: () => labService.lockLabReport(orderId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not lock report" }),
  });
  const [ackAlert, setAckAlert] = useState<LabCriticalAlert | null>(null);
  // The delta says how far today's value moved; the trend says what it has
  // been doing. Same delta, different clinical picture.
  const [trendOpen, setTrendOpen] = useState(false);
  const [readback, setReadback] = useState("");
  const acknowledgeMutation = useMutation({
    mutationFn: (vars: { alertId: string; readback_value: string }) =>
      labService.acknowledgeCriticalAlert(vars.alertId, { readback_value: vars.readback_value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-critical-alerts"] });
      setAckAlert(null);
      setReadback("");
    },
    onError: (e: Error) =>
      notifications.show({ title: "Read-back", message: e.message, color: "danger" }),
  });
  const amendMutation = useMutation({
    mutationFn: (data: AmendResultRequest) => labService.amendLabResult(orderId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      setAmendData(null);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not amend result" }),
  });
  const addOnMutation = useMutation({
    mutationFn: (testId: string) => labService.addOnLabTest(orderId, { test_id: testId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      notifications.show({
        title: "Add-on test created",
        message: "Linked order created",
        color: "success",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not add on test" }),
  });

  const autoValidateMutation = useMutation({
    mutationFn: (resultId: string) => labService.autoValidateResult(resultId),
    onSuccess: (result: AutoValidateResult) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      notifications.show({
        title: result.auto_validated ? "Auto-validated" : "Validation skipped",
        message: result.message,
        color: result.auto_validated ? "success" : "warning",
      });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Auto-validation failed", color: "danger" });
    },
  });

  // Crossmatch link
  const { data: crossmatchData } = useQuery({
    queryKey: ["lab-order-crossmatch", orderId],
    queryFn: () => labService.getOrderCrossmatch(orderId),
    enabled: !!orderId,
    retry: false,
  });

  if (!data) return <Text c="dimmed">{t("loading...")}</Text>;

  const order = data.order;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700}>Order: {order.id.slice(0, 8)}...</Text>
        <Badge tone={toBadgeTone(statusColors[order.status])} size="lg">
          {order.status.replace(/_/g, " ")}
        </Badge>
      </Group>
      <PatientContextBanner patientId={order.patient_id} hideLoadingState />
      <Group>
        <Badge tone={toBadgeTone(statusColor(order.priority))} variant="dot">
          Priority: {order.priority}
        </Badge>
        {order.report_status && (
          <Badge tone={order.is_report_locked ? "danger" : "primary"} size="sm">
            Report: {order.report_status}
            {order.is_report_locked ? " (locked)" : ""}
          </Badge>
        )}
        {order.is_outsourced && (
          <Badge tone="accent" size="sm">
            Outsourced
          </Badge>
        )}
        {order.parent_order_id && (
          <Badge tone="primary" size="sm">
            Add-on
          </Badge>
        )}
        {crossmatchData && crossmatchData.crossmatch_requests.length > 0 && (
          <Badge tone="danger" size="sm" leftSection={<IconDroplet size={12} />}>
            Crossmatch ({crossmatchData.crossmatch_requests.length})
          </Badge>
        )}
      </Group>

      {/* Critical alerts banner */}
      {/* Same rule as the ward banner: a failed fetch is not an all-clear. */}
      {orderAlertsFailed && (
        <Alert
          tone="danger"
          icon={<IconAlertTriangle size={16} />}
          title="Critical alerts unavailable"
        >
          Could not load critical values for this order. Do not read this as there being none.
        </Alert>
      )}
      {orderAlerts.length > 0 && (
        <Alert
          tone="danger"
          icon={<IconAlertTriangle size={16} />}
          title={t("title.criticalValues")}
        >
          {orderAlerts.map((a: LabCriticalAlert) => (
            <Group key={a.id} justify="space-between" mb={4}>
              <Text size="sm" fw={500}>
                {a.parameter_name}: {a.value} ({a.flag.replace(/_/g, " ")})
              </Text>
              {/* Ungated until now: `acknowledge_critical_alert` requires
                  `lab.results.update`, which a nurse does not hold. They were
                  shown the NABH read-back control, typed the value a critical
                  result needs documenting against, and got a 403. */}
              {canVerify && (
                <Button
                  tone="subtle-danger"
                  size="xs"
                  onClick={() => {
                    setReadback("");
                    setAckAlert(a);
                  }}
                >
                  Acknowledge
                </Button>
              )}
            </Group>
          ))}
        </Alert>
      )}

      {ackAlert && (
        <Modal
          opened
          onClose={() => setAckAlert(null)}
          title="Acknowledge critical result — read back"
          size="sm"
        >
          <Stack gap="sm">
            <Text size="sm">
              Read back the value for <b>{ackAlert.parameter_name}</b> to confirm you received it
              correctly.
            </Text>
            <TextInput
              label="Read-back value"
              placeholder="Type the value you were told"
              value={readback}
              onChange={(e) => setReadback(e.currentTarget.value)}
            />
            <Button
              tone="primary"
              loading={acknowledgeMutation.isPending}
              disabled={!readback.trim()}
              onClick={() =>
                acknowledgeMutation.mutate({
                  alertId: ackAlert.id,
                  readback_value: readback.trim(),
                })
              }
            >
              Confirm acknowledgement
            </Button>
          </Stack>
        </Modal>
      )}

      <Modal
        opened={collectOpened}
        onClose={closeCollect}
        title="Confirm patient identity"
        size="sm"
      >
        <Stack gap="md">
          <Alert tone="warning" title="Positive patient identification">
            Confirm you are drawing from the right patient. Scan the wristband (or key the UHID) —
            the system checks it against this order to prevent wrong-blood-in-tube.
          </Alert>

          <Card withBorder padding="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Collecting from
            </Text>
            <PatientNameCell patientId={order.patient_id} showUhid={false} />
          </Card>

          <Input
            label="Scan wristband / enter UHID"
            placeholder="Scan the patient's wristband"
            value={scannedId}
            onChange={(e) => setScannedId(e.currentTarget.value)}
            autoFocus
          />

          <Group justify="flex-end">
            <Button tone="ghost" onClick={closeCollect}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={collectMutation.isPending}
              disabled={!scannedId.trim()}
              onClick={() => collectMutation.mutate(scannedId.trim())}
            >
              Confirm &amp; collect
            </Button>
          </Group>
        </Stack>
      </Modal>

      {order.rejection_reason && (
        <Badge tone="danger" size="lg">
          Rejected: {order.rejection_reason}
        </Badge>
      )}

      {/* Status transition buttons */}
      {canCreateResult && (
        <Group>
          {order.status === "ordered" && (
            <Button tone="primary" size="xs" onClick={openCollect}>
              {t("collectSample")}
            </Button>
          )}
          {order.status === "sample_collected" && (
            <Button tone="primary" size="xs" onClick={() => processMutation.mutate()}>
              {t("startProcessing")}
            </Button>
          )}
          {order.status === "processing" && (
            <Button tone="primary" size="xs" onClick={() => completeMutation.mutate()}>
              {t("complete")}
            </Button>
          )}
          {/* Cancelling is an order-level act: `cancel_order` requires
              `lab.orders.create`, not the results code the rest of this block
              is gated on. A doctor holds the former and not the latter. */}
          {order.status === "ordered" && canCreateOrder && (
            <Button
              tone="subtle-danger"
              size="xs"
              onClick={() =>
                confirmDestructive({
                  title: "Cancel order",
                  message: "Cancel this lab order? This cannot be undone.",
                  confirmLabel: "Cancel order",
                  cancelLabel: "Keep",
                  onConfirm: () => cancelMutation.mutate(),
                })
              }
            >
              {t("cancel")}
            </Button>
          )}
          {(order.status === "ordered" || order.status === "sample_collected") && (
            <Group gap="xs">
              <TextInput
                size="xs"
                placeholder={t("placeholder.rejectionReason")}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.currentTarget.value)}
                w={200}
              />
              <Button
                tone="danger"
                size="xs"
                disabled={!rejectionReason}
                onClick={() => rejectMutation.mutate(rejectionReason)}
                loading={rejectMutation.isPending}
              >
                Reject Sample
              </Button>
            </Group>
          )}
        </Group>
      )}
      {canVerify && order.status === "completed" && (
        <Button tone="primary" size="xs" onClick={() => verifyMutation.mutate()}>
          {t("verifyResults")}
        </Button>
      )}
      {canPrintReports && order.status === "verified" && (
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconPrinter size={14} />}
          onClick={() => {
            void printLabReportPacket(order.id);
          }}
        >
          Print report
        </Button>
      )}
      {canPrintReports && order.status === "verified" && (
        <DocumentActions templateCode="lab_report" sourceId={order.id} />
      )}

      {/* Report status controls */}
      {canVerify &&
        (order.status === "completed" || order.status === "verified") &&
        !order.is_report_locked && (
          <Group>
            <Button
              tone="secondary"
              size="xs"
              onClick={() => reportStatusMutation.mutate("preliminary")}
            >
              {t("setPreliminary")}
            </Button>
            <Button tone="secondary" size="xs" onClick={() => reportStatusMutation.mutate("final")}>
              {t("setFinal")}
            </Button>
            <Button
              tone="subtle-danger"
              size="xs"
              leftSection={<IconLock size={14} />}
              onClick={() => lockReportMutation.mutate()}
            >
              {t("lockReport")}
            </Button>
          </Group>
        )}

      <Text fw={600} mt="md">
        {t("results")}
      </Text>
      <DataTable
        columns={[
          { key: "parameter", label: "Parameter", render: (r: LabResult) => r.parameter_name },
          {
            key: "value",
            label: "Value",
            render: (r: LabResult) => <Text fw={500}>{r.value}</Text>,
          },
          { key: "unit", label: "Unit", render: (r: LabResult) => r.unit ?? "—" },
          { key: "range", label: "Range", render: (r: LabResult) => r.normal_range ?? "—" },
          {
            key: "flag",
            label: "Flag",
            render: (r: LabResult) =>
              r.flag ? (
                <Badge tone={flagColors[r.flag] ?? "neutral"} size="sm">
                  {r.flag.replace(/_/g, " ")}
                </Badge>
              ) : (
                "—"
              ),
          },
          {
            key: "delta",
            label: "Delta",
            // A percentage without the value it moved from is not a delta
            // check, it is a number. "Δ 42%" cannot tell a real deterioration
            // from a mislabelled tube; "1.1 → 1.6" can. `previous_value` has
            // been computed and stored at entry all along with no consumer.
            render: (r: LabResult) => {
              if (!r.is_delta_flagged && !r.delta_percent) return "—";
              const move = r.previous_value ? `${r.previous_value} → ${r.value}` : null;
              const pct = r.delta_percent ? `${Number(r.delta_percent).toFixed(1)}%` : "flagged";
              return (
                <Stack gap={0}>
                  {r.is_delta_flagged ? (
                    <Badge tone="danger" size="sm">
                      Δ {pct}
                    </Badge>
                  ) : (
                    <Text size="xs" c="dimmed">
                      {pct}
                    </Text>
                  )}
                  {move && (
                    <Text size="xs" c="dimmed">
                      {move}
                    </Text>
                  )}
                </Stack>
              );
            },
          },
          // `auto_validate_result` requires `lab.results.create`. Gating
          // it on `update` showed the control to a doctor, who holds
          // update but not create, and got a 403 on press.
          ...(canCreateResult && !order.is_report_locked
            ? [
                {
                  key: "auto-validate",
                  label: "Auto-Validate",
                  render: (r: LabResult) =>
                    (order.status === "completed" || order.status === "processing") && (
                      <Tooltip label={t("label.autoValidateResult")}>
                        <IconButton
                          size="xs"
                          tone="success"
                          loading={autoValidateMutation.isPending}
                          onClick={() => autoValidateMutation.mutate(r.id)}
                          aria-label={t("aria.robot")}
                        >
                          <IconRobot size={12} />
                        </IconButton>
                      </Tooltip>
                    ),
                },
              ]
            : []),
          ...(canAmend && !order.is_report_locked
            ? [
                {
                  key: "amend",
                  label: "Amend",
                  render: (r: LabResult) => (
                    <IconButton
                      size="xs"
                      onClick={() => setAmendData({ resultId: r.id, value: r.value, reason: "" })}
                      aria-label={t("aria.refresh")}
                    >
                      <IconRefresh size={12} />
                    </IconButton>
                  ),
                },
              ]
            : []),
        ]}
        data={data?.results ?? []}
        rowKey={(r) => r.id}
      />

      {/* Amendment form */}
      {amendData && (
        <Stack
          gap="xs"
          p="xs"
          style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
        >
          <Text size="sm" fw={600}>
            {t("amendResult")}
          </Text>
          <TextInput
            size="xs"
            label={t("label.newValue")}
            value={amendData.value}
            onChange={(e) => setAmendData({ ...amendData, value: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label={t("label.reason(required)")}
            value={amendData.reason}
            onChange={(e) => setAmendData({ ...amendData, reason: e.currentTarget.value })}
          />
          <Group>
            <Button
              tone="primary"
              size="xs"
              disabled={!amendData.reason}
              onClick={() =>
                amendMutation.mutate({
                  result_id: amendData.resultId,
                  amended_value: amendData.value,
                  reason: amendData.reason,
                })
              }
              loading={amendMutation.isPending}
            >
              Save Amendment
            </Button>
            <Button tone="secondary" size="xs" onClick={() => setAmendData(null)}>
              Cancel
            </Button>
          </Group>
        </Stack>
      )}

      {/* Only a verified report is handed to a patient. Printing an
          unverified one puts a number nobody has signed off into somebody's
          hand, and it cannot be recalled — so the button is present at every
          status and enabled at one. */}
      <Group>
        <PrintLabReportButton orderId={orderId} disabled={order.status !== "verified"} />
      </Group>

      {/* Add results form */}
      {canCreateResult &&
        (order.status === "processing" || order.status === "sample_collected") && (
          <>
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                // Seed the first row from the catalogue when the form opens,
                // not when the component mounts: at mount the order has not
                // loaded yet, and the first row is the one most likely to be
                // the only one.
                if (!resultFormOpen) {
                  setResultInputs([newResultRow(data?.test)]);
                }
                resultFormHandlers.toggle();
              }}
            >
              Add Results
            </Button>
            {resultFormOpen && (
              <Stack gap="xs">
                {resultInputs.map((ri, idx) => {
                  const patch = (change: Partial<ResultRow>) =>
                    setResultInputs((rows) =>
                      rows.map((row, i) => (i === idx ? { ...row, ...change } : row)),
                    );
                  return (
                    <Group key={ri.rowId} align="flex-end" grow>
                      <TextInput
                        // Real labels, not placeholders. A placeholder
                        // disappears the moment somebody types, so a
                        // half-filled row stops saying which column is which —
                        // and a screen reader never announced them at all.
                        label={idx === 0 ? t("parameter") : undefined}
                        aria-label={t("parameter")}
                        placeholder="Haemoglobin"
                        value={ri.parameter_name}
                        onChange={(e) => patch({ parameter_name: e.currentTarget.value })}
                      />
                      <TextInput
                        label={idx === 0 ? t("value") : undefined}
                        aria-label={t("value")}
                        placeholder="13.4"
                        value={ri.value}
                        onChange={(e) => patch({ value: e.currentTarget.value })}
                      />
                      <TextInput
                        label={idx === 0 ? t("unit") : undefined}
                        aria-label={t("unit")}
                        placeholder="g/dL"
                        // This field had an onChange and no value — an
                        // uncontrolled input whose contents and state could
                        // drift apart, and which survived a form reset.
                        value={ri.unit ?? ""}
                        onChange={(e) => patch({ unit: e.currentTarget.value || undefined })}
                      />
                      <TextInput
                        // normal_range has always been part of ResultInput and
                        // the form never offered it, so every result was
                        // recorded without the range it should be read against
                        // — and the printed report had nothing to put in that
                        // column.
                        label={idx === 0 ? "Reference range" : undefined}
                        aria-label="Reference range"
                        placeholder="13.0-17.0"
                        value={ri.normal_range ?? ""}
                        onChange={(e) =>
                          patch({ normal_range: e.currentTarget.value || undefined })
                        }
                      />
                      <Select
                        label={idx === 0 ? t("flag") : undefined}
                        aria-label={t("flag")}
                        placeholder="—"
                        data={[
                          "normal",
                          "low",
                          "high",
                          "critical_low",
                          "critical_high",
                          "abnormal",
                        ]}
                        clearable
                        value={ri.flag ?? null}
                        onChange={(v) => patch({ flag: toLabResultFlag(v) })}
                      />
                    </Group>
                  );
                })}
                <Group>
                  <Button
                    tone="secondary"
                    size="xs"
                    onClick={() => setResultInputs([...resultInputs, newResultRow(data?.test)])}
                  >
                    Add Row
                  </Button>
                  <Button
                    tone="primary"
                    size="xs"
                    onClick={() => addResultsMutation.mutate()}
                    loading={addResultsMutation.isPending}
                  >
                    Save Results
                  </Button>
                </Group>
              </Stack>
            )}
          </>
        )}

      {/* Add-on test */}
      {canPrintReports && (
        <Group>
          <Button tone="secondary" size="xs" onClick={() => setTrendOpen(true)}>
            View trend
          </Button>
        </Group>
      )}

      <CumulativeTrendDrawer
        opened={trendOpen}
        onClose={() => setTrendOpen(false)}
        patientId={order.patient_id}
        testId={order.test_id}
      />

      {amendments.length > 0 && (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Amendments
          </Text>
          <Alert tone="warning" title="This report has been corrected">
            An amended value replaces the one reported before it. Anyone acting on the earlier
            report needs to know what changed.
          </Alert>
          {amendments.map((a: LabResultAmendment) => (
            <Group key={a.id} justify="space-between" wrap="nowrap">
              <Stack gap={0}>
                <Text size="sm">
                  {a.original_value ?? "—"}
                  {a.original_flag ? ` (${a.original_flag})` : ""} → {a.amended_value ?? "—"}
                  {a.amended_flag ? ` (${a.amended_flag})` : ""}
                </Text>
                <Text size="xs" c="dimmed">
                  {a.reason}
                </Text>
              </Stack>
              <Text size="xs" c="dimmed">
                {new Date(a.amended_at).toLocaleString()}
              </Text>
            </Group>
          ))}
        </Stack>
      )}

      {/* `add_on_test` requires `lab.orders.create` -- adding a test is
          ordering one. */}
      {canCreateOrder && order.status !== "cancelled" && (
        <AddOnTestSection
          onAddOn={(testId) => addOnMutation.mutate(testId)}
          isPending={addOnMutation.isPending}
        />
      )}
    </Stack>
  );
}
