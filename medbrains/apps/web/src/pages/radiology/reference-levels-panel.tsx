/**
 * Diagnostic reference levels, and the audit against them. A level is not
 * a limit for a patient: the hospital compares the median dose of its adult
 * CT exams of a region over a period with the level, and a median above it
 * means the protocol is reviewed (ICRP 135). India has no national set, so
 * the starting values come from a regional survey and say so.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import type { DiagnosticReferenceLevel, DrlAuditRow, DrlRegion } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { QueryError } from "@/components/QueryError";
import { Badge, Button, Input, Modal, NumberField, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

const REGION_LABEL: Record<DrlRegion, string> = {
  head: "Head",
  head_neck: "Head and neck",
  neck: "Neck",
  chest: "Chest",
  abdomen_pelvis: "Abdomen and pelvis",
  trunk: "Chest, abdomen and pelvis",
};
const METRIC_LABEL = { ctdi_vol: "CTDIvol (mGy)", dlp: "DLP (mGy·cm)" } as const;
const DAYS_BACK = 90;

const schema = z.object({
  region: z.enum(["head", "head_neck", "neck", "chest", "abdomen_pelvis", "trunk"]),
  metric: z.enum(["ctdi_vol", "dlp"]),
  value: z.number({ error: "Enter the level" }).positive("Above zero"),
  source: z.string().trim().min(1, "Say where it comes from"),
});
type Form = z.infer<typeof schema>;

function LevelForm({
  level,
  onClose,
}: {
  level: DiagnosticReferenceLevel | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: level
      ? {
          region: level.region,
          metric: level.metric,
          value: Number(level.value),
          source: level.source,
        }
      : { region: "head", metric: "dlp", source: "" },
  });
  const save = useMutation({
    mutationFn: (v: Form) => radiologyService.saveReferenceLevel(v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-drls"] });
      void qc.invalidateQueries({ queryKey: ["radiology-drl-audit"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  return (
    <Modal opened onClose={onClose} title={level ? "Change level" : "Add a level"}>
      <form aria-label="Reference level" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Stack>
          <SimpleGrid cols={2}>
            <Controller
              control={control}
              name="region"
              render={({ field }) => (
                <Select
                  label="Region"
                  disabled={level !== null}
                  data={Object.entries(REGION_LABEL).map(([value, label]) => ({ value, label }))}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "head")}
                  allowDeselect={false}
                />
              )}
            />
            <Controller
              control={control}
              name="metric"
              render={({ field }) => (
                <Select
                  label="Measure"
                  disabled={level !== null}
                  data={Object.entries(METRIC_LABEL).map(([value, label]) => ({ value, label }))}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "dlp")}
                  allowDeselect={false}
                />
              )}
            />
          </SimpleGrid>
          <Controller
            control={control}
            name="value"
            render={({ field, fieldState }) => (
              <NumberField
                label="Level"
                min={0}
                decimalScale={2}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="source"
            render={({ field, fieldState }) => (
              <Input
                label="Source"
                placeholder="Physicist's review, 2026"
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
          <Group justify="flex-end">
            <Button tone="primary" type="submit" loading={save.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

const VERDICT = {
  above: { tone: "danger", label: "Median above the level — review the protocol" },
  within: { tone: "success", label: "Within" },
  too_few: { tone: "neutral", label: "Too few exams to judge" },
} as const;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(1));

export function ReferenceLevelsPanel() {
  const [editing, setEditing] = useState<DiagnosticReferenceLevel | null | "new">(null);
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - DAYS_BACK * 86_400_000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const levels = useQuery({
    queryKey: ["radiology-drls"],
    queryFn: () => radiologyService.listReferenceLevels(),
  });
  const report = useQuery({
    queryKey: ["radiology-drl-audit", from, to],
    queryFn: () => radiologyService.drlAudit(from, to),
    enabled: from !== "" && to !== "" && from <= to,
  });
  if (levels.isError)
    return <QueryError error={levels.error} onRetry={() => void levels.refetch()} />;
  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Adult CT. A level is compared with the median of the period&apos;s exams, not with any one
          patient.
        </Text>
        <Button tone="primary" onClick={() => setEditing("new")}>
          Add a level
        </Button>
      </Group>
      <DataTable
        loading={levels.isLoading}
        data={levels.data ?? []}
        rowKey={(l) => l.id}
        emptyTitle="No levels"
        columns={[
          {
            key: "region",
            label: "Region",
            render: (l: DiagnosticReferenceLevel) => REGION_LABEL[l.region],
          },
          {
            key: "metric",
            label: "Measure",
            render: (l: DiagnosticReferenceLevel) => METRIC_LABEL[l.metric],
          },
          {
            key: "value",
            label: "Level",
            render: (l: DiagnosticReferenceLevel) => String(Number(l.value)),
          },
          { key: "source", label: "Source", render: (l: DiagnosticReferenceLevel) => l.source },
          {
            key: "edit",
            label: "",
            render: (l: DiagnosticReferenceLevel) => (
              <Button size="xs" tone="ghost" onClick={() => setEditing(l)}>
                Change
              </Button>
            ),
          },
        ]}
      />
      <Text fw={600} size="sm">
        Audit
      </Text>
      <Group>
        <Input
          label="From"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
        />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
      </Group>
      {report.isError ? (
        <QueryError error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <DataTable
          loading={report.isLoading}
          data={report.data?.rows ?? []}
          rowKey={(r) => r.level_id}
          emptyTitle="No levels to audit against"
          columns={[
            { key: "region", label: "Region", render: (r: DrlAuditRow) => REGION_LABEL[r.region] },
            { key: "metric", label: "Measure", render: (r: DrlAuditRow) => METRIC_LABEL[r.metric] },
            { key: "drl", label: "Level", render: (r: DrlAuditRow) => fmt(r.drl) },
            { key: "exams", label: "Exams", render: (r: DrlAuditRow) => String(r.exams) },
            { key: "median", label: "Median", render: (r: DrlAuditRow) => fmt(r.median) },
            { key: "p75", label: "75th percentile", render: (r: DrlAuditRow) => fmt(r.p75) },
            {
              key: "verdict",
              label: "",
              render: (r: DrlAuditRow) => (
                <Badge tone={VERDICT[r.verdict].tone}>{VERDICT[r.verdict].label}</Badge>
              ),
            },
          ]}
        />
      )}
      {editing !== null && (
        <LevelForm level={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </Stack>
  );
}
