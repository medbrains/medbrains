import { Sparkline } from "@mantine/charts";
import { Card, Group, Text, ThemeIcon, UnstyledButton } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight, IconMinus } from "@tabler/icons-react";
import type { ReactNode } from "react";

/** How the value sits against a baseline. Tone is good/bad for this measure, not up/down. */
export interface StatComparison {
  text: string;
  tone: "good" | "bad" | "neutral";
  direction: "up" | "down" | "flat";
}

const TONE_COLOR: Record<StatComparison["tone"], string> = {
  good: "success",
  bad: "danger",
  neutral: "var(--mb-text-caption)",
};

const DIRECTION_ICON = {
  up: IconArrowUpRight,
  down: IconArrowDownRight,
  flat: IconMinus,
} as const;

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color?: string;
  comparison?: StatComparison;
  /** A short line under the figure — e.g. the day it is for. */
  note?: string;
  /** Daily values behind the number, oldest first; gaps are unknown days. */
  sparkline?: (number | null)[];
  onClick?: () => void;
  actionLabel?: string;
  /** Controls of the tile's own (compare, expand). With these the card is
   *  not one big button — a control inside a button cannot be reached. */
  actions?: ReactNode;
}

export function StatCard({
  label,
  value,
  icon,
  color = "primary",
  comparison,
  note,
  sparkline,
  onClick,
  actionLabel,
  actions,
}: StatCardProps) {
  const card = (
    <Card className="stat-card" padding="lg" h="100%">
      <Group justify="space-between" mb="sm">
        <Text
          size="xs"
          tt="uppercase"
          c="var(--mb-text-caption)"
          fw={500}
          ff="var(--font-mono, 'JetBrains Mono', monospace)"
          style={{ fontSize: 11 }}
        >
          {label}
        </Text>
        <ThemeIcon variant="light" color={color} size={36} radius="lg">
          {icon}
        </ThemeIcon>
      </Group>
      <Text
        fz={28}
        fw={600}
        lh={1.1}
        c="var(--mb-text-heading)"
        ff="var(--font-display)"
        style={{ fontVariantNumeric: "lining-nums tabular-nums" }}
      >
        {value}
      </Text>
      {comparison && <ComparisonLine comparison={comparison} />}
      {note && (
        <Text size="xs" mt="sm" c="var(--mb-text-caption)">
          {note}
        </Text>
      )}
      {sparkline && sparkline.length > 1 && (
        // The line above says it in words; the shape is for the eye only.
        <Sparkline
          mt="xs"
          h={28}
          data={sparkline}
          connectNulls
          curveType="linear"
          color="var(--mb-text-caption)"
          fillOpacity={0.08}
          strokeWidth={1.5}
          aria-hidden
        />
      )}
      {actions && (
        // The tile's own controls sit at its foot, so the figure stays where
        // the eye goes first and every tile in a row lines up.
        <Group justify="space-between" gap={4} mt="auto" pt="xs" wrap="wrap">
          {actions}
        </Group>
      )}
    </Card>
  );

  if (!onClick || actions) return card;

  return (
    <UnstyledButton
      onClick={onClick}
      aria-label={actionLabel ?? `Open ${label}`}
      style={{ display: "block", width: "100%" }}
    >
      {card}
    </UnstyledButton>
  );
}

function ComparisonLine({ comparison }: { comparison: StatComparison }) {
  const Icon = DIRECTION_ICON[comparison.direction];
  // The arrow takes the line's colour; the words carry the meaning on their own.
  return (
    <Group gap={4} mt="sm" wrap="nowrap" c={TONE_COLOR[comparison.tone]}>
      <Icon size={14} stroke={2} aria-hidden />
      <Text size="xs" c="inherit" fw={500}>
        {comparison.text}
      </Text>
    </Group>
  );
}
