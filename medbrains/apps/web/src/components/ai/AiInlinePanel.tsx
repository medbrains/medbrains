import { Box } from "@mantine/core";
import { AiChatPanel } from "./AiChatPanel";
import styles from "./ai-inline-panel.module.scss";
import type { ChatContext, ChatTransport } from "./transport/types";

export interface AiInlinePanelProps {
  context?: ChatContext;
  transport?: ChatTransport;
  title?: string;
  suggestions?: string[];
  height?: number | string;
}

/**
 * An embeddable assistant surface — drop it into a page section (e.g. beside a
 * lab result) for a self-contained conversation, separate from the global one.
 */
export function AiInlinePanel({
  context,
  transport,
  title,
  suggestions,
  height = 440,
}: AiInlinePanelProps) {
  return (
    <Box className={styles.wrap} style={{ height }}>
      <AiChatPanel
        context={context}
        transport={transport}
        title={title}
        suggestions={suggestions}
      />
    </Box>
  );
}
