// Home-healthcare AdvanceDirectivesPanel — split from home-healthcare.tsx (pure move).

import { Group, Select, Stack, Switch, Text, Textarea, TextInput } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

const DIRECTIVE_TYPES = ["living_will", "dnr", "dpoa", "molst", "organ_donation"];

export function AdvanceDirectivesPanel({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<string | null>("dnr");
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);
  const [family, setFamily] = useState("");
  const [rel, setRel] = useState("");
  const [witnessed, setWitnessed] = useState("");
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["advance-directives", patientId],
    queryFn: () => homeHealthService.listAdvanceDirectives(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["advance-directives", patientId] });
  };
  const create = useMutation({
    mutationFn: () =>
      homeHealthService.createAdvanceDirective({
        patient_id: patientId,
        directive_type: type ?? "dnr",
        content: content || undefined,
        family_consent_obtained: consent,
        family_member_name: family || undefined,
        family_relationship: rel || undefined,
        witnessed_by: witnessed || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Directive recorded", { title: "Home healthcare" });
      setContent("");
      setConsent(false);
      setFamily("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const revoke = useMutation({
    mutationFn: () => homeHealthService.revokeAdvanceDirective(revokeId ?? "", { reason }),
    onSuccess: () => {
      invalidate();
      toast.success("Directive revoked", { title: "Home healthcare" });
      setRevokeId(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Advance directives
      </Text>
      {canManage && (
        <>
          <Group grow>
            <Select
              label="Type"
              data={DIRECTIVE_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
              value={type}
              onChange={setType}
            />
            <TextInput
              label="Witnessed by"
              value={witnessed}
              onChange={(e) => setWitnessed(e.currentTarget.value)}
            />
          </Group>
          <Textarea
            label="Content"
            value={content}
            onChange={(e) => setContent(e.currentTarget.value)}
            placeholder="No CPR / no intubation"
            minRows={2}
          />
          <Group grow>
            <TextInput
              label="Family member"
              value={family}
              onChange={(e) => setFamily(e.currentTarget.value)}
            />
            <TextInput
              label="Relationship"
              value={rel}
              onChange={(e) => setRel(e.currentTarget.value)}
            />
          </Group>
          <Switch
            label="Family consent obtained"
            checked={consent}
            onChange={(e) => setConsent(e.currentTarget.checked)}
          />
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            Record directive
          </Button>
        </>
      )}
      {revokeId && (
        <Group align="flex-end" gap="xs">
          <TextInput
            label="Revoke reason"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            tone="danger"
            onClick={() => revoke.mutate()}
            loading={revoke.isPending}
            disabled={!reason.trim()}
          >
            Confirm
          </Button>
          <Button tone="ghost" onClick={() => setRevokeId(null)}>
            Cancel
          </Button>
        </Group>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No advance directives.
        </Text>
      ) : (
        data.map((d) => (
          <Group key={d.id} justify="space-between">
            <Group gap={6}>
              <Badge tone={d.status === "active" ? "success" : "neutral"} size="xs">
                {d.directive_type.replace("_", " ")}
              </Badge>
              {d.family_consent_obtained && (
                <Badge tone="info" size="xs">
                  family consent
                </Badge>
              )}
              <Text size="sm">{d.content}</Text>
            </Group>
            {canManage && d.status === "active" && (
              <Button size="xs" tone="danger" onClick={() => setRevokeId(d.id)}>
                Revoke
              </Button>
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}
