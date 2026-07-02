import { Box, ScrollArea } from "@mantine/core";
import { type ReactNode, useEffect, useRef } from "react";
import styles from "./conversation.module.scss";

export interface ConversationProps {
  children: ReactNode;
  /** When this value changes the view sticks to the bottom (e.g. streamed length). */
  stickToken?: unknown;
  empty?: ReactNode;
  isEmpty?: boolean;
}

/** Scrollable thread that auto-sticks to the bottom as new content streams in. */
export function Conversation({ children, stickToken, empty, isEmpty }: ConversationProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  // DOM side-effect (external integration): keep the newest turn in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only when stickToken changes (ref is stable)
  useEffect(() => {
    const el = viewportRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [stickToken]);

  return (
    <ScrollArea className={styles.scroll} viewportRef={viewportRef} type="hover">
      {isEmpty ? (
        <Box className={styles.empty}>{empty}</Box>
      ) : (
        <Box className={styles.body}>{children}</Box>
      )}
    </ScrollArea>
  );
}
