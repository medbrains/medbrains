import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, Stack, Tabs, Text, Textarea, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { NotifiableReport } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconFlask,
  IconPill,
  IconReportMedical,
  IconVirus,
} from "@tabler/icons-react";
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

const CKB_TABS = ["notifiable", "reports", "formulary", "lab"] as const;

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
    {
      label: "Reference",
      items: [
        { value: "formulary", label: "Drug formulary", icon: <IconPill size={14} /> },
        { value: "lab", label: "Lab reference", icon: <IconFlask size={14} /> },
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
          <Tabs.Panel value="formulary">
            <FormularyTab />
          </Tabs.Panel>
          <Tabs.Panel value="lab">
            <LabReferenceTab />
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

function LabReferenceTab() {
  const [search, setSearch] = useState("");
  const { data: analytes = [], isLoading } = useQuery({
    queryKey: ["ckb-lab-reference", search],
    queryFn: () => ckbService.listCkbLabReference(search.trim() || undefined),
  });
  const fmt = (n?: number | null) => (n === null || n === undefined ? "—" : String(n));

  return (
    <Stack>
      <Group justify="space-between">
        <Input
          placeholder="Search analyte or test"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={320}
        />
        <Text size="xs" c="dimmed">
          Auto-flags critical results at result entry
        </Text>
      </Group>
      <DataTable
        columns={[
          {
            key: "analyte",
            label: "Analyte",
            render: (a) => (
              <Stack gap={0}>
                <Text size="sm" fw={600} tt="capitalize">
                  {a.analyte}
                </Text>
                {a.test ? (
                  <Text size="xs" c="dimmed">
                    {a.test}
                  </Text>
                ) : null}
              </Stack>
            ),
          },
          { key: "unit", label: "Unit", render: (a) => <Text size="sm">{a.unit ?? "—"}</Text> },
          {
            key: "normal",
            label: "Normal",
            render: (a) => (
              <Text size="sm">
                {fmt(a.normal_low)}–{fmt(a.normal_high)}
              </Text>
            ),
          },
          {
            key: "critical",
            label: "Critical",
            render: (a) =>
              a.critical_low !== null || a.critical_high !== null ? (
                <Badge tone="danger">
                  &lt;{fmt(a.critical_low)} / &gt;{fmt(a.critical_high)}
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "pregnancy",
            label: "Pregnancy",
            render: (a) =>
              a.pregnancy_low !== null || a.pregnancy_high !== null ? (
                <Text size="sm">
                  {fmt(a.pregnancy_low)}–{fmt(a.pregnancy_high)}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "elderly",
            label: "Elderly (≥65)",
            render: (a) =>
              a.elderly_low !== null || a.elderly_high !== null ? (
                <Text size="sm">
                  {fmt(a.elderly_low)}–{fmt(a.elderly_high)}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "category",
            label: "Category",
            render: (a) => (
              <Text size="sm" c="dimmed">
                {a.category ?? "—"}
              </Text>
            ),
          },
        ]}
        data={analytes}
        loading={isLoading}
        rowKey={(a) => a.analyte}
      />
    </Stack>
  );
}

function FormularyTab() {
  const [search, setSearch] = useState("");
  const { data: drugs = [], isLoading } = useQuery({
    queryKey: ["ckb-formulary", search],
    queryFn: () => ckbService.listCkbFormulary(search.trim() || undefined),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Input
          placeholder="Search generic drug"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={320}
        />
        <Text size="xs" c="dimmed">
          CDS reference — feeds dose / renal / hepatic checks
        </Text>
      </Group>
      <DataTable
        columns={[
          {
            key: "generic_name",
            label: "Generic",
            render: (d) => (
              <Stack gap={0}>
                <Group gap={6}>
                  <Text size="sm" fw={600} tt="capitalize">
                    {d.generic_name}
                  </Text>
                  {d.is_nlem ? (
                    <Badge tone="success" size="xs">
                      NLEM
                    </Badge>
                  ) : null}
                </Group>
                {d.brands ? (
                  <Text size="xs" c="dimmed">
                    {d.brands}
                  </Text>
                ) : null}
              </Stack>
            ),
          },
          {
            key: "max_dose_per_day",
            label: "Max/day",
            render: (d) => <Text size="sm">{d.max_dose_per_day ?? "—"}</Text>,
          },
          {
            key: "dose_per_kg",
            label: "Paeds mg/kg",
            render: (d) => <Text size="sm">{d.dose_per_kg ?? "—"}</Text>,
          },
          {
            key: "renal",
            label: "Renal",
            render: (d) =>
              d.renal_adjust_rule ? (
                <Text size="xs" lineClamp={2} maw={220}>
                  {d.renal_adjust_egfr_threshold ? `eGFR<${d.renal_adjust_egfr_threshold}: ` : ""}
                  {d.renal_adjust_rule}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "hepatic_caution",
            label: "Hepatic",
            render: (d) =>
              d.hepatic_caution ? (
                <Text size="xs" lineClamp={2} maw={220}>
                  {d.hepatic_caution}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "pregnancy_category",
            label: "Preg",
            render: (d) =>
              d.pregnancy_category ? (
                <Badge tone={["D", "X"].includes(d.pregnancy_category) ? "danger" : "neutral"}>
                  {d.pregnancy_category}
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
        ]}
        data={drugs}
        loading={isLoading}
        rowKey={(d) => d.generic_name}
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
