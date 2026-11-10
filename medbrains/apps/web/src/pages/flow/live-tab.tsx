import { Grid, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMemo, useState } from "react";
import { Alert, Badge, FloorMap, FloorMapTable, SegmentedControl, Select } from "@/components/ui";
import {
  BAND_LABELS,
  type FlowOverlay,
  floorSummary,
  OVERLAYS,
  timeline,
  zonesAt,
  zoneViews,
} from "./flow-state";
import { QuestsPanel } from "./quests-panel";
import { TimelineBar } from "./timeline-bar";
import { useFlowFloors, useFlowForecast, useFlowHistory, useFlowLive } from "./use-flow";
import { ZoneDetail } from "./zone-detail";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

/**
 * The live floor: the map shaded under one overlay at a time, its table
 * twin (the keyboard surface), recommendations, alerts and team goals, and a
 * timeline to scrub back through today or play the forecast forward.
 */
export function LiveTab() {
  const canAct = useHasPermission(P.FLOW.RECOMMENDATIONS_ACT);
  const canAck = useHasPermission(P.FLOW.ALERTS_ACK);
  const canHistory = useHasPermission(P.FLOW.HISTORY_VIEW);
  const floors = useFlowFloors(true);
  const [chosen, setChosen] = useState<string | null>(null);
  const floorId = chosen ?? floors.data?.[0]?.id ?? null;
  const live = useFlowLive(floorId);
  const history = useFlowHistory(floorId, canHistory);
  const forecast = useFlowForecast(floorId);
  const [overlay, setOverlay] = useState<FlowOverlay>("crowd");
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState<number | null>(null);

  const steps = useMemo(
    () => timeline(history.data ?? [], forecast.data ?? null),
    [history.data, forecast.data],
  );
  const nowIndex = steps.findIndex((s) => s.moment.kind === "live");
  const index = stepIndex ?? nowIndex;
  const moment = steps[index]?.moment ?? { kind: "live" as const };
  const data = live.data;
  const views = useMemo(() => {
    if (!data) return [];
    const zones = zonesAt(data.zones, moment, history.data ?? [], forecast.data ?? null);
    return zoneViews(zones, overlay, moment.kind === "live" ? data.recommendations : []);
  }, [data, moment, overlay, history.data, forecast.data]);
  const names = useMemo(
    () => new Map((data?.zones ?? []).map((z) => [z.location_id, z.name] as const)),
    [data],
  );
  const overlayLabel = OVERLAYS.find((o) => o.value === overlay)?.label ?? "Crowd";
  const summary = floorSummary(data?.floor_name ?? "Floor", views);

  if (floors.isError) {
    return (
      <Alert tone="danger">
        Flow could not be loaded. This is a connection problem, not an empty building.
      </Alert>
    );
  }
  if (floors.data && floors.data.length === 0) {
    return (
      <Alert tone="info">
        No floor has Flow zones yet. Facilities sets up zones, their limits and what feeds them in
        the Setup tab.
      </Alert>
    );
  }
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Group gap="md" align="flex-end">
          <Select
            label="Floor"
            data={(floors.data ?? []).map((f) => ({
              value: f.id,
              label: f.building_name ? `${f.building_name} · ${f.name}` : f.name,
            }))}
            value={floorId}
            onChange={(v) => {
              setChosen(v);
              setStepIndex(null);
            }}
            allowDeselect={false}
            w={260}
          />
          <SegmentedControl
            aria-label="Overlay"
            data={OVERLAYS}
            value={overlay}
            onChange={(v) => setOverlay(v as FlowOverlay)}
            data-testid="flow-overlay"
          />
        </Group>
        <Group gap="xs">
          <Badge tone="info">Estimated</Badge>
          <Text size="xs" c="dimmed">
            {data?.as_of ? `Updated ${timeOf(data.as_of)}` : "No reading yet"}
          </Text>
        </Group>
      </Group>

      {live.isError && (
        <Alert tone="danger">
          Flow could not be refreshed
          {data?.as_of ? `; showing the floor as it was at ${timeOf(data.as_of)}` : ""}.
        </Alert>
      )}
      {data?.stale && (
        <Alert tone="warning">
          {data.as_of
            ? `Stale since ${timeOf(data.as_of)}: Flow has not updated this floor since then.`
            : "No reading yet: Flow updates once a minute once a zone is mapped to a department or queue."}
        </Alert>
      )}

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 9 }}>
          <Stack gap="sm">
            <FloorMap
              zones={views}
              summary={summary}
              selectedId={focused ?? selected}
              onZoneSelect={setSelected}
              data-testid="flow-map"
            />
            <Text size="xs" c="dimmed">
              Levels: {BAND_LABELS.join(" · ")}, written on every zone with its number. Dots are
              people waiting in the queue. "est." means estimated from queues, check-ins, visitor
              passes and rosters.
            </Text>
            {steps.length > 1 && (
              <TimelineBar
                steps={steps}
                index={index}
                onChange={setStepIndex}
                forecastBasis={forecast.data?.basis ?? null}
              />
            )}
            <FloorMapTable
              zones={views}
              caption={`${summary} ${overlayLabel} overlay.`}
              metricLabel={overlayLabel}
              selectedId={selected}
              onZoneSelect={setSelected}
              onZoneFocus={setFocused}
            />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          {data && (
            <QuestsPanel
              live={data}
              names={names}
              canAct={canAct}
              canAck={canAck}
              onInspect={setSelected}
            />
          )}
        </Grid.Col>
      </Grid>
      <ZoneDetail zoneId={selected} onClose={() => setSelected(null)} />
    </Stack>
  );
}
