import { Group, SegmentedControl, Stack, Text } from "@mantine/core";
import type { PrescriptionWithItems } from "@medbrains/types";
import { IconCalculator, IconCards, IconFileText, IconTimeline } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { OperationalSignal } from "@/components/OperationalSignal";
import {
  DoseCalculatorView,
  type FlatItem,
  ProseView,
  RuleCardsView,
  TimelineView,
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
  const { t } = useTranslation("clinical");
  const [view, setView] = useState<ViewMode>("prose");
  const items = useMemo(() => flattenItems(prescriptions), [prescriptions]);

  if (prescriptions.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        {t("prescriptionViews.empty")}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text size="xs" fw={500}>
          {patientName}
        </Text>
        <Text size="xs" ff="var(--fc-font-mono, monospace)" c="dimmed">
          {uhid}
        </Text>
        {patientAge && (
          <Text size="xs" c="dimmed">
            {patientAge}
          </Text>
        )}
        <OperationalSignal
          label={t("prescriptionViews.signals.itemCount", { count: items.length })}
          shape="token"
          size="xs"
          tone="active"
        />
        <OperationalSignal
          label={t("prescriptionViews.signals.allergyCount", { count: allergies.length })}
          shape={allergies.length > 0 ? "diamond" : "pill"}
          size="xs"
          tone={allergies.length > 0 ? "risk" : "ready"}
        />
      </Group>

      <SegmentedControl
        value={view}
        onChange={(v) => setView(v as ViewMode)}
        data={[
          {
            label: (
              <SegLabel icon={<IconFileText size={14} />} text={t("prescriptionViews.prose")} />
            ),
            value: "prose",
          },
          {
            label: (
              <SegLabel icon={<IconTimeline size={14} />} text={t("prescriptionViews.timeline")} />
            ),
            value: "timeline",
          },
          {
            label: (
              <SegLabel
                icon={<IconCalculator size={14} />}
                text={t("prescriptionViews.doseCalc")}
              />
            ),
            value: "dose",
          },
          {
            label: <SegLabel icon={<IconCards size={14} />} text={t("prescriptionViews.rules")} />,
            value: "rules",
          },
        ]}
        size="xs"
        fullWidth
      />

      {view === "prose" && (
        <ProseView items={items} allergies={allergies} doctorName={doctorName} />
      )}
      {view === "timeline" && <TimelineView items={items} />}
      {view === "dose" && (
        <DoseCalculatorView items={items} patientWeight={patientWeight} patientAge={patientAge} />
      )}
      {view === "rules" && <RuleCardsView items={items} />}
    </Stack>
  );
}
