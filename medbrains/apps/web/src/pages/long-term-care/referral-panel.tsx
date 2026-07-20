// Long-term-care ReferralPanel — split from long-term-care.tsx (pure move).

import { Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, toast } from "@/components/ui";
import { longTermCareService } from "@/services/longTermCare.service";

const REFERRAL_TYPES = [
  "nursing",
  "wound_care",
  "physiotherapy",
  "occupational",
  "speech",
  "general",
];
const REFERRAL_STATUS = ["pending", "accepted", "scheduled", "declined", "completed"];

export function ReferralPanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [type, setType] = useState<string | null>("nursing");
  const [reason, setReason] = useState("");
  const [provider, setProvider] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["referrals", patientId],
    queryFn: () => longTermCareService.listHomeCareReferrals(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["referrals", patientId] });
  };
  const create = useMutation({
    mutationFn: () =>
      longTermCareService.createHomeCareReferral({
        patient_id: patientId,
        referral_type: type ?? "nursing",
        reason: reason || undefined,
        provider: provider || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Referral created", { title: "Long-term care" });
      setReason("");
      setProvider("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      longTermCareService.updateHomeCareReferral(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const refTone = (s: string): BadgeTone => {
    if (s === "completed" || s === "scheduled") return "success";
    if (s === "declined") return "danger";
    if (s === "accepted") return "info";
    return "neutral";
  };

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Home care referrals
      </Text>
      {canManage && (
        <>
          <Group grow>
            <Select
              label="Service"
              data={REFERRAL_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
              value={type}
              onChange={setType}
            />
            <TextInput
              label="Provider"
              value={provider}
              onChange={(e) => setProvider(e.currentTarget.value)}
            />
          </Group>
          <TextInput
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            Create referral
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No home-care referrals.
        </Text>
      ) : (
        data.map((r) => (
          <Group key={r.id} justify="space-between">
            <Group gap={6}>
              <Badge tone={refTone(r.status)} size="xs">
                {r.status}
              </Badge>
              <Text size="sm">
                {r.referral_type.replace("_", " ")}
                {r.provider ? ` · ${r.provider}` : ""}
              </Text>
            </Group>
            {canManage && (
              <Select
                size="xs"
                w={130}
                data={REFERRAL_STATUS.map((s) => ({ value: s, label: s }))}
                value={r.status}
                onChange={(v) => v && update.mutate({ id: r.id, status: v })}
                aria-label="Referral status"
              />
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}
