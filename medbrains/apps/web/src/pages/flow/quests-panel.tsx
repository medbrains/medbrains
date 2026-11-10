import { Group, Progress, Stack, Text, Title } from "@mantine/core";
import type { FlowFloorLive } from "@medbrains/types";
import { AiLabel, Alert, Button, Card } from "@/components/ui";
import { useAckAlert, useDecideRecommendation } from "./use-flow";

interface QuestsPanelProps {
  live: FlowFloorLive;
  names: Map<string, string>;
  canAct: boolean;
  canAck: boolean;
  onInspect: (zoneId: string) => void;
}

const ADVICE_EXPLAINER = {
  title: "How this is worked out",
  description:
    "People waiting, times the minutes one token takes at a counter (measured over the last 30 minutes, or 3 minutes when too few were called), shared across the open counters. Advisory: accepting records your decision and opens nothing by itself.",
};

/**
 * Recommendations as nudges, alerts that point at a zone, and the team goals.
 * Team-level only: no person is named or ranked anywhere on this panel.
 */
export function QuestsPanel({ live, names, canAct, canAck, onInspect }: QuestsPanelProps) {
  const decide = useDecideRecommendation();
  const ack = useAckAlert();
  const name = (id: string) => names.get(id) ?? "A zone";
  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Group gap="xs">
          <Title order={3} size="h5">
            Recommendations ({live.recommendations.length})
          </Title>
          <AiLabel size="xs" explainer={ADVICE_EXPLAINER} />
        </Group>
        {live.recommendations.length === 0 && (
          <Text size="sm" c="dimmed">
            No queue is past its target right now.
          </Text>
        )}
        {live.recommendations.map((r) => (
          <Card key={r.id} withBorder padding="sm" data-testid="flow-recommendation">
            <Text size="sm" fw={600}>
              {name(r.location_id)}: open{" "}
              {r.counters_suggested - r.counters_open === 1
                ? "another counter"
                : `${r.counters_suggested - r.counters_open} more counters`}
            </Text>
            <Text size="sm">
              Est. wait {Math.round(r.wait_before_minutes)} → {Math.round(r.wait_after_minutes)} min
              (target {r.target_minutes}, {r.waiting} waiting)
            </Text>
            <Group gap="xs" mt="xs">
              {canAct && (
                <>
                  <Button
                    tone="primary"
                    size="xs"
                    loading={decide.isPending}
                    onClick={() => decide.mutate({ id: r.id, decision: "accepted" })}
                  >
                    Accept
                  </Button>
                  <Button
                    tone="secondary"
                    size="xs"
                    onClick={() => decide.mutate({ id: r.id, decision: "snoozed" })}
                  >
                    Snooze 30 min
                  </Button>
                </>
              )}
              <Button tone="ghost" size="xs" onClick={() => onInspect(r.location_id)}>
                Why?
              </Button>
            </Group>
          </Card>
        ))}
        {decide.isError && <Alert tone="danger">That decision was not saved. Try again.</Alert>}
      </Stack>

      <Stack gap="xs">
        <Title order={3} size="h5">
          Alerts ({live.alerts.length})
        </Title>
        {live.alerts.length === 0 && (
          <Text size="sm" c="dimmed">
            No zone is over its limit.
          </Text>
        )}
        {live.alerts.map((a) => (
          <Alert key={a.id} tone={a.level === "capacity" ? "danger" : "warning"}>
            <Text size="sm">
              {name(a.location_id)} is over its{" "}
              {a.level === "capacity" ? "capacity" : "comfort limit"}: about {a.people_est} people
              (limit {a.limit_value}).
            </Text>
            {canAck && !a.acked_at && (
              <Button tone="tertiary" size="xs" mt="xs" onClick={() => ack.mutate(a.id)}>
                Acknowledge
              </Button>
            )}
            {a.acked_at && (
              <Text size="xs" c="dimmed">
                Acknowledged
              </Text>
            )}
          </Alert>
        ))}
      </Stack>

      {live.goals.length > 0 && (
        <Stack gap="xs">
          <Title order={3} size="h5">
            Today's team goals
          </Title>
          {live.goals.map((g) => {
            const pct = g.minutes_measured === 0 ? 0 : (g.minutes_met / g.minutes_measured) * 100;
            return (
              <Stack key={g.location_id} gap={2}>
                <Text size="sm">
                  {name(g.location_id)} wait ≤ {g.goal_wait_minutes} min: met {g.minutes_met} of{" "}
                  {g.minutes_measured} minutes
                </Text>
                <Progress
                  value={pct}
                  aria-label={`${name(g.location_id)} goal ${Math.round(pct)}% met`}
                />
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
