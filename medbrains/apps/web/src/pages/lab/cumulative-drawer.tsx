import { LineChart } from "@mantine/charts";
import { Group, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, Drawer, Select } from "@/components/ui";
import { labService } from "@/services/lab.service";

/**
 * One analyte's history for one patient.
 *
 * The delta on the results table says how far today's value moved. This says
 * what it has been doing — the difference between "up 40% since Tuesday" and
 * "climbing steadily for a month", which are the same delta and different
 * clinical pictures.
 *
 * Only numeric points are charted. A culture reading "MRSA isolated" has no
 * position on an axis, and forcing one would be inventing a number; those
 * appear in the list underneath instead, so nothing is silently dropped.
 */
export function CumulativeTrendDrawer({
  opened,
  onClose,
  patientId,
  testId,
}: {
  opened: boolean;
  onClose: () => void;
  patientId: string | null;
  testId: string | null;
}) {
  const [parameter, setParameter] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lab-cumulative", patientId, testId],
    queryFn: () => labService.getLabCumulativeReport(patientId as string, testId as string),
    enabled: opened && patientId !== null && testId !== null,
  });

  const parameters = useMemo(() => {
    const seen = new Set<string>();
    for (const row of data?.results ?? []) seen.add(row.parameter_name);
    return [...seen];
  }, [data]);

  const active = parameter ?? parameters[0] ?? null;

  const series = useMemo(() => {
    if (!active) return [];
    return (
      (data?.results ?? [])
        .filter((row) => row.parameter_name === active)
        // Oldest first: a trend read right-to-left is a trend read backwards.
        .slice()
        .reverse()
    );
  }, [data, active]);

  const numeric = useMemo(
    () =>
      series
        .map((row) => ({
          when: new Date(row.created_at).toLocaleDateString(),
          value: Number(row.value),
        }))
        .filter((point) => Number.isFinite(point.value)),
    [series],
  );

  const nonNumeric = series.filter((row) => !Number.isFinite(Number(row.value)));

  return (
    <Drawer opened={opened} onClose={onClose} title="Trend" position="right" size="lg">
      <Stack gap="md">
        {isError && (
          <Alert tone="danger" title="Trend could not be loaded">
            This is not a statement that there is no history.
          </Alert>
        )}
        {isLoading && (
          <Text size="sm" c="dimmed">
            Loading…
          </Text>
        )}

        {parameters.length > 1 && (
          <Select
            label="Analyte"
            data={parameters.map((p) => ({ value: p, label: p }))}
            value={active}
            onChange={setParameter}
            allowDeselect={false}
          />
        )}

        {numeric.length > 1 && (
          <LineChart
            h={240}
            data={numeric}
            dataKey="when"
            // Zero baseline is wrong for a clinical series — a haemoglobin
            // between 9 and 11 would be a flat line against zero, and the
            // movement is the whole point. The axis fits the data instead.
            yAxisProps={{ domain: ["auto", "auto"] }}
            series={[{ name: "value", label: active ?? "Value", color: "blue.6" }]}
            curveType="linear"
            withDots
          />
        )}
        {numeric.length === 1 && (
          <Text size="sm" c="dimmed">
            Only one numeric result so far — a trend needs a second.
          </Text>
        )}

        <Stack gap={4}>
          <Text fw={600} size="sm">
            {series.length} result{series.length === 1 ? "" : "s"}
          </Text>
          {series
            .slice()
            .reverse()
            .map((row) => (
              <Group key={`${row.order_id}-${row.created_at}`} justify="space-between">
                <Text size="sm">{row.value}</Text>
                <Group gap="xs">
                  {row.flag && row.flag !== "normal" && (
                    <Badge tone={row.flag.startsWith("critical") ? "danger" : "warning"} size="sm">
                      {row.flag.replace(/_/g, " ")}
                    </Badge>
                  )}
                  <Text size="xs" c="dimmed">
                    {new Date(row.created_at).toLocaleString()}
                  </Text>
                </Group>
              </Group>
            ))}
        </Stack>

        {nonNumeric.length > 0 && (
          <Text size="xs" c="dimmed">
            {nonNumeric.length} result{nonNumeric.length === 1 ? " is" : "s are"} not numeric and
            cannot be plotted. {nonNumeric.length === 1 ? "It is" : "They are"} listed above.
          </Text>
        )}
      </Stack>
    </Drawer>
  );
}
