/**
 * In the session drawer: the patient's booked shift today and their dialyzer
 * — which use this will be, or why it can't be used — with issue, reprocess
 * (TCV) and discard right there, so the session records the real ones.
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { DialysisSerology, Dialyzer } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Input, NumberField, Select, toast } from "@/components/ui";
import { specialtyService } from "@/services/specialty.service";
import { SEROLOGY_OPTIONS, todayIso } from "./labels";

interface DialyzerPickerProps {
  patientId: string;
  dialyzerId: string | undefined;
  slotId: string | undefined;
  onDialyzer: (id: string | undefined) => void;
  onSlot: (id: string | undefined) => void;
}

const usable = (d: Dialyzer) => d.status === "in_use" && d.uses < d.max_uses;

export function DialyzerPicker({
  patientId,
  dialyzerId,
  slotId,
  onDialyzer,
  onSlot,
}: DialyzerPickerProps) {
  const qc = useQueryClient();
  const dialyzers = useQuery({
    queryKey: ["dialyzers", patientId],
    queryFn: () => specialtyService.listDialyzers(patientId),
  });
  const slots = useQuery({
    queryKey: ["dialysis-slots", todayIso()],
    queryFn: () => specialtyService.listDialysisSlots(todayIso()),
  });
  const [label, setLabel] = useState("");
  const [serology, setSerology] = useState<DialysisSerology>("none");
  const [baseline, setBaseline] = useState<number | undefined>();
  const [tcv, setTcv] = useState<number | undefined>();
  const refresh = () => void qc.invalidateQueries({ queryKey: ["dialyzers", patientId] });

  const issue = useMutation({
    mutationFn: specialtyService.issueDialyzer,
    onSuccess: (d) => {
      refresh();
      onDialyzer(d.id);
      setLabel("");
      toast.success(`Dialyzer ${d.label} issued`);
    },
  });
  const reprocess = useMutation({
    mutationFn: (id: string) => specialtyService.reprocessDialyzer(id, { tcv_ml: tcv ?? 0 }),
    onSuccess: (d) => {
      refresh();
      setTcv(undefined);
      if (d.status === "discarded") {
        onDialyzer(undefined);
        toast.warning(d.discard_reason ?? "Discarded");
      } else toast.success("TCV recorded");
    },
  });
  const discard = useMutation({
    mutationFn: (id: string) =>
      specialtyService.discardDialyzer(id, { reason: "Discarded at the bedside" }),
    onSuccess: () => {
      refresh();
      onDialyzer(undefined);
    },
  });

  const mine = (slots.data ?? []).filter(
    (s) => s.patient_id === patientId && s.status === "booked",
  );
  const chosen = dialyzers.data?.find((d) => d.id === dialyzerId);
  const failure = dialyzers.error ?? issue.error ?? reprocess.error ?? discard.error;

  return (
    <Card padding="sm" withBorder>
      <Stack gap="sm">
        <Select
          label="Booked shift today"
          data={mine.map((s) => ({ value: s.id, label: `${s.shift} · machine ${s.machine_code}` }))}
          value={slotId ?? null}
          onChange={(v) => onSlot(v ?? undefined)}
          clearable
          placeholder={mine.length ? "Choose" : "No shift booked today — book one under Shifts"}
        />
        <Select
          label="Dialyzer"
          value={dialyzerId ?? null}
          onChange={(v) => onDialyzer(v ?? undefined)}
          clearable
          data={(dialyzers.data ?? []).map((d) => ({
            value: d.id,
            disabled: !usable(d),
            label: `${d.label} · used ${d.uses} of ${d.max_uses}${d.status === "discarded" ? " · discarded" : ""}`,
          }))}
        />
        {chosen && (
          <Group gap="xs">
            <Badge tone={chosen.max_uses === 1 ? "warning" : "neutral"}>
              {chosen.max_uses === 1
                ? "Single use"
                : `This will be use ${chosen.uses + 1} of ${chosen.max_uses}`}
            </Badge>
            <NumberField
              aria-label="TCV after reprocessing (ml)"
              placeholder="TCV ml"
              w={120}
              min={1}
              value={tcv ?? ""}
              onChange={(v) => setTcv(Number(v) || undefined)}
            />
            <Button
              size="xs"
              tone="secondary"
              disabled={!tcv}
              loading={reprocess.isPending}
              onClick={() => reprocess.mutate(chosen.id)}
            >
              Record TCV
            </Button>
            <Button
              size="xs"
              tone="danger-ghost"
              loading={discard.isPending}
              onClick={() => discard.mutate(chosen.id)}
            >
              Discard
            </Button>
          </Group>
        )}
        <Text size="sm" fw={600}>
          Issue a new dialyzer
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Input label="Label" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
          <Select
            label="Patient serology"
            data={SEROLOGY_OPTIONS}
            value={serology}
            allowDeselect={false}
            onChange={(v) => v && setSerology(v as DialysisSerology)}
          />
          <NumberField
            label="Priming volume / TCV (ml)"
            min={1}
            value={baseline ?? ""}
            onChange={(v) => setBaseline(Number(v) || undefined)}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button
            size="xs"
            tone="secondary"
            disabled={!label.trim()}
            loading={issue.isPending}
            onClick={() =>
              issue.mutate({ patient_id: patientId, label, serology, baseline_tcv_ml: baseline })
            }
          >
            Issue dialyzer
          </Button>
        </Group>
        {failure && <Alert tone="danger">{failure.message}</Alert>}
      </Stack>
    </Card>
  );
}
