import { useMemo, useState } from "react";
import { Group, SegmentedControl, Stack, Text } from "@mantine/core";
import {
  IconCalculator,
  IconCards,
  IconFileText,
  IconTimeline,
} from "@tabler/icons-react";
import type { PrescriptionWithItems } from "@medbrains/types";
import {
  type FlatItem,
  ProseView,
  TimelineView,
  DoseCalculatorView,
  RuleCardsView,
} from "./prescription-view-panels";

// ── Types ──────────────────────────────────────────────────────

interface PrescriptionViewsProps {
  prescriptions: PrescriptionWithItems[];
  patientName: string;
  uhid: string;
  patientAge?: string;
  patientWeight?: number;
  allergies: string[];
  doctorName?: string;
}

type ViewMode = "prose" | "timeline" | "dose" | "rules";

// ── Helpers ────────────────────────────────────────────────────

function flattenItems(prescriptions: PrescriptionWithItems[]): FlatItem[] {
  return prescriptions.flatMap((rx, rxIndex) =>
    rx.items.map((item) => ({
      ...item,
      rxDate: rx.prescription.created_at,
      rxIndex,
    })),
  );
}

function SegLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Group gap={4} wrap="nowrap">
      {icon}
      <Text size="xs">{text}</Text>
    </Group>
  );
}

// ── Main Component ─────────────────────────────────────────────

export function PrescriptionViews({
  prescriptions,
  patientName,
  uhid,
  patientAge,
  patientWeight,
  allergies,
  doctorName,
}: PrescriptionViewsProps) {
  const [view, setView] = useState<ViewMode>("prose");
  const items = useMemo(() => flattenItems(prescriptions), [prescriptions]);

  if (prescriptions.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No prescriptions to display.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text size="xs" fw={500}>{patientName}</Text>
        <Text size="xs" ff="var(--fc-font-mono, monospace)" c="dimmed">{uhid}</Text>
        {patientAge && <Text size="xs" c="dimmed">{patientAge}</Text>}
      </Group>

      <SegmentedControl
        value={view}
        onChange={(v) => setView(v as ViewMode)}
        data={[
          { label: <SegLabel icon={<IconFileText size={14} />} text="Prose" />, value: "prose" },
          { label: <SegLabel icon={<IconTimeline size={14} />} text="Timeline" />, value: "timeline" },
          { label: <SegLabel icon={<IconCalculator size={14} />} text="Dose Calc" />, value: "dose" },
          { label: <SegLabel icon={<IconCards size={14} />} text="Rules" />, value: "rules" },
        ]}
        size="xs"
        fullWidth
      />

      {view === "prose" && <ProseView items={items} allergies={allergies} doctorName={doctorName} />}
      {view === "timeline" && <TimelineView items={items} />}
      {view === "dose" && <DoseCalculatorView items={items} patientWeight={patientWeight} patientAge={patientAge} />}
      {view === "rules" && <RuleCardsView items={items} />}
    </Stack>
  );
}
