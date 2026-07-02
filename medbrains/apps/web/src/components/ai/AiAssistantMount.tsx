import { Drawer, UnstyledButton } from "@mantine/core";
import { useEffect, useMemo } from "react";
import { AiChatPanel } from "./AiChatPanel";
import { useAiAssistantStore } from "./assistant-store";
import { CrabMascot } from "./CrabMascot";
import { MockTransport } from "./transport/mock";
import { useAiChat } from "./useAiChat";
import styles from "./ai-assistant-mount.module.scss";

const DEFAULT_SUGGESTIONS = [
  "Summarize this patient's labs",
  "Draft a discharge note",
  "Check drug interactions",
];

export interface AiAssistantMountProps {
  suggestions?: string[];
}

/**
 * The app-wide assistant, mounted ONCE in the shell. Renders a floating crab
 * launcher + a right-side drawer, and owns one shared conversation so it
 * persists across surfaces. Any component opens/asks it via `useAiAssistant()`.
 */
export function AiAssistantMount({ suggestions = DEFAULT_SUGGESTIONS }: AiAssistantMountProps) {
  const isOpen = useAiAssistantStore((state) => state.isOpen);
  const close = useAiAssistantStore((state) => state.close);
  const toggle = useAiAssistantStore((state) => state.toggle);
  const pendingQuery = useAiAssistantStore((state) => state.pendingQuery);
  const consumeQuery = useAiAssistantStore((state) => state.consumeQuery);
  const context = useAiAssistantStore((state) => state.context);

  const transport = useMemo(() => new MockTransport(), []);
  const controller = useAiChat({ transport, context });

  // When a surface calls ask(), flush the queued question into the shared thread.
  // Guarded on pendingQuery so re-renders don't re-send (it's cleared on consume).
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire on queue/open changes only
  useEffect(() => {
    if (pendingQuery && isOpen) {
      const query = consumeQuery();
      if (query) void controller.send(query);
    }
  }, [pendingQuery, isOpen]);

  return (
    <>
      {!isOpen && (
        <UnstyledButton
          className={styles.fab}
          onClick={toggle}
          aria-label="Open MedBrains assistant"
        >
          <CrabMascot size={40} pose="greet" />
        </UnstyledButton>
      )}
      <Drawer
        opened={isOpen}
        onClose={close}
        position="right"
        size={440}
        withCloseButton={false}
        padding={0}
        keepMounted
        overlayProps={{ backgroundOpacity: 0.15 }}
        classNames={{ body: styles.drawerBody }}
      >
        <AiChatPanel controller={controller} context={context} suggestions={suggestions} />
      </Drawer>
    </>
  );
}
