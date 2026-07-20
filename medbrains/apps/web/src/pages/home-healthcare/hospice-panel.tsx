// Home-healthcare HospicePanel — split from home-healthcare.tsx (pure move).

import { Group, Select, Stack, Switch, Text, Textarea, TextInput } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

export function HospicePanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [diag, setDiag] = useState("");
  const [prognosis, setPrognosis] = useState("");
  const [plan, setPlan] = useState("");
  const [dnr, setDnr] = useState(false);
  const [caregiver, setCaregiver] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["hospice", patientId],
    queryFn: () => homeHealthService.listHospiceEnrollments(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["hospice", patientId] });
  };
  const enroll = useMutation({
    mutationFn: () =>
      homeHealthService.enrollHospice({
        patient_id: patientId,
        terminal_diagnosis: diag || undefined,
        prognosis: prognosis || undefined,
        comfort_care_plan: plan || undefined,
        dnr_confirmed: dnr,
        primary_caregiver: caregiver || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Enrolled in hospice", { title: "Home healthcare" });
      setDiag("");
      setPrognosis("");
      setPlan("");
      setDnr(false);
      setCaregiver("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      homeHealthService.updateHospice(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const hasActive = data.some((h) => h.status === "active");
  const hospiceTone = (s: string): BadgeTone =>
    s === "active" ? "success" : s === "deceased" ? "neutral" : "warning";

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Hospice / palliative care
      </Text>
      {canManage && !hasActive && (
        <>
          <Group grow>
            <TextInput
              label="Terminal diagnosis"
              value={diag}
              onChange={(e) => setDiag(e.currentTarget.value)}
            />
            <TextInput
              label="Prognosis"
              value={prognosis}
              onChange={(e) => setPrognosis(e.currentTarget.value)}
              placeholder="< 6 months"
            />
          </Group>
          <Textarea
            label="Comfort care plan"
            value={plan}
            onChange={(e) => setPlan(e.currentTarget.value)}
            minRows={2}
          />
          <Group grow>
            <TextInput
              label="Primary caregiver"
              value={caregiver}
              onChange={(e) => setCaregiver(e.currentTarget.value)}
            />
            <Switch
              label="DNR confirmed"
              checked={dnr}
              onChange={(e) => setDnr(e.currentTarget.checked)}
              mt="lg"
            />
          </Group>
          <Button onClick={() => enroll.mutate()} loading={enroll.isPending}>
            Enroll in hospice
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          Not enrolled in hospice.
        </Text>
      ) : (
        data.map((h) => (
          <Group key={h.id} justify="space-between">
            <Stack gap={0}>
              <Group gap={6}>
                <Badge tone={hospiceTone(h.status)} size="xs">
                  {h.status}
                </Badge>
                {h.dnr_confirmed && (
                  <Badge tone="danger" size="xs">
                    DNR
                  </Badge>
                )}
                <Text size="sm">
                  {h.terminal_diagnosis} · {h.prognosis}
                </Text>
              </Group>
              {h.comfort_care_plan && (
                <Text size="xs" c="dimmed">
                  {h.comfort_care_plan}
                </Text>
              )}
            </Stack>
            {canManage && h.status === "active" && (
              <Select
                size="xs"
                w={130}
                data={["active", "discharged", "deceased"].map((v) => ({ value: v, label: v }))}
                value={h.status}
                onChange={(v) => v && update.mutate({ id: h.id, status: v })}
                aria-label="Hospice status"
              />
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}
