import { Card, Divider, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { SepsisBundleElement, SepsisBundleView } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, NumberField, Switch } from "@/components/ui";
import { sepsisBundleService } from "@/services/sepsisBundle.service";

function elementBadge(el: SepsisBundleElement) {
  if (!el.done) return <Badge tone={el.required ? "warning" : "neutral"}>Pending</Badge>;
  return <Badge tone={el.on_time ? "success" : "danger"}>{el.on_time ? "On time" : "Late"}</Badge>;
}

/** Surviving Sepsis Hour-1 bundle checklist for a patient. Server stamps each element's completion
 *  and computes within-the-hour compliance; this is the bedside view that drives the KPI. */
export function SepsisBundlePanel({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const [fluidsIndicated, setFluidsIndicated] = useState(false);
  const [lactate, setLactate] = useState<number | "">("");
  const key = ["sepsis-bundles", patientId];

  const { data: bundles = [] } = useQuery({
    queryKey: key,
    queryFn: () => sepsisBundleService.listSepsisBundles(patientId),
    enabled: !!patientId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });
  const onError = (e: Error) =>
    notifications.show({ title: "Action failed", message: e.message, color: "danger" });

  const start = useMutation({
    mutationFn: () =>
      sepsisBundleService.createSepsisBundle({
        patient_id: patientId,
        fluids_indicated: fluidsIndicated,
        initial_lactate: lactate === "" ? undefined : lactate,
      }),
    onSuccess: () => {
      void invalidate();
      setFluidsIndicated(false);
      setLactate("");
    },
    onError,
  });

  const mark = useMutation({
    mutationFn: (vars: { id: string; field: string }) =>
      sepsisBundleService.updateSepsisBundle(vars.id, { [vars.field]: true }),
    onSuccess: () => void invalidate(),
    onError,
  });

  const active = bundles[0];

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Start Hour-1 bundle
          </Text>
          <Text size="xs" c="dimmed">
            Start the clock at sepsis recognition (e.g. qSOFA ≥ 2 with suspected infection).
          </Text>
          <Group>
            <Switch
              label="Hypotension or lactate ≥ 4 (fluids + vasopressors required)"
              checked={fluidsIndicated}
              onChange={(e) => setFluidsIndicated(e.currentTarget.checked)}
            />
          </Group>
          <NumberField
            label="Initial lactate (mmol/L)"
            value={lactate}
            onChange={(v) => setLactate(v === "" ? "" : Number(v))}
            min={0}
            max={30}
            step={0.1}
            decimalScale={1}
            w={220}
          />
          <Button
            tone="primary"
            loading={start.isPending}
            onClick={() => start.mutate()}
            w="fit-content"
          >
            Start bundle
          </Button>
        </Stack>
      </Card>

      {active && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>
                Recognised {new Date(active.bundle.recognised_at).toLocaleString()}
              </Text>
              <Badge tone={active.bundle.bundle_compliant ? "success" : "warning"}>
                {active.bundle.bundle_compliant ? "Bundle compliant" : "In progress"}
              </Badge>
            </Group>
            <Divider />
            {active.elements.map((el) => (
              <Group key={el.key} justify="space-between">
                <Text size="sm">
                  {el.label}
                  {!el.required ? " (n/a)" : ""}
                </Text>
                <Group gap="xs">
                  {elementBadge(el)}
                  {!el.done && (
                    <Button
                      tone="secondary"
                      size="xs"
                      loading={mark.isPending}
                      onClick={() => mark.mutate({ id: active.bundle.id, field: `mark_${el.key}` })}
                    >
                      Mark done
                    </Button>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      {bundles.length > 1 && (
        <Stack gap={4}>
          <Text fw={600} size="sm">
            Earlier bundles
          </Text>
          {bundles.slice(1).map((b: SepsisBundleView) => (
            <Text key={b.bundle.id} size="xs" c="dimmed">
              {new Date(b.bundle.recognised_at).toLocaleString()} —{" "}
              {b.bundle.bundle_compliant ? "compliant" : "non-compliant"}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
