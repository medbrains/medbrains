import { Box, Group, Loader, Text } from "@mantine/core";
import { IconAlertTriangle, IconTool } from "@tabler/icons-react";
import { Badge } from "@/components/ui";
import { AI_TOOL_LABELS } from "./tools";
import type { ChatToolCall } from "./transport/types";
import styles from "./unified-response.module.scss";

/** What a finished tool call came to: refused, not run, or done. */
type ToolOutcome = "blocked" | "unchecked" | "done";

const OUTCOME_VIEW: Record<ToolOutcome, { badge: string; tone: "danger" | "warning" | "success" }> =
  {
    blocked: { badge: "BLOCKED", tone: "danger" },
    unchecked: { badge: "Not checked", tone: "warning" },
    done: { badge: "done", tone: "success" },
  };

/**
 * Read the outcome out of a tool result (shape varies by tool). A check that
 * did not run (`checked: false`) is neither blocked nor done — showing it as
 * either would tell the clinician something nobody verified.
 */
export function toolResultInfo(result: unknown): { outcome: ToolOutcome; message?: string } {
  if (!result || typeof result !== "object") return { outcome: "done" };
  const r = result as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v : undefined);
  if (r.checked === false) return { outcome: "unchecked", message: text(r.notes) };
  if (r.decision === "blocked" || r.safe === false) {
    return { outcome: "blocked", message: text(r.message) ?? text(r.notes) };
  }
  return { outcome: "done" };
}

/** A tool-call chip — red when the server BLOCKED the action, amber when a check did not run. */
export function ToolView({ toolCall }: { toolCall: ChatToolCall }) {
  const { outcome, message } = toolResultInfo(toolCall.result);
  const label = AI_TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const running = toolCall.status === "running" || toolCall.status === "pending";
  const flagged = !running && outcome !== "done";
  const view = OUTCOME_VIEW[outcome];
  const boxClass = !flagged
    ? styles.tool
    : outcome === "blocked"
      ? styles.toolBlocked
      : styles.toolUnchecked;

  return (
    <Box className={boxClass}>
      <Group gap={8} wrap="nowrap">
        {flagged ? (
          <IconAlertTriangle size={16} aria-hidden />
        ) : running ? (
          <Loader size={14} />
        ) : (
          <IconTool size={16} aria-hidden />
        )}
        <Text size="xs" fw={flagged ? 700 : 500}>
          {label}
        </Text>
        {!running && (
          <Badge tone={view.tone} size="sm">
            {view.badge}
          </Badge>
        )}
      </Group>
      {flagged && message && (
        <Text
          size="xs"
          mt={4}
          className={outcome === "blocked" ? styles.toolBlockedMsg : undefined}
        >
          {message}
        </Text>
      )}
    </Box>
  );
}
