/**
 * Body site: type it, or pick it on the body.
 *
 * The typed field always works — no WebGL, a slow link or a model that fails
 * to load never blocks a wound or an injury being recorded. "Pick on body"
 * opens the anatomy model (loaded only then) with two equal ways to choose: a
 * tap on the 3D body, or the structure search, which is the keyboard and
 * screen-reader path. A structure pick stores the FMA concept code and the
 * side; a region pick ("Left knee") stores its words and side, with no code,
 * and lights the structures in it. The label is what a chart prints.
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
  Input,
  Modal,
  SegmentedControl,
  Select,
} from "@/components/ui";
import { groupedSelectData } from "@/lib/select-groups";
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
import { BODY_REGIONS, type BodyRegion, regionLabel, regionParts } from "./body-regions";
import classes from "./body-site.module.scss";

const AnatomyScene = lazy(() =>
  import("./AnatomyScene").then((m) => ({ default: m.AnatomyScene })),
);

/** Structures offered per keystroke; the list holds 2,234. */
const SEARCH_LIMIT = 60;
/** Select values for regions; structure ids are the model's own. */
const REGION_PREFIX = "region:";
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

type Selection = { part: AtlasPart } | { region: BodyRegion };

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
  const [selection, setSelection] = useState<Selection | null>(null);
  const [side, setSide] = useState<Laterality | null>(initial?.laterality ?? null);
  const [progress, setProgress] = useState(0);
  const [sceneError, setSceneError] = useState<string | null>(null);

  const partsById = useMemo(
    () => new Map((atlas.data?.parts ?? []).map((p) => [p.id, p])),
    [atlas.data],
  );
  const partsByName = useMemo(
    () => new Map((atlas.data?.parts ?? []).map((p) => [p.name, p])),
    [atlas.data],
  );
  const options = useMemo(
    () =>
      groupedSelectData([
        ...BODY_REGIONS.map((r) => ({
          value: `${REGION_PREFIX}${r.id}`,
          label: r.label,
          group: "Regions",
        })),
        ...(atlas.data?.parts ?? []).map((p) => ({
          value: p.id,
          label: p.name,
          group: "Structures",
        })),
      ]),
    [atlas.data],
  );
  const lit = useMemo(() => {
    if (!selection) return [];
    if ("part" in selection) return [selection.part];
    return regionParts(selection.region, side, partsByName);
  }, [selection, side, partsByName]);
  const litIds = useMemo(() => lit.map((p) => p.id), [lit]);

  const showSystems = (parts: AtlasPart[]) => {
    const missing = parts.map((p) => p.system).filter((sys) => !visible.includes(sys));
    if (missing.length) setVisible([...new Set([...visible, ...missing])]);
  };
  const choosePart = (next: AtlasPart | null) => {
    setSelection(next && { part: next });
    if (!next) return;
    setSide(lateralityFromName(next.name) ?? side);
    showSystems([next]);
  };
  const chooseValue = (value: string | null) => {
    const region = value?.startsWith(REGION_PREFIX)
      ? BODY_REGIONS.find((r) => `${REGION_PREFIX}${r.id}` === value)
      : undefined;
    if (!region) {
      choosePart(value ? (partsById.get(value) ?? null) : null);
      return;
    }
    setSelection({ region });
    showSystems(regionParts(region, side, partsByName));
  };
  const needsSide = selection !== null && "region" in selection && selection.region.sided && !side;
  const picked: BodySite | null = !selection
    ? null
    : "part" in selection
      ? { label: selection.part.name, code: selection.part.conceptId, laterality: side }
      : { label: regionLabel(selection.region, side), code: null, laterality: side };

  return (
    <Modal opened onClose={onClose} title={`Pick ${title.toLowerCase()}`} fullScreen>
      <Stack gap="sm" className={classes.drawerBody}>
        <Select
          label="Find a region or structure"
          placeholder="Type a name — knee, right iliac fossa, femur…"
          searchable
          clearable
          limit={SEARCH_LIMIT}
          data={options}
          value={
            !selection
              ? null
              : "part" in selection
                ? selection.part.id
                : `${REGION_PREFIX}${selection.region.id}`
          }
          onChange={chooseValue}
          disabled={!atlas.data}
          nothingFoundMessage="Nothing by that name"
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
                  selectedPartIds={litIds}
                  onPick={choosePart}
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
            {needsSide
              ? "Choose the side"
              : picked
                ? `Selected: ${picked.label}`
                : "Nothing selected yet"}
          </Text>
          <Group gap="xs">
            <Button tone="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              tone="primary"
              disabled={!picked || needsSide}
              onClick={() => picked && onPick(picked)}
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
    </Modal>
  );
}
