// Lab QcResultsSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { LineChart } from "@mantine/charts";
import { Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabQcResultFormInput } from "@medbrains/schemas";
import { labQcResultFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateQcResultRequest, LabQcResult, LabReagentLot } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { Badge, Button, IconButton, Tooltip } from "@/components/ui";
import { labOptionalNumber, labOptionalText } from "@/forms/lab.form";
import { statusColor } from "@/lib/status-colors";
import { labService } from "@/services/lab.service";
import { toBadgeTone } from "./shared";

function LeveyJenningsChart({
  qcResults,
  lots,
  selectedLotId,
  onLotChange,
}: {
  qcResults: LabQcResult[];
  lots: LabReagentLot[];
  selectedLotId: string | null;
  onLotChange: (id: string | null) => void;
}) {
  const { t } = useTranslation("lab");
  const lotResults = useMemo(() => {
    if (!selectedLotId) return [];
    return qcResults
      .filter((r) => r.lot_id === selectedLotId && r.observed_value != null && r.run_date)
      .sort((a, b) => (a.run_date ?? "").localeCompare(b.run_date ?? ""));
  }, [qcResults, selectedLotId]);

  const { chartData, refLines, hasData, mean, sd } = useMemo(() => {
    if (lotResults.length === 0) {
      return { chartData: [], refLines: [], hasData: false, mean: 0, sd: 0 };
    }

    // Derive mean and SD from the first result that has them; fall back to lot-level average
    const withMean = lotResults.find((r) => r.target_mean != null && r.target_sd != null);
    const targetMean = withMean ? Number(withMean.target_mean) : 0;
    const targetSd = withMean ? Number(withMean.target_sd) : 0;

    if (targetSd === 0) {
      return { chartData: [], refLines: [], hasData: false, mean: targetMean, sd: 0 };
    }

    const points = lotResults.map((r) => {
      const observed = Number(r.observed_value);
      const sdIdx = targetSd !== 0 ? Math.abs((observed - targetMean) / targetSd) : 0;
      let pointColor = "success";
      if (sdIdx > 3) pointColor = "danger";
      else if (sdIdx > 2) pointColor = "orange";
      else if (sdIdx > 1) pointColor = "warning";
      return {
        date: r.run_date ?? "",
        observed,
        color: pointColor,
      };
    });

    const lines = [
      { y: targetMean, color: "blue.6", label: "Mean" },
      { y: targetMean + targetSd, color: "green.5", label: "+1SD" },
      { y: targetMean - targetSd, color: "green.5", label: "-1SD" },
      { y: targetMean + 2 * targetSd, color: "yellow.5", label: "+2SD" },
      { y: targetMean - 2 * targetSd, color: "yellow.5", label: "-2SD" },
      { y: targetMean + 3 * targetSd, color: "red.5", label: "+3SD" },
      { y: targetMean - 3 * targetSd, color: "red.5", label: "-3SD" },
    ];

    return { chartData: points, refLines: lines, hasData: true, mean: targetMean, sd: targetSd };
  }, [lotResults]);

  return (
    <Stack mt="lg" gap="sm">
      <Text fw={600} size="sm">
        {t("leveyJenningsQcChart")}
      </Text>
      <Select
        label={t("label.selectReagentLot")}
        placeholder={t("placeholder.chooseALotToViewQcChart")}
        data={lots.map((l) => ({ value: l.id, label: `${l.reagent_name} — Lot ${l.lot_number}` }))}
        value={selectedLotId}
        onChange={onLotChange}
        clearable
        w={400}
      />
      {selectedLotId && !hasData && (
        <Text size="sm" c="dimmed">
          No QC results with target mean/SD found for this lot. Ensure QC results have target_mean
          and target_sd values.
        </Text>
      )}
      {selectedLotId && hasData && (
        <Stack gap="xs">
          <Group gap="lg">
            <Badge tone="primary">Mean: {mean.toFixed(2)}</Badge>
            <Badge tone="success">SD: {sd.toFixed(2)}</Badge>
            <Badge tone="neutral">{chartData.length} points</Badge>
          </Group>
          <Group gap="xs">
            <Badge size="xs" tone="success" variant="dot">
              Within 1SD
            </Badge>
            <Badge size="xs" tone="warning" variant="dot">
              1-2 SD
            </Badge>
            <Badge size="xs" tone="warning" variant="dot">
              2-3 SD
            </Badge>
            <Badge size="xs" tone="danger" variant="dot">
              Beyond 3SD
            </Badge>
          </Group>
          <LineChart
            h={350}
            data={chartData}
            dataKey="date"
            series={[{ name: "observed", color: "violet" }]}
            curveType="monotone"
            connectNulls
            withTooltip
            withDots
            referenceLines={refLines}
          />
        </Stack>
      )}
    </Stack>
  );
}

export function QcResultsSection() {
  const { t } = useTranslation("lab");
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  const canReview = useHasPermission(P.LAB.QC_MANAGE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const [chartLotId, setChartLotId] = useState<string | null>(null);
  const qcDefaults: LabQcResultFormInput = {
    test_id: "",
    lot_id: "",
    level: "",
    target_mean: "",
    target_sd: "",
    observed_value: "",
    run_date: "",
    reviewer_notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabQcResultFormInput>({
    resolver: zodResolver(labQcResultFormSchema),
    defaultValues: qcDefaults,
  });

  const { data: qcResults = [], isLoading } = useQuery({
    queryKey: ["lab-qc-results"],
    queryFn: () => labService.listQcResults(),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ["lab-reagent-lots"],
    queryFn: () => labService.listReagentLots(),
  });
  const lotOptions = lots.map((lot) => ({
    value: lot.id,
    label: `${lot.reagent_name} · ${lot.lot_number}`,
  }));

  const createMutation = useMutation({
    mutationFn: (data: CreateQcResultRequest) => labService.createQcResult(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-qc-results"] });
      formHandlers.close();
      reset(qcDefaults);
    },
  });

  const handleCreateQcResult = (values: LabQcResultFormInput) => {
    createMutation.mutate({
      test_id: values.test_id.trim(),
      lot_id: values.lot_id.trim(),
      level: values.level.trim(),
      target_mean: labOptionalNumber(values.target_mean),
      target_sd: labOptionalNumber(values.target_sd),
      observed_value: labOptionalNumber(values.observed_value),
      run_date: labOptionalText(values.run_date),
      reviewer_notes: labOptionalText(values.reviewer_notes),
    });
  };

  // A rejected run holds every result for its test until somebody other than
  // the person who ran it has reviewed it. Without this control that hold has
  // no way out from the interface at all.
  const reviewMutation = useMutation({
    mutationFn: (id: string) => labService.reviewQcResult(id, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-qc-results"] }),
  });

  const columns = [
    {
      key: "test_id",
      label: "Test",
      render: (row: LabQcResult) => <Text size="sm">{row.test_id.slice(0, 8)}...</Text>,
    },
    {
      key: "level",
      label: "Level",
      render: (row: LabQcResult) => <Text size="sm">{row.level}</Text>,
    },
    {
      key: "observed_value",
      label: "Observed",
      render: (row: LabQcResult) => <Text size="sm">{row.observed_value ?? "—"}</Text>,
    },
    {
      key: "sd_index",
      label: "SD Index",
      render: (row: LabQcResult) => (
        <Text size="sm" fw={row.sd_index && Math.abs(Number(row.sd_index)) > 2 ? 700 : 400}>
          {row.sd_index ?? "—"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabQcResult) => (
        <Badge tone={toBadgeTone(statusColor(row.status))} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "westgard",
      label: "Westgard",
      render: (row: LabQcResult) =>
        row.westgard_violations?.length ? (
          <Badge tone="danger" size="sm">
            {row.westgard_violations.join(", ")}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            OK
          </Text>
        ),
    },
    {
      key: "run_date",
      label: "Run Date",
      render: (row: LabQcResult) => <Text size="sm">{row.run_date ?? "—"}</Text>,
    },
    {
      key: "review",
      label: "Review",
      render: (row: LabQcResult) => {
        if (row.reviewed_by) {
          return (
            <Text size="sm" c="dimmed">
              {t("qc.reviewed")}
            </Text>
          );
        }
        if (!canReview || row.status !== "rejected") {
          return (
            <Text size="sm" c="dimmed">
              —
            </Text>
          );
        }
        return (
          <Tooltip label={t("qc.reviewHint")}>
            <IconButton
              tone="primary"
              size="sm"
              aria-label={t("qc.review")}
              loading={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate(row.id)}
            >
              <IconCheck size={14} />
            </IconButton>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              if (formOpen) reset(qcDefaults);
              formHandlers.toggle();
            }}
          >
            {t("addQcResult")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateQcResult)}>
          <Group grow>
            <Controller
              control={control}
              name="test_id"
              render={({ field }) => (
                <LabTestSearchSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  error={errors.test_id?.message}
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="lot_id"
              render={({ field }) => (
                <Select
                  label={t("label.lotId")}
                  data={lotOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.lot_id?.message}
                  required
                  searchable
                />
              )}
            />
            <TextInput
              label={t("label.level")}
              required
              placeholder={t("placeholder.e.g.L1,L2")}
              error={errors.level?.message}
              {...register("level")}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="target_mean"
              render={({ field }) => (
                <NumberInput
                  label={t("label.targetMean")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.target_mean?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="target_sd"
              render={({ field }) => (
                <NumberInput
                  label={t("label.targetSd")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.target_sd?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="observed_value"
              render={({ field }) => (
                <NumberInput
                  label={t("label.observedValue")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.observed_value?.message}
                />
              )}
            />
          </Group>
          <TextInput
            label={t("label.runDate")}
            type="date"
            error={errors.run_date?.message}
            {...register("run_date")}
            w={200}
          />
          <Textarea
            label={t("reviewerNotes")}
            error={errors.reviewer_notes?.message}
            {...register("reviewer_notes")}
          />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={qcResults} loading={isLoading} rowKey={(row) => row.id} />

      {/* Levey-Jennings Chart */}
      <LeveyJenningsChart
        qcResults={qcResults}
        lots={lots}
        selectedLotId={chartLotId}
        onLotChange={setChartLotId}
      />
    </Stack>
  );
}
