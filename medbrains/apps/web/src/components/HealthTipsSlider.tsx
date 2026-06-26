import { ActionIcon, Box, Group, Text } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlayerPause,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import classes from "./health-tips-slider.module.scss";

interface HealthTip {
  title: string;
  body: string;
  source: string;
}

// Positive, sourced public-health tips (not "bad news"). Static for now; a
// pluggable health-news feed can replace this later.
const TIPS: HealthTip[] = [
  {
    title: "Move 30 minutes a day",
    body: "At least 150 minutes of moderate activity a week lowers heart-disease, diabetes and stroke risk.",
    source: "World Health Organization",
  },
  {
    title: "Fill half your plate with fruit & veg",
    body: "Five servings a day supports immunity, digestion and long-term health.",
    source: "ICMR–NIN Dietary Guidelines",
  },
  {
    title: "Sleep 7–9 hours",
    body: "Consistent, good-quality sleep improves memory, mood, metabolism and recovery.",
    source: "National Sleep Foundation",
  },
  {
    title: "Wash hands for 20 seconds",
    body: "Hand hygiene is the single most effective way to prevent the spread of infection.",
    source: "CDC",
  },
  {
    title: "Know your numbers",
    body: "Regular blood-pressure, sugar and cholesterol checks catch silent risks early.",
    source: "Indian Heart Association",
  },
  {
    title: "Stay hydrated",
    body: "Water aids circulation, temperature control and kidney function — sip through the day.",
    source: "Harvard T.H. Chan School of Public Health",
  },
];

const ADVANCE_MS = 7000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Accessible auto-advancing health-tips slider for the login panel. Follows the
 * project motion + WCAG rules: pausable (SC 2.2.2), honours prefers-reduced-
 * motion (no auto-advance, no fade), keyboard-operable, and announces the active
 * tip via an aria-live region.
 */
export function HealthTipsSlider() {
  const reduced = prefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduced);

  const go = (next: number) => setIndex((next + TIPS.length) % TIPS.length);

  // External timer (allowed useEffect): auto-advance while playing.
  useEffect(() => {
    if (!playing || reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % TIPS.length), ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [playing, reduced]);

  const tip = TIPS[index];
  if (!tip) return null;

  return (
    <section
      className={classes.slider}
      aria-roledescription="carousel"
      aria-label="Health tips"
      onMouseEnter={() => !reduced && setPlaying(false)}
      onMouseLeave={() => !reduced && setPlaying(true)}
    >
      <Box key={index} className={classes.slide} aria-live="polite">
        <Text className={classes.eyebrow}>Health tip</Text>
        <Text className={classes.title}>{tip.title}</Text>
        <Text className={classes.body}>{tip.body}</Text>
        <Text className={classes.source}>Source: {tip.source}</Text>
      </Box>

      <Group justify="space-between" align="center" mt="md">
        <Group gap={6}>
          {!reduced && (
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={playing ? "Pause health tips" : "Play health tips"}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
            </ActionIcon>
          )}
          <Group gap={6} role="tablist" aria-label="Choose a health tip">
            {TIPS.map((t, i) => (
              <button
                key={t.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Tip ${i + 1} of ${TIPS.length}`}
                className={i === index ? classes.dotActive : classes.dot}
                onClick={() => setIndex(i)}
              />
            ))}
          </Group>
        </Group>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Previous tip"
            onClick={() => go(index - 1)}
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Next tip"
            onClick={() => go(index + 1)}
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      </Group>
    </section>
  );
}
