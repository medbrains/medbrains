// Radiology OrderDetailDrawer — split from radiology.tsx (pure move).

import { Group, Stack, Switch, Tabs, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPrinter } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useClinicalEmit } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PrintDocumentMenu } from "@/components/Print/PrintDocumentMenu";
import { Badge, Button, Modal } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { radiologyService } from "@/services/radiology.service";
import { DoseTab } from "./dose-tab";
import { OrderImages } from "./OrderImages";
import { OrderFormFNotice } from "./order-form-f-notice";
import { colorToBadgeTone, printRadiologyReportPacket, statusColors } from "./shared";

export function OrderDetailDrawer({
  id,
  onClose,
  canReport,
  canVerify,
  canPrintReports,
}: {
  id: string;
  onClose: () => void;
  canReport: boolean;
  canVerify: boolean;
  canPrintReports: boolean;
}) {
  const qc = useQueryClient();
  const emit = useClinicalEmit();

  const { data } = useQuery({
    queryKey: ["radiology-order", id],
    queryFn: () => radiologyService.getRadiologyOrder(id),
  });

  const [reportTab, setReportTab] = useState<string | null>("details");
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [isCritical, setIsCritical] = useState(false);

  const reportMutation = useMutation({
    mutationFn: () =>
      radiologyService.createRadiologyReport(id, {
        findings,
        impression: impression || undefined,
        recommendations: recommendations || undefined,
        is_critical: isCritical,
        status: "preliminary",
      }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["radiology-order", id] });
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      notifications.show({ title: "Report created", message: "", color: "success" });
      if (order) {
        emit("radiology.report.created", {
          body_part: order.body_part,
          encounter_id: order.encounter_id,
          is_critical: result.is_critical,
          modality_id: order.modality_id,
          order_id: order.id,
          patient_id: order.patient_id,
          report_id: result.id,
          report_status: result.status,
          reported_at: result.created_at,
        });
      }
      setFindings("");
      setImpression("");
      setRecommendations("");
      setIsCritical(false);
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not create report", message: e.message, color: "red" }),
  });

  const verifyMutation = useMutation({
    mutationFn: (reportId: string) => radiologyService.verifyRadiologyReport(reportId),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["radiology-order", id] });
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      if (order) {
        emit("radiology.report.verified", {
          body_part: order.body_part,
          encounter_id: order.encounter_id,
          modality_id: order.modality_id,
          order_id: order.id,
          patient_id: order.patient_id,
          report_id: result.id,
          report_status: result.status,
          verified_at: result.verified_at,
        });
      }
      notifications.show({ title: "Report verified", message: "", color: "success" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not verify report", message: e.message, color: "red" }),
  });

  const order = data?.order;
  const report = data?.report;
  const doseRecords = data?.dose_records ?? [];

  return (
    <Modal opened onClose={onClose} title="Order Detail" fullScreen>
      {order && (
        <Stack>
          <PatientContextBanner
            patientId={order.patient_id}
            hideLoadingState
            collectLane="radiology"
          />
          <Group>
            <Text fw={600}>Status:</Text>
            <Badge tone={colorToBadgeTone(statusColors[order.status])}>{order.status}</Badge>
            <Text fw={600}>Priority:</Text>
            <Badge tone={colorToBadgeTone(statusColor(order.priority))}>{order.priority}</Badge>
          </Group>
          <OrderFormFNotice orderId={order.id} />
          <OrderImages order={order} />
          {order.body_part && <Text size="sm">Body Part: {order.body_part}</Text>}
          {order.clinical_indication && (
            <Text size="sm">Indication: {order.clinical_indication}</Text>
          )}
          {order.cancellation_reason && (
            <Badge tone="danger">Cancelled: {order.cancellation_reason}</Badge>
          )}

          <Tabs value={reportTab} onChange={setReportTab}>
            <Tabs.List>
              <Tabs.Tab value="details">Details</Tabs.Tab>
              <Tabs.Tab value="report">Report</Tabs.Tab>
              <Tabs.Tab value="dose">Radiation dose</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="details" pt="sm">
              <Stack gap="xs">
                <Group gap={8}>
                  {order.contrast_required && (
                    <Badge size="sm" tone="warning">
                      Contrast Required
                    </Badge>
                  )}
                  {order.pregnancy_checked && (
                    <Badge size="sm" tone="danger">
                      Pregnancy Verified
                    </Badge>
                  )}
                  {order.allergy_flagged && (
                    <Badge size="sm" tone="danger">
                      Allergy Flagged
                    </Badge>
                  )}
                </Group>
                {order.notes && <Text size="sm">Notes: {order.notes}</Text>}
                {order.scheduled_at && (
                  <Text size="sm">Scheduled: {new Date(order.scheduled_at).toLocaleString()}</Text>
                )}
                {order.completed_at && (
                  <Text size="sm">Completed: {new Date(order.completed_at).toLocaleString()}</Text>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="report" pt="sm">
              {report ? (
                <Stack>
                  <Group>
                    <Badge tone={report.status === "final" ? "success" : "warning"}>
                      {report.status}
                    </Badge>
                    {report.is_critical && <Badge tone="danger">CRITICAL</Badge>}
                  </Group>
                  <Text fw={600}>Findings:</Text>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {report.findings}
                  </Text>
                  {report.impression && (
                    <>
                      <Text fw={600}>Impression:</Text>
                      <Text size="sm">{report.impression}</Text>
                    </>
                  )}
                  {report.recommendations && (
                    <>
                      <Text fw={600}>Recommendations:</Text>
                      <Text size="sm">{report.recommendations}</Text>
                    </>
                  )}
                  {canVerify && report.status !== "final" && (
                    <Button
                      tone="primary"
                      onClick={() => verifyMutation.mutate(report.id)}
                      loading={verifyMutation.isPending}
                    >
                      Verify & Finalize Report
                    </Button>
                  )}
                  {canPrintReports && order.status === "verified" && (
                    <Button
                      tone="secondary"
                      leftSection={<IconPrinter size={16} />}
                      onClick={() => {
                        void printRadiologyReportPacket(order.id);
                      }}
                    >
                      Print report
                    </Button>
                  )}
                  {order.status === "verified" && (
                    <PrintDocumentMenu
                      idKind="radiology_order"
                      recordId={order.id}
                      exclude={["radiology-report"]}
                      label="Also print"
                    />
                  )}
                </Stack>
              ) : canReport && ["completed", "in_progress"].includes(order.status) ? (
                <Stack>
                  <Textarea
                    label="Findings"
                    required
                    value={findings}
                    onChange={(e) => setFindings(e.currentTarget.value)}
                    minRows={4}
                  />
                  <Textarea
                    label="Impression"
                    value={impression}
                    onChange={(e) => setImpression(e.currentTarget.value)}
                  />
                  <Textarea
                    label="Recommendations"
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.currentTarget.value)}
                  />
                  <Switch
                    label="Critical Finding"
                    checked={isCritical}
                    onChange={(e) => setIsCritical(e.currentTarget.checked)}
                  />
                  <Button
                    tone="primary"
                    onClick={() => reportMutation.mutate()}
                    loading={reportMutation.isPending}
                    disabled={!findings}
                  >
                    Submit Report
                  </Button>
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">
                  No report available yet.
                </Text>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="dose" pt="sm">
              <DoseTab orderId={order.id} patientId={order.patient_id} records={doseRecords} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════
//  Modalities Tab
// ══════════════════════════════════════════════════════════
