/**
 * Admin → Flows → one flow's switchboard (RFC-SOP-FLOWS §5): switches as
 * plain sentences grouped by stage in the order a patient meets them, the
 * locked safety signals, the metro map, and — beside it — the preview of a
 * change before it is proposed as a knowledge change set.
 */
import { Anchor, Grid, Group, Loader, SimpleGrid, Stack, Tabs, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { FlowDetail, FlowSwitches, FlowSwitchValue } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconEye, IconLock, IconRoute, IconToggleRight, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { PageHeader } from "@/components";
import { Alert, Badge, Breadcrumb, Button, Card, Panel, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { knowledgeChangesService } from "@/services/knowledgeChanges.service";
import { DISCHARGE_FLOW, sopFlowsService } from "@/services/sopFlows.service";
import { BuildTab } from "./build-tab";
import { changedKeys, describeRouteChange, stationsForSwitch } from "./metro";
import { MetroMap } from "./metro-map";
import { PreviewPanel } from "./preview-panel";
import { SwitchLine } from "./switch-line";
import styles from "./switchboard.module.scss";

/** Switch defs grouped by stage, stages in the order the track meets them. */
function byStage(flow: FlowDetail) {
  const order = [...new Set(flow.stations.map((s) => s.stage))];
  const stages = order.filter((st) => flow.switch_defs.some((d) => d.stage === st));
  return stages.map((stage) => ({
    stage,
    defs: flow.switch_defs.filter((d) => d.stage === stage),
  }));
}

/** The switches a pending proposal would set. */
function proposed(flow: FlowDetail): FlowSwitches | null {
  const after = flow.pending_change?.after;
  if (!after) return null;
  return Object.fromEntries(
    flow.switch_defs.map((d) => [d.key, after[d.key] ?? flow.switches[d.key]]),
  ) as FlowSwitches;
}

export function FlowSwitchboardPage() {
  useRequirePermission(P.FLOWS.VIEW);
  const { code = DISCHARGE_FLOW } = useParams();
  const canView = useHasPermission(P.FLOWS.VIEW);
  const canSwitch = useHasPermission(P.FLOWS.SWITCH);
  const canDraft = useHasPermission(P.KNOWLEDGE.CHANGE_SETS.CREATE);
  const canBuild = useHasPermission(P.FLOWS.BUILD);
  const flow = useQuery({
    queryKey: ["flows", code],
    queryFn: () => sopFlowsService.get(code),
    // No permission, no request (RFC §8).
    enabled: canView,
  });

  return (
    <Stack gap="md">
      <PageHeader
        title={flow.data ? `${flow.data.name}: switchboard` : "Flow switchboard"}
        subtitle="Flip a switch, see the route it creates and who it affects, then propose it for approval"
        actions={
          <Anchor component={Link} to={`/admin/flows/${encodeURIComponent(code)}/control-room`}>
            Open the control room
          </Anchor>
        }
      />
      {flow.isLoading && <Loader aria-label="Loading the flow" />}
      {flow.error && (
        <Alert tone="danger" title="Could not load the flow">
          <Stack gap="xs">
            <Text size="sm">{flow.error.message}</Text>
            <Group>
              <Button tone="secondary" size="xs" onClick={() => void flow.refetch()}>
                Try again
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}
      {flow.data && (
        <Tabs defaultValue="switchboard" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="switchboard" leftSection={<IconToggleRight size={16} aria-hidden />}>
              Switchboard
            </Tabs.Tab>
            {canBuild && (
              <Tabs.Tab value="build" leftSection={<IconRoute size={16} aria-hidden />}>
                Build
              </Tabs.Tab>
            )}
          </Tabs.List>
          <Tabs.Panel value="switchboard" pt="md">
            <Board flow={flow.data} canSwitch={canSwitch} canPropose={canSwitch && canDraft} />
          </Tabs.Panel>
          {canBuild && (
            <Tabs.Panel value="build" pt="md">
              <BuildTab code={code} pendingTitle={flow.data.pending_change?.title ?? null} />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </Stack>
  );
}

interface BoardProps {
  flow: FlowDetail;
  canSwitch: boolean;
  canPropose: boolean;
}

function Board({ flow, canSwitch, canPropose }: BoardProps) {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<FlowSwitches>({});
  const [highlight, setHighlight] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const saved = flow.switches;
  const current = useMemo(() => ({ ...saved, ...edits }), [saved, edits]);
  const changes = changedKeys(saved, current);
  const pending = proposed(flow);
  const mapSwitches = changes.length > 0 ? current : (pending ?? saved);
  const ghost = changes.length > 0 || pending ? saved : null;
  // Patients at each station now, shared with the control room's cache.
  const room = useQuery({
    queryKey: ["flows", flow.code, "control-room"],
    queryFn: () => sopFlowsService.controlRoom(flow.code),
  });
  const counts = useMemo(
    () => (room.data ? new Map(room.data.stations.map((s) => [s.key, s.count])) : undefined),
    [room.data],
  );
  const highlighted = useMemo(
    () => new Set(highlight ? stationsForSwitch(flow.stations, highlight) : []),
    [flow.stations, highlight],
  );
  const routeChange = describeRouteChange(flow.stations, saved, mapSwitches);
  const announcement =
    routeChange.length > 0
      ? `${routeChange.join(". ")}.`
      : `Route as published (version ${flow.version}).`;

  const impact = useMutation({
    mutationFn: () => sopFlowsService.previewImpact(flow.code, current),
  });
  const propose = useMutation({
    mutationFn: async (reason: string) => {
      const titles = flow.switch_defs.filter((d) => changes.includes(d.key)).map((d) => d.sentence);
      const set = await knowledgeChangesService.create({
        area: "flow_switches",
        title: `${flow.name}: ${titles.join("; ")}`,
        reason,
        items: [
          {
            op: "update",
            target_id: flow.template_id,
            // The published track rides along unchanged, so the change set
            // goes stale if a track is published before this applies.
            after: { flow_code: flow.code, ...current, track: flow.stations },
          },
        ],
      });
      return knowledgeChangesService.preview(set.id);
    },
    onSuccess: () => {
      toast.success("Proposed. It changes nothing until it is approved and applied.", {
        title: "Switch change proposed",
      });
      setEdits({});
      setPreviewOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["flows", flow.code] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not propose the change" }),
  });

  const flip = (key: string, value: FlowSwitchValue) => {
    const next = { ...edits, [key]: value };
    if (saved[key] === value) delete next[key];
    setEdits(next);
    // The preview described the old setting; close it rather than show it stale.
    setPreviewOpen(false);
  };
  const openPreview = () => {
    setPreviewOpen(true);
    impact.mutate();
  };

  return (
    <Stack gap="md">
      <Breadcrumb
        items={[
          { label: "Flows", href: "/admin/flows" },
          ...flow.path.split(" › ").map((label) => ({ label })),
        ]}
      />
      <Group gap="xs">
        <Badge tone="success">Published · version {flow.version}</Badge>
        {flow.in_flight.map((v) => (
          <Badge key={v.version} tone="neutral">
            {v.patients} in discharge on version {v.version}
          </Badge>
        ))}
      </Group>
      {flow.pending_change && (
        <Alert
          tone={flow.pending_change.status === "stale" ? "danger" : "warning"}
          title="A switch change is proposed"
        >
          <Text size="sm">
            {flow.pending_change.title}.{" "}
            {flow.pending_change.status === "stale"
              ? "Live settings changed since it was previewed; preview it again."
              : flow.pending_change.status === "approved"
                ? "Approved; waiting to be applied."
                : `${flow.pending_change.approvals} of ${flow.clinical ? 2 : 1} approvals.`}{" "}
            The map shows it, with today's route as a ghost line.{" "}
            <Anchor component={Link} to={`/admin/knowledge-changes?open=${flow.pending_change.id}`}>
              Review the change
            </Anchor>
          </Text>
        </Alert>
      )}
      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: previewOpen ? 8 : 12 }}>
          <Card withBorder padding="md">
            <MetroMap
              stations={flow.stations}
              switches={mapSwitches}
              ghost={ghost}
              highlight={highlighted}
              announcement={announcement}
              fitKey={previewOpen ? "narrow" : "wide"}
              counts={counts}
              countsError={room.isError}
            />
          </Card>
        </Grid.Col>
        {previewOpen && (
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <PreviewPanel
              report={impact.data}
              isLoading={impact.isPending}
              error={impact.error}
              clinical={flow.clinical}
              canPropose={canPropose}
              proposing={propose.isPending}
              onRetry={() => impact.mutate()}
              onPropose={(reason) => propose.mutate(reason)}
              onClose={() => setPreviewOpen(false)}
            />
          </Grid.Col>
        )}
      </Grid>
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {byStage(flow).map(({ stage, defs }) => (
          <Panel key={stage} title={stage}>
            <Stack gap="md">
              {defs.map((d) => (
                <SwitchLine
                  key={d.key}
                  def={d}
                  value={current[d.key] ?? d.kind.default}
                  saved={saved[d.key] ?? d.kind.default}
                  disabled={!canSwitch}
                  history={flow.history}
                  highlighted={highlight === d.key}
                  onChange={(v) => flip(d.key, v)}
                  onShowOnMap={() => setHighlight(highlight === d.key ? null : d.key)}
                />
              ))}
            </Stack>
          </Panel>
        ))}
        <Panel
          title="Always on"
          description="Required by law or patient safety; no switch can remove them."
        >
          <Stack gap="xs">
            {flow.stations
              .filter((s) => s.locked)
              .map((s) => (
                <Group key={s.key} gap="xs" wrap="nowrap" align="flex-start">
                  <IconLock size={16} aria-hidden />
                  <Stack gap={0}>
                    <Text size="sm" fw={600}>
                      {s.name} — Always on: required
                    </Text>
                    <Text size="xs" c="dimmed">
                      {s.required_by}
                    </Text>
                  </Stack>
                </Group>
              ))}
          </Stack>
        </Panel>
      </SimpleGrid>
      {changes.length > 0 && (
        <Card withBorder padding="sm" className={styles.footer}>
          <Group justify="space-between">
            <Text fw={600}>
              {changes.length} {changes.length === 1 ? "change" : "changes"}, not yet proposed
            </Text>
            <Group gap="xs">
              <Button tone="primary" leftSection={<IconEye size={16} />} onClick={openPreview}>
                Preview
              </Button>
              <Button
                tone="secondary"
                leftSection={<IconTrash size={16} />}
                onClick={() => setEdits({})}
              >
                Discard
              </Button>
            </Group>
          </Group>
        </Card>
      )}
    </Stack>
  );
}
