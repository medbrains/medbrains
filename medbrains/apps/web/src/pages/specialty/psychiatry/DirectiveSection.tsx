import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychAdvanceDirective, type PsychDirectiveChallenge } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Input, Modal, Panel, Select, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { ChallengeModal } from "./ChallengeModal";
import { blankToUndefined, CHALLENGE_GROUNDS, formatDate, labelOf } from "./labels";

const schema = z
  .object({
    made_by: z.enum(["patient", "legal_guardian"]),
    made_on: z.string(),
    treatment_wishes: z.string(),
    treatment_refusals: z.string(),
    representative_preferences: z.string(),
    document_ref: z.string(),
  })
  .refine(
    (v) =>
      [v.treatment_wishes, v.treatment_refusals, v.representative_preferences].some((t) =>
        t.trim(),
      ),
    {
      path: ["treatment_wishes"],
      message: "Record what the directive says",
    },
  );
type Form = z.infer<typeof schema>;

const STATUS_LABEL: Record<PsychAdvanceDirective["status"], string> = {
  active: "In force",
  revoked: "Revoked by the patient",
  modified_by_board: "Modified by the Board",
  cancelled_by_board: "Cancelled by the Board",
};

function DirectiveBody({ d }: { d: PsychAdvanceDirective }) {
  return (
    <Stack gap={4}>
      {d.treatment_wishes && (
        <Text size="sm">
          <b>Wishes:</b> {d.treatment_wishes}
        </Text>
      )}
      {d.treatment_refusals && (
        <Text size="sm">
          <b>Refuses:</b> {d.treatment_refusals}
        </Text>
      )}
      {d.representative_preferences && (
        <Text size="sm">
          <b>Representative preference:</b> {d.representative_preferences}
        </Text>
      )}
    </Stack>
  );
}

interface ChallengeLineProps {
  c: PsychDirectiveChallenge;
  onDecide?: (status: "upheld" | "modified" | "cancelled") => void;
}

function ChallengeLine({ c, onDecide }: ChallengeLineProps) {
  return (
    <Stack gap={4}>
      <Text size="sm">
        Application to the Board ({c.grounds.map((g) => labelOf(CHALLENGE_GROUNDS, g)).join("; ")})
        — {c.status === "pending_board" ? "awaiting the Board" : `Board: ${c.status}`}
      </Text>
      {onDecide && c.status === "pending_board" && (
        <Group gap="xs">
          <Button tone="ghost" size="xs" onClick={() => onDecide("upheld")}>
            Board upheld it
          </Button>
          <Button tone="ghost" size="xs" onClick={() => onDecide("modified")}>
            Board modified it
          </Button>
          <Button tone="ghost" size="xs" onClick={() => onDecide("cancelled")}>
            Board cancelled it
          </Button>
        </Group>
      )}
    </Stack>
  );
}

/** MHCA s.5–13: the directive governs treatment unless the patient revokes
 *  it, the Board modifies or cancels it (s.11), or for emergency treatment
 *  alone (s.9). A pending application does not suspend it. */
export function DirectiveSection({ psychPatientId }: { psychPatientId: string }) {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.SPECIALTY.PSYCHIATRY.LEGAL_MANAGE);
  const canChallenge = useHasPermission(P.SPECIALTY.PSYCHIATRY.DIRECTIVES_CHALLENGE);
  const canDecide = useHasPermission(P.SPECIALTY.PSYCHIATRY.MHRB_MANAGE);
  const directives = useQuery({
    queryKey: ["psych-directives", psychPatientId],
    queryFn: () => psychiatryService.listDirectives(psychPatientId),
  });
  const challenges = useQuery({
    queryKey: ["psych-challenges", psychPatientId],
    queryFn: () => psychiatryService.listChallenges(psychPatientId),
  });
  const [open, setOpen] = useState(false);
  const [challenging, setChallenging] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      made_by: "patient",
      made_on: "",
      treatment_wishes: "",
      treatment_refusals: "",
      representative_preferences: "",
      document_ref: "",
    },
  });
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["psych-directives", psychPatientId] });
  const create = useMutation({
    mutationFn: (v: Form) =>
      psychiatryService.createDirective(psychPatientId, {
        made_by: v.made_by,
        made_on: blankToUndefined(v.made_on),
        treatment_wishes: blankToUndefined(v.treatment_wishes),
        treatment_refusals: blankToUndefined(v.treatment_refusals),
        representative_preferences: blankToUndefined(v.representative_preferences),
        document_ref: blankToUndefined(v.document_ref),
      }),
    onSuccess: () => {
      invalidate();
      reset();
      setOpen(false);
    },
  });
  const revoke = useMutation({
    mutationFn: psychiatryService.revokeDirective,
    onSuccess: invalidate,
  });
  const decide = useMutation({
    mutationFn: (a: { id: string; status: "upheld" | "modified" | "cancelled" }) =>
      psychiatryService.decideChallenge(a.id, { status: a.status }),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["psych-challenges", psychPatientId] });
    },
  });
  const rows = directives.data ?? [];
  const active = rows.find((d) => d.status === "active");
  const pending = (challenges.data ?? []).filter((c) => c.advance_directive_id === active?.id);
  const area = (
    name: "treatment_wishes" | "treatment_refusals" | "representative_preferences",
    label: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextArea label={label} autosize minRows={2} error={fieldState.error?.message} {...field} />
      )}
    />
  );

  return (
    <Panel
      title="Advance directive (s.5)"
      actions={
        canManage && !active ? (
          <Button tone="primary" size="xs" onClick={() => setOpen(true)}>
            Record directive
          </Button>
        ) : undefined
      }
    >
      <Stack gap="sm">
        {directives.isError && (
          <Alert tone="danger">The directive could not be loaded. {directives.error.message}</Alert>
        )}
        {active ? (
          <Alert tone="warning" title="This directive must be followed">
            <Stack gap="xs">
              <DirectiveBody d={active} />
              <Text size="xs">
                Treat in line with it (s.10). It does not govern emergency treatment under s.94
                (s.9). Not following it requires an application to the Mental Health Review Board
                (s.11).
              </Text>
              {pending.map((c) => (
                <ChallengeLine
                  key={c.id}
                  c={c}
                  onDecide={canDecide ? (status) => decide.mutate({ id: c.id, status }) : undefined}
                />
              ))}
              <Group gap="xs">
                {canChallenge && (
                  <Button tone="tertiary" size="xs" onClick={() => setChallenging(active.id)}>
                    Apply to the Board
                  </Button>
                )}
                {canManage && (
                  <Button
                    tone="danger-ghost"
                    size="xs"
                    loading={revoke.isPending}
                    onClick={() => revoke.mutate(active.id)}
                  >
                    Patient revoked it
                  </Button>
                )}
              </Group>
            </Stack>
          </Alert>
        ) : (
          !directives.isLoading &&
          !directives.isError && (
            <Text size="sm" c="dimmed">
              No directive in force.
            </Text>
          )
        )}
        {rows
          .filter((d) => d.status !== "active")
          .map((d) => (
            <Group key={d.id} gap="xs">
              <Badge tone="neutral">{STATUS_LABEL[d.status]}</Badge>
              <Text size="sm">Recorded {formatDate(d.created_at)}</Text>
            </Group>
          ))}
        {(revoke.isError || decide.isError) && (
          <Alert tone="danger">{(revoke.error ?? decide.error)?.message}</Alert>
        )}
      </Stack>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Record an advance directive"
        size="lg"
        primaryAction={{
          label: "Record",
          onClick: () => void handleSubmit((v) => create.mutate(v))(),
          loading: create.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
      >
        <Stack gap="sm">
          <Group grow>
            <Controller
              control={control}
              name="made_by"
              render={({ field }) => (
                <Select
                  label="Made by"
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  allowDeselect={false}
                  data={[
                    { value: "patient", label: "The patient (adult)" },
                    { value: "legal_guardian", label: "Legal guardian (minor)" },
                  ]}
                />
              )}
            />
            <Controller
              control={control}
              name="made_on"
              render={({ field }) => <Input label="Made on" type="date" {...field} />}
            />
          </Group>
          {area("treatment_wishes", "How the patient wishes to be cared for and treated")}
          {area("treatment_refusals", "How the patient does not wish to be treated")}
          {area(
            "representative_preferences",
            "Who should be the nominated representative, in order",
          )}
          <Controller
            control={control}
            name="document_ref"
            render={({ field }) => <Input label="Signed document reference" {...field} />}
          />
          {create.isError && <Alert tone="danger">{create.error.message}</Alert>}
        </Stack>
      </Modal>
      <ChallengeModal
        directiveId={challenging}
        psychPatientId={psychPatientId}
        onClose={() => setChallenging(null)}
      />
    </Panel>
  );
}
