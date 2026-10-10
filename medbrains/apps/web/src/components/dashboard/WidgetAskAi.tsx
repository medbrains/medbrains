import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { DashboardWidget } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMemo } from "react";
import { AiInlinePanel, SseTransport } from "@/components/ai";
import type { KpiBaseline } from "./kpi-reading";
import { useReportWidgetData } from "./useReportWidgetData";
import { widgetAiContext } from "./widget-ai-context";

interface Props {
  widget: DashboardWidget;
  data: unknown;
  compare: KpiBaseline;
}

const SUGGESTIONS = [
  "What stands out here?",
  "How does today compare with the usual day, and why might it differ?",
  "What should I check next?",
];

/** Ask the assistant about the widget open in front of you. */
// Default export for React.lazy: the assistant loads when its tab opens.
export default function WidgetAskAi({ widget, data, compare }: Props) {
  const canAsk = useHasPermission(P.AI.ASSISTANT.USE);
  // The real assistant — the panel's own default is a mock that would answer
  // with invented text.
  const transport = useMemo(() => new SseTransport(), []);
  const reportId = widget.data_source?.type === "report" ? widget.data_source.report_id : undefined;
  const { shape } = useReportWidgetData(reportId);
  const context = useMemo(
    () => widgetAiContext(widget, data, compare, shape),
    [widget, data, compare, shape],
  );
  if (!canAsk) return null;
  return (
    <Stack gap="xs">
      <Text fw={600}>Ask about this</Text>
      <Text size="xs" c="dimmed">
        The assistant sees this widget's figures, not the patients behind them.
      </Text>
      <AiInlinePanel
        transport={transport}
        context={context}
        title={widget.title}
        suggestions={SUGGESTIONS}
        height={380}
      />
    </Stack>
  );
}
