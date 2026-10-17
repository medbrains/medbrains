import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DentalChartEntry, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, Input, Select, toast } from "@/components/ui";
import { specialtyService } from "@/services/specialty.service";
import { Odontogram } from "./Odontogram";
import { CONDITIONS, conditionTone, type Dentition, label } from "./tooth-layout";

const SURFACES = ["mesial", "distal", "occlusal", "buccal", "lingual"].map((s) => ({
  value: s,
  label: s,
}));
const schema = z.object({
  condition: z.string().min(1, "Pick a condition"),
  surface: z.string().nullable(),
  notes: z.string(),
});
type Finding = z.infer<typeof schema>;
const EMPTY: Finding = { condition: "", surface: null, notes: "" };

export function ChartTab({ examId }: { examId: string }) {
  const canAdd = useHasPermission(P.SPECIALTY.DENTAL.CHART_CREATE);
  const canEdit = useHasPermission(P.SPECIALTY.DENTAL.CHART_UPDATE);
  const queryClient = useQueryClient();
  const key = ["dental-chart", examId];
  const {
    data: chart = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: key,
    queryFn: () => specialtyService.listDentalChart(examId),
  });
  const [dentition, setDentition] = useState<Dentition>("permanent");
  const [tooth, setTooth] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const form = useForm<Finding>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const findings = useMemo(() => new Map(chart.map((c) => [c.tooth_number, c.condition])), [chart]);
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    form.reset(EMPTY);
    setEditing(null);
  };
  const save = useMutation({
    mutationFn: (v: Finding) => {
      const body = { condition: v.condition, surface: v.surface, notes: v.notes.trim() || null };
      return editing
        ? specialtyService.updateDentalChartEntry(editing, body)
        : specialtyService.createDentalChartEntry(examId, {
            tooth_number: tooth ?? "",
            condition: v.condition,
            surface: v.surface ?? undefined,
            notes: v.notes.trim() || undefined,
          });
    },
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message, { title: "Finding not saved" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => specialtyService.removeDentalChartEntry(id),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message, { title: "Finding not removed" }),
  });

  const columns: Column<DentalChartEntry>[] = [
    { key: "tooth_number", label: "Tooth", render: (r) => r.tooth_number },
    {
      key: "condition",
      label: "Condition",
      render: (r) => <Badge tone={conditionTone(r.condition)}>{label(r.condition)}</Badge>,
    },
    { key: "surface", label: "Surface", render: (r) => r.surface ?? "—" },
    { key: "notes", label: "Notes", render: (r) => r.notes ?? "—" },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canEdit && (
          <Group gap={4} wrap="nowrap">
            <Button
              tone="ghost"
              size="xs"
              aria-label={`Edit tooth ${r.tooth_number}`}
              onClick={() => {
                setTooth(r.tooth_number);
                setEditing(r.id);
                form.reset({ condition: r.condition, surface: r.surface, notes: r.notes ?? "" });
              }}
            >
              Edit
            </Button>
            <Button
              tone="danger-ghost"
              size="xs"
              aria-label={`Remove tooth ${r.tooth_number}`}
              onClick={() => remove.mutate(r.id)}
            >
              Remove
            </Button>
          </Group>
        ),
    },
  ];
  const canSave = editing ? canEdit : canAdd;

  return (
    <Stack gap="md">
      <Odontogram
        dentition={dentition}
        onDentition={setDentition}
        findings={findings}
        selected={tooth}
        onSelect={(t) => {
          setTooth(t);
          setEditing(null);
          form.reset(EMPTY);
        }}
      />
      {tooth && canSave && (
        <form
          aria-label="Tooth finding"
          noValidate
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
        >
          <Group align="flex-end" gap="xs">
            <Text fw={600} size="sm">
              Tooth {tooth}
            </Text>
            <Controller
              control={form.control}
              name="condition"
              render={({ field, fieldState }) => (
                <Select
                  label="Condition"
                  data={CONDITIONS.map((c) => ({ value: c, label: label(c) }))}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="surface"
              render={({ field }) => (
                <Select
                  label="Surface"
                  data={SURFACES}
                  value={field.value}
                  onChange={field.onChange}
                  clearable
                />
              )}
            />
            <Input label="Notes" {...form.register("notes")} />
            <Button type="submit" loading={save.isPending}>
              {editing ? "Save" : "Add finding"}
            </Button>
          </Group>
        </form>
      )}
      <DataTable
        columns={columns}
        data={chart}
        loading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        rowKey={(r) => r.id}
        emptyTitle="No teeth charted yet."
      />
    </Stack>
  );
}
