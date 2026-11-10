import { Group, Stack, Text } from "@mantine/core";
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { useUnmount } from "react-use";
import { AiLabel, Button, IconButton, Slider } from "@/components/ui";
import type { TimelineStep } from "./flow-state";

interface TimelineBarProps {
  steps: TimelineStep[];
  index: number;
  onChange: (index: number) => void;
  forecastBasis: string | null;
}

/** One step a second while playing forward: slow enough to read each map. */
const PLAY_STEP_MS = 1000;

/**
 * Scrub back through today and play forward through the forecast. Play is
 * pausable and stops at the end; Prev/Next step one stop at a time for anyone
 * who prefers no auto-play.
 */
export function TimelineBar({ steps, index, onChange, forecastBasis }: TimelineBarProps) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const at = useRef(index);
  at.current = index;
  const last = steps.length - 1;
  const step = steps[index];

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  };
  const play = () => {
    stop();
    setPlaying(true);
    timer.current = setInterval(() => {
      if (at.current >= last) {
        stop();
        return;
      }
      onChange(at.current + 1);
    }, PLAY_STEP_MS);
  };
  // A timer is an external system: clear it when the screen goes away.
  useUnmount(() => {
    if (timer.current) clearInterval(timer.current);
  });

  if (steps.length < 2) return null;
  const nowIndex = steps.findIndex((s) => s.moment.kind === "live");
  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap">
        <IconButton
          aria-label="Step back"
          onClick={() => onChange(Math.max(0, index - 1))}
          disabled={index === 0}
        >
          <IconPlayerTrackPrev size={16} />
        </IconButton>
        <IconButton
          aria-label={playing ? "Pause" : "Play forward"}
          onClick={playing ? stop : play}
          disabled={!playing && index >= last}
        >
          {playing ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
        </IconButton>
        <IconButton
          aria-label="Step forward"
          onClick={() => onChange(Math.min(last, index + 1))}
          disabled={index >= last}
        >
          <IconPlayerTrackNext size={16} />
        </IconButton>
        <Slider
          flex={1}
          min={0}
          max={last}
          value={index}
          onChange={(v) => {
            stop();
            onChange(v);
          }}
          label={(v) => steps[v]?.label}
          thumbLabel="Time on the floor map"
          marks={nowIndex >= 0 ? [{ value: nowIndex, label: "Now" }] : []}
        />
        {step?.moment.kind !== "live" && (
          <Button tone="ghost" size="xs" onClick={() => onChange(nowIndex)}>
            Back to now
          </Button>
        )}
      </Group>
      <Group gap="xs" mt="md">
        <Text size="sm" fw={600}>
          Showing: {step?.label}
        </Text>
        {step?.moment.kind === "forecast" && forecastBasis && (
          <AiLabel size="xs" explainer={{ title: "Forecast", description: forecastBasis }} />
        )}
      </Group>
    </Stack>
  );
}
