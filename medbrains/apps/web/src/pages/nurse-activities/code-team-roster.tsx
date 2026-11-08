// Emergency-code rosters — who each code pages, by tier, and when a code blue
// re-pages. The maker screen for code_blue_team_members: without it the
// rosters stay empty, a code blue falls back to the ward shift or to every
// clinician, and a floor code to the duty medical officer and security.

import { Group, Stack, Text } from "@mantine/core";
import type { CodeTeamMember, CodeTeamRoster, CodeTeamTier } from "@medbrains/types";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  IconButton,
  Modal,
  NumberField,
  Select,
  toast,
} from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";

const TIER_LABEL: Record<CodeTeamTier, string> = {
  1: "Code team",
  2: "Duty medical officer",
  3: "Medical superintendent",
};
const CODE_OPTIONS = [
  { value: "code_blue", label: "Code blue (cardiac arrest)" },
  { value: "code_pink", label: "Code pink (infant or child abduction)" },
  { value: "code_red", label: "Code red (fire)" },
  { value: "code_yellow", label: "Code yellow (mass casualty)" },
  { value: "code_orange", label: "Code orange (hazardous material)" },
  { value: "code_silver", label: "Code silver (armed intruder)" },
  { value: "code_black", label: "Code black (bomb threat)" },
];
const ROSTER_KEY = ["code-blue", "team"] as const;

/** Roster card, shown only to holders of `nurse.code_blue.manage_team`. */
export function CodeTeamRosterCard() {
  const [codeType, setCodeType] = useState("code_blue");
  const { data, isError, isLoading } = useQuery({
    queryKey: ROSTER_KEY,
    queryFn: () => nurseActivitiesService.getCodeBlueTeam(),
  });
  if (isError) {
    return (
      <Alert tone="danger" title="Code rosters unavailable">
        The rosters could not be loaded. This does not mean they are empty.
      </Alert>
    );
  }
  if (isLoading || !data) {
    return <Text c="dimmed">Loading the code rosters…</Text>;
  }
  const isCodeBlue = codeType === "code_blue";
  const tiers: CodeTeamTier[] = isCodeBlue ? [1, 2, 3] : [1];
  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Text fw={600}>Emergency code rosters</Text>
        <Select
          label="Code"
          data={CODE_OPTIONS}
          value={codeType}
          onChange={(v) => v && setCodeType(v)}
          allowDeselect={false}
          w={360}
        />
        <Text size="sm" c="dimmed">
          {isCodeBlue
            ? "A code blue pages tier 1. Each round nobody answers adds the next tier."
            : "This code pages its responders. With none, it pages the duty medical officer and security."}
        </Text>
        {tiers.map((tier) => (
          <TierRow key={tier} tier={tier} codeType={codeType} roster={data} />
        ))}
        {isCodeBlue && <EscalationSettings roster={data} />}
      </Stack>
    </Card>
  );
}

interface TierRowProps {
  tier: CodeTeamTier;
  codeType: string;
  roster: CodeTeamRoster;
}

/** One tier of one code: its members, and a picker to add someone. */
function TierRow({ tier, codeType, roster }: TierRowProps) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const label = codeType === "code_blue" ? TIER_LABEL[tier] : "Responders";
  const members = useMemo(
    () => roster.members.filter((m) => m.tier === tier && m.code_type === codeType),
    [roster.members, tier, codeType],
  );
  const options = useMemo(() => {
    const taken = new Set(members.map((m) => m.user_id));
    return roster.candidates
      .filter((c) => !taken.has(c.id))
      .map((c) => ({ value: c.id, label: `${c.full_name} (${c.role.replace(/_/g, " ")})` }));
  }, [roster.candidates, members]);
  /** Reload the rosters after a change. */
  const refresh = () => qc.invalidateQueries({ queryKey: ROSTER_KEY });
  const add = useMutation({
    mutationFn: (id: string) =>
      nurseActivitiesService.addCodeBlueTeamMember({ user_id: id, tier, code_type: codeType }),
    onSuccess: () => {
      setUserId(null);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not add to the roster" }),
  });
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        {codeType === "code_blue" ? `Tier ${tier}: ${label}` : label}
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
          label={`Add to ${label.toLowerCase()}`}
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

/** A roster member with a remove control, confirmed first. */
function MemberRow({ member, onRemoved }: { member: CodeTeamMember; onRemoved: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => nurseActivitiesService.removeCodeBlueTeamMember(member.id),
    onSuccess: () => {
      setConfirming(false);
      onRemoved();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not remove" }),
  });
  return (
    <Group gap="xs">
      <Text size="sm">{member.full_name}</Text>
      <IconButton
        aria-label={`Remove ${member.full_name} from the roster`}
        tone="danger"
        onClick={() => setConfirming(true)}
      >
        <IconTrash size={16} />
      </IconButton>
      <Modal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title="Remove from the roster?"
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">
            {member.full_name} will no longer be paged for this code. If nobody is left on the team,
            the code falls back to a wider page.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button tone="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
            <Button tone="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              Remove
            </Button>
          </Group>
        </Stack>
      </Modal>
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
