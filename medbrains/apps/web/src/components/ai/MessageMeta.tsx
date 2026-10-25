import { CopyButton, Group, Text } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { IconButton, Tooltip } from "@/components/ui";
import type { TokenUsage } from "./transport/types";

export interface MessageMetaProps {
  /** The answer as shown, for the copy button. */
  text: string;
  usage?: TokenUsage;
  /** How long the turn took, in ms. */
  elapsedMs?: number;
}

const NUMBER = new Intl.NumberFormat("en-IN");

/** Tokens one turn used, for developers tuning cost (never shown in production). */
function usageLine(u: TokenUsage, elapsedMs?: number): string {
  const input = u.input + u.cacheRead + u.cacheWrite;
  const time = elapsedMs === undefined ? "" : ` · ${(elapsedMs / 1000).toFixed(1)} s`;
  return `${NUMBER.format(input)} in (${NUMBER.format(u.cacheRead)} cached) · ${NUMBER.format(u.output)} out tokens${time}`;
}

/** Under a finished answer: copy it, and (dev builds only) what it cost in tokens. */
export function MessageMeta({ text, usage, elapsedMs }: MessageMetaProps) {
  return (
    <Group gap="xs" wrap="nowrap">
      <CopyButton value={text} timeout={1500}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? "Copied" : "Copy answer"} withArrow>
            <IconButton
              aria-label={copied ? "Answer copied" : "Copy answer"}
              tone={copied ? "success" : "default"}
              size="md"
              onClick={copy}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </IconButton>
          </Tooltip>
        )}
      </CopyButton>
      {import.meta.env.DEV && usage && (
        <Text size="xs" c="dimmed" ff="monospace" data-testid="ai-usage">
          {usageLine(usage, elapsedMs)}
        </Text>
      )}
    </Group>
  );
}
