// Radiology OrderDetailDrawer — split from radiology.tsx (pure move).

import { Drawer, Group, Stack, Switch, Tabs, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { RadiationDoseRecord } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, useClinicalEmit } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { Badge, Button } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { radiologyService } from "@/services/radiology.service";
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
    <Drawer opened onClose={onClose} title="Order Detail" position="right" size="lg">
      {order && (
        <Stack>
          <PatientContextBanner patientId={order.patient_id} hideLoadingState />
          <Group>
            <Text fw={600}>Status:</Text>
            <Badge tone={colorToBadgeTone(statusColors[order.status])}>{order.status}</Badge>
            <Text fw={600}>Priority:</Text>
            <Badge tone={colorToBadgeTone(statusColor(order.priority))}>{order.priority}</Badge>
          </Group>
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
              <Tabs.Tab value="dose">Dose Tracking</Tabs.Tab>
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
              {doseRecords.length > 0 ? (
                <DataTable
                  columns={[
                    {
                      key: "modality",
                      label: "Modality",
                      render: (d: RadiationDoseRecord) => d.modality_code,
                    },
                    {
                      key: "body_part",
                      label: "Body Part",
                      render: (d: RadiationDoseRecord) => d.body_part ?? "—",
                    },
                    {
                      key: "dose",
                      label: "Dose",
                      render: (d: RadiationDoseRecord) =>
                        d.dose_value ? `${d.dose_value} ${d.dose_unit}` : "—",
                    },
                    {
                      key: "dlp",
                      label: "DLP",
                      render: (d: RadiationDoseRecord) => d.dlp ?? "—",
                    },
                    {
                      key: "ctdi_vol",
                      label: "CTDIvol",
                      render: (d: RadiationDoseRecord) => d.ctdi_vol ?? "—",
                    },
                    {
                      key: "recorded",
                      label: "Recorded",
                      render: (d: RadiationDoseRecord) => new Date(d.recorded_at).toLocaleString(),
                    },
                  ]}
                  data={doseRecords}
                  rowKey={(d) => d.id}
                />
              ) : (
                <Text c="dimmed" size="sm">
                  No dose records.
                </Text>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  Modalities Tab
// ══════════════════════════════════════════════════════════
