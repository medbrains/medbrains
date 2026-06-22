import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, Stack, Tabs, Text, Textarea, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { NotifiableReport } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconReportMedical, IconVirus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable, PageHeader, type RailGroup, WorkspaceRail } from "@/components";
import { Badge, type BadgeTone, Button, Input, Modal, Switch, toast } from "@/components/ui";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { ckbService } from "@/services/ckb.service";
import styles from "./mrd.module.scss";

const CKB_TABS = ["notifiable", "reports"] as const;

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "warning",
  submitted: "success",
  exempted: "neutral",
};

export function ClinicalKbPage() {
  useRequirePermission(P.CKB.VIEW);
  const canManage = useHasPermission(P.CKB.REPORTS_MANAGE);

  const groups: RailGroup[] = [
    {
      label: "Statutory",
      items: [
        { value: "notifiable", label: "Notifiable diseases", icon: <IconVirus size={14} /> },
        { value: "reports", label: "Reporting worklist", icon: <IconReportMedical size={14} /> },
      ],
    },
  ];
  const [tab, setTab] = useHashTabs("notifiable", CKB_TABS);

  return (
    <Box className={styles.page}>
      <PageHeader
        title="Clinical Knowledge Base"
        subtitle="Diagnosis reference, notifiable diseases & statutory reporting"
      />
      <Box className={styles.workspace}>
        <WorkspaceRail groups={groups} active={tab} onChange={setTab}>
          <Tabs.Panel value="notifiable">
            <NotifiableDiseasesTab />
          </Tabs.Panel>
          <Tabs.Panel value="reports">
            <ReportsTab canManage={canManage} />
          </Tabs.Panel>
        </WorkspaceRail>
      </Box>
    </Box>
  );
}

function NotifiableDiseasesTab() {
  const [search, setSearch] = useState("");
  const [notifiableOnly, setNotifiableOnly] = useState(true);

  const { data: diagnoses = [], isLoading } = useQuery({
    queryKey: ["ckb-diagnoses", search, notifiableOnly],
    queryFn: () =>
      ckbService.listCkbDiagnoses({ q: search.trim(), notifiable_only: notifiableOnly }),
  });

  return (
    <Stack>
      <Group justify="space-between" wrap="nowrap">
        <Input
          placeholder="Search diagnosis or ICD-10 code"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={320}
        />
        <Switch
          label="Notifiable only"
          checked={notifiableOnly}
          onChange={(e) => setNotifiableOnly(e.currentTarget.checked)}
        />
      </Group>
      <DataTable
        columns={[
          {
            key: "icd10_code",
            label: "ICD-10",
            render: (d) => (
              <Text size="sm" ff="var(--mb-font-mono)">
                {d.icd10_code}
              </Text>
            ),
          },
          { key: "name", label: "Diagnosis", render: (d) => <Text size="sm">{d.name}</Text> },
          {
            key: "department",
            label: "Department",
            render: (d) => (
              <Text size="sm" c="dimmed">
                {d.department ?? "—"}
              </Text>
            ),
          },
          {
            key: "notifiable",
            label: "Notifiable",
            render: (d) =>
              d.is_notifiable ? (
                <Badge tone="danger" leftSection={<IconAlertTriangle size={11} />}>
                  {d.reporting_body ?? "Notifiable"}
                  {d.report_timeframe ? ` · ${d.report_timeframe}` : ""}
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
        ]}
        data={diagnoses}
        loading={isLoading}
        rowKey={(d) => d.icd10_code}
      />
    </Stack>
  );
}

function ReportsTab({ canManage }: { canManage: boolean }) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [target, setTarget] = useState<NotifiableReport | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["ckb-notifiable-reports", statusFilter],
    queryFn: () => ckbService.listNotifiableReports(statusFilter || undefined),
  });

  return (
    <Stack>
      <Group gap="xs">
        {["pending", "submitted", "exempted", ""].map((s) => (
          <Button
            key={s || "all"}
            size="xs"
            tone={statusFilter === s ? "primary" : "ghost"}
            onClick={() => setStatusFilter(s)}
          >
            {s || "All"}
          </Button>
        ))}
      </Group>
      <DataTable
        columns={[
          {
            key: "disease_name",
            label: "Disease",
            render: (r) => (
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  {r.disease_name}
                </Text>
                <Text size="xs" c="dimmed" ff="var(--mb-font-mono)">
                  {r.icd10_code}
                  {r.reporting_body ? ` · ${r.reporting_body}` : ""}
                </Text>
              </Stack>
            ),
          },
          {
            key: "detected_at",
            label: "Detected",
            render: (r) => <Text size="sm">{new Date(r.detected_at).toLocaleString()}</Text>,
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>,
          },
          {
            key: "report_ref",
            label: "Ref",
            render: (r) => (
              <Text size="sm" c="dimmed">
                {r.report_ref ?? "—"}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (r) =>
              canManage && r.status === "pending" ? (
                <Button size="xs" tone="primary" onClick={() => setTarget(r)}>
                  Resolve
                </Button>
              ) : null,
          },
        ]}
        data={reports}
        loading={isLoading}
        rowKey={(r) => r.id}
      />
      <ResolveReportModal report={target} onClose={() => setTarget(null)} />
    </Stack>
  );
}

const resolveSchema = z.object({
  status: z.enum(["submitted", "exempted"]),
  report_ref: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
type ResolveValues = z.infer<typeof resolveSchema>;

function ResolveReportModal({
  report,
  onClose,
}: {
  report: NotifiableReport | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResolveValues>({
    resolver: zodResolver(resolveSchema),
    defaultValues: { status: "submitted", report_ref: "", notes: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ResolveValues) =>
      ckbService.updateNotifiableReport(report?.id ?? "", {
        status: values.status,
        report_ref: values.report_ref || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ckb-notifiable-reports"] });
      toast.success("Report updated", { title: "Notifiable disease" });
      reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not update" }),
  });

  return (
    <Modal opened={report !== null} onClose={onClose} title="Resolve notifiable report" size="md">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {report?.disease_name} ({report?.icd10_code})
        </Text>
        <Controller
          control={control}
          name="report_ref"
          render={({ field }) => (
            <TextInput
              label="Report reference (IHIP/IDSP ack no.)"
              placeholder="e.g. IHIP-2026-00481"
              value={field.value ?? ""}
              onChange={field.onChange}
              error={errors.report_ref?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea
              label="Notes"
              autosize
              minRows={2}
              value={field.value ?? ""}
              onChange={field.onChange}
            />
          )}
        />
        <Group justify="flex-end">
          <Button
            tone="secondary"
            loading={mutation.isPending}
            onClick={handleSubmit((v) => mutation.mutate({ ...v, status: "exempted" }))}
          >
            Exempt
          </Button>
          <Button
            tone="primary"
            loading={mutation.isPending}
            onClick={handleSubmit((v) => mutation.mutate({ ...v, status: "submitted" }))}
          >
            Mark submitted
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
