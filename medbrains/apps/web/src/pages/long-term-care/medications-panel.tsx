// Long-term-care LtcMedicationsPanel — split from long-term-care.tsx (pure move).

import { Group, NumberInput, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { PharmacyCatalog } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, toast } from "@/components/ui";
import { longTermCareService } from "@/services/longTermCare.service";

export function LtcMedicationsPanel({ patientId }: { patientId: string }) {
  const canView = useHasPermission(P.SPECIALTY.LTC.MEDICATIONS_LIST);
  const canCreate = useHasPermission(P.SPECIALTY.LTC.MEDICATIONS_CREATE);
  const canUpdate = useHasPermission(P.SPECIALTY.LTC.MEDICATIONS_UPDATE);
  const qc = useQueryClient();
  const [drugId, setDrugId] = useState("");
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [freq, setFreq] = useState("");
  const [supply, setSupply] = useState<number | "">(90);
  const [autoRefill, setAutoRefill] = useState(true);

  const { data = [] } = useQuery({
    queryKey: ["ltc-meds", patientId],
    queryFn: () => longTermCareService.listLtcMedications(patientId),
    enabled: canView,
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["ltc-meds", patientId] });
  };
  const add = useMutation({
    mutationFn: () =>
      longTermCareService.addLtcMedication({
        patient_id: patientId,
        drug_name: drugName,
        dosage: dosage || undefined,
        frequency: freq || undefined,
        supply_days: typeof supply === "number" ? supply : 90,
        auto_refill: autoRefill,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Medication added", { title: "Long-term care" });
      setDrugId("");
      setDrugName("");
      setDosage("");
      setFreq("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const refill = useMutation({
    mutationFn: (id: string) => longTermCareService.refillLtcMedication(id),
    onSuccess: () => {
      invalidate();
      toast.success("Refilled", { title: "Long-term care" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      longTermCareService.updateLtcMedication(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const medTone = (s: string): BadgeTone =>
    s === "active" ? "success" : s === "paused" ? "warning" : "neutral";

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Long-term medications
      </Text>
      {canCreate && (
        <>
          <DrugSearchSelect
            value={drugId}
            onChange={(id, drug?: PharmacyCatalog) => {
              setDrugId(id);
              setDrugName(drug?.name ?? "");
            }}
          />
          <Group grow>
            <TextInput
              label="Dosage"
              value={dosage}
              onChange={(e) => setDosage(e.currentTarget.value)}
              placeholder="500 mg"
            />
            <TextInput
              label="Frequency"
              value={freq}
              onChange={(e) => setFreq(e.currentTarget.value)}
              placeholder="BD"
            />
            <NumberInput
              label="Supply (days)"
              value={supply}
              onChange={(v) => setSupply(typeof v === "number" ? v : "")}
              min={1}
            />
          </Group>
          <Switch
            label="Auto-refill"
            checked={autoRefill}
            onChange={(e) => setAutoRefill(e.currentTarget.checked)}
          />
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!drugName}>
            Add medication
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No long-term medications.
        </Text>
      ) : (
        data.map((m) => (
          <Group key={m.id} justify="space-between">
            <Stack gap={0}>
              <Group gap={6}>
                <Badge tone={medTone(m.status)} size="xs">
                  {m.status}
                </Badge>
                {m.auto_refill && (
                  <Badge tone="info" size="xs">
                    auto
                  </Badge>
                )}
                <Text size="sm">
                  {m.drug_name} {m.dosage} {m.frequency}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                next refill{" "}
                {m.next_refill_date ? new Date(m.next_refill_date).toLocaleDateString() : "—"} ·{" "}
                {m.refill_count} refills
              </Text>
            </Stack>
            {canUpdate && m.status === "active" && (
              <Group gap="xs">
                <Button size="xs" tone="primary" onClick={() => refill.mutate(m.id)}>
                  Refill
                </Button>
                <Button
                  size="xs"
                  tone="ghost"
                  onClick={() => update.mutate({ id: m.id, status: "discontinued" })}
                >
                  Stop
                </Button>
              </Group>
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}
