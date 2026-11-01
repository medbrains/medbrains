/**
 * The track builder canvas (RFC §11.3): the metro map made editable — "+"
 * after a station opens the block catalogue, drag along the line or use the
 * station panel's buttons to reorder, a branch is a station with a
 * condition — beside the always-visible checks, the test drive and Propose.
 * Call path: Build tab → edit → autosave (PUT draft) → server checks →
 * test drive (POST dry-run) → Propose (knowledge change set) → QO + MS
 * approve → apply publishes the next version.
 */
import { Grid, Group, Stack, Text } from "@mantine/core";
import type { FlowBuilder, FlowStation } from "@medbrains/types";
import { IconRefresh } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Button, Card, toast } from "@/components/ui";
import { sopFlowsService } from "@/services/sopFlows.service";
import { BlockCatalogue } from "./block-catalogue";
import { insertBlock, moveBy, moveTo, removeStation, setBranch, updateStation } from "./builder";
import styles from "./builder.module.scss";
import { ChecksPanel } from "./checks-panel";
import { MetroMap } from "./metro-map";
import { ProposeTrack } from "./propose-track";
import { StationPanel } from "./station-panel";
import { TestDrive } from "./test-drive";
import { builderKey, useAutosave } from "./use-autosave";

const SAVE_TEXT = {
  saved: "Saved",
  unsaved: "Not saved yet",
  saving: "Saving…",
  error: "Not saved",
} as const;

interface Highlight {
  keys: string[];
  label: string;
}

export interface TrackBuilderProps {
  view: FlowBuilder;
  /** A proposed change waiting for approval, if any. */
  pendingTitle: string | null;
}

export function TrackBuilder({ view, pendingTitle }: TrackBuilderProps) {
  const queryClient = useQueryClient();
  const [track, setTrack] = useState<FlowStation[]>(view.draft?.stations ?? view.published);
  const [selected, setSelected] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const autosave = useAutosave(view.code, view.draft?.revision ?? 0);
  const { blocks, facts, departments, roles } = view.catalogue;

  const edit = (next: FlowStation[]) => {
    setTrack(next);
    autosave.schedule(next);
  };
  const drive = useMutation({
    mutationFn: () => sopFlowsService.dryRun(view.code, view.draft?.revision ?? 0),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: builderKey(view.code) }),
  });
  const discard = useMutation({
    mutationFn: () => sopFlowsService.discardDraft(view.code),
    onSuccess: (fresh) => {
      queryClient.setQueryData(builderKey(view.code), fresh);
      autosave.reset(0);
      setTrack(fresh.published);
      setSelected(null);
      drive.reset();
      toast.success("The draft is gone; the published track is unchanged.", {
        title: "Draft discarded",
      });
    },
  });

  const station = track.find((s) => s.key === selected);
  const index = station ? track.indexOf(station) : -1;
  const highlightSet = useMemo(() => new Set(highlight?.keys ?? []), [highlight]);
  const mapEdit = {
    selected,
    onSelect: (key: string) => setSelected(key === selected ? null : key),
    onInsertAfter: (key: string) => setInsertAt(track.findIndex((s) => s.key === key) + 1),
    onMove: (key: string, to: number) => edit(moveTo(track, key, to)),
  };
  const dirty = autosave.state !== "saved";
  const driveCurrent =
    drive.data && drive.data.revision === view.draft?.revision ? drive.data : undefined;
  const driveBlocked = !view.draft
    ? "Change the track first: the test drive runs on a saved draft."
    : dirty
      ? "Wait for the draft to save."
      : null;
  const where = insertAt === null ? "" : `after ${track[insertAt - 1]?.name ?? "the start"}`;

  return (
    <Stack gap="md">
      {pendingTitle && (
        <Alert tone="warning" title="A change to this flow is waiting for approval">
          {pendingTitle}. Editing the draft now means proposing it again.
        </Alert>
      )}
      {view.draft?.stale && (
        <Alert tone="danger" title="This draft is out of date">
          <Stack gap="xs">
            <Text size="sm">
              Another change was published after this draft started. Start again from the published
              track so nothing published is undone.
            </Text>
            <Group>
              <Button
                tone="secondary"
                size="xs"
                onClick={() => discard.mutate()}
                loading={discard.isPending}
              >
                Start again from the published track
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}
      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            <Card withBorder padding="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" role="status" aria-live="polite">
                    {view.draft || dirty
                      ? `Draft: ${SAVE_TEXT[autosave.state]}`
                      : `Published version ${view.version}: change anything to start a draft`}
                    {autosave.state === "error" && autosave.error ? ` (${autosave.error})` : ""}
                  </Text>
                  {view.draft && (
                    <Button
                      tone="ghost"
                      size="xs"
                      leftSection={<IconRefresh size={16} />}
                      onClick={() => discard.mutate()}
                      loading={discard.isPending}
                    >
                      Discard draft
                    </Button>
                  )}
                </Group>
                <MetroMap
                  stations={track}
                  switches={view.switches}
                  ghost={null}
                  highlight={highlightSet}
                  highlightLabel={highlight?.label}
                  announcement={`${track.length} stations. Select a station to edit it, or press + to add one after it.`}
                  edit={mapEdit}
                />
              </Stack>
            </Card>
            {station && (
              <StationPanel
                station={station}
                block={blocks.find(
                  (b) =>
                    b.kind === station.kind.type && Object.values(station.kind).includes(b.code),
                )}
                facts={facts}
                departments={departments}
                roles={roles}
                isFirst={index === 0}
                isLast={index === track.length - 1}
                onChange={(patch) => edit(updateStation(track, station.key, patch))}
                onBranch={(lane, clause) => edit(setBranch(track, station.key, lane, clause))}
                onMove={(d) => edit(moveBy(track, station.key, d))}
                onRemove={() => {
                  edit(removeStation(track, station.key));
                  setSelected(null);
                }}
                onClose={() => setSelected(null)}
              />
            )}
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md" className={styles.sticky}>
            <ChecksPanel
              checks={dirty ? null : view.checks}
              error={
                autosave.state === "error"
                  ? (autosave.error ?? "The draft could not be saved")
                  : null
              }
              onRetry={autosave.retry}
              onHighlight={(keys) => setHighlight({ keys, label: "Check fails" })}
            />
            <ProposeTrack view={view} track={track} dirty={dirty} />
            <TestDrive
              drive={driveCurrent}
              running={drive.isPending}
              error={drive.error?.message ?? null}
              blocked={driveBlocked}
              stations={track}
              onRun={() => drive.mutate()}
              onShow={(keys) => setHighlight(keys ? { keys, label: "Sample patient" } : null)}
            />
          </Stack>
        </Grid.Col>
      </Grid>
      <BlockCatalogue
        opened={insertAt !== null}
        where={where}
        blocks={blocks}
        onClose={() => setInsertAt(null)}
        onPick={(b) => {
          const next = insertBlock(track, insertAt ?? track.length, b);
          edit(next);
          setSelected(next[insertAt ?? 0]?.key ?? null);
          setInsertAt(null);
        }}
      />
    </Stack>
  );
}
