// Which way a quality indicator meets its target (#6021). Falls, infections and
// waiting times are met by staying under target, compliance by reaching it.

import { Progress, Text } from "@mantine/core";
import type { IndicatorDirection, QualityIndicator } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge, Select, toast } from "@/components/ui";
import { qualityService } from "@/services/quality.service";

export const DIRECTION_OPTIONS: { value: IndicatorDirection; label: string }[] = [
  { value: "lower_better", label: "Lower is better (falls, infections, errors, waits)" },
  { value: "higher_better", label: "Higher is better (compliance, satisfaction)" },
];

/**
 * Whether `value` meets `target` in the indicator's direction. `null` when it
 * cannot be said: no value recorded, no target, or no direction. Never guessed.
 */
export function meetsTarget(
  direction: IndicatorDirection | null,
  value: number | null | undefined,
  target: number | null | undefined,
): boolean | null {
  if (value == null || target == null || direction == null) return null;
  return direction === "lower_better" ? value <= target : value >= target;
}

interface DirectionCellProps {
  indicator: QualityIndicator;
  canManage: boolean;
}

/** The direction as a badge; a manager sees a picker while it is unset. */
export function DirectionCell({ indicator, canManage }: DirectionCellProps) {
  const qc = useQueryClient();
  const setDirection = useMutation({
    mutationFn: (direction: IndicatorDirection) =>
      qualityService.setQualityIndicatorDirection(indicator.id, direction),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["quality-indicators"] }),
    onError: () => toast.error("Try again, or reload the page", { title: "Direction not saved" }),
  });

  if (indicator.direction === "lower_better") return <Badge tone="neutral">Lower is better</Badge>;
  if (indicator.direction === "higher_better")
    return <Badge tone="neutral">Higher is better</Badge>;
  if (!canManage) return <Badge tone="warning">Direction not set</Badge>;
  return (
    <Select
      aria-label={`Which way ${indicator.name} meets its target`}
      placeholder="Set direction"
      data={DIRECTION_OPTIONS}
      value={null}
      disabled={setDirection.isPending}
      onChange={(v) => v && setDirection.mutate(v as IndicatorDirection)}
      w={220}
    />
  );
}

interface BenchmarkCellProps {
  indicator: QualityIndicator;
  /** The latest recorded value; missing is "No value", never zero. */
  value: number | null | undefined;
}

/** Latest value, toned and labelled met / not met in the indicator's direction. */
export function CurrentValueCell({ indicator, value }: BenchmarkCellProps) {
  if (value == null) return <Badge tone="neutral">No value</Badge>;
  const met = meetsTarget(indicator.direction, value, indicator.target_value);
  const [tone, word] =
    met == null
      ? (["warning", "direction not set"] as const)
      : met
        ? (["success", "met"] as const)
        : (["danger", "not met"] as const);
  return (
    <Badge tone={tone}>
      {value.toFixed(2)}
      {indicator.unit ? ` ${indicator.unit}` : ""} · {word}
    </Badge>
  );
}

/** Signed percentage distance from target, coloured by whether it is met. */
export function VarianceCell({ indicator, value }: BenchmarkCellProps) {
  if (value == null) return "---";
  const target = indicator.target_value ?? 0;
  const variance = target !== 0 ? ((value - target) / target) * 100 : 0;
  const met = meetsTarget(indicator.direction, value, indicator.target_value);
  return (
    <Text c={met == null ? "dimmed" : met ? "success" : "danger"} fw={500}>
      {variance > 0 ? "+" : ""}
      {variance.toFixed(1)}%
    </Text>
  );
}

/** Value as a share of target; shown only when met or not met can be said. */
export function ProgressCell({ indicator, value }: BenchmarkCellProps) {
  const met = meetsTarget(indicator.direction, value, indicator.target_value);
  if (value == null || met == null) return "---";
  const target = indicator.target_value ?? 0;
  const progress = target !== 0 ? Math.min(100, (value / target) * 100) : 0;
  const label = `${met ? "Met" : "Not met"}: ${value} of target ${target}`;
  return (
    <Progress value={progress} color={met ? "success" : "danger"} size="lg" aria-label={label} />
  );
}
