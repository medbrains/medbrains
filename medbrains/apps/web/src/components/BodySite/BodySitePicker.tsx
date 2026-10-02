/**
 * Body site: type it, or pick it on the body.
 *
 * The typed field always works — no WebGL, a slow link or a model that fails
 * to load never blocks a wound or an injury being recorded. "Pick on body"
 * opens the anatomy model (loaded only then) with two equal ways to choose: a
 * tap on the 3D body, or the structure search, which is the keyboard and
 * screen-reader path. A pick stores the FMA concept code and the side; the
 * label is what a chart prints.
 */
import { Anchor, Box, Group, Progress, Stack, Text } from "@mantine/core";
import { IconBodyScan } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  ChipGroup,
  Drawer,
  Input,
  SegmentedControl,
  Select,
} from "@/components/ui";
import {
  ANATOMY_BASE_URL,
  type AtlasPart,
  type BodySite,
  DEFAULT_SYSTEMS,
  fetchAtlas,
  type Laterality,
  lateralityFromName,
  SYSTEMS,
  type SystemId,
} from "./anatomy-atlas";
import classes from "./body-site.module.scss";

const AnatomyScene = lazy(() =>
  import("./AnatomyScene").then((m) => ({ default: m.AnatomyScene })),
);

/** Structures offered per keystroke; the list holds 2,234. */
const SEARCH_LIMIT = 60;
const NO_SIDE = "none";
const SIDES = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "bilateral", label: "Both" },
  { value: "midline", label: "Midline" },
  { value: NO_SIDE, label: "Not stated" },
];

export interface BodySitePickerProps {
  label: string;
  value: BodySite | null;
  onChange: (site: BodySite | null) => void;
  required?: boolean;
  error?: string;
  placeholder?: string;
}

export function BodySitePicker({
  label,
  value,
  onChange,
  required,
  error,
  placeholder = "e.g. Left heel",
}: BodySitePickerProps) {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Stack gap={4}>
        <Input
          label={label}
          required={required}
          error={error}
          placeholder={placeholder}
          value={value?.label ?? ""}
          onChange={(e) => {
            const text = e.currentTarget.value;
            onChange(
              text ? { label: text, code: null, laterality: value?.laterality ?? null } : null,
            );
          }}
        />
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconBodyScan size={16} />}
          aria-label={`Pick ${label.toLowerCase()} on the body`}
          onClick={() => setOpened(true)}
          className={classes.pickButton}
        >
          Pick on body
        </Button>
      </Stack>
      {opened && (
        <BodySiteDrawer
          title={label}
          initial={value}
          onClose={() => setOpened(false)}
          onPick={(site) => {
            onChange(site);
            setOpened(false);
          }}
        />
      )}
    </>
  );
}

interface BodySiteDrawerProps {
  title: string;
  initial: BodySite | null;
  onClose: () => void;
  onPick: (site: BodySite) => void;
}

function BodySiteDrawer({ title, initial, onClose, onPick }: BodySiteDrawerProps) {
  const atlas = useQuery({
    queryKey: ["anatomy-atlas", ANATOMY_BASE_URL],
    queryFn: ({ signal }) => fetchAtlas(signal),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  const [visible, setVisible] = useState<SystemId[]>(DEFAULT_SYSTEMS);
  const [part, setPart] = useState<AtlasPart | null>(null);
  const [side, setSide] = useState<Laterality | null>(initial?.laterality ?? null);
  const [progress, setProgress] = useState(0);
  const [sceneError, setSceneError] = useState<string | null>(null);

  const partsById = useMemo(
    () => new Map((atlas.data?.parts ?? []).map((p) => [p.id, p])),
    [atlas.data],
  );
  const options = useMemo(
    () => (atlas.data?.parts ?? []).map((p) => ({ value: p.id, label: p.name })),
    [atlas.data],
  );
  const choose = (next: AtlasPart | null) => {
    setPart(next);
    if (next) setSide(lateralityFromName(next.name) ?? side);
    if (next && !visible.includes(next.system)) setVisible([...visible, next.system]);
  };

  return (
    <Drawer
      opened
      onClose={onClose}
      title={`Pick ${title.toLowerCase()}`}
      position="right"
      size="xl"
    >
      <Stack gap="sm" className={classes.drawerBody}>
        <Select
          label="Find a structure"
          placeholder="Type a name — femur, heel, deltoid…"
          searchable
          clearable
          limit={SEARCH_LIMIT}
          data={options}
          value={part?.id ?? null}
          onChange={(id) => choose(id ? (partsById.get(id) ?? null) : null)}
          disabled={!atlas.data}
          nothingFoundMessage="No structure by that name"
        />
        <ChipGroup multiple value={visible} onChange={(v) => setVisible(v as SystemId[])}>
          <Group gap={6} aria-label="Body systems shown">
            {SYSTEMS.map((s) => (
              <Chip key={s.id} value={s.id} size="xs">
                {s.label}
              </Chip>
            ))}
          </Group>
        </ChipGroup>
        {atlas.isError || sceneError ? (
          <Alert tone="warning" title="The body model is unavailable">
            {sceneError ?? "It could not be loaded."} Use the search above, or close this and type
            the site.
          </Alert>
        ) : (
          <Box className={classes.stage}>
            {progress < 100 && (
              <Progress value={progress} size="sm" aria-label="Loading the body model" />
            )}
            {atlas.data && (
              <Suspense fallback={null}>
                <AnatomyScene
                  atlas={atlas.data}
                  visible={visible}
                  selectedPartId={part?.id ?? null}
                  onPick={choose}
                  onProgress={setProgress}
                  onError={setSceneError}
                />
              </Suspense>
            )}
          </Box>
        )}
        <SegmentedControl
          aria-label="Side"
          value={side ?? NO_SIDE}
          onChange={(v) => setSide(v === NO_SIDE ? null : (v as Laterality))}
          data={SIDES}
        />
        <Group justify="space-between" align="flex-end">
          <Text size="sm" aria-live="polite">
            {part ? `Selected: ${part.name}` : "Nothing selected yet"}
          </Text>
          <Group gap="xs">
            <Button tone="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              tone="primary"
              disabled={!part}
              onClick={() =>
                part && onPick({ label: part.name, code: part.conceptId, laterality: side })
              }
            >
              Use this site
            </Button>
          </Group>
        </Group>
        <Text size="xs" c="dimmed">
          Reference adult anatomy for pointing, not for diagnosis. Anatomy data: BodyParts3D ©
          DBCLS,{" "}
          <Anchor href="https://creativecommons.org/licenses/by/4.0/" target="_blank" size="xs">
            CC BY 4.0
          </Anchor>
          , via human-atlas.
        </Text>
      </Stack>
    </Drawer>
  );
}
