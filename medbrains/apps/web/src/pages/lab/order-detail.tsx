// Lab LabOrderDetail — split from lab.tsx (pure move).

import { Card, Group, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  AmendResultRequest,
  AutoValidateResult,
  LabCriticalAlert,
  LabOrderDetailResponse,
  LabResult,
  ResultInput,
} from "@medbrains/types";
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
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Alert, Badge, Button, IconButton, Input, Modal, toast } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { statusColor } from "@/lib/status-colors";
import { labService } from "@/services/lab.service";
import { AddOnTestSection } from "./add-on-test";
import {
  flagColors,
  printLabReportPacket,
  statusColors,
  toBadgeTone,
  toLabResultFlag,
} from "./shared";

export function LabOrderDetail({
  orderId,
  canCreateResult,
  canVerify,
  canAmend,
  canPrintReports,
}: {
  orderId: string;
  canCreateResult: boolean;
  canVerify: boolean;
  canAmend: boolean;
  canPrintReports: boolean;
}) {
  const { t } = useTranslation("lab");
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [resultFormOpen, resultFormHandlers] = useDisclosure(false);
  const [collectOpened, { open: openCollect, close: closeCollect }] = useDisclosure(false);
  const [scannedId, setScannedId] = useState("");
  const [resultInputs, setResultInputs] = useState<ResultInput[]>([
    { parameter_name: "", value: "" },
  ]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [amendData, setAmendData] = useState<{
    resultId: string;
    value: string;
    reason: string;
  } | null>(null);

  const { data } = useQuery<LabOrderDetailResponse>({
    queryKey: ["lab-order-detail", orderId],
    queryFn: () => labService.getLabOrder(orderId),
  });

  // Critical alerts for this order
  const { data: alerts = [] } = useQuery({
    queryKey: ["lab-critical-alerts"],
    queryFn: () => labService.listCriticalAlerts(),
  });

  const orderAlerts = alerts.filter(
    (a: LabCriticalAlert) => a.order_id === orderId && !a.acknowledged_at,
  );

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
    mutationFn: () => labService.addLabResults(orderId, { results: resultInputs }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-order-detail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["lab-critical-alerts"] });
      emit("lab.results_entered", {
        order_id: orderId,
        patient_id: data?.order.patient_id,
        result_count: resultInputs.length,
      });
      resultFormHandlers.close();
      setResultInputs([{ parameter_name: "", value: "" }]);
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
          {order.status === "ordered" && (
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
            render: (r: LabResult) =>
              r.is_delta_flagged ? (
                <Badge tone="danger" size="sm">
                  Δ {r.delta_percent ? `${Number(r.delta_percent).toFixed(1)}%` : "flagged"}
                </Badge>
              ) : r.delta_percent ? (
                <Text size="xs" c="dimmed">
                  {Number(r.delta_percent).toFixed(1)}%
                </Text>
              ) : (
                "—"
              ),
          },
          ...(canVerify && !order.is_report_locked
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

      {/* Add results form */}
      {canCreateResult &&
        (order.status === "processing" || order.status === "sample_collected") && (
          <>
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={resultFormHandlers.toggle}
            >
              Add Results
            </Button>
            {resultFormOpen && (
              <Stack gap="xs">
                {resultInputs.map((ri, idx) => (
                  <Group
                    key={`${ri.parameter_name || "parameter"}-${ri.value || "value"}-${ri.unit || "unit"}`}
                    grow
                  >
                    <TextInput
                      placeholder={t("parameter")}
                      value={ri.parameter_name}
                      onChange={(e) => {
                        const updated = [...resultInputs];
                        updated[idx] = { ...ri, parameter_name: e.currentTarget.value };
                        setResultInputs(updated);
                      }}
                    />
                    <TextInput
                      placeholder={t("value")}
                      value={ri.value}
                      onChange={(e) => {
                        const updated = [...resultInputs];
                        updated[idx] = { ...ri, value: e.currentTarget.value };
                        setResultInputs(updated);
                      }}
                    />
                    <TextInput
                      placeholder={t("unit")}
                      onChange={(e) => {
                        const updated = [...resultInputs];
                        updated[idx] = { ...ri, unit: e.currentTarget.value || undefined };
                        setResultInputs(updated);
                      }}
                    />
                    <Select
                      placeholder={t("flag")}
                      data={["normal", "low", "high", "critical_low", "critical_high", "abnormal"]}
                      clearable
                      onChange={(v) => {
                        const updated = [...resultInputs];
                        updated[idx] = { ...ri, flag: toLabResultFlag(v) };
                        setResultInputs(updated);
                      }}
                    />
                  </Group>
                ))}
                <Group>
                  <Button
                    tone="secondary"
                    size="xs"
                    onClick={() =>
                      setResultInputs([...resultInputs, { parameter_name: "", value: "" }])
                    }
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
      {canCreateResult && order.status !== "cancelled" && (
        <AddOnTestSection
          onAddOn={(testId) => addOnMutation.mutate(testId)}
          isPending={addOnMutation.isPending}
        />
      )}
    </Stack>
  );
}
