// Code-blue team roster — who a code blue pages, by tier, and when it re-pages.
// The maker screen for code_blue_team_members: without it the roster stays
// empty and every code falls back to the ward shift or to every clinician.

import { Group, Stack, Text } from "@mantine/core";
import type { CodeTeamMember, CodeTeamRoster, CodeTeamTier } from "@medbrains/types";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Button, Card, IconButton, NumberField, Select, toast } from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";

const TIER_LABEL: Record<CodeTeamTier, string> = {
  1: "Code team",
  2: "Duty medical officer",
  3: "Medical superintendent",
};
const TIERS: CodeTeamTier[] = [1, 2, 3];
const ROSTER_KEY = ["code-blue", "team"] as const;

/** Roster card, shown only to holders of `nurse.code_blue.manage_team`. */
export function CodeTeamRosterCard() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ROSTER_KEY,
    queryFn: () => nurseActivitiesService.getCodeBlueTeam(),
  });
  if (isError) {
    return (
      <Alert tone="danger" title="Code-blue roster unavailable">
        The roster could not be loaded. This does not mean it is empty.
      </Alert>
    );
  }
  if (isLoading || !data) {
    return <Text c="dimmed">Loading the code-blue roster…</Text>;
  }
  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Text fw={600}>Code-blue team</Text>
        <Text size="sm" c="dimmed">
          A code blue pages tier 1. Each round nobody answers adds the next tier.
        </Text>
        {TIERS.map((tier) => (
          <TierRow key={tier} tier={tier} roster={data} />
        ))}
        <EscalationSettings roster={data} />
      </Stack>
    </Card>
  );
}

/** One tier: its members, and a picker to add someone to it. */
function TierRow({ tier, roster }: { tier: CodeTeamTier; roster: CodeTeamRoster }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const members = useMemo(
    () => roster.members.filter((m) => m.tier === tier),
    [roster.members, tier],
  );
  const options = useMemo(() => {
    const taken = new Set(members.map((m) => m.user_id));
    return roster.candidates
      .filter((c) => !taken.has(c.id))
      .map((c) => ({ value: c.id, label: `${c.full_name} (${c.role.replace(/_/g, " ")})` }));
  }, [roster.candidates, members]);
  const refresh = () => qc.invalidateQueries({ queryKey: ROSTER_KEY });
  const add = useMutation({
    mutationFn: (id: string) => nurseActivitiesService.addCodeBlueTeamMember({ user_id: id, tier }),
    onSuccess: () => {
      setUserId(null);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not add to the roster" }),
  });
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        Tier {tier}: {TIER_LABEL[tier]}
      </Text>
      {members.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nobody on this tier.
        </Text>
      ) : (
        members.map((m) => <MemberRow key={m.id} member={m} onRemoved={refresh} />)
      )}
      <Group align="end" gap="xs">
        <Select
          label={`Add to ${TIER_LABEL[tier].toLowerCase()}`}
          data={options}
          value={userId}
          onChange={setUserId}
          searchable
          w={320}
        />
        <Button
          tone="secondary"
          disabled={!userId}
          loading={add.isPending}
          onClick={() => userId && add.mutate(userId)}
        >
          Add
        </Button>
      </Group>
    </Stack>
  );
}

/** A roster member with a remove control. */
function MemberRow({ member, onRemoved }: { member: CodeTeamMember; onRemoved: () => void }) {
  const remove = useMutation({
    mutationFn: () => nurseActivitiesService.removeCodeBlueTeamMember(member.id),
    onSuccess: onRemoved,
    onError: (e: Error) => toast.error(e.message, { title: "Could not remove" }),
  });
  return (
    <Group gap="xs">
      <Text size="sm">{member.full_name}</Text>
      <IconButton
        aria-label={`Remove ${member.full_name} from the roster`}
        tone="danger"
        loading={remove.isPending}
        onClick={() => remove.mutate()}
      >
        <IconTrash size={16} />
      </IconButton>
    </Group>
  );
}

/** How long before a re-page, and how many rounds at most. */
function EscalationSettings({ roster }: { roster: CodeTeamRoster }) {
  const qc = useQueryClient();
  const [secs, setSecs] = useState<number>(roster.response_secs);
  const [rounds, setRounds] = useState<number>(roster.max_rounds);
  const save = useMutation({
    mutationFn: () =>
      nurseActivitiesService.updateCodeBlueTeamSettings({
        response_secs: secs,
        max_rounds: rounds,
      }),
    onSuccess: () => {
      toast.success("Re-page settings saved");
      void qc.invalidateQueries({ queryKey: ROSTER_KEY });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save" }),
  });
  return (
    <Group align="end" gap="xs">
      <NumberField
        label="Re-page after (seconds without a response)"
        min={15}
        max={600}
        value={secs}
        onChange={(v) => setSecs(Number(v) || 0)}
        w={260}
      />
      <NumberField
        label="Rounds at most"
        min={1}
        max={10}
        value={rounds}
        onChange={(v) => setRounds(Number(v) || 0)}
        w={160}
      />
      <Button tone="secondary" loading={save.isPending} onClick={() => save.mutate()}>
        Save
      </Button>
    </Group>
  );
}
