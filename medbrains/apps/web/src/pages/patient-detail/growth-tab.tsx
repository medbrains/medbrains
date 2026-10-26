/**
 * A child's growth: WHO 0-5 year standards and IAP 2015 5-18 year charts,
 * plotted from the weights, lengths and head circumferences charted at
 * visits. z-scores and centiles come from the server.
 */
import { Group, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type Patient } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { GrowthChartView } from "@/components/growth/GrowthChartView";
import { Alert, Button, NumberField, SegmentedControl, toast } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

export function GrowthTab({ patient }: { patient: Patient }) {
  const canRecordGestation = useHasPermission(P.PATIENTS.GROWTH.RECORD_GESTATION);
  const queryClient = useQueryClient();
  const key = ["patient-growth", patient.id];
  const growth = useQuery({
    queryKey: key,
    queryFn: () => patientDetailService.getGrowth(patient.id),
  });
  const [picked, setPicked] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<number | string>("");
  const save = useMutation({
    mutationFn: () =>
      patientDetailService.setBirthGestation(patient.id, weeks === "" ? null : Number(weeks)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Gestation at birth saved.", { title: "Saved" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });

  const charts = growth.data?.charts ?? [];
  const current = useMemo(
    () => picked ?? (charts.find((c) => c.points.length > 0) ?? charts[0])?.key ?? null,
    [picked, charts],
  );
  const alerts = useMemo(
    () =>
      charts.flatMap((c) => {
        const last = c.points.at(-1);
        return last ? last.flags.map((f) => `${c.title}: ${f.label} (${last.measured_on})`) : [];
      }),
    [charts],
  );

  if (growth.isLoading) return <Loader aria-label="Loading growth charts" />;
  if (growth.isError) {
    return (
      <Alert tone="danger" title="Growth charts could not be loaded">
        {(growth.error as Error).message}
      </Alert>
    );
  }
  const chart = charts.find((c) => c.key === current);

  return (
    <Stack gap="md">
      {growth.data?.unavailable && (
        <Alert tone="info" title="No growth chart">
          {growth.data.unavailable}
        </Alert>
      )}
      <Group align="flex-end" gap="sm">
        <NumberField
          label="Gestation at birth (weeks)"
          description={
            growth.data?.gestation_weeks
              ? `Recorded: ${growth.data.gestation_weeks} weeks. Below 37 weeks, age is corrected until 2 years.`
              : "Below 37 weeks, the charts correct age for prematurity until 2 years."
          }
          min={22}
          max={44}
          step={0.5}
          decimalScale={1}
          placeholder={
            growth.data?.gestation_weeks ? String(growth.data.gestation_weeks) : "Not recorded"
          }
          value={weeks}
          onChange={setWeeks}
          disabled={!canRecordGestation}
          w={260}
        />
        {canRecordGestation && (
          <Button tone="secondary" loading={save.isPending} onClick={() => save.mutate()}>
            Save gestation
          </Button>
        )}
      </Group>
      {alerts.length > 0 && (
        <Alert tone="warning" title="Latest measurements need a look">
          <Stack gap={2}>
            {alerts.map((a) => (
              <Text key={a} size="sm">
                {a}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}
      {charts.length > 0 && current && (
        <SegmentedControl
          aria-label="Growth chart"
          value={current}
          onChange={setPicked}
          data={charts.map((c) => ({
            value: c.key,
            label: `${c.title}${c.key.startsWith("iap") ? " (IAP)" : " (WHO)"}`,
          }))}
        />
      )}
      {chart && <GrowthChartView chart={chart} />}
    </Stack>
  );
}
